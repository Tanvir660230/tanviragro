import { HealthEngine } from "@/lib/livestock/health-engine";
import {
  InvalidVitalSignsError,
  PrescriptionDosageError,
  UnauthorizedMedicalActionError,
} from "@/lib/livestock/errors";
import type { VitalSigns } from "@/lib/livestock/types";

describe("Enterprise Animal Health & Medical Engine", () => {
  describe("Vital Signs Validation", () => {
    it("should accept normal physiological vitals without warnings or errors", () => {
      const normalVitals: VitalSigns = {
        temperatureCelsius: 38.6,
        heartRateBpm: 64,
        respirationRateBpm: 24,
        bodyConditionScore: 3.25,
        rumenMotilityPer2Min: 3,
        recordedAt: "2026-09-09",
      };

      const result = HealthEngine.validateVitals(normalVitals);
      expect(result.isValid).toBe(true);
      expect(result.isCritical).toBe(false);
      expect(result.warnings).toHaveLength(0);
    });

    it("should flag severe hyperthermia / fever as critical warning", () => {
      const feverVitals: VitalSigns = {
        temperatureCelsius: 41.2,
        heartRateBpm: 115,
        respirationRateBpm: 55,
        recordedAt: "2026-09-09",
      };

      const result = HealthEngine.validateVitals(feverVitals);
      expect(result.isValid).toBe(true);
      expect(result.isCritical).toBe(true);
      expect(result.warnings.some((w) => w.includes("Hyperthermia"))).toBe(true);
      expect(result.warnings.some((w) => w.includes("Tachycardia"))).toBe(true);
      expect(result.warnings.some((w) => w.includes("Tachypnea"))).toBe(true);
    });

    it("should detect complete rumen stasis as critical", () => {
      const stasisVitals: VitalSigns = {
        rumenMotilityPer2Min: 0,
        recordedAt: "2026-09-09",
      };

      const result = HealthEngine.validateVitals(stasisVitals);
      expect(result.isCritical).toBe(true);
      expect(result.warnings.some((w) => w.includes("Rumen Stasis"))).toBe(true);
    });

    it("should throw InvalidVitalSignsError for biologically impossible temperature", () => {
      expect(() => {
        HealthEngine.validateVitals({
          temperatureCelsius: 49.5,
          recordedAt: "2026-09-09",
        });
      }).toThrow(InvalidVitalSignsError);

      expect(() => {
        HealthEngine.validateVitals({
          temperatureCelsius: 22.0,
          recordedAt: "2026-09-09",
        });
      }).toThrow(InvalidVitalSignsError);
    });

    it("should throw InvalidVitalSignsError for out-of-bounds BCS or heart rate", () => {
      expect(() => {
        HealthEngine.validateVitals({
          bodyConditionScore: 6.5,
          recordedAt: "2026-09-09",
        });
      }).toThrow(InvalidVitalSignsError);

      expect(() => {
        HealthEngine.validateVitals({
          heartRateBpm: 250,
          recordedAt: "2026-09-09",
        });
      }).toThrow(InvalidVitalSignsError);
    });
  });

  describe("Prescription Dosage Engine", () => {
    it("should calculate correct weight-adjusted dosage", () => {
      const dose = HealthEngine.calculatePrescriptionDosage(450, 2.5);
      expect(dose).toBe(11.25);
    });

    it("should round dosage accurately", () => {
      const dose = HealthEngine.calculatePrescriptionDosage(333, 1.33);
      expect(dose).toBe(4.429);
    });

    it("should throw PrescriptionDosageError on invalid weight or rate", () => {
      expect(() => {
        HealthEngine.calculatePrescriptionDosage(0, 2.5);
      }).toThrow(PrescriptionDosageError);

      expect(() => {
        HealthEngine.calculatePrescriptionDosage(300, -1);
      }).toThrow(PrescriptionDosageError);
    });
  });

  describe("Food Safety & Drug Withdrawal Period", () => {
    it("should compute correct withdrawal end date", () => {
      const administeredDate = "2026-09-01";
      const withdrawalDays = 14;
      const endDate = HealthEngine.calculateWithdrawalPeriod(administeredDate, withdrawalDays);
      expect(endDate).toBe("2026-09-15");
    });

    it("should accurately assess withdrawal embargo status", () => {
      const withdrawalUntil = "2026-09-15";
      expect(HealthEngine.isUnderWithdrawal(withdrawalUntil, "2026-09-10")).toBe(true);
      expect(HealthEngine.isUnderWithdrawal(withdrawalUntil, "2026-09-15")).toBe(true);
      expect(HealthEngine.isUnderWithdrawal(withdrawalUntil, "2026-09-16")).toBe(false);
    });
  });

  describe("Intelligent Health Risk Alert Evaluation", () => {
    // The engine reads the real clock; pin it so fixture dates stay relative to "today".
    beforeAll(() => {
      jest.useFakeTimers({ now: new Date("2026-09-10T06:00:00Z") });
    });
    afterAll(() => {
      jest.useRealTimers();
    });

    const mockCattle = {
      id: "cattle-123",
      tag_id: "TAG-901",
      is_quarantined: false,
      withdrawal_end_date: "2026-09-20",
    };

    it("should generate alerts for overdue vaccines and active withdrawal embargo", () => {
      const mockEvents = [
        {
          id: "evt-1",
          title: "FMD Vaccine",
          event_type: "vaccine" as const,
          scheduled_at: "2026-09-01",
          completed_at: null,
        },
      ];

      const alerts = HealthEngine.evaluateAnimalHealthRisk(
        mockCattle,
        mockEvents,
        [{ id: "tr-1", diagnosis: "BRD", treated_at: "2026-09-02" }]
      );

      expect(alerts.length).toBeGreaterThanOrEqual(2);
      expect(alerts.some((a) => a.type === "overdue_vaccine")).toBe(true);
      expect(alerts.some((a) => a.type === "active_withdrawal")).toBe(true);
    });

    it("should generate quarantine alert when cattle is quarantined", () => {
      const alerts = HealthEngine.evaluateAnimalHealthRisk(
        { ...mockCattle, is_quarantined: true, withdrawal_end_date: null },
        [],
        []
      );
      expect(alerts.some((a) => a.type === "quarantine_alert")).toBe(true);
    });
  });

  describe("Health Certificate Generation", () => {
    it("should compile a comprehensive and valid health certificate", () => {
      const mockCattle = {
        id: "cattle-456",
        tag_id: "COW-042",
        breed: "Brahman Cross",
        gender: "female",
        dob: "2024-03-01",
        purchase_date: "2024-04-01",
        status: "active",
        is_quarantined: false,
        withdrawal_end_date: null,
      };

      const mockEvents = [
        { title: "FMD Vaccine", event_type: "vaccine" as const, completed_at: "2026-05-10", scheduled_at: "2026-05-10" },
        { title: "Anthrax Vaccine", event_type: "vaccine" as const, completed_at: "2026-06-15", scheduled_at: "2026-06-15" },
      ];

      const cert = HealthEngine.compileHealthCertificate(
        mockCattle,
        420,
        mockEvents,
        [],
        "Dr. Rafiqul Islam, DVM"
      );

      expect(cert.tagId).toBe("COW-042");
      expect(cert.breed).toBe("Brahman Cross");
      expect(cert.currentWeightKg).toBe(420);
      expect(cert.isFitForSaleOrSlaughter).toBe(true);
      expect(cert.isVaccinatedUpToDate).toBe(true);
      expect(cert.completedVaccinations).toHaveLength(2);
      expect(cert.certifiedBy).toBe("Dr. Rafiqul Islam, DVM");
    });
  });

  describe("Medical RBAC Permissions", () => {
    it("should allow authorized roles to prescribe and administer", () => {
      expect(HealthEngine.validateMedicalPermission("prescribe", "owner")).toBe(true);
      expect(HealthEngine.validateMedicalPermission("prescribe", "veterinarian")).toBe(true);
      expect(HealthEngine.validateMedicalPermission("administer", "staff")).toBe(true);
    });

    it("should deny staff and viewers from prescribing medicines", () => {
      expect(() => {
        HealthEngine.validateMedicalPermission("prescribe", "staff");
      }).toThrow(UnauthorizedMedicalActionError);

      expect(() => {
        HealthEngine.validateMedicalPermission("prescribe", "viewer");
      }).toThrow(UnauthorizedMedicalActionError);
    });
  });

});

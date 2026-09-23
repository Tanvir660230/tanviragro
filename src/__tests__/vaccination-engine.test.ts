import {
  VaccinationEngine,
  type AdverseReactionRecord,
} from "@/lib/livestock/vaccination-engine";

describe("VaccinationEngine Domain & Immunization Suite", () => {
  describe("Schedule Generation for New Animal", () => {
    it("generates deterministic standard immunization schedule based on purchase date", () => {
      const animal = {
        id: "cattle-101",
        tagId: "TAG-101",
        purchaseDate: "2026-01-01",
      };
      const schedule = VaccinationEngine.generateScheduleForAnimal(animal);

      expect(schedule.length).toBeGreaterThanOrEqual(4);

      // Check first protocol (FMD at 7 days -> 2026-01-08)
      const fmd1 = schedule.find((s) => s.vaccineCode === "fmd" && !s.isBooster);
      expect(fmd1).toBeDefined();
      expect(fmd1?.scheduledAt).toBe("2026-01-08");

      // Check HS at 14 days -> 2026-01-15
      const hs = schedule.find((s) => s.vaccineCode === "hs");
      expect(hs).toBeDefined();
      expect(hs?.scheduledAt).toBe("2026-01-15");

      // Check FMD booster (+28 days after 1st dose -> Day 35 = 2026-02-05)
      const fmdBooster = schedule.find((s) => s.vaccineCode === "fmd" && s.isBooster);
      expect(fmdBooster).toBeDefined();
      expect(fmdBooster?.scheduledAt).toBe("2026-02-05");

      // Check Anthrax at 45 days (2026-02-15)
      const anthrax = schedule.find((s) => s.vaccineCode === "anthrax");
      expect(anthrax).toBeDefined();
      expect(anthrax?.scheduledAt).toBe("2026-02-15");

      // Check LSD at 60 days (2026-03-02)
      const lsd = schedule.find((s) => s.vaccineCode === "lsd");
      expect(lsd).toBeDefined();
      expect(lsd?.scheduledAt).toBe("2026-03-02");
    });
  });

  describe("Compliance & Vaccine Status Evaluation", () => {
    it("returns 'never' when animal has never received the vaccine", () => {
      const status = VaccinationEngine.evaluateVaccineStatus(null, 180, "2026-06-01");
      expect(status.status).toBe("never");
      expect(status.nextDueDate).toBeNull();
    });

    it("evaluates active compliant status with remaining days", () => {
      const lastGiven = "2026-01-01";
      const intervalDays = 180;
      const refDate = "2026-04-01";

      const status = VaccinationEngine.evaluateVaccineStatus(lastGiven, intervalDays, refDate);
      expect(status.status).toBe("ok");
      expect(status.daysRemaining).toBe(90);
      expect(status.nextDueDate).toBe("2026-06-30");
    });

    it("evaluates 'due' when within 14 days of due date", () => {
      const lastGiven = "2026-01-01";
      const intervalDays = 180;
      const refDate = "2026-06-20";

      const status = VaccinationEngine.evaluateVaccineStatus(lastGiven, intervalDays, refDate);
      expect(status.status).toBe("due");
      expect(status.daysRemaining).toBe(10);
    });

    it("evaluates 'overdue' when reference date is past due date", () => {
      const lastGiven = "2026-01-01";
      const intervalDays = 180;
      const refDate = "2026-07-05";

      const status = VaccinationEngine.evaluateVaccineStatus(lastGiven, intervalDays, refDate);
      expect(status.status).toBe("overdue");
      expect(status.daysRemaining).toBeLessThan(0);
    });
  });

  describe("Booster Date Calculation", () => {
    it("calculates exact calendar date for secondary booster", () => {
      const administered = "2026-03-01";
      const boosterDate = VaccinationEngine.calculateNextBoosterDate(administered, 28);
      expect(boosterDate).toBe("2026-03-29");
    });
  });

  describe("Mass Campaign Metrics Calculation", () => {
    it("computes completion percentages and pending counts accurately", () => {
      const metrics = VaccinationEngine.calculateCampaignMetrics(
        { targetCount: 50 },
        25,
        2
      );

      expect(metrics.completionPercentage).toBe(50);
      expect(metrics.pendingCount).toBe(25);
      expect(metrics.isCompleted).toBe(false);
      expect(metrics.overdueCount).toBe(2);
    });
  });

  describe("Reminders & Operational Alerts Evaluation", () => {
    it("identifies overdue vaccinations, upcoming events, low stock, and adverse follow-ups", () => {
      const todayISO = "2026-06-15";

      const healthEvents = [
        {
          id: "ev-1",
          cattle_id: "c-1",
          title: "FMD Trivalent Primary",
          event_type: "vaccine",
          scheduled_at: "2026-06-10",
          completed_at: null,
          cattle: { tag_id: "TAG-001" },
        },
        {
          id: "ev-2",
          cattle_id: "c-2",
          title: "Anthrax Spore Prophylaxis",
          event_type: "vaccine",
          scheduled_at: "2026-06-18",
          completed_at: null,
          cattle: { tag_id: "TAG-002" },
        },
      ];

      const medicineStock = [
        {
          id: "med-1",
          name: "FMD Inactivated Vaccine (Vial)",
          qty: 2,
          min_threshold: 10,
        },
      ];

      const adverseEvents: AdverseReactionRecord[] = [
        {
          id: "adv-1",
          cattleId: "c-3",
          cattleTag: "TAG-003",
          vaccineName: "Anthrax Spore",
          reactionType: "anaphylaxis",
          severity: "critical",
          symptoms: "Acute respiratory distress and trembling",
          administeredAt: "2026-06-14",
          reportedAt: "2026-06-14",
          requiresQuarantine: true,
          recovered: false,
        },
      ];

      const alerts = VaccinationEngine.evaluateReminders(
        healthEvents,
        medicineStock,
        adverseEvents,
        todayISO
      );

      expect(alerts.length).toBe(4);

      const overdueAlert = alerts.find((a) => a.type === "overdue");
      expect(overdueAlert?.cattleTag).toBe("TAG-001");
      expect(overdueAlert?.severity).toBe("critical");

      const upcomingAlert = alerts.find((a) => a.type === "upcoming");
      expect(upcomingAlert?.cattleTag).toBe("TAG-002");
      expect(upcomingAlert?.severity).toBe("medium");

      const stockAlert = alerts.find((a) => a.type === "low_stock");
      expect(stockAlert?.severity).toBe("high");

      const adverseAlert = alerts.find((a) => a.type === "adverse_followup");
      expect(adverseAlert?.cattleTag).toBe("TAG-003");
      expect(adverseAlert?.severity).toBe("critical");
    });
  });

  describe("Role-Based Access Control (RBAC)", () => {
    it("authorizes veterinarians and managers for all clinical actions", () => {
      expect(VaccinationEngine.checkVaccineRBAC("veterinarian", "administer").allowed).toBe(true);
      expect(VaccinationEngine.checkVaccineRBAC("manager", "bulk_campaign").allowed).toBe(true);
      expect(VaccinationEngine.checkVaccineRBAC("owner", "edit_protocols").allowed).toBe(true);
    });

    it("restricts unauthorized roles from administering vaccines", () => {
      const res = VaccinationEngine.checkVaccineRBAC("viewer", "administer");
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("not authorized");
    });
  });
});

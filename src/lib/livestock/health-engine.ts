import type { HealthEventType, UserRole } from "@/types/database";
import type {
  HealthProtocolRecord,
  VitalSigns,
  PrescriptionItem,
  ClinicalVisitRecord,
  HealthAlert,
  HealthCertificateSummary,
} from "./types";
import { DEFAULT_HEALTH_PROTOCOL, type ProtocolStep } from "@/lib/healthProtocol";
import {
  InvalidVitalSignsError,
  PrescriptionDosageError,
  UnauthorizedMedicalActionError,
} from "./errors";
import { todayDhaka } from "@/lib/dates";

export function addDaysToDate(dateStr: string, days: number): string {
  const parts = dateStr.slice(0, 10).split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2] + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type MedicalActionType =
  | "prescribe"
  | "administer"
  | "record_vitals"
  | "issue_certificate"
  | "quarantine"
  | "order_lab_test";

export const MEDICAL_RBAC_PERMISSIONS: Record<MedicalActionType, UserRole[]> = {
  prescribe: ["owner", "manager", "veterinarian"],
  administer: ["owner", "manager", "veterinarian", "staff"],
  record_vitals: ["owner", "manager", "veterinarian", "staff"],
  issue_certificate: ["owner", "manager", "veterinarian"],
  quarantine: ["owner", "manager", "veterinarian", "staff"],
  order_lab_test: ["owner", "manager", "veterinarian"],
};

export class HealthEngine {
  /**
   * Validates user role permissions for a medical action.
   */
  public static validateMedicalPermission(
    action: MedicalActionType,
    role: UserRole
  ): boolean {
    const allowed = MEDICAL_RBAC_PERMISSIONS[action] || [];
    if (!allowed.includes(role)) {
      throw new UnauthorizedMedicalActionError(action, role);
    }
    return true;
  }

  /**
   * Validates physiological vital signs against bovine biological constraints.
   */
  public static validateVitals(vitals: VitalSigns): {
    isValid: boolean;
    isCritical: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let isCritical = false;

    if (vitals.temperatureCelsius != null) {
      if (vitals.temperatureCelsius < 30 || vitals.temperatureCelsius > 44) {
        throw new InvalidVitalSignsError(
          "Body Temperature",
          vitals.temperatureCelsius,
          "30.0°C to 44.0°C (Normal: 38.0°C - 39.5°C)"
        );
      }
      if (vitals.temperatureCelsius > 40.5) {
        warnings.push(`High Fever / Hyperthermia detected: ${vitals.temperatureCelsius.toFixed(1)}°C`);
        isCritical = true;
      } else if (vitals.temperatureCelsius < 37.5) {
        warnings.push(`Hypothermia warning: ${vitals.temperatureCelsius.toFixed(1)}°C`);
        isCritical = true;
      }
    }

    if (vitals.heartRateBpm != null) {
      if (vitals.heartRateBpm < 30 || vitals.heartRateBpm > 200) {
        throw new InvalidVitalSignsError(
          "Heart Rate",
          vitals.heartRateBpm,
          "30 to 200 bpm (Normal: 48 - 84 bpm)"
        );
      }
      if (vitals.heartRateBpm > 110) {
        warnings.push(`Severe Tachycardia: ${vitals.heartRateBpm} bpm`);
        isCritical = true;
      } else if (vitals.heartRateBpm < 42) {
        warnings.push(`Severe Bradycardia: ${vitals.heartRateBpm} bpm`);
        isCritical = true;
      }
    }

    if (vitals.respirationRateBpm != null) {
      if (vitals.respirationRateBpm < 5 || vitals.respirationRateBpm > 120) {
        throw new InvalidVitalSignsError(
          "Respiration Rate",
          vitals.respirationRateBpm,
          "5 to 120 bpm (Normal: 15 - 35 bpm)"
        );
      }
      if (vitals.respirationRateBpm > 50) {
        warnings.push(`Severe Tachypnea: ${vitals.respirationRateBpm} bpm`);
        isCritical = true;
      }
    }

    if (vitals.bodyConditionScore != null) {
      if (vitals.bodyConditionScore < 1.0 || vitals.bodyConditionScore > 5.0) {
        throw new InvalidVitalSignsError(
          "Body Condition Score",
          vitals.bodyConditionScore,
          "1.0 to 5.0 (Bovine 5-point scale)"
        );
      }
      if (vitals.bodyConditionScore < 2.0) {
        warnings.push(`Severely emaciated BCS: ${vitals.bodyConditionScore}`);
      }
    }

    if (vitals.rumenMotilityPer2Min != null) {
      if (vitals.rumenMotilityPer2Min < 0 || vitals.rumenMotilityPer2Min > 10) {
        throw new InvalidVitalSignsError(
          "Rumen Motility",
          vitals.rumenMotilityPer2Min,
          "0 to 10 contractions per 2 min (Normal: 2 - 3)"
        );
      }
      if (vitals.rumenMotilityPer2Min === 0) {
        warnings.push("Rumen Stasis / Complete Atony detected");
        isCritical = true;
      }
    }

    return { isValid: true, isCritical, warnings };
  }

  /**
   * Calculates weight-adjusted drug dosage.
   */
  public static calculatePrescriptionDosage(
    weightKg: number,
    dosePer100kg: number
  ): number {
    if (weightKg <= 0) {
      throw new PrescriptionDosageError("Cattle weight must be greater than zero to calculate dosage.");
    }
    if (dosePer100kg <= 0) {
      throw new PrescriptionDosageError("Dose rate per 100kg must be positive.");
    }
    return parseFloat(((weightKg / 100) * dosePer100kg).toFixed(3));
  }
  /**
   * Generates standard intake vaccination and deworming schedule for new cattle.
   */
  public static generateIntakeProtocol(
    cattleId: string,
    businessId: string,
    purchaseDate: string,
    customProtocol: ProtocolStep[] = DEFAULT_HEALTH_PROTOCOL
  ): HealthProtocolRecord[] {
    return customProtocol.map((step) => {
      const scheduledAt = addDaysToDate(purchaseDate, step.dayOffset);
      return {
        cattleId,
        businessId,
        title: step.title,
        eventType: step.eventType,
        scheduledAt,
        notes: step.notes,
      };
    });
  }

  /**
   * Calculates drug withdrawal end date for food safety compliance.
   */
  public static calculateWithdrawalPeriod(
    administeredDate: string,
    withdrawalDays: number
  ): string {
    return addDaysToDate(administeredDate, withdrawalDays);
  }

  /**
   * Checks if an animal has an active withdrawal restriction.
   */
  public static isUnderWithdrawal(
    withdrawalUntil?: string | null,
    asOf?: string
  ): boolean {
    if (!withdrawalUntil) return false;
    const today = asOf ?? todayDhaka();
    return withdrawalUntil >= today;
  }


  /**
   * Evaluates animal health condition and detects intelligent automated alerts.
   */
  public static evaluateAnimalHealthRisk(
    cattle: {
      id: string;
      tag_id: string;
      is_quarantined: boolean;
      withdrawal_end_date?: string | null;
    },
    events: {
      id: string;
      title: string;
      event_type: HealthEventType;
      scheduled_at: string;
      completed_at?: string | null;
    }[],
    treatments: {
      id: string;
      diagnosis: string | null;
      treated_at: string;
    }[],
    latestVitals?: VitalSigns
  ): HealthAlert[] {
    const alerts: HealthAlert[] = [];
    const today = todayDhaka();

    // 1. Overdue Vaccines / Protocols
    const pendingEvents = events.filter((e) => !e.completed_at);
    const overdueEvents = pendingEvents.filter((e) => e.scheduled_at < today);

    for (const evt of overdueEvents) {
      alerts.push({
        id: `alert-overdue-${evt.id}`,
        cattleId: cattle.id,
        tagId: cattle.tag_id,
        type: "overdue_vaccine",
        severity: evt.event_type === "vaccine" ? "high" : "medium",
        title: `Overdue Health Event: ${evt.title}`,
        description: `Scheduled on ${evt.scheduled_at} but not marked as completed.`,
        actionRequired: "Administer protocol and mark completed or reschedule.",
        dueDate: evt.scheduled_at,
      });
    }

    // 2. Active Drug Withdrawal Embargo
    if (cattle.withdrawal_end_date && cattle.withdrawal_end_date >= today) {
      alerts.push({
        id: `alert-withdrawal-${cattle.id}`,
        cattleId: cattle.id,
        tagId: cattle.tag_id,
        type: "active_withdrawal",
        severity: "high",
        title: "Active Drug Withdrawal Embargo",
        description: `Animal is under drug withdrawal until ${cattle.withdrawal_end_date}. Meat/milk cannot be sold.`,
        actionRequired: "Enforce biological sales embargo until clearance date.",
        dueDate: cattle.withdrawal_end_date,
      });
    }

    // 3. Quarantine Alert
    if (cattle.is_quarantined) {
      alerts.push({
        id: `alert-quarantine-${cattle.id}`,
        cattleId: cattle.id,
        tagId: cattle.tag_id,
        type: "quarantine_alert",
        severity: "medium",
        title: "Active Quarantine / Isolation",
        description: "Animal is marked in quarantine isolation.",
        actionRequired: "Perform routine clinical check and evaluate recovery for clearance.",
      });
    }

    // 4. Repeated Illness
    if (treatments.length >= 3) {
      alerts.push({
        id: `alert-repeated-illness-${cattle.id}`,
        cattleId: cattle.id,
        tagId: cattle.tag_id,
        type: "repeated_condition",
        severity: "medium",
        title: "Frequent Medical Treatments Logged",
        description: `Animal has received ${treatments.length} medical treatments. Potential chronic vulnerability.`,
        actionRequired: "Perform comprehensive diagnostic workup or lab tests.",
      });
    }

    // 5. Vital Sign Anomalies
    if (latestVitals) {
      const { isCritical, warnings } = this.validateVitals(latestVitals);
      if (isCritical || warnings.length > 0) {
        alerts.push({
          id: `alert-vitals-${cattle.id}`,
          cattleId: cattle.id,
          tagId: cattle.tag_id,
          type: "vital_anomaly",
          severity: isCritical ? "critical" : "high",
          title: "Vital Sign Abnormality",
          description: warnings.join("; "),
          actionRequired: "Immediate veterinarian examination required.",
        });
      }
    }

    return alerts;
  }

  /**
   * Compiles an exportable Health Clearance & Certificate summary.
   */
  public static compileHealthCertificate(
    cattle: {
      id: string;
      tag_id: string;
      breed: string | null;
      gender: string;
      dob?: string | null;
      purchase_date?: string | null;
      status: string;
      is_quarantined: boolean;
      withdrawal_end_date?: string | null;
    },
    weightKg: number,
    events: {
      title: string;
      event_type: HealthEventType;
      completed_at?: string | null;
      scheduled_at: string;
    }[],
    treatments: {
      diagnosis: string | null;
      treated_at: string;
      inventory_items?: { name: string } | null;
    }[],
    certifyingVet: string
  ): HealthCertificateSummary {
    const today = todayDhaka();
    const completedVaccines = events
      .filter((e) => e.event_type === "vaccine" && e.completed_at)
      .map((e) => ({ title: e.title, completedAt: e.completed_at! }));

    const isUnderWithdrawal = this.isUnderWithdrawal(cattle.withdrawal_end_date, today);
    const isFitForSale = !cattle.is_quarantined && !isUnderWithdrawal && cattle.status === "active";

    const refDate = cattle.dob ?? cattle.purchase_date ?? today;
    const diffMs = Date.now() - new Date(refDate).getTime();
    const ageMonths = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.4375)));

    return {
      certificateId: `HC-${cattle.tag_id}-${today.replace(/-/g, "")}`,
      cattleId: cattle.id,
      tagId: cattle.tag_id,
      breed: cattle.breed,
      gender: cattle.gender,
      ageMonths,
      currentWeightKg: weightKg,
      overallStatus: cattle.is_quarantined ? "Quarantined" : cattle.status,
      isVaccinatedUpToDate: completedVaccines.length >= 2,
      activeWithdrawalPeriod: isUnderWithdrawal,
      withdrawalEndDate: cattle.withdrawal_end_date,
      completedVaccinations: completedVaccines,
      recentTreatments: treatments.slice(0, 5).map((t) => ({
        diagnosis: t.diagnosis ?? "General Treatment",
        treatedAt: t.treated_at,
        vetName: certifyingVet,
      })),
      isFitForSaleOrSlaughter: isFitForSale,
      certifiedAt: today,
      certifiedBy: certifyingVet,
    };
  }
}
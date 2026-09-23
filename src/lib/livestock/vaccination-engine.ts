import type { HealthEventType, UserRole } from "@/types/database";

export type VaccineCode = "fmd" | "hs" | "bq" | "anthrax" | "lsd" | "brucellosis" | "ppr" | "custom";

export type AdministrationRoute = "IM" | "SC" | "IV" | "Oral" | "Intranasal" | "Topical";

export type ReactionSeverity = "mild" | "moderate" | "severe" | "critical";

export type ReactionType = 
  | "anaphylaxis"
  | "local_swelling"
  | "injection_abscess"
  | "high_fever"
  | "lethargy"
  | "respiratory_distress"
  | "abortion"
  | "other";

export interface VaccineProgramRule {
  id: string;
  vaccineCode: VaccineCode;
  vaccineName: string;
  manufacturer?: string;
  defaultDoseMl: number;
  route: AdministrationRoute;
  primaryAgeWeeks?: number;
  primaryWeightKg?: number;
  boosterIntervalDays?: number; // e.g. 28 days post 1st dose
  repeatIntervalDays: number; // e.g. 180 or 365
  targetSpecies: ("cattle" | "goat" | "sheep" | "buffalo" | "all")[];
  isMandatory: boolean;
  withdrawalDays: number;
  coldChainTempC?: string;
  description: string;
}

export interface VaccinationCampaign {
  id: string;
  title: string;
  vaccineCode: VaccineCode;
  vaccineName: string;
  targetCount: number;
  completedCount: number;
  startDate: string;
  endDate: string;
  targetPens?: string[];
  status: "draft" | "in_progress" | "completed" | "cancelled";
  notes?: string;
}

export interface AdverseReactionRecord {
  id: string;
  cattleId: string;
  cattleTag: string;
  vaccineName: string;
  batchNumber?: string;
  administeredAt: string;
  reportedAt: string;
  reactionType: ReactionType;
  severity: ReactionSeverity;
  symptoms: string;
  treatmentAdministered?: string;
  veterinarianNotes?: string;
  requiresQuarantine: boolean;
  followUpDate?: string;
  recovered: boolean;
}

export interface VaccinationExecutionParams {
  cattleId: string;
  cattleTag: string;
  vaccineItemId?: string | null;
  vaccineName: string;
  vaccineCode?: VaccineCode;
  batchNumber?: string;
  manufacturer?: string;
  doseAdministeredMl: number;
  route: AdministrationRoute;
  administeredBy: string;
  administeredAt: string;
  scheduleBooster: boolean;
  boosterDays?: number;
  notes?: string;
}

export const STANDARD_VACCINE_PROGRAMS: readonly VaccineProgramRule[] = [
  {
    id: "prog_fmd",
    vaccineCode: "fmd",
    vaccineName: "Foot & Mouth Disease (FMD / খুরারোগ)",
    manufacturer: "DLS Bangladesh / Bioveta",
    defaultDoseMl: 2.0,
    route: "SC",
    primaryAgeWeeks: 16,
    boosterIntervalDays: 28,
    repeatIntervalDays: 180,
    targetSpecies: ["cattle", "buffalo", "sheep", "goat", "all"],
    isMandatory: true,
    withdrawalDays: 0,
    coldChainTempC: "2°C – 8°C",
    description: "Inactivated trivalent / quadrivalent vaccine against Foot and Mouth Disease aphthovirus.",
  },
  {
    id: "prog_hs",
    vaccineCode: "hs",
    vaccineName: "Hemorrhagic Septicemia (HS / গলাফুলা)",
    manufacturer: "DLS Bangladesh / Incepta",
    defaultDoseMl: 3.0,
    route: "SC",
    primaryAgeWeeks: 24,
    repeatIntervalDays: 365,
    targetSpecies: ["cattle", "buffalo", "all"],
    isMandatory: true,
    withdrawalDays: 0,
    coldChainTempC: "2°C – 8°C",
    description: "Adjuvanted Pasteurella multocida bacterin preventing acute septicemic pasteurellosis.",
  },
  {
    id: "prog_bq",
    vaccineCode: "bq",
    vaccineName: "Black Quarter (BQ / বাদলা)",
    manufacturer: "DLS Bangladesh",
    defaultDoseMl: 5.0,
    route: "SC",
    primaryAgeWeeks: 24,
    repeatIntervalDays: 365,
    targetSpecies: ["cattle", "sheep", "all"],
    isMandatory: true,
    withdrawalDays: 0,
    coldChainTempC: "2°C – 8°C",
    description: "Formalin-inactivated Clostridium chauvoei culture for blackleg protection.",
  },
  {
    id: "prog_anthrax",
    vaccineCode: "anthrax",
    vaccineName: "Anthrax Spore Vaccine (Anthrax / তড়কা)",
    manufacturer: "DLS Bangladesh (Sterne 34F2)",
    defaultDoseMl: 1.0,
    route: "SC",
    primaryAgeWeeks: 24,
    repeatIntervalDays: 365,
    targetSpecies: ["cattle", "buffalo", "sheep", "goat", "all"],
    isMandatory: true,
    withdrawalDays: 14,
    coldChainTempC: "2°C – 8°C",
    description: "Live avirulent Bacillus anthracis spore vaccine for active immunization.",
  },
  {
    id: "prog_lsd",
    vaccineCode: "lsd",
    vaccineName: "Lumpy Skin Disease (LSD / লাম্পি স্কিন)",
    manufacturer: "Neethling / Heterologous Goat Pox Strain",
    defaultDoseMl: 2.0,
    route: "SC",
    primaryAgeWeeks: 12,
    repeatIntervalDays: 365,
    targetSpecies: ["cattle", "buffalo", "all"],
    isMandatory: true,
    withdrawalDays: 0,
    coldChainTempC: "2°C – 8°C",
    description: "Attenuated capripox / neethling strain preventing nodular dermatosis.",
  },
  {
    id: "prog_ppr",
    vaccineCode: "ppr",
    vaccineName: "PPR Vaccine (Peste des Petits Ruminants)",
    manufacturer: "DLS Bangladesh / Hester",
    defaultDoseMl: 1.0,
    route: "SC",
    primaryAgeWeeks: 12,
    repeatIntervalDays: 365,
    targetSpecies: ["goat", "sheep", "all"],
    isMandatory: true,
    withdrawalDays: 0,
    coldChainTempC: "2°C – 8°C",
    description: "Homologous live attenuated vaccine for small ruminant morbillivirus prevention.",
  },
] as const;

export class VaccinationEngine {
  /**
   * Generates a deterministic multi-dose vaccination schedule for an animal based on purchase/birth date.
   */
  public static generateScheduleForAnimal(
    animal: {
      id: string;
      tagId: string;
      species?: string;
      breed?: string | null;
      dob?: string | null;
      purchaseDate: string;
      weightKg?: number;
    },
    programs: readonly VaccineProgramRule[] = STANDARD_VACCINE_PROGRAMS
  ): {
    title: string;
    eventType: HealthEventType;
    scheduledAt: string;
    notes: string;
    vaccineCode: VaccineCode;
    isBooster: boolean;
  }[] {
    const baseDate = new Date(animal.purchaseDate || new Date().toISOString().slice(0, 10));
    const schedule: {
      title: string;
      eventType: HealthEventType;
      scheduledAt: string;
      notes: string;
      vaccineCode: VaccineCode;
      isBooster: boolean;
    }[] = [];

    // Protocol Day 7: Primary FMD
    const fmdProg = programs.find((p) => p.vaccineCode === "fmd") || STANDARD_VACCINE_PROGRAMS[0];
    const fmdDate = new Date(baseDate);
    fmdDate.setDate(fmdDate.getDate() + 7);
    schedule.push({
      title: `${fmdProg.vaccineName} — 1st Dose`,
      eventType: "vaccine",
      scheduledAt: fmdDate.toISOString().slice(0, 10),
      notes: `Route: ${fmdProg.route} | Dose: ${fmdProg.defaultDoseMl}ml | Mandatory DLS Bangladesh protocol`,
      vaccineCode: "fmd",
      isBooster: false,
    });

    // Protocol Day 14: HS
    const hsProg = programs.find((p) => p.vaccineCode === "hs") || STANDARD_VACCINE_PROGRAMS[1];
    const hsDate = new Date(baseDate);
    hsDate.setDate(hsDate.getDate() + 14);
    schedule.push({
      title: `${hsProg.vaccineName}`,
      eventType: "vaccine",
      scheduledAt: hsDate.toISOString().slice(0, 10),
      notes: `Route: ${hsProg.route} | Dose: ${hsProg.defaultDoseMl}ml | Pasteurella multocida prevention`,
      vaccineCode: "hs",
      isBooster: false,
    });

    // Protocol Day 28: BQ
    const bqProg = programs.find((p) => p.vaccineCode === "bq") || STANDARD_VACCINE_PROGRAMS[2];
    const bqDate = new Date(baseDate);
    bqDate.setDate(bqDate.getDate() + 28);
    schedule.push({
      title: `${bqProg.vaccineName}`,
      eventType: "vaccine",
      scheduledAt: bqDate.toISOString().slice(0, 10),
      notes: `Route: ${bqProg.route} | Dose: ${bqProg.defaultDoseMl}ml | Clostridium chauvoei prevention`,
      vaccineCode: "bq",
      isBooster: false,
    });

    // Protocol Day 35: FMD Booster (28 days post 1st dose)
    if (fmdProg.boosterIntervalDays) {
      const fmdBoosterDate = new Date(fmdDate);
      fmdBoosterDate.setDate(fmdBoosterDate.getDate() + fmdProg.boosterIntervalDays);
      schedule.push({
        title: `${fmdProg.vaccineName} — Booster Dose`,
        eventType: "vaccine",
        scheduledAt: fmdBoosterDate.toISOString().slice(0, 10),
        notes: `Route: ${fmdProg.route} | Dose: ${fmdProg.defaultDoseMl}ml | Secondary humoral immunity booster`,
        vaccineCode: "fmd",
        isBooster: true,
      });
    }

    // Protocol Day 45: Anthrax
    const anthraxProg = programs.find((p) => p.vaccineCode === "anthrax") || STANDARD_VACCINE_PROGRAMS[3];
    const anthraxDate = new Date(baseDate);
    anthraxDate.setDate(anthraxDate.getDate() + 45);
    schedule.push({
      title: `${anthraxProg.vaccineName}`,
      eventType: "vaccine",
      scheduledAt: anthraxDate.toISOString().slice(0, 10),
      notes: `Route: ${anthraxProg.route} | Dose: ${anthraxProg.defaultDoseMl}ml | Bacillus anthracis spore prevention`,
      vaccineCode: "anthrax",
      isBooster: false,
    });

    // Protocol Day 60: LSD (Lumpy Skin Disease)
    const lsdProg = programs.find((p) => p.vaccineCode === "lsd") || STANDARD_VACCINE_PROGRAMS[4];
    const lsdDate = new Date(baseDate);
    lsdDate.setDate(lsdDate.getDate() + 60);
    schedule.push({
      title: `${lsdProg.vaccineName}`,
      eventType: "vaccine",
      scheduledAt: lsdDate.toISOString().slice(0, 10),
      notes: `Route: ${lsdProg.route} | Dose: ${lsdProg.defaultDoseMl}ml | Capripox prophylaxis`,
      vaccineCode: "lsd",
      isBooster: false,
    });

    return schedule;
  }

  /**
   * Evaluates compliance status of an animal for a specific vaccine protocol.
   */
  public static evaluateVaccineStatus(
    lastAdministeredDate: string | null,
    intervalDays: number,
    referenceDate: string = new Date().toISOString().slice(0, 10)
  ): {
    status: "ok" | "due" | "overdue" | "never";
    daysRemaining: number;
    nextDueDate: string | null;
  } {
    if (!lastAdministeredDate) {
      return { status: "never", daysRemaining: -999, nextDueDate: null };
    }

    const last = new Date(lastAdministeredDate);
    const due = new Date(last);
    due.setDate(due.getDate() + intervalDays);
    const nextDueDate = due.toISOString().slice(0, 10);

    const ref = new Date(referenceDate);
    const diffMs = due.getTime() - ref.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
      return { status: "overdue", daysRemaining, nextDueDate };
    } else if (daysRemaining <= 14) {
      return { status: "due", daysRemaining, nextDueDate };
    }
    return { status: "ok", daysRemaining, nextDueDate };
  }
  /**
   * Calculates progress metrics for a mass vaccination campaign.
   */
  public static calculateCampaignMetrics(
    campaign: { targetCount: number },
    completedAnimalsCount: number,
    overdueCount: number = 0
  ): {
    completionPercentage: number;
    pendingCount: number;
    isCompleted: boolean;
    overdueCount: number;
  } {
    const target = Math.max(1, campaign.targetCount);
    const completed = Math.min(target, completedAnimalsCount);
    const pending = Math.max(0, target - completed);
    const percentage = Math.min(100, Math.round((completed / target) * 100));

    return {
      completionPercentage: percentage,
      pendingCount: pending,
      isCompleted: completed >= target,
      overdueCount,
    };
  }

  /**
   * Generates prioritized operational alerts and reminders across the farm.
   */
  public static evaluateReminders(
    healthEvents: {
      id: string;
      cattle_id: string;
      title: string;
      event_type: string;
      scheduled_at: string;
      completed_at: string | null;
      cattle?: { tag_id: string } | null;
    }[],
    medicineStock: {
      id: string;
      name: string;
      qty: number;
      min_threshold?: number | null;
    }[],
    adverseReactions: AdverseReactionRecord[] = [],
    todayISO: string = new Date().toISOString().slice(0, 10)
  ): VaccinationReminderAlert[] {
    const alerts: VaccinationReminderAlert[] = [];

    // 1. Overdue vaccinations
    const overdueEvents = healthEvents.filter(
      (e) => !e.completed_at && e.event_type === "vaccine" && e.scheduled_at < todayISO
    );
    for (const ov of overdueEvents) {
      const tag = ov.cattle?.tag_id || "Animal";
      alerts.push({
        id: `alert-ov-${ov.id}`,
        cattleId: ov.cattle_id,
        cattleTag: tag,
        type: "overdue",
        severity: "critical",
        title: `Overdue Vaccine: #${tag} — ${ov.title}`,
        message: `Vaccine protocol scheduled for ${ov.scheduled_at} is past due. Immunity gap risk.`,
        dueDate: ov.scheduled_at,
        recommendedAction: "Administer vaccine immediately and update medical ledger.",
        channels: ["in_app", "sms", "whatsapp"],
      });
    }

    // 2. Upcoming vaccinations (next 7 days)
    const next7Days = new Date(todayISO);
    next7Days.setDate(next7Days.getDate() + 7);
    const next7ISO = next7Days.toISOString().slice(0, 10);

    const upcomingEvents = healthEvents.filter(
      (e) => !e.completed_at && e.event_type === "vaccine" && e.scheduled_at >= todayISO && e.scheduled_at <= next7ISO
    );
    for (const up of upcomingEvents) {
      const tag = up.cattle?.tag_id || "Animal";
      alerts.push({
        id: `alert-up-${up.id}`,
        cattleId: up.cattle_id,
        cattleTag: tag,
        type: "upcoming",
        severity: "medium",
        title: `Upcoming Vaccine: #${tag} — ${up.title}`,
        message: `Vaccine protocol due on ${up.scheduled_at}. Ensure cold chain preparation.`,
        dueDate: up.scheduled_at,
        recommendedAction: "Verify vaccine inventory and cold chain temperature.",
        channels: ["in_app"],
      });
    }

    // 3. Low Vaccine Stock Warnings
    const vaccineItems = medicineStock.filter((m) =>
      m.name.toLowerCase().includes("vaccin") ||
      m.name.toLowerCase().includes("fmd") ||
      m.name.toLowerCase().includes("anthrax") ||
      m.name.toLowerCase().includes("hs") ||
      m.name.toLowerCase().includes("bq")
    );

    for (const vItem of vaccineItems) {
      const threshold = vItem.min_threshold ?? 10;
      if (vItem.qty <= 0) {
        alerts.push({
          id: `alert-stock-depleted-${vItem.id}`,
          type: "low_stock",
          severity: "critical",
          title: `Vaccine Out of Stock: ${vItem.name}`,
          message: `Current inventory is 0 doses. Ongoing campaigns and routine protocols cannot be executed.`,
          recommendedAction: "Procure cold chain batch from verified veterinary supplier.",
          channels: ["in_app", "sms", "email"],
        });
      } else if (vItem.qty < threshold) {
        alerts.push({
          id: `alert-stock-low-${vItem.id}`,
          type: "low_stock",
          severity: "high",
          title: `Low Vaccine Stock: ${vItem.name} (${vItem.qty} remaining)`,
          message: `Stock level is below minimum reserve of ${threshold} doses.`,
          recommendedAction: "Reorder vaccine vials before upcoming herd campaign.",
          channels: ["in_app"],
        });
      }
    }

    // 4. Adverse Reaction Follow-ups
    const pendingAdverse = adverseReactions.filter(
      (r) => !r.recovered && (r.severity === "severe" || r.severity === "critical" || r.requiresQuarantine)
    );
    for (const adv of pendingAdverse) {
      alerts.push({
        id: `alert-adverse-${adv.id}`,
        cattleId: adv.cattleId,
        cattleTag: adv.cattleTag,
        type: "adverse_followup",
        severity: "critical",
        title: `Adverse Reaction Follow-up: #${adv.cattleTag} (${adv.reactionType})`,
        message: `Animal experienced ${adv.severity} ${adv.reactionType} following ${adv.vaccineName}. Veterinary follow-up required.`,
        recommendedAction: "Conduct clinical examination, assess vitals and verify antihistamine/epinephrine response.",
        channels: ["in_app", "sms", "whatsapp"],
      });
    }

    return alerts;
  }

  /**
   * RBAC Security Matrix for Vaccination Platform operations.
   */
  public static checkVaccineRBAC(
    role: UserRole | string,
    action: "schedule" | "administer" | "bulk_campaign" | "record_adverse" | "view" | "edit_protocols"
  ): { allowed: boolean; reason?: string } {
    const permissions: Record<string, string[]> = {
      owner: ["schedule", "administer", "bulk_campaign", "record_adverse", "view", "edit_protocols"],
      manager: ["schedule", "administer", "bulk_campaign", "record_adverse", "view", "edit_protocols"],
      veterinarian: ["schedule", "administer", "bulk_campaign", "record_adverse", "view", "edit_protocols"],
      staff: ["schedule", "administer", "bulk_campaign", "record_adverse", "view"],
      worker: ["view"],
      viewer: ["view"],
    };

    const allowedActions = permissions[role] || ["view"];
    if (allowedActions.includes(action)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `User role '${role}' is not authorized to perform '${action}' on the vaccination platform.`,
    };
  }

  /**
   * Calculates next booster / revaccination date.
   */
  public static calculateNextBoosterDate(
    administeredDate: string,
    intervalDays: number
  ): string {
    const d = new Date(administeredDate);
    d.setDate(d.getDate() + intervalDays);
    return d.toISOString().slice(0, 10);
  }
}

export interface VaccinationReminderAlert {
  id: string;
  cattleId?: string;
  cattleTag?: string;
  type: "overdue" | "upcoming" | "booster_due" | "low_stock" | "expired_batch" | "adverse_followup";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  message: string;
  dueDate?: string;
  recommendedAction: string;
  channels: ("in_app" | "sms" | "whatsapp" | "email")[];
}

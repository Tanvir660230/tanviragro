/**
 * Bovine Reproduction & Gestation Calculation Engine
 */

export const DEFAULT_BOVINE_GESTATION_DAYS = 283;
export const DEFAULT_DRY_PERIOD_DAYS = 60;
export const DEFAULT_TRANSITION_DIET_DAYS = 21;
export const DEFAULT_PD_CHECK_DAYS = 45;
export const DEFAULT_HEAT_CYCLE_DAYS = 21;

export const BREED_GESTATION_PERIODS: Record<string, number> = {
  "holstein": 280,
  "holstein friesian": 280,
  "jersey": 279,
  "sahiwal": 287,
  "red sindhi": 286,
  "sindhi": 286,
  "brahman": 292,
  "angus": 281,
  "hereford": 284,
  "charolais": 289,
  "limousin": 289,
  "crossbred": 283,
  "desi": 285,
  "local": 285,
};

export class GestationEngine {
  public static addDays(dateStr: string, days: number): string {
    const parts = dateStr.slice(0, 10).split("-").map(Number);
    if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
      const fallback = new Date();
      fallback.setDate(fallback.getDate() + days);
      return fallback.toISOString().slice(0, 10);
    }
    const d = new Date(parts[0], parts[1] - 1, parts[2] + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  public static getGestationLengthForBreed(breedName?: string | null): number {
    if (!breedName) return DEFAULT_BOVINE_GESTATION_DAYS;
    const lower = breedName.toLowerCase().trim();
    for (const [key, days] of Object.entries(BREED_GESTATION_PERIODS)) {
      if (lower.includes(key)) return days;
    }
    return DEFAULT_BOVINE_GESTATION_DAYS;
  }

  public static calculateOptimalBreedingWindow(heatDetectedAtISO: string): {
    startISO: string;
    endISO: string;
    description: string;
  } {
    const date = new Date(heatDetectedAtISO);
    const hours = date.getHours();

    const start = new Date(date);
    const end = new Date(date);

    if (hours < 12) {
      start.setHours(start.getHours() + 10, 0, 0, 0);
      end.setHours(end.getHours() + 18, 0, 0, 0);
      return {
        startISO: start.toISOString(),
        endISO: end.toISOString(),
        description: "AM Detection: Optimal breeding is this evening (10-18h post observation).",
      };
    } else {
      start.setHours(start.getHours() + 12, 0, 0, 0);
      end.setHours(end.getHours() + 20, 0, 0, 0);
      return {
        startISO: start.toISOString(),
        endISO: end.toISOString(),
        description: "PM Detection: Optimal breeding is tomorrow morning (12-20h post observation).",
      };
    }
  }

  public static calculateExpectedCalvingDate(inseminationDate: string, breed?: string | null): string {
    const days = this.getGestationLengthForBreed(breed);
    return this.addDays(inseminationDate, days);
  }

  public static calculatePDCheckDate(inseminationDate: string, customDays = DEFAULT_PD_CHECK_DAYS): string {
    return this.addDays(inseminationDate, customDays);
  }

  public static calculateDryOffDate(expectedCalvingDate: string, dryDays = DEFAULT_DRY_PERIOD_DAYS): string {
    return this.addDays(expectedCalvingDate, -dryDays);
  }

  public static calculateTransitionDietDate(expectedCalvingDate: string): string {
    return this.addDays(expectedCalvingDate, -DEFAULT_TRANSITION_DIET_DAYS);
  }

  public static predictNextHeatDate(lastHeatDate: string, cycleNumber = 1): string {
    return this.addDays(lastHeatDate, DEFAULT_HEAT_CYCLE_DAYS * cycleNumber);
  }

  public static getGestationDetails(
    inseminationDate: string,
    breed?: string | null,
    referenceDate = new Date()
  ): {
    gestationDays: number;
    totalGestationDays: number;
    daysRemaining: number;
    percentComplete: number;
    trimester: "1st Trimester" | "2nd Trimester" | "3rd Trimester" | "Post-Term";
    isOverdue: boolean;
    stageLabel: string;
  } {
    const totalGestationDays = this.getGestationLengthForBreed(breed);
    const parts = inseminationDate.slice(0, 10).split("-").map(Number);
    const aiDate = new Date(parts[0], parts[1] - 1, parts[2]);
    const ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());

    const diffTime = ref.getTime() - aiDate.getTime();
    const gestationDays = Math.max(0, Math.floor(diffTime / 86_400_000));
    const daysRemaining = totalGestationDays - gestationDays;
    const percentComplete = Math.min(100, Math.max(0, Math.round((gestationDays / totalGestationDays) * 100)));

    let trimester: "1st Trimester" | "2nd Trimester" | "3rd Trimester" | "Post-Term" = "1st Trimester";
    let stageLabel = "Early Embryonic";

    if (gestationDays > totalGestationDays) {
      trimester = "Post-Term";
      stageLabel = `Overdue by ${Math.abs(daysRemaining)} days`;
    } else if (gestationDays >= 180) {
      trimester = "3rd Trimester";
      stageLabel = "Late Gestation / Dry Period";
    } else if (gestationDays >= 90) {
      trimester = "2nd Trimester";
      stageLabel = "Mid Gestation";
    } else {
      trimester = "1st Trimester";
      stageLabel = "Early Gestation";
    }

    return {
      gestationDays,
      totalGestationDays,
      daysRemaining: Math.max(0, daysRemaining),
      percentComplete,
      trimester,
      isOverdue: daysRemaining < 0,
      stageLabel,
    };
  }
}


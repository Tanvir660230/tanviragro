import { GestationPeriodError } from "./errors";

// Standard bovine gestation period in days
export const BOVINE_GESTATION_DAYS = 283;
// Standard dry period before calving (60 days)
export const DRY_PERIOD_DAYS = 60;
// Standard pregnancy diagnosis (PD) check window (45 - 60 days post-AI)
export const PD_CHECK_DAYS = 45;

function addDaysToDate(dateStr: string, days: number): string {
  const parts = dateStr.slice(0, 10).split("-").map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    throw new GestationPeriodError("Invalid date provided");
  }
  const d = new Date(parts[0], parts[1] - 1, parts[2] + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export class BreedingEngine {
  /**
   * Computes Expected Calving Date (ECD) from Insemination Date.
   */
  public static calculateExpectedCalvingDate(inseminationDate: string): string {
    return addDaysToDate(inseminationDate, BOVINE_GESTATION_DAYS);
  }

  /**
   * Computes recommended Pregnancy Diagnosis (PD) check date.
   */
  public static calculatePDCheckDate(inseminationDate: string): string {
    return addDaysToDate(inseminationDate, PD_CHECK_DAYS);
  }

  /**
   * Computes recommended Dry Off date for dairy cows before calving.
   */
  public static calculateDryOffDate(expectedCalvingDate: string): string {
    return addDaysToDate(expectedCalvingDate, -DRY_PERIOD_DAYS);
  }

  /**
   * Calculates current gestation day and remaining days.
   */
  public static getGestationProgress(
    inseminationDate: string,
    currentDate = new Date()
  ): { gestationDay: number; daysRemaining: number; isOverdue: boolean } {
    const parts = inseminationDate.slice(0, 10).split("-").map(Number);
    const aiDate = new Date(parts[0], parts[1] - 1, parts[2]);
    const current = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const diffTime = current.getTime() - aiDate.getTime();
    const gestationDay = Math.max(0, Math.floor(diffTime / 86_400_000));
    const daysRemaining = BOVINE_GESTATION_DAYS - gestationDay;

    return {
      gestationDay,
      daysRemaining: Math.max(0, daysRemaining),
      isOverdue: daysRemaining < 0,
    };
  }
}
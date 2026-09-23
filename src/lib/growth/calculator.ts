import {
  type WeightRecord,
  type GrowthStage,
  type PerformanceTier,
  type GrowthPrediction,
} from "./types";

/**
 * Estimates live body weight in kg from heart girth and body length in cm
 * Standard Schaeffer's Dairy/Beef Formula: Weight (kg) = (Heart Girth cm)² × (Body Length cm) / 10,840
 */
export function estimateWeightFromTape(girthCm: number, lengthCm: number): number {
  if (girthCm <= 0 || lengthCm <= 0) return 0;
  return Math.round(((girthCm * girthCm * lengthCm) / 10840) * 10) / 10;
}

/**
 * Calculates days between two ISO date strings (inclusive/absolute)
 */
export function daysBetween(startISO: string, endISO: string): number {
  const d1 = new Date(startISO.slice(0, 10)).getTime();
  const d2 = new Date(endISO.slice(0, 10)).getTime();
  const diff = Math.abs(d2 - d1);
  return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Calculates Average Daily Gain (ADG) between two discrete weight measurements in kg/day
 */
export function calculateAdgBetween(
  startWeight: number,
  endWeight: number,
  startISO: string,
  endISO: string
): number {
  const days = daysBetween(startISO, endISO);
  if (days <= 0) return 0;
  const delta = endWeight - startWeight;
  return Math.round((delta / days) * 1000) / 1000;
}

/**
 * Calculates window-based ADG over the last N days from sorted historical records
 */
export function calculateWindowAdg(
  records: WeightRecord[],
  daysWindow: number
): number {
  if (!records || records.length < 2) return 0;

  const sorted = [...records].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  const latest = sorted[sorted.length - 1];
  const latestTime = new Date(latest.recorded_at).getTime();
  const cutoffTime = latestTime - daysWindow * 24 * 60 * 60 * 1000;

  const windowRecords = sorted.filter(
    (r) => new Date(r.recorded_at).getTime() >= cutoffTime
  );

  if (windowRecords.length >= 2) {
    const first = windowRecords[0];
    const last = windowRecords[windowRecords.length - 1];
    return calculateAdgBetween(first.weight_kg, last.weight_kg, first.recorded_at, last.recorded_at);
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return calculateAdgBetween(first.weight_kg, last.weight_kg, first.recorded_at, last.recorded_at);
}

/**
 * Calculates Average Monthly Gain (AMG) in kg/month from daily ADG (30.4 days avg)
 */
export function calculateMonthlyGain(adgKg: number): number {
  return Math.round(adgKg * 30.416 * 10) / 10;
}

/**
 * Determines biological growth stage based on live weight and age in months
 */
export function determineGrowthStage(weightKg: number, ageMonths?: number): GrowthStage {
  if (ageMonths !== undefined && ageMonths !== null) {
    if (ageMonths <= 6 || weightKg < 150) return "calf";
    if (ageMonths <= 12 || weightKg < 260) return "weaner";
    if (ageMonths <= 18 || weightKg < 420) return "grower";
    if (ageMonths <= 30 || weightKg < 650) return "finisher";
    return "mature";
  }

  if (weightKg < 150) return "calf";
  if (weightKg < 260) return "weaner";
  if (weightKg < 420) return "grower";
  if (weightKg < 650) return "finisher";
  return "mature";
}

export const calculateGrowthStage = determineGrowthStage;
export const calculateWeightFromTapeSchaeffer = estimateWeightFromTape;
export const calculateIntervalAdg = calculateAdgBetween;

/**
 * Classifies animal growth performance tier
 */
export function determinePerformanceTier(adgKg: number, stage: GrowthStage): PerformanceTier {
  if (stage === "calf") {
    if (adgKg >= 0.8) return "elite";
    if (adgKg >= 0.6) return "above_average";
    if (adgKg >= 0.45) return "standard";
    if (adgKg >= 0.25) return "underperforming";
    return "critical";
  }

  if (adgKg >= 1.15) return "elite";
  if (adgKg >= 0.85) return "above_average";
  if (adgKg >= 0.60) return "standard";
  if (adgKg >= 0.30) return "underperforming";
  return "critical";
}

/**
 * Calculates target progress percentage (0 - 100%)
 */
export function calculateTargetAchievement(
  currentWeightKg: number,
  initialWeightKg: number,
  targetWeightKg: number
): number {
  if (targetWeightKg <= initialWeightKg) return 100;
  const gained = Math.max(0, currentWeightKg - initialWeightKg);
  const targetGain = targetWeightKg - initialWeightKg;
  const pct = (gained / targetGain) * 100;
  return Math.min(100, Math.max(0, Math.round(pct * 10) / 10));
}

/**
 * Calculates days remaining to reach target weight given current ADG
 */
export function calculateDaysToTarget(
  currentWeightKg: number,
  targetWeightKg: number,
  adgKg: number
): number | null {
  if (targetWeightKg <= currentWeightKg) return 0;
  if (adgKg <= 0.05) return null;
  const remainingKg = targetWeightKg - currentWeightKg;
  return Math.ceil(remainingKg / adgKg);
}

/**
 * Multi-point growth trajectory prediction using blended linear & asymptotic curve
 */
export function predictGrowthTrajectory(
  cattleId: string,
  tagId: string,
  records: WeightRecord[],
  targetWeightKg?: number,
  breedAsymptoteKg: number = 850
): GrowthPrediction {
  const sorted = [...records].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  const latest = sorted[sorted.length - 1];
  const currentWeight = latest?.weight_kg ?? 0;
  const adg = calculateWindowAdg(records, 60) || 0.75;

  const maturityRatio = Math.min(0.95, currentWeight / breedAsymptoteKg);
  const deceleration = Math.max(0.70, 1 - maturityRatio * 0.35);
  const effectiveAdg = Math.max(0.1, adg * deceleration);

  const p30 = Math.round((currentWeight + effectiveAdg * 30) * 10) / 10;
  const p60 = Math.round((currentWeight + effectiveAdg * 60 * 0.98) * 10) / 10;
  const p90 = Math.round((currentWeight + effectiveAdg * 90 * 0.95) * 10) / 10;

  let daysToTarget: number | undefined;
  let projectedFinishDate: string | undefined;

  if (targetWeightKg && targetWeightKg > currentWeight && effectiveAdg > 0) {
    const days = calculateDaysToTarget(currentWeight, targetWeightKg, effectiveAdg);
    if (days !== null) {
      daysToTarget = days;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      projectedFinishDate = targetDate.toISOString().slice(0, 10);
    }
  }

  const confidenceScore = Math.min(
    0.95,
    Math.max(0.4, 0.4 + sorted.length * 0.08)
  );

  const isSlaughterReady = targetWeightKg
    ? currentWeight >= targetWeightKg * 0.95
    : currentWeight >= 450;

  const marketReadinessScore = targetWeightKg
    ? Math.min(100, Math.round((currentWeight / targetWeightKg) * 100))
    : Math.min(100, Math.round((currentWeight / 500) * 100));

  return {
    cattleId,
    tagId,
    currentWeightKg: currentWeight,
    currentAdgKg: Math.round(effectiveAdg * 1000) / 1000,
    predicted30dKg: p30,
    predicted60dKg: p60,
    predicted90dKg: p90,
    targetWeightKg,
    projectedFinishDate,
    daysToTarget,
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    growthModel: records.length >= 4 ? "gompertz" : "linear",
    isSlaughterReady,
    marketReadinessScore,
  };
}

/**
 * Calculates current estimated live market value in BDT
 */
export function calculateAnimalValuation(
  weightKg: number,
  pricePerKgLive: number = 420
): number {
  return Math.round(weightKg * pricePerKgLive);
}

/**
 * Calculates Feed Conversion Ratio (FCR)
 */
export function calculateFcr(
  totalFeedDmConsumedKg: number,
  totalWeightGainKg: number
): number {
  if (totalWeightGainKg <= 0 || totalFeedDmConsumedKg <= 0) return 0;
  return Math.round((totalFeedDmConsumedKg / totalWeightGainKg) * 100) / 100;
}

/**
 * Calculates Cost per Kg Gain
 */
export function calculateCostPerKgGain(
  totalWeightGainKg: number,
  totalCostsBdt: number
): number {
  if (totalWeightGainKg <= 0 || totalCostsBdt <= 0) return 0;
  return Math.round((totalCostsBdt / totalWeightGainKg) * 100) / 100;
}

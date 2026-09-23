import {
  type CattleNutritionState,
  type HerdNutritionSummary,
} from "./types";
import { calculateAnimalRequirement } from "./calculator";

export function calculateHerdSummary(
  animals: CattleNutritionState[],
  mixCostBdt = 42.0,
  roughageCostBdt = 8.5
): HerdNutritionSummary {
  if (animals.length === 0) {
    return {
      totalActiveCattle: 0,
      totalDailyDmiKg: 0,
      totalDailyConcentrateKg: 0,
      totalDailyRoughageKg: 0,
      totalDailyAsFedKg: 0,
      totalEstimatedDailyCostBdt: 0,
      averageCostPerHeadBdt: 0,
      averageFcr: 0,
      acclimatizingCount: 0,
      quarantinedCount: 0,
      feedEfficiencyRatio: 0,
    };
  }

  let sumDmi = 0;
  let sumConc = 0;
  let sumRough = 0;
  let sumCost = 0;
  let acclimatizingCount = 0;
  let quarantinedCount = 0;
  let totalAdgExpected = 0;

  for (const a of animals) {
    const req = calculateAnimalRequirement(a, mixCostBdt, roughageCostBdt);
    sumDmi += req.dailyDmiKg;
    sumConc += req.targetConcentrateKg;
    sumRough += req.targetRoughageKg;
    sumCost += req.estimatedDailyCostBdt;
    totalAdgExpected += a.expectedDailyGainKg || 0.8;
    if (req.isAcclimatizing) acclimatizingCount++;
    if (a.isQuarantined) quarantinedCount++;
  }

  const totalActiveCattle = animals.length;
  const totalDailyAsFedKg = Math.round((sumConc + sumRough) * 100) / 100;
  const averageCostPerHeadBdt =
    Math.round((sumCost / Math.max(1, totalActiveCattle)) * 100) / 100;

  const averageFcr =
    totalAdgExpected > 0 ? Math.round((sumDmi / totalAdgExpected) * 100) / 100 : 6.8;

  const feedEfficiencyRatio =
    averageFcr > 0 ? Math.round((1 / averageFcr) * 1000) / 1000 : 0.147;

  return {
    totalActiveCattle,
    totalDailyDmiKg: Math.round(sumDmi * 100) / 100,
    totalDailyConcentrateKg: Math.round(sumConc * 100) / 100,
    totalDailyRoughageKg: Math.round(sumRough * 100) / 100,
    totalDailyAsFedKg,
    totalEstimatedDailyCostBdt: Math.round(sumCost * 100) / 100,
    averageCostPerHeadBdt,
    averageFcr,
    acclimatizingCount,
    quarantinedCount,
    feedEfficiencyRatio,
  };
}

export function calculateFcr(
  totalFeedDmConsumedKg: number,
  totalWeightGainedKg: number
): number {
  if (totalWeightGainedKg <= 0 || totalFeedDmConsumedKg <= 0) return 0;
  return Math.round((totalFeedDmConsumedKg / totalWeightGainedKg) * 100) / 100;
}

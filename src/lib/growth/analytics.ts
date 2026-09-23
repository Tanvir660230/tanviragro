import {
  type WeightRecord,
  type GrowthTarget,
  type AnimalGrowthProfile,
  type GrowthHerdSummary,
  type PenGrowthBenchmark,
  type BreedGrowthBenchmark,
} from "./types";
import {
  calculateWindowAdg,
  calculateMonthlyGain,
  determineGrowthStage,
  determinePerformanceTier,
  calculateTargetAchievement,
  calculateDaysToTarget,
  calculateAnimalValuation,
  calculateCostPerKgGain,
  calculateFcr,
  daysBetween,
} from "./calculator";
import { detectGrowthAnomalies } from "./intelligence";

export interface CattleBaseInfo {
  id: string;
  tag_id: string;
  name?: string | null;
  breed?: string | null;
  gender?: string | null;
  dob?: string | null;
  status: string;
  pen_id?: string | null;
  farm_id?: string | null;
  pen_name?: string | null;
  initial_weight?: number | null;
  purchase_date?: string | null;
}

/**
 * Transforms raw database records into a rich domain AnimalGrowthProfile
 */
export function buildAnimalGrowthProfile(
  cattle: CattleBaseInfo,
  records: WeightRecord[],
  target?: GrowthTarget | null,
  feedCostsBdt: number = 0,
  healthCostsBdt: number = 0,
  feedDmConsumedKg: number = 0,
  todayISO: string = new Date().toISOString().slice(0, 10),
  pricePerKgLiveBdt: number = 420
): AnimalGrowthProfile {
  const sorted = [...records].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  const initialWeight = cattle.initial_weight || sorted[0]?.weight_kg || 150;
  const latest = sorted[sorted.length - 1];
  const currentWeight = latest?.weight_kg || initialWeight;
  const currentBcs = latest?.bcs || 3.5;
  const lastWeighedAt = latest?.recorded_at || cattle.purchase_date || todayISO;
  const daysSinceLastWeighed = daysBetween(lastWeighedAt, todayISO);

  const firstDate = cattle.purchase_date || sorted[0]?.recorded_at || todayISO;
  const daysOnFarm = daysBetween(firstDate, todayISO);
  const totalWeightGain = Math.max(0, currentWeight - initialWeight);

  const overallAdg = sorted.length >= 2
    ? calculateWindowAdg(sorted, 3650)
    : daysOnFarm > 0
    ? totalWeightGain / daysOnFarm
    : 0.65;

  const recent30dAdg = calculateWindowAdg(sorted, 30);
  const recent90dAdg = calculateWindowAdg(sorted, 90);
  const averageMonthlyGain = calculateMonthlyGain(recent30dAdg || overallAdg);

  const growthStage = determineGrowthStage(currentWeight);
  const performanceTier = determinePerformanceTier(recent30dAdg || overallAdg, growthStage);

  const targetAchievementPct = target
    ? calculateTargetAchievement(currentWeight, initialWeight, target.target_weight_kg)
    : 0;

  let daysToTarget: number | undefined;
  let projectedFinishDate: string | undefined;

  if (target && target.target_weight_kg > currentWeight) {
    const effAdg = recent30dAdg > 0.1 ? recent30dAdg : overallAdg > 0.1 ? overallAdg : 0.6;
    const dtt = calculateDaysToTarget(currentWeight, target.target_weight_kg, effAdg);
    if (dtt !== null) {
      daysToTarget = dtt;
      const finishDate = new Date();
      finishDate.setDate(finishDate.getDate() + dtt);
      projectedFinishDate = finishDate.toISOString().slice(0, 10);
    }
  }

  const estimatedValue = calculateAnimalValuation(currentWeight, pricePerKgLiveBdt);
  const totalCost = feedCostsBdt + healthCostsBdt;
  const costPerKgGain = calculateCostPerKgGain(totalWeightGain, totalCost);
  const fcr = feedDmConsumedKg > 0 && totalWeightGain > 0
    ? calculateFcr(feedDmConsumedKg, totalWeightGain)
    : undefined;

  const alerts = detectGrowthAnomalies(cattle.id, cattle.tag_id, sorted, target, todayISO);

  return {
    cattleId: cattle.id,
    tagId: cattle.tag_id,
    name: cattle.name,
    breed: cattle.breed || "Crossbreed",
    gender: cattle.gender || "male",
    dob: cattle.dob,
    status: cattle.status,
    penName: cattle.pen_name || "General Pen",
    currentWeightKg: currentWeight,
    initialWeightKg: initialWeight,
    totalWeightGainKg: Math.round(totalWeightGain * 10) / 10,
    daysOnFarm,
    overallAdgKg: Math.round(overallAdg * 1000) / 1000,
    recent30dAdgKg: Math.round(recent30dAdg * 1000) / 1000,
    recent90dAdgKg: Math.round(recent90dAdg * 1000) / 1000,
    averageMonthlyGainKg: averageMonthlyGain,
    currentBcs,
    growthStage,
    performanceTier,
    activeTarget: target,
    targetAchievementPct,
    daysToTarget,
    projectedFinishDate,
    estimatedAnimalValueBdt: estimatedValue,
    costPerKgGainBdt: costPerKgGain,
    fcr,
    lastWeighedAt,
    daysSinceLastWeighed,
    weightHistoryCount: sorted.length,
    alerts,
  };
}

/**
 * Calculates aggregate summary metrics for the entire active herd
 */
export function buildHerdGrowthSummary(profiles: AnimalGrowthProfile[]): GrowthHerdSummary {
  const totalActive = profiles.filter((p) => p.status === "active").length;
  if (totalActive === 0) {
    return {
      totalActiveAnimals: 0,
      totalWeighedLast30d: 0,
      complianceRatePct: 0,
      herdAvgWeightKg: 0,
      herdAvgAdgKg: 0,
      herdAvgRecentAdgKg: 0,
      herdAvgBcs: 0,
      herdAvgFcr: 0,
      herdAvgCostPerKgGainBdt: 0,
      totalProjectedValueBdt: 0,
      eliteCount: 0,
      aboveAverageCount: 0,
      standardCount: 0,
      underperformingCount: 0,
      criticalCount: 0,
      totalAlertsCount: 0,
      criticalAlertsCount: 0,
    };
  }

  const activeProfiles = profiles.filter((p) => p.status === "active");
  const weighed30d = activeProfiles.filter((p) => p.daysSinceLastWeighed <= 30).length;
  const complianceRate = Math.round((weighed30d / totalActive) * 100);

  const avgWeight = activeProfiles.reduce((acc, p) => acc + p.currentWeightKg, 0) / totalActive;
  const avgOverallAdg = activeProfiles.reduce((acc, p) => acc + p.overallAdgKg, 0) / totalActive;
  const avgRecentAdg = activeProfiles.reduce((acc, p) => acc + (p.recent30dAdgKg || p.overallAdgKg), 0) / totalActive;
  const avgBcs = activeProfiles.reduce((acc, p) => acc + p.currentBcs, 0) / totalActive;

  const validFcrs = activeProfiles.filter((p) => p.fcr && p.fcr > 0);
  const avgFcr = validFcrs.length > 0
    ? validFcrs.reduce((acc, p) => acc + (p.fcr || 0), 0) / validFcrs.length
    : 7.2;

  const validCostKg = activeProfiles.filter((p) => p.costPerKgGainBdt > 0);
  const avgCostKg = validCostKg.length > 0
    ? validCostKg.reduce((acc, p) => acc + p.costPerKgGainBdt, 0) / validCostKg.length
    : 285;

  const totalValue = activeProfiles.reduce((acc, p) => acc + p.estimatedAnimalValueBdt, 0);

  let elite = 0;
  let above = 0;
  let std = 0;
  let under = 0;
  let crit = 0;

  let totalAlerts = 0;
  let critAlerts = 0;

  for (const p of activeProfiles) {
    if (p.performanceTier === "elite") elite++;
    else if (p.performanceTier === "above_average") above++;
    else if (p.performanceTier === "standard") std++;
    else if (p.performanceTier === "underperforming") under++;
    else crit++;

    totalAlerts += p.alerts.length;
    critAlerts += p.alerts.filter((a) => a.severity === "critical").length;
  }

  return {
    totalActiveAnimals: totalActive,
    totalWeighedLast30d: weighed30d,
    complianceRatePct: complianceRate,
    herdAvgWeightKg: Math.round(avgWeight * 10) / 10,
    herdAvgAdgKg: Math.round(avgOverallAdg * 1000) / 1000,
    herdAvgRecentAdgKg: Math.round(avgRecentAdg * 1000) / 1000,
    herdAvgBcs: Math.round(avgBcs * 10) / 10,
    herdAvgFcr: Math.round(avgFcr * 100) / 100,
    herdAvgCostPerKgGainBdt: Math.round(avgCostKg),
    totalProjectedValueBdt: totalValue,
    eliteCount: elite,
    aboveAverageCount: above,
    standardCount: std,
    underperformingCount: under,
    criticalCount: crit,
    totalAlertsCount: totalAlerts,
    criticalAlertsCount: critAlerts,
  };
}

/**
 * Groups growth metrics by pen/shed for comparative feedlot analysis
 */
export function buildPenGrowthBenchmarks(profiles: AnimalGrowthProfile[]): PenGrowthBenchmark[] {
  const map = new Map<string, AnimalGrowthProfile[]>();
  for (const p of profiles) {
    const pen = p.penName || "General Pen";
    if (!map.has(pen)) map.set(pen, []);
    map.get(pen)!.push(p);
  }

  const result: PenGrowthBenchmark[] = [];
  for (const [penName, list] of map.entries()) {
    const count = list.length;
    const avgW = list.reduce((a, b) => a + b.currentWeightKg, 0) / count;
    const avgAdg = list.reduce((a, b) => a + (b.recent30dAdgKg || b.overallAdgKg), 0) / count;
    const topPerformer = [...list].sort((a, b) => b.recent30dAdgKg - a.recent30dAdgKg)[0];

    result.push({
      penName,
      animalCount: count,
      avgWeightKg: Math.round(avgW * 10) / 10,
      avgAdgKg: Math.round(avgAdg * 1000) / 1000,
      avgFcr: 7.2,
      avgCostPerKgGainBdt: 285,
      topPerformerTag: topPerformer ? topPerformer.tagId : "-",
    });
  }

  return result.sort((a, b) => b.avgAdgKg - a.avgAdgKg);
}

/**
 * Groups growth metrics by breed
 */
export function buildBreedGrowthBenchmarks(profiles: AnimalGrowthProfile[]): BreedGrowthBenchmark[] {
  const map = new Map<string, AnimalGrowthProfile[]>();
  for (const p of profiles) {
    const b = p.breed || "Other";
    if (!map.has(b)) map.set(b, []);
    map.get(b)!.push(p);
  }

  const result: BreedGrowthBenchmark[] = [];
  for (const [breed, list] of map.entries()) {
    const count = list.length;
    const avgW = list.reduce((a, b) => a + b.currentWeightKg, 0) / count;
    const avgAdg = list.reduce((a, b) => a + (b.recent30dAdgKg || b.overallAdgKg), 0) / count;

    result.push({
      breed,
      animalCount: count,
      avgWeightKg: Math.round(avgW * 10) / 10,
      avgAdgKg: Math.round(avgAdg * 1000) / 1000,
      targetAdgKg: breed.toLowerCase().includes("brahman") ? 1.1 : 0.85,
    });
  }

  return result.sort((a, b) => b.animalCount - a.animalCount);
}

/**
 * Aggregates herd data into a unified GrowthHerdAnalytics dataset
 */
export function buildHerdGrowthAnalytics(
  animals: CattleBaseInfo[],
  weightLogs: WeightRecord[],
  targets: GrowthTarget[] = [],
  _alertsAcked: any[] = []
) {
  const logsByCattle = new Map<string, WeightRecord[]>();
  for (const log of weightLogs) {
    if (!logsByCattle.has(log.cattle_id)) logsByCattle.set(log.cattle_id, []);
    logsByCattle.get(log.cattle_id)!.push(log);
  }

  const targetsByCattle = new Map<string, GrowthTarget>();
  for (const t of targets) {
    targetsByCattle.set(t.cattle_id, t);
  }

  const profiles = animals.map((a) => {
    const logs = logsByCattle.get(a.id) || [];
    const target = targetsByCattle.get(a.id) || null;
    return buildAnimalGrowthProfile(a, logs, target);
  });

  const summary = buildHerdGrowthSummary(profiles);
  const penBenchmarks = buildPenGrowthBenchmarks(profiles);
  const breedBenchmarks = buildBreedGrowthBenchmarks(profiles);
  const alerts = profiles.flatMap((p) => p.alerts);

  return {
    summary,
    profiles,
    alerts,
    penBenchmarks,
    breedBenchmarks,
  };
}

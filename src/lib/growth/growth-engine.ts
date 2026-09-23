import * as Calculator from "./calculator";
import * as Intelligence from "./intelligence";
import * as Analytics from "./analytics";
import {
  type WeightRecord,
  type GrowthTarget,
  type GrowthAlert,
  type GrowthPrediction,
  type AnimalGrowthProfile,
  type GrowthHerdSummary,
  type PenGrowthBenchmark,
  type BreedGrowthBenchmark,
  type WeighingMethod,
  type GrowthStage,
  type PerformanceTier,
} from "./types";

export class GrowthIntelligenceEngine {
  // Calculator Facade
  estimateWeightFromTape(girthCm: number, lengthCm: number): number {
    return Calculator.estimateWeightFromTape(girthCm, lengthCm);
  }

  calculateAdgBetween(
    startWeight: number,
    endWeight: number,
    startISO: string,
    endISO: string
  ): number {
    return Calculator.calculateAdgBetween(startWeight, endWeight, startISO, endISO);
  }

  calculateWindowAdg(records: WeightRecord[], daysWindow: number): number {
    return Calculator.calculateWindowAdg(records, daysWindow);
  }

  calculateMonthlyGain(adgKg: number): number {
    return Calculator.calculateMonthlyGain(adgKg);
  }

  determineGrowthStage(weightKg: number, ageMonths?: number): GrowthStage {
    return Calculator.determineGrowthStage(weightKg, ageMonths);
  }

  determinePerformanceTier(adgKg: number, stage: GrowthStage): PerformanceTier {
    return Calculator.determinePerformanceTier(adgKg, stage);
  }

  calculateTargetAchievement(
    currentWeightKg: number,
    initialWeightKg: number,
    targetWeightKg: number
  ): number {
    return Calculator.calculateTargetAchievement(currentWeightKg, initialWeightKg, targetWeightKg);
  }

  predictGrowthTrajectory(
    cattleId: string,
    tagId: string,
    records: WeightRecord[],
    targetWeightKg?: number
  ): GrowthPrediction {
    return Calculator.predictGrowthTrajectory(cattleId, tagId, records, targetWeightKg);
  }

  calculateValuation(weightKg: number, pricePerKgLive: number = 420): number {
    return Calculator.calculateAnimalValuation(weightKg, pricePerKgLive);
  }

  calculateFcr(totalFeedDmKg: number, totalWeightGainKg: number): number {
    return Calculator.calculateFcr(totalFeedDmKg, totalWeightGainKg);
  }

  calculateCostPerKgGain(totalWeightGainKg: number, totalCostsBdt: number): number {
    return Calculator.calculateCostPerKgGain(totalWeightGainKg, totalCostsBdt);
  }

  // Intelligence Facade
  detectAnomalies(
    cattleId: string,
    tagId: string,
    records: WeightRecord[],
    target?: GrowthTarget | null,
    todayISO?: string
  ): GrowthAlert[] {
    return Intelligence.detectGrowthAnomalies(cattleId, tagId, records, target, todayISO);
  }

  generateRecommendations(profile: AnimalGrowthProfile): string[] {
    return Intelligence.generateGrowthRecommendations(profile);
  }

  // Analytics Facade
  buildProfile(
    cattle: Analytics.CattleBaseInfo,
    records: WeightRecord[],
    target?: GrowthTarget | null,
    feedCostsBdt?: number,
    healthCostsBdt?: number,
    feedDmConsumedKg?: number,
    todayISO?: string,
    pricePerKgLiveBdt?: number
  ): AnimalGrowthProfile {
    return Analytics.buildAnimalGrowthProfile(
      cattle,
      records,
      target,
      feedCostsBdt,
      healthCostsBdt,
      feedDmConsumedKg,
      todayISO,
      pricePerKgLiveBdt
    );
  }

  buildHerdSummary(profiles: AnimalGrowthProfile[]): GrowthHerdSummary {
    return Analytics.buildHerdGrowthSummary(profiles);
  }

  buildPenBenchmarks(profiles: AnimalGrowthProfile[]): PenGrowthBenchmark[] {
    return Analytics.buildPenGrowthBenchmarks(profiles);
  }

  buildBreedBenchmarks(profiles: AnimalGrowthProfile[]): BreedGrowthBenchmark[] {
    return Analytics.buildBreedGrowthBenchmarks(profiles);
  }
}

export const growthEngine = new GrowthIntelligenceEngine();

export * from "./types";
export * from "./calculator";
export * from "./intelligence";
export * from "./analytics";

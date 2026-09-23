/**
 * Enterprise Feed & Nutrition Intelligence Platform
 * Unified Domain Façade
 */

import {
  type CattleNutritionState,
  type CalculatedAnimalRequirement,
  type FeedNutrientProfile,
  type FeedSession,
  type FeedConsumptionRecord,
  type HerdNutritionSummary,
  type NutritionAlert,
  type RationComplianceResult,
  type RationIngredientInput,
  type AiNutritionRecommendation,
} from "./types";

import { calculateAnimalRequirement, evaluateRationCompliance } from "./calculator";
import { calculateHerdSummary, calculateFcr } from "./analytics";
import { evaluateAlerts } from "./alerts";
import { generateAiRecommendations } from "./ai-advisor";

export * from "./types";
export * from "./presets";
export * from "./calculator";
export * from "./analytics";
export * from "./alerts";
export * from "./ai-advisor";

export class NutritionEngine {
  private static instance: NutritionEngine;
  private constructor() {}

  public static getInstance(): NutritionEngine {
    if (!NutritionEngine.instance) {
      NutritionEngine.instance = new NutritionEngine();
    }
    return NutritionEngine.instance;
  }

  public calculateAnimalRequirement(
    animal: CattleNutritionState,
    mixUnitCostBdt = 42.0,
    roughageUnitCostBdt = 8.5,
    roughageDmPercent = 0.90
  ): CalculatedAnimalRequirement {
    return calculateAnimalRequirement(animal, mixUnitCostBdt, roughageUnitCostBdt, roughageDmPercent);
  }

  public evaluateRationCompliance(
    targetDmiKg: number,
    targetCpPercentDm: number,
    targetTdnPercentDm: number,
    targetDailyGainKg: number,
    ingredients: RationIngredientInput[]
  ): RationComplianceResult {
    return evaluateRationCompliance(
      targetDmiKg,
      targetCpPercentDm,
      targetTdnPercentDm,
      targetDailyGainKg,
      ingredients
    );
  }

  public calculateHerdSummary(
    animals: CattleNutritionState[],
    mixCostBdt = 42.0,
    roughageCostBdt = 8.5
  ): HerdNutritionSummary {
    return calculateHerdSummary(animals, mixCostBdt, roughageCostBdt);
  }

  public calculateFcr(totalFeedDmConsumedKg: number, totalWeightGainedKg: number): number {
    return calculateFcr(totalFeedDmConsumedKg, totalWeightGainedKg);
  }

  public evaluateAlerts(
    inventoryItems: FeedNutrientProfile[],
    sessions: FeedSession[],
    recentConsumption: FeedConsumptionRecord[],
    todayISO: string = new Date().toISOString().slice(0, 10)
  ): NutritionAlert[] {
    return evaluateAlerts(inventoryItems, sessions, recentConsumption, todayISO);
  }

  public generateAiRecommendations(
    summary: HerdNutritionSummary,
    inventory: FeedNutrientProfile[]
  ): AiNutritionRecommendation[] {
    return generateAiRecommendations(summary, inventory);
  }
}

export const nutritionEngine = NutritionEngine.getInstance();


/**
 * Enterprise Livestock Feed Ration Balancer Engine
 * Evaluates nutrient targets (DM, CP, TDN, Minerals) and daily feeding economics.
 */

export interface FeedIngredientNutrientProfile {
  id: string;
  name: string;
  category: "energy_concentrate" | "protein_concentrate" | "dry_roughage" | "green_roughage" | "mineral_supplement";
  dmPercent: number;        // e.g. 0.90 for straw, 0.88 for corn
  cpPercentDm: number;      // e.g. 35 for mustard cake (35%)
  tdnPercentDm: number;     // e.g. 80 for corn (80%)
  costPerKgAsFed: number;   // BDT per kg as-fed
}

export interface RationIngredientInput {
  ingredient: FeedIngredientNutrientProfile;
  asFedKg: number;
}

export interface NutritionalRequirementTarget {
  bodyWeightKg: number;
  targetDailyGainKg: number;
  dailyDmiKg: number;
  targetCpPercentDm: number;
  targetTdnPercentDm: number;
}

export interface FormulationAnalysisResult {
  totalAsFedKg: number;
  totalDryMatterKg: number;
  crudeProteinPercentDm: number;
  tdnPercentDm: number;
  totalDailyCostBdt: number;
  costPerKgDryMatter: number;
  costPerKgLiveGainExpected: number;
  isNutritionallyAdequate: boolean;
  complianceChecks: {
    nutrient: string;
    target: number;
    actual: number;
    unit: string;
    passed: boolean;
  }[];
}

export class RationBalancerEngine {
  private static instance: RationBalancerEngine;
  private constructor() {}

  public static getInstance(): RationBalancerEngine {
    if (!RationBalancerEngine.instance) {
      RationBalancerEngine.instance = new RationBalancerEngine();
    }
    return RationBalancerEngine.instance;
  }

  public calculateNutritionalRequirements(
    bodyWeightKg: number,
    targetDailyGainKg = 1.0
  ): NutritionalRequirementTarget {
    const clampedWeight = Math.max(100, Math.min(650, bodyWeightKg));
    const clampedAdg = Math.max(0.2, Math.min(2.0, targetDailyGainKg));
    const dailyDmiKg = Math.round(clampedWeight * 0.027 * 100) / 100;
    const targetCpPercentDm = clampedAdg >= 1.2 ? 14.5 : clampedAdg >= 0.8 ? 13.0 : 11.5;
    const targetTdnPercentDm = clampedAdg >= 1.2 ? 70.0 : 66.0;

    return {
      bodyWeightKg: clampedWeight,
      targetDailyGainKg: clampedAdg,
      dailyDmiKg,
      targetCpPercentDm,
      targetTdnPercentDm,
    };
  }

  public evaluateRationFormulation(
    target: NutritionalRequirementTarget,
    ingredients: RationIngredientInput[]
  ): FormulationAnalysisResult {
    let totalAsFedKg = 0;
    let totalDryMatterKg = 0;
    let totalCpGrams = 0;
    let totalTdnKg = 0;
    let totalDailyCostBdt = 0;

    for (const item of ingredients) {
      const asFed = item.asFedKg;
      const ing = item.ingredient;
      const dmKg = asFed * ing.dmPercent;
      const cpGrams = dmKg * (ing.cpPercentDm / 100) * 1000;
      const tdnKg = dmKg * (ing.tdnPercentDm / 100);
      const cost = asFed * ing.costPerKgAsFed;

      totalAsFedKg += asFed;
      totalDryMatterKg += dmKg;
      totalCpGrams += cpGrams;
      totalTdnKg += tdnKg;
      totalDailyCostBdt += cost;
    }

    const crudeProteinPercentDm =
      totalDryMatterKg > 0 ? (totalCpGrams / (totalDryMatterKg * 1000)) * 100 : 0;
    const tdnPercentDm = totalDryMatterKg > 0 ? (totalTdnKg / totalDryMatterKg) * 100 : 0;
    const costPerKgDryMatter = totalDryMatterKg > 0 ? totalDailyCostBdt / totalDryMatterKg : 0;
    const costPerKgLiveGainExpected =
      target.targetDailyGainKg > 0 ? totalDailyCostBdt / target.targetDailyGainKg : 0;

    const complianceChecks = [
      {
        nutrient: "Dry Matter Intake (DMI)",
        target: target.dailyDmiKg,
        actual: Math.round(totalDryMatterKg * 100) / 100,
        unit: "kg/day",
        passed: totalDryMatterKg >= target.dailyDmiKg * 0.9,
      },
      {
        nutrient: "Crude Protein (CP)",
        target: target.targetCpPercentDm,
        actual: Math.round(crudeProteinPercentDm * 10) / 10,
        unit: "% DM",
        passed: crudeProteinPercentDm >= target.targetCpPercentDm * 0.95,
      },
      {
        nutrient: "Total Digestible Nutrients (TDN)",
        target: target.targetTdnPercentDm,
        actual: Math.round(tdnPercentDm * 10) / 10,
        unit: "% DM",
        passed: tdnPercentDm >= target.targetTdnPercentDm * 0.95,
      },
    ];

    const isNutritionallyAdequate = complianceChecks.every((c) => c.passed);

    return {
      totalAsFedKg: Math.round(totalAsFedKg * 100) / 100,
      totalDryMatterKg: Math.round(totalDryMatterKg * 100) / 100,
      crudeProteinPercentDm: Math.round(crudeProteinPercentDm * 10) / 10,
      tdnPercentDm: Math.round(tdnPercentDm * 10) / 10,
      totalDailyCostBdt: Math.round(totalDailyCostBdt * 100) / 100,
      costPerKgDryMatter: Math.round(costPerKgDryMatter * 100) / 100,
      costPerKgLiveGainExpected: Math.round(costPerKgLiveGainExpected * 100) / 100,
      isNutritionallyAdequate,
      complianceChecks,
    };
  }
}

export const rationBalancerEngine = RationBalancerEngine.getInstance();

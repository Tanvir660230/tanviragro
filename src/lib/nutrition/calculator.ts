import {
  type CattleNutritionState,
  type CalculatedAnimalRequirement,
  type RationComplianceResult,
  type RationIngredientInput,
} from "./types";

export function calculateAnimalRequirement(
  animal: CattleNutritionState,
  mixUnitCostBdt = 42.0,
  roughageUnitCostBdt = 8.5,
  roughageDmPercent = 0.90
): CalculatedAnimalRequirement {
  const bw = Math.max(80, Math.min(750, animal.currentWeightKg));
  const daysOnFarm = Math.max(0, animal.daysOnFarm);

  const acclimatizationFactor =
    daysOnFarm >= 14 ? 1.0 : Math.max(0.40, 0.40 + (daysOnFarm / 14) * 0.60);
  const isAcclimatizing = acclimatizationFactor < 1.0;

  const dmiPercent = bw < 200 ? 0.030 : bw < 350 ? 0.027 : 0.025;
  const dailyDmiKg = Math.round(bw * dmiPercent * 100) / 100;

  let concentratePercentOfBw = 0.015;
  if (bw >= 180 && bw <= 300) {
    concentratePercentOfBw = 0.020;
  } else if (bw > 300) {
    concentratePercentOfBw = 0.015;
  }

  const unadjustedConcentrateKg = bw * concentratePercentOfBw;
  const targetConcentrateKg =
    Math.round(unadjustedConcentrateKg * acclimatizationFactor * 100) / 100;

  const concentrateDmKg = targetConcentrateKg * 0.88;
  const remainingDmKg = Math.max(0.5, dailyDmiKg - concentrateDmKg);
  const calculatedRoughageAsFedKg = remainingDmKg / Math.max(0.15, roughageDmPercent);

  const targetRoughageKg =
    animal.roughageOverrideKg !== null && animal.roughageOverrideKg !== undefined
      ? animal.roughageOverrideKg
      : Math.round(calculatedRoughageAsFedKg * 100) / 100;

  const targetRoughageDmKg = Math.round(targetRoughageKg * roughageDmPercent * 100) / 100;
  const targetTotalAsFedKg = Math.round((targetConcentrateKg + targetRoughageKg) * 100) / 100;

  const targetCpPercentDm =
    animal.expectedDailyGainKg >= 1.2 ? 14.5 : animal.expectedDailyGainKg >= 0.8 ? 13.0 : 11.5;
  const targetTdnPercentDm = animal.expectedDailyGainKg >= 1.2 ? 72.0 : 66.0;

  const estimatedDailyCostBdt =
    Math.round(
      (targetConcentrateKg * mixUnitCostBdt + targetRoughageKg * roughageUnitCostBdt) * 100
    ) / 100;

  return {
    cattleId: animal.id,
    tagId: animal.tagId,
    projectedWeightKg: bw,
    dailyDmiKg,
    targetConcentrateKg,
    targetRoughageKg,
    targetRoughageDmKg,
    targetTotalAsFedKg,
    acclimatizationFactor: Math.round(acclimatizationFactor * 100) / 100,
    targetCpPercentDm,
    targetTdnPercentDm,
    estimatedDailyCostBdt,
    isAcclimatizing,
  };
}

export function evaluateRationCompliance(
  targetDmiKg: number,
  targetCpPercentDm: number,
  targetTdnPercentDm: number,
  targetDailyGainKg: number,
  ingredients: RationIngredientInput[]
): RationComplianceResult {
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
    // unknown price adds nothing here; callers see costPerKgAsFed === null and label it
    const cost = asFed * (ing.costPerKgAsFed ?? 0);

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
    targetDailyGainKg > 0 ? totalDailyCostBdt / targetDailyGainKg : 0;

  const complianceChecks = [
    {
      nutrient: "Dry Matter Intake (DMI)",
      target: targetDmiKg,
      actual: Math.round(totalDryMatterKg * 100) / 100,
      unit: "kg/day",
      passed: totalDryMatterKg >= targetDmiKg * 0.90,
      deviationPercent:
        targetDmiKg > 0
          ? Math.round(((totalDryMatterKg - targetDmiKg) / targetDmiKg) * 1000) / 10
          : 0,
    },
    {
      nutrient: "Crude Protein (CP)",
      target: targetCpPercentDm,
      actual: Math.round(crudeProteinPercentDm * 10) / 10,
      unit: "% DM",
      passed: crudeProteinPercentDm >= targetCpPercentDm * 0.95,
      deviationPercent:
        targetCpPercentDm > 0
          ? Math.round(((crudeProteinPercentDm - targetCpPercentDm) / targetCpPercentDm) * 1000) / 10
          : 0,
    },
    {
      nutrient: "Total Digestible Nutrients (TDN)",
      target: targetTdnPercentDm,
      actual: Math.round(tdnPercentDm * 10) / 10,
      unit: "% DM",
      passed: tdnPercentDm >= targetTdnPercentDm * 0.95,
      deviationPercent:
        targetTdnPercentDm > 0
          ? Math.round(((tdnPercentDm - targetTdnPercentDm) / targetTdnPercentDm) * 1000) / 10
          : 0,
    },
  ];

  const isNutritionallyAdequate = complianceChecks.every((c) => c.passed);
  const passedCount = complianceChecks.filter((c) => c.passed).length;
  const nutritionScore = Math.round((passedCount / complianceChecks.length) * 100);

  return {
    totalAsFedKg: Math.round(totalAsFedKg * 100) / 100,
    totalDryMatterKg: Math.round(totalDryMatterKg * 100) / 100,
    crudeProteinPercentDm: Math.round(crudeProteinPercentDm * 10) / 10,
    tdnPercentDm: Math.round(tdnPercentDm * 10) / 10,
    totalDailyCostBdt: Math.round(totalDailyCostBdt * 100) / 100,
    costPerKgDryMatter: Math.round(costPerKgDryMatter * 100) / 100,
    costPerKgLiveGainExpected: Math.round(costPerKgLiveGainExpected * 100) / 100,
    nutritionScore,
    isNutritionallyAdequate,
    complianceChecks,
  };
}

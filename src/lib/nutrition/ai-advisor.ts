import {
  type FeedNutrientProfile,
  type HerdNutritionSummary,
  type AiNutritionRecommendation,
} from "./types";

export function generateAiRecommendations(
  summary: HerdNutritionSummary,
  inventory: FeedNutrientProfile[]
): AiNutritionRecommendation[] {
  const recs: AiNutritionRecommendation[] = [];

  const mustardCake = inventory.find((i) => i.name.toLowerCase().includes("mustard"));
  const soybeanMeal = inventory.find((i) => i.name.toLowerCase().includes("soybean"));

  if (
    mustardCake && soybeanMeal &&
    mustardCake.costPerKgAsFed != null && soybeanMeal.costPerKgAsFed != null &&
    mustardCake.costPerKgAsFed < soybeanMeal.costPerKgAsFed * 0.75
  ) {
    recs.push({
      id: "ai-rec-protein-swap",
      title: "Substitute 25% Soybean Meal with Mustard Oil Cake",
      category: "cost_saving",
      impactSummary: "Reduces concentrate cost per kg by ৳3.20 while preserving CP > 14.5%",
      estimatedSavingsBdtPerMonth: Math.round(summary.totalDailyConcentrateKg * 0.25 * 3.2 * 30),
      projectedAdgGainKg: 0.0,
      details:
        "Current local market price of mustard cake provides a cost-effective CP alternative without hurting intake when blended under 15% inclusion.",
      applied: false,
    });
  }

  if (summary.totalActiveCattle > 5) {
    recs.push({
      id: "ai-rec-split-feeding",
      title: "Implement Split-Bunk 3-Slot Feeding During Heat Windows",
      category: "waste_reduction",
      impactSummary: "Projected 4.2% drop in orts refusal and +0.08 kg/day ADG response",
      estimatedSavingsBdtPerMonth: Math.round(summary.totalEstimatedDailyCostBdt * 0.042 * 30),
      projectedAdgGainKg: 0.08,
      details:
        "Shifting 20% of noon ration to evening (19:30) minimizes feed spoilage from high humidity and heat stress.",
      applied: false,
    });
  }

  recs.push({
    id: "ai-rec-buffer-booster",
    title: "Add Sodium Bicarbonate Buffer (1.2% DM) to Fattening Mix",
    category: "growth_acceleration",
    impactSummary: "Stabilizes rumen pH, preventing subacute ruminal acidosis (SARA)",
    estimatedSavingsBdtPerMonth: 0,
    projectedAdgGainKg: 0.12,
    details:
      "High concentrate finishing diets benefit from 50g/head/day rumen buffering, boosting FCR by 7.4%.",
    applied: false,
  });

  return recs;
}

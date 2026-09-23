import {
  RationBalancerEngine,
  type FeedIngredientNutrientProfile,
  type RationIngredientInput,
} from "@/lib/inventory/ration-balancer";

describe("Enterprise Livestock Feed Ration Balancer Engine", () => {
  const engine = RationBalancerEngine.getInstance();

  const corn: FeedIngredientNutrientProfile = {
    id: "ing-corn",
    name: "Yellow Maize / Corn",
    category: "energy_concentrate",
    dmPercent: 0.88,
    cpPercentDm: 9.5,
    tdnPercentDm: 85.0,
    costPerKgAsFed: 32,
  };

  const mustardCake: FeedIngredientNutrientProfile = {
    id: "ing-mustard-cake",
    name: "Mustard Oil Cake (Khail)",
    category: "protein_concentrate",
    dmPercent: 0.90,
    cpPercentDm: 36.0,
    tdnPercentDm: 74.0,
    costPerKgAsFed: 45,
  };

  const riceStraw: FeedIngredientNutrientProfile = {
    id: "ing-straw",
    name: "Rice Straw (Khor)",
    category: "dry_roughage",
    dmPercent: 0.90,
    cpPercentDm: 4.5,
    tdnPercentDm: 45.0,
    costPerKgAsFed: 8,
  };

  it("calculates standardized nutritional requirements based on live weight and ADG", () => {
    const target = engine.calculateNutritionalRequirements(350, 1.2);

    expect(target.bodyWeightKg).toBe(350);
    expect(target.targetDailyGainKg).toBe(1.2);
    expect(target.dailyDmiKg).toBeCloseTo(9.45, 1);
    expect(target.targetCpPercentDm).toBe(14.5);
    expect(target.targetTdnPercentDm).toBe(70.0);
  });

  it("evaluates balanced ration mix and verifies nutritional adequacy", () => {
    const target = engine.calculateNutritionalRequirements(300, 1.0);

    const ration: RationIngredientInput[] = [
      { ingredient: corn, asFedKg: 3.5 },
      { ingredient: mustardCake, asFedKg: 2.0 },
      { ingredient: riceStraw, asFedKg: 4.0 },
    ];

    const result = engine.evaluateRationFormulation(target, ration);

    expect(result.totalAsFedKg).toBe(9.5);
    expect(result.totalDryMatterKg).toBeGreaterThan(8.0);
    expect(result.crudeProteinPercentDm).toBeGreaterThan(12.0);
    expect(result.tdnPercentDm).toBeGreaterThan(60.0);
    expect(result.totalDailyCostBdt).toBe(3.5 * 32 + 2.0 * 45 + 4.0 * 8); // 112 + 90 + 32 = 234
    expect(result.costPerKgLiveGainExpected).toBe(result.totalDailyCostBdt / 1.0);
  });
});

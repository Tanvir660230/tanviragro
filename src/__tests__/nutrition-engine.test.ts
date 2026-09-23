import {
  NutritionEngine,
  type CattleNutritionState,
  type FeedNutrientProfile,
  type FeedSession,
  type RationIngredientInput,
} from "@/lib/nutrition/nutrition-engine";

describe("NutritionEngine (Enterprise Feed & Nutrition Platform)", () => {
  const engine = NutritionEngine.getInstance();

  const mockCattle: CattleNutritionState[] = [
    { id: "c-001", tagId: "TAG-101", breed: "Brahman", gender: "bull", currentWeightKg: 280, initialWeightKg: 220, targetWeightKg: 400, expectedDailyGainKg: 1.2, daysOnFarm: 45 },
    { id: "c-002", tagId: "TAG-102", breed: "Sahiwal", gender: "heifer", currentWeightKg: 150, initialWeightKg: 140, targetWeightKg: 280, expectedDailyGainKg: 0.7, daysOnFarm: 5 },
    { id: "c-003", tagId: "TAG-103", breed: "Pabna", gender: "bull", currentWeightKg: 350, initialWeightKg: 300, targetWeightKg: 450, expectedDailyGainKg: 1.0, daysOnFarm: 60, roughageOverrideKg: 5.0 },
  ];

  const mockInventory: FeedNutrientProfile[] = [
    { id: "item-corn", name: "Maize Corn", category: "energy_concentrate", dmPercent: 0.88, cpPercentDm: 9.5, tdnPercentDm: 82.0, costPerKgAsFed: 38.0, currentStockKg: 500, lowStockThresholdKg: 100 },
    { id: "item-mustard", name: "Mustard Oil Cake", category: "protein_concentrate", dmPercent: 0.90, cpPercentDm: 35.0, tdnPercentDm: 74.0, costPerKgAsFed: 46.0, currentStockKg: 40, lowStockThresholdKg: 50 },
    { id: "item-straw", name: "Rice Straw", category: "dry_roughage", dmPercent: 0.90, cpPercentDm: 4.0, tdnPercentDm: 45.0, costPerKgAsFed: 8.0, currentStockKg: 1200, lowStockThresholdKg: 200 },
    { id: "item-expired-premix", name: "Premix", category: "mineral_supplement", dmPercent: 0.95, cpPercentDm: 0.0, tdnPercentDm: 0.0, costPerKgAsFed: 150.0, currentStockKg: 10, lowStockThresholdKg: 5, batchNumber: "BX-991", expiryDate: "2026-01-01" },
  ];

  it("calculates animal requirements for adult bull", () => {
    const req = engine.calculateAnimalRequirement(mockCattle[0], 42.0, 8.5);
    expect(req.cattleId).toBe("c-001");
    expect(req.projectedWeightKg).toBe(280);
    expect(req.dailyDmiKg).toBeGreaterThan(6.0);
    expect(req.acclimatizationFactor).toBe(1.0);
    expect(req.isAcclimatizing).toBe(false);
  });

  it("applies progressive ramp factor for new arrival during acclimatization", () => {
    const req = engine.calculateAnimalRequirement(mockCattle[1], 42.0, 8.5);
    expect(req.acclimatizationFactor).toBeLessThan(1.0);
    expect(req.isAcclimatizing).toBe(true);
    expect(req.targetConcentrateKg).toBeLessThan(150 * 0.02);
  });

  it("respects manual roughage override when provided", () => {
    const req = engine.calculateAnimalRequirement(mockCattle[2], 42.0, 8.5);
    expect(req.targetRoughageKg).toBe(5.0);
  });

  it("evaluates balanced ration mix and verifies nutritional adequacy score", () => {
    const ingredients: RationIngredientInput[] = [
      { ingredient: mockInventory[0], asFedKg: 3.5 },
      { ingredient: mockInventory[1], asFedKg: 1.5 },
      { ingredient: mockInventory[2], asFedKg: 3.0 },
    ];
    const res = engine.evaluateRationCompliance(7.0, 14.0, 68.0, 1.2, ingredients);
    expect(res.totalAsFedKg).toBe(8.0);
    expect(res.totalDryMatterKg).toBeGreaterThan(6.5);
    expect(res.crudeProteinPercentDm).toBeGreaterThan(12.0);
    expect(res.tdnPercentDm).toBeGreaterThan(60.0);
    expect(res.nutritionScore).toBeGreaterThanOrEqual(60);
  });

  it("summarizes herd totals, average daily feed cost and FCR", () => {
    const summary = engine.calculateHerdSummary(mockCattle, 42.0, 8.5);
    expect(summary.totalActiveCattle).toBe(3);
    expect(summary.totalDailyAsFedKg).toBeGreaterThan(10);
    expect(summary.totalEstimatedDailyCostBdt).toBeGreaterThan(150);
    expect(summary.averageCostPerHeadBdt).toBeGreaterThan(40);
    expect(summary.averageFcr).toBeGreaterThan(4.0);
    expect(summary.acclimatizingCount).toBe(1);
  });

  it("computes exact Feed Conversion Ratio (FCR = DM intake / Live gain)", () => {
    expect(engine.calculateFcr(70, 10)).toBe(7.0);
    expect(engine.calculateFcr(125, 20)).toBe(6.25);
    expect(engine.calculateFcr(0, 10)).toBe(0);
    expect(engine.calculateFcr(50, 0)).toBe(0);
  });

  it("detects low stock and expired feed items", () => {
    const alerts = engine.evaluateAlerts(mockInventory, [], [], "2026-09-09");
    const lowStockAlert = alerts.find((a) => a.type === "low_feed_stock");
    const expiredAlert = alerts.find((a) => a.type === "expired_feed");
    expect(lowStockAlert?.entityId).toBe("item-mustard");
    expect(expiredAlert?.entityId).toBe("item-expired-premix");
  });

  it("detects missed feeding sessions and high feed waste", () => {
    const sessions: FeedSession[] = [
      { id: "sess-01", businessId: "biz-1", dateISO: "2026-09-08", slot: "morning", scheduledTime: "07:00", targetGroupOrPen: "Pen 1", cattleCount: 10, status: "planned", targetTotalKg: 30, actualTotalKg: 0, totalWasteKg: 0, totalCostBdt: 0, wasteCostBdt: 0, records: [] },
      { id: "sess-02", businessId: "biz-1", dateISO: "2026-09-09", slot: "evening", scheduledTime: "17:30", targetGroupOrPen: "Pen 2", cattleCount: 5, status: "completed", targetTotalKg: 20, actualTotalKg: 20, totalWasteKg: 3.5, totalCostBdt: 700, wasteCostBdt: 122.5, records: [] },
    ];
    const alerts = engine.evaluateAlerts(mockInventory, sessions, [], "2026-09-09");
    expect(alerts.find((a) => a.type === "missed_feeding")?.entityId).toBe("sess-01");
    expect(alerts.find((a) => a.type === "high_feed_waste")?.entityId).toBe("sess-02");
  });

  it("generates protein optimization and bunk management recommendations", () => {
    const summary = engine.calculateHerdSummary(mockCattle, 42.0, 8.5);
    const recs = engine.generateAiRecommendations(summary, mockInventory);
    expect(recs.length).toBeGreaterThanOrEqual(1);
    expect(recs.find((r) => r.category === "growth_acceleration")).toBeDefined();
  });
});

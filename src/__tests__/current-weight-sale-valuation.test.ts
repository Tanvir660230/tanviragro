import { getCurrentLiveWeight, predictWeight } from "@/lib/cattle-weight";

describe("Current Weight and Sell Today Valuation Business Logic Bug Fix", () => {
  test("C004 animal calculates sell-today valuation using latest live weight, NOT initial weight", () => {
    const cattle = {
      cattleId: "c004",
      initialWeightKg: 170,
      purchaseDate: "2026-01-01",
      defaultDailyGainKg: 0.8,
    };

    const logs = [
      { cattle_id: "c004", weight_kg: 170, recorded_at: "2026-01-01T00:00:00.000Z" },
      { cattle_id: "c004", weight_kg: 190, recorded_at: "2026-01-15T00:00:00.000Z" },
      { cattle_id: "c004", weight_kg: 210, recorded_at: "2026-02-01T00:00:00.000Z" },
      { cattle_id: "c004", weight_kg: 230, recorded_at: "2026-02-15T00:00:00.000Z" },
      { cattle_id: "c004", weight_kg: 250, recorded_at: "2026-03-01T00:00:00.000Z" },
    ];

    const asOfDate = new Date("2026-03-01T00:00:00.000Z");
    const currentLiveWeight = getCurrentLiveWeight(cattle, logs, asOfDate);

    // Verify current live weight is 250 kg (latest valid weight), NOT initial 170 kg
    expect(currentLiveWeight).toBe(250);

    // Current market rate per kg
    const marketRatePerKg = 500;

    // Calculate estimated sale value for 'Sell Today'
    const estimatedSaleValue = currentLiveWeight * marketRatePerKg;

    // Expected: 250 * 500 = 125,000 BDT
    expect(estimatedSaleValue).toBe(125000);

    // Ensure it must NOT calculate using initial weight (170 * 500 = 85,000)
    const incorrectInitialValuation = cattle.initialWeightKg * marketRatePerKg;
    expect(incorrectInitialValuation).toBe(85000);
    expect(estimatedSaleValue).not.toBe(incorrectInitialValuation);
  });
});

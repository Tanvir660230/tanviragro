import { KpiEngine } from "@/lib/analytics/kpi-engine";
import { AlertEngine } from "@/lib/analytics/alert-engine";
import { TrendEngine } from "@/lib/analytics/trend-engine";

describe("Phase 6: Farm Financial & Biological KPI Engine", () => {
  test("Computes farm financial KPIs accurately", () => {
    const kpis = KpiEngine.calculateFinancialKPIs(
      500_000, // Revenue
      320_000, // Operating expenses
      150_000, // Inventory valuation
      1_200_000, // Biological assets
      1_000_000 // Invested capital
    );

    expect(kpis.totalRevenue).toBe(500000);
    expect(kpis.totalOperatingExpense).toBe(320000);
    expect(kpis.netFarmProfit).toBe(180000);
    expect(kpis.grossMarginPercent).toBe(36); // (180,000 / 500,000) * 100
    expect(kpis.farmRoiPercent).toBe(18); // (180,000 / 1,000,000) * 100
    expect(kpis.totalInventoryValuation).toBe(150000);
    expect(kpis.totalBiologicalAssetValue).toBe(1200000);
  });

  test("Computes biological herd growth and mortality KPIs", () => {
    const cattle = [
      { purchaseWeightKg: 200, currentWeightKg: 290, daysOnFeed: 90 }, // Gain: 90 kg, 1 kg/d
      { purchaseWeightKg: 220, currentWeightKg: 280, daysOnFeed: 60 }, // Gain: 60 kg, 1 kg/d
    ];

    const bioKpis = KpiEngine.calculateBiologicalKPIs(cattle, 1, 21, 900);

    expect(bioKpis.activeHeadCount).toBe(2);
    expect(bioKpis.totalLiveBiomassKg).toBe(570);
    expect(bioKpis.averageWeightKg).toBe(285);
    expect(bioKpis.averageDailyGainKg).toBe(1);
    expect(bioKpis.feedConversionRatio).toBe(6); // 900kg feed / 150kg gain = 6.0 FCR
    expect(bioKpis.mortalityRatePercent).toBe(4.76); // 1 / 21 * 100
    expect(bioKpis.averageDaysOnFeed).toBe(75);
  });

  test("Handles zero active herd gracefully", () => {
    const emptyBio = KpiEngine.calculateBiologicalKPIs([]);
    expect(emptyBio.activeHeadCount).toBe(0);
    expect(emptyBio.averageDailyGainKg).toBe(0);
  });

  test("Computes inventory and health compliance KPIs", () => {
    const invKpis = KpiEngine.calculateInventoryKPIs(
      [
        { currentStock: 50, lowStockThreshold: 100, unitCost: 40, isOutOfStock: false },
        { currentStock: 0, lowStockThreshold: 20, unitCost: 100, isOutOfStock: true },
        { currentStock: 200, lowStockThreshold: 50, unitCost: 30, isOutOfStock: false },
      ],
      150,
      4500
    );

    expect(invKpis.totalStockValuation).toBe(8000); // (50*40) + (0*100) + (200*30)
    expect(invKpis.lowStockItemsCount).toBe(2);
    expect(invKpis.criticalStockOutCount).toBe(1);

    const healthKpis = KpiEngine.calculateHealthKPIs(10, 9, 2, 1, 0);
    expect(healthKpis.vaccinationComplianceRate).toBe(90);
    expect(healthKpis.activeWithdrawalCount).toBe(2);
  });
});

describe("Phase 6: Multi-Domain Operational Alert Engine", () => {
  test("Consolidates disparate alerts and sorts by strict severity hierarchy", () => {
    const alerts = AlertEngine.compileOperationalAlerts({
      criticalStockOuts: [{ id: "item-1", name: "Wheat Bran" }],
      overdueHealthEvents: [{ id: "h-1", title: "Anthrax Booster", scheduledAt: "2026-01-01", cattleTag: "TAG-1", cattleId: "c-1" }],
      withdrawalRestrictedCattle: [{ cattleId: "c-2", tagId: "TAG-2", withdrawalUntil: "2026-10-01" }],
      lowStockItems: [{ id: "item-2", name: "Mustard Oil Cake", unit: "kg", currentStock: 20, threshold: 50 }],
      loansDueSoon: [{ id: "l-1", lenderName: "Agro Bank", amount: 50000, dueDate: "2026-03-01", isOverdue: false }],
      upcomingHealthEvents: [{ id: "h-2", title: "FMD Vaccine", scheduledAt: "2026-09-15", cattleTag: "TAG-3", cattleId: "c-3" }],
      unweighedCattle: [{ cattleId: "c-4", tagId: "TAG-4", daysSinceLastWeight: 14 }],
    });

    expect(alerts.length).toBe(7);
    // Severity order: critical (rank 1) -> high (rank 2) -> medium (rank 3) -> low (rank 4) -> info (rank 5)
    expect(alerts[0].severity).toBe("critical");
    expect(alerts[1].severity).toBe("critical");
    expect(alerts[2].severity).toBe("high");
    expect(alerts[3].severity).toBe("high");
    expect(alerts[4].severity).toBe("medium");
    expect(alerts[5].severity).toBe("low");
    expect(alerts[6].severity).toBe("info");
  });
});

describe("Phase 6: Historical Trend Series Engine", () => {
  test("Generates 6-month empty monthly buckets", () => {
    const buckets = TrendEngine.buildEmptyMonthlyBuckets(6, new Date("2026-06-15T00:00:00Z"));
    expect(buckets.length).toBe(6);
    expect(buckets[5].monthKey).toBe("2026-06");
    expect(buckets[0].monthKey).toBe("2026-01");
  });

  test("Aggregates sales and expenses into trend buckets", () => {
    const buckets = TrendEngine.buildEmptyMonthlyBuckets(3, new Date("2026-03-15T00:00:00Z"));
    const sales = [
      { amount: 120_000, date: "2026-01-10" },
      { amount: 80_000, date: "2026-01-25" },
      { amount: 150_000, date: "2026-03-05" },
    ];
    const expenses = [
      { amount: 70_000, date: "2026-01-12", category: "feed" },
      { amount: 30_000, date: "2026-01-20", category: "medicine" },
      { amount: 60_000, date: "2026-03-10", category: "feed" },
    ];

    const trends = TrendEngine.compileMonthlyTrends(buckets, sales, expenses);

    expect(trends[0].monthKey).toBe("2026-01");
    expect(trends[0].revenue).toBe(200_000);
    expect(trends[0].expense).toBe(100_000);
    expect(trends[0].feedCost).toBe(70_000);
    expect(trends[0].netProfit).toBe(100_000);

    expect(trends[1].monthKey).toBe("2026-02");
    expect(trends[1].revenue).toBe(0);
    expect(trends[1].expense).toBe(0);

    expect(trends[2].monthKey).toBe("2026-03");
    expect(trends[2].revenue).toBe(150_000);
    expect(trends[2].feedCost).toBe(60_000);
    expect(trends[2].netProfit).toBe(90_000);
  });
});
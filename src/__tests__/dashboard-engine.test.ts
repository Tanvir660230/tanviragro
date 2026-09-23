import { DashboardDataService } from "@/lib/services/dashboard.service";
import type { Dictionary } from "@/i18n/getDictionary";

describe("Phase 7: Centralized Dashboard Data & Analytics Service", () => {
  test("DashboardDataService exposes KPI, Trend, and Alert engines uniformly", () => {
    expect(DashboardDataService.kpi).toBeDefined();
    expect(DashboardDataService.trend).toBeDefined();
    expect(DashboardDataService.alert).toBeDefined();
  });

  test("DashboardDataService integrates with KpiEngine to calculate financial and biological metrics", () => {
    const finKpis = DashboardDataService.kpi.calculateFinancialKPIs(1_000_000, 600_000, 150_000, 800_000, 500_000);
    expect(finKpis.totalRevenue).toBe(1_000_000);
    expect(finKpis.netFarmProfit).toBe(400_000);
    expect(finKpis.grossMarginPercent).toBe(40);
    expect(finKpis.farmRoiPercent).toBe(80);

    const bioKpis = DashboardDataService.kpi.calculateBiologicalKPIs([
      { purchaseWeightKg: 200, currentWeightKg: 250, daysOnFeed: 50 },
      { purchaseWeightKg: 220, currentWeightKg: 280, daysOnFeed: 50 },
    ]);
    expect(bioKpis.activeHeadCount).toBe(2);
    expect(bioKpis.totalLiveBiomassKg).toBe(530);
    expect(bioKpis.averageWeightKg).toBe(265);
    expect(bioKpis.averageDailyGainKg).toBe(1.1);
  });

  test("DashboardDataService integrates with TrendEngine to compile trend series", () => {
    const buckets = DashboardDataService.trend.buildEmptyMonthlyBuckets(3, new Date("2026-03-31T00:00:00Z"));
    const sales = [{ amount: 50_000, date: "2026-02-15" }];
    const expenses = [{ amount: 20_000, date: "2026-02-20", category: "feed" }];

    const trends = DashboardDataService.trend.compileMonthlyTrends(buckets, sales, expenses);
    const feb = trends.find((t) => t.monthKey === "2026-02");
    expect(feb).toBeDefined();
    expect(feb?.revenue).toBe(50_000);
    expect(feb?.expense).toBe(20_000);
    expect(feb?.feedCost).toBe(20_000);
    expect(feb?.netProfit).toBe(30_000);
  });
});

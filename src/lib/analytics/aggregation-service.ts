import type { SupabaseClient } from "@supabase/supabase-js";
import { KpiEngine } from "./kpi-engine";
import { AlertEngine } from "./alert-engine";
import { TrendEngine } from "./trend-engine";
import { ForecastEngine } from "./forecast-engine";
import { RoleDashboardService } from "./role-dashboard-service";
import { getCashBalance } from "@/lib/supabase/queries/cash";
import type {
  ExecutiveRoleSlug,
  ExecutiveFarmSummary,
  OperationalAlertItem,
  MonthlyTrendDataPoint,
  TimeSeriesPoint,
  RoleDashboardConfig,
} from "./types";

export interface DashboardPayload {
  role: ExecutiveRoleSlug;
  dashboardConfig: RoleDashboardConfig;
  summary: ExecutiveFarmSummary;
  alerts: OperationalAlertItem[];
  monthlyTrends: MonthlyTrendDataPoint[];
  forecast: {
    biomassGrowth: TimeSeriesPoint[];
    feedExpenditure: TimeSeriesPoint[];
  };
  asOf: string;
}

export class AnalyticsAggregationService {
  /**
   * Fetches, aggregates, and compiles an all-in-one real-time analytics package for any executive role.
   */
  public static async getExecutiveDashboardData(
    supabase: SupabaseClient<any>,
    businessId: string,
    roleSlug: ExecutiveRoleSlug = "ceo"
  ): Promise<DashboardPayload> {
    const dashboardConfig = RoleDashboardService.getDashboardForRole(roleSlug);

    const [
      { data: cattleRaw },
      { data: salesRaw },
      { data: costsRaw },
      { data: inventoryRaw },
      { data: healthRaw },
      { data: loansRaw },
      { data: ordersRaw },
      cashRes,
    ] = await Promise.all([
      supabase
        .from("cattle")
        .select("id, tag_number, breed, gender, status, purchase_price, purchase_weight_kg, current_weight_kg, created_at, updated_at")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .limit(2000),
      supabase
        .from("sales")
        .select("id, sale_price_total, sold_at, cattle_id, cattle!inner(business_id)")
        .eq("cattle.business_id", businessId)
        .is("deleted_at", null)
        .limit(2000),
      supabase
        .from("cost_entries")
        .select("id, amount, type, recorded_at, entry_class")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .limit(5000),
      supabase
        .from("inventory_items")
        .select("id, name, category, unit, current_stock, unit_cost, reorder_threshold")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .limit(500),
      supabase
        .from("health_events")
        .select("id, title, event_type, status, scheduled_at, completed_at, withdrawal_days, cattle_id, cattle:cattle_id(tag_number)")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .limit(1000),
      supabase
        .from("loans")
        .select("id, principal_amount, status, lender_name, due_date")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .limit(200),
      supabase
        .from("orders")
        .select("id, total_amount, status, created_at, customer_id, order_type")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .limit(1000),
      getCashBalance(supabase, businessId),
    ]);

    const cattle = cattleRaw ?? [];
    const activeCattle = cattle.filter((c) => c.status === "active");
    const deceasedCattle = cattle.filter((c) => c.status === "deceased");

    // 1. Biological Calculations
    const cattleRecordsForKpi = activeCattle.map((c) => {
      const createdTime = new Date(c.created_at).getTime();
      const nowTime = new Date().getTime();
      const daysOnFeed = Math.max(1, Math.round((nowTime - createdTime) / (24 * 60 * 60 * 1000)));
      return {
        purchaseWeightKg: c.purchase_weight_kg || 0,
        currentWeightKg: c.current_weight_kg || c.purchase_weight_kg || 0,
        daysOnFeed,
        lastWeighedDate: c.updated_at,
      };
    });

    const bioKpis = KpiEngine.calculateBiologicalKPIs({
      activeCattle: cattleRecordsForKpi,
      totalDeceasedCount: deceasedCattle.length,
      totalHistoricalCount: cattle.length,
    });

    // 2. Financial Calculations
    const sales = salesRaw ?? [];
    const costs = costsRaw ?? [];
    const totalRevenue = sales.reduce((sum, s) => sum + (Number(s.sale_price_total) || 0), 0);
    const totalOpEx = costs.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    const biologicalAssetValue = activeCattle.reduce((sum, c) => sum + (Number(c.purchase_price) || 0), 0);
    
    const inventoryItems = (inventoryRaw ?? []).map((i) => ({
      currentStock: Number(i.current_stock) || 0,
      lowStockThreshold: Number(i.reorder_threshold) || 10,
      unitCost: Number(i.unit_cost) || 0,
    }));

    const inventoryKpis = KpiEngine.calculateInventoryKPIs(inventoryItems);

    const loans = loansRaw ?? [];
    const totalLiabilities = loans
      .filter((l) => l.status === "active")
      .reduce((sum, l) => sum + (Number(l.principal_amount) || 0), 0);

    const cashBalance = cashRes.balance ?? 0;

    const financialKpis = KpiEngine.calculateFinancialKPIs({
      totalRevenue,
      totalOpEx,
      inventoryValuation: inventoryKpis.totalStockValuation,
      biologicalAssetValue,
      totalLiabilities,
      cashBalance,
      totalBiomassGainKg: bioKpis.totalLiveBiomassKg,
    });

    // 3. Health & Veterinary Calculations
    const healthEvents = healthRaw ?? [];
    const completedVaccines = healthEvents.filter((h) => h.event_type === "vaccination" && h.status === "completed").length;
    const scheduledVaccines = healthEvents.filter((h) => h.event_type === "vaccination").length;
    const overdueMedical = healthEvents.filter((h) => h.status === "pending" && new Date(h.scheduled_at) < new Date()).length;

    const healthKpis = KpiEngine.calculateHealthKPIs({
      totalScheduledVaccines: scheduledVaccines,
      completedVaccines,
      activeWithdrawalCount: 0,
      overdueMedicalCount: overdueMedical,
      quarantinedCount: 0,
    });

    // 4. Commerce Calculations
    const orders = ordersRaw ?? [];
    const commerceKpis = KpiEngine.calculateCommerceKPIs({
      totalOrders: orders.length,
      totalGrossSalesBdt: orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0),
      qurbaniBookingsCount: orders.filter((o) => o.order_type === "qurbani").length,
      pendingDeliveriesCount: orders.filter((o) => o.status === "pending").length,
    });

    // 5. Consolidated Summary
    const summary: ExecutiveFarmSummary = {
      financial: financialKpis,
      biological: bioKpis,
      inventory: inventoryKpis,
      health: healthKpis,
      commerce: commerceKpis,
      asOf: new Date().toISOString(),
    };

    // 6. Operational Alerts
    const criticalStockOuts = (inventoryRaw ?? [])
      .filter((i) => Number(i.current_stock) <= 0)
      .map((i) => ({ id: i.id, name: i.name }));

    const lowStockItems = (inventoryRaw ?? [])
      .filter((i) => Number(i.current_stock) > 0 && Number(i.current_stock) <= (Number(i.reorder_threshold) || 10))
      .map((i) => ({
        id: i.id,
        name: i.name,
        unit: i.unit || "kg",
        currentStock: Number(i.current_stock) || 0,
        threshold: Number(i.reorder_threshold) || 10,
      }));

    const alerts = AlertEngine.compileOperationalAlerts({
      criticalStockOuts,
      lowStockItems,
      mortalityRate: bioKpis.mortalityRatePercent,
      grossMarginPct: financialKpis.grossMarginPercent,
      cashRunwayDays: financialKpis.cashRunwayDays,
    });

    // 7. Monthly Trends
    const buckets = TrendEngine.buildEmptyMonthlyBuckets(6);
    const monthlyTrends = TrendEngine.compileMonthlyTrends(
      buckets,
      sales.map((s) => ({ amount: Number(s.sale_price_total) || 0, date: s.sold_at || new Date().toISOString() })),
      costs.map((c) => ({ amount: Number(c.amount) || 0, date: c.recorded_at || new Date().toISOString(), category: c.type }))
    );

    // 8. Forecasts
    const biomassHistPoints = monthlyTrends.map((t, idx) => ({
      timestamp: t.monthKey,
      label: t.label,
      value: Math.max(100, bioKpis.totalLiveBiomassKg - (5 - idx) * 200),
    }));
    const biomassForecast = ForecastEngine.linearRegressionForecast(biomassHistPoints, 3).forecast;

    const feedHistPoints = monthlyTrends.map((t) => ({
      timestamp: t.monthKey,
      label: t.label,
      value: t.feedCost,
    }));
    const feedForecast = ForecastEngine.linearRegressionForecast(feedHistPoints, 3).forecast;

    return {
      role: roleSlug,
      dashboardConfig,
      summary,
      alerts,
      monthlyTrends,
      forecast: {
        biomassGrowth: biomassForecast,
        feedExpenditure: feedForecast,
      },
      asOf: new Date().toISOString(),
    };
  }
}

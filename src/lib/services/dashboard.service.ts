import type { SupabaseClient } from "@supabase/supabase-js";
import { KpiEngine } from "@/lib/analytics/kpi-engine";
import { TrendEngine } from "@/lib/analytics/trend-engine";
import { AlertEngine } from "@/lib/analytics/alert-engine";
import { getCashBalance, type CashBalance } from "@/lib/supabase/queries/cash";
import { getLiveHerdValuation, type LiveValuationResult } from "@/lib/supabase/queries/valuation";
import {
  getDashboardStats,
  getRecentActivity,
  type DashboardStats,
  type ActivityItem,
} from "@/lib/supabase/queries/dashboard";
import {
  getSmartInsights,
  getPortfolioHealthScore,
  getMonthlyRevenueVsCost,
  getPreviousPeriodStats,
  type MonthlyPoint,
  type HealthScore,
  type InsightItem,
  type PreviousPeriodStats,
} from "@/lib/supabase/queries/analytics";
import type { Dictionary } from "@/i18n/getDictionary";

export interface UnifiedDashboardData {
  businessId: string;
  stats: DashboardStats;
  activities: ActivityItem[];
  valuation: LiveValuationResult;
  insights: InsightItem[];
  healthScore: HealthScore;
  monthlyPoints: MonthlyPoint[];
  prevStats: PreviousPeriodStats;
  trends: {
    cattleTrend?: { pct: number };
    salesTrend?: { pct: number };
    costTrend?: { pct: number; inverted: boolean };
    profitTrend?: { pct: number };
  };
  cashBalance?: CashBalance;
  timestamp: string;
}

export interface DashboardFilterOptions {
  startDate?: string;
  endDate?: string;
  farmId?: string;
  limit?: number;
}

/**
 * Centralized Dashboard Data Engine and Service
 * Unified Single Source of Truth for all executive dashboards, widgets, and KPI summaries.
 */
export class DashboardDataService {
  /**
   * Fetches unified dashboard payload in an optimized parallel batch.
   */
  public static async getUnifiedDashboardData(
    supabase: SupabaseClient<any>,
    businessId: string,
    t?: Dictionary
  ): Promise<UnifiedDashboardData> {
    if (!businessId) {
      throw new Error("Business ID is required to fetch dashboard data.");
    }

    const [
      stats,
      activities,
      valuation,
      insights,
      healthScore,
      monthlyPoints,
      prevStats,
    ] = await Promise.all([
      getDashboardStats(supabase, businessId),
      getRecentActivity(supabase, businessId, t),
      getLiveHerdValuation(supabase, businessId),
      getSmartInsights(supabase, businessId, t),
      getPortfolioHealthScore(supabase, businessId),
      getMonthlyRevenueVsCost(supabase, businessId),
      getPreviousPeriodStats(supabase, businessId),
    ]);

    // Compute standardized percentage trends
    const cattleTrend =
      prevStats.totalCattle > 0
        ? { pct: ((stats.totalCattle - prevStats.totalCattle) / prevStats.totalCattle) * 100 }
        : undefined;

    const salesTrend =
      prevStats.totalSales > 0
        ? { pct: ((stats.totalSales - prevStats.totalSales) / prevStats.totalSales) * 100 }
        : undefined;

    const costTrend =
      prevStats.totalInvestment > 0
        ? {
            pct: ((stats.totalInvestment - prevStats.totalInvestment) / prevStats.totalInvestment) * 100,
            inverted: true,
          }
        : undefined;

    const profitTrend =
      prevStats.netProfitLoss !== 0
        ? { pct: ((stats.netProfitLoss - prevStats.netProfitLoss) / Math.abs(prevStats.netProfitLoss)) * 100 }
        : undefined;

    return {
      businessId,
      stats,
      activities,
      valuation,
      insights,
      healthScore,
      monthlyPoints,
      prevStats,
      trends: {
        cattleTrend,
        salesTrend,
        costTrend,
        profitTrend,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Retrieves live cash balance through the centralized Cash Engine
   */
  public static async getCashOverview(
    supabase: SupabaseClient<any>,
    businessId: string
  ): Promise<CashBalance> {
    return getCashBalance(supabase, businessId);
  }

  /**
   * Retrieves live valuation of the active herd
   */
  public static async getHerdValuation(
    supabase: SupabaseClient<any>,
    businessId: string
  ): Promise<LiveValuationResult> {
    return getLiveHerdValuation(supabase, businessId);
  }

  /**
   * Exposes KPI Engine access for calculations
   */
  public static get kpi() {
    return KpiEngine;
  }

  /**
   * Exposes Trend Engine access for analytics
   */
  public static get trend() {
    return TrendEngine;
  }

  /**
   * Exposes Alert Engine access for operational notifications
   */
  public static get alert() {
    return AlertEngine;
  }
}

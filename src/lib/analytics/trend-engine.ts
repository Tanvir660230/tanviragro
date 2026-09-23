import type { MonthlyTrendDataPoint } from "./types";

export class TrendEngine {
  /**
   * Builds an empty monthly bucket array for the preceding N months.
   */
  public static buildEmptyMonthlyBuckets(monthCount = 6, referenceDate = new Date()): MonthlyTrendDataPoint[] {
    const buckets: MonthlyTrendDataPoint[] = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthNum = d.getMonth() + 1;
      const monthKey = `${year}-${String(monthNum).padStart(2, "0")}`;
      const label = `${monthNames[d.getMonth()]} ${year}`;

      buckets.push({
        monthKey,
        label,
        revenue: 0,
        expense: 0,
        netProfit: 0,
        feedCost: 0,
      });
    }

    return buckets;
  }

  /**
   * Aggregates raw transactions into monthly trend series.
   */
  public static compileMonthlyTrends(
    buckets: MonthlyTrendDataPoint[],
    sales: { amount: number; date: string }[],
    expenses: { amount: number; date: string; category?: string }[]
  ): MonthlyTrendDataPoint[] {
    const map = new Map<string, MonthlyTrendDataPoint>();
    for (const b of buckets) {
      map.set(b.monthKey, { ...b });
    }

    for (const sale of sales) {
      const key = sale.date.slice(0, 7);
      const bucket = map.get(key);
      if (bucket) {
        bucket.revenue += sale.amount;
      }
    }

    for (const exp of expenses) {
      const key = exp.date.slice(0, 7);
      const bucket = map.get(key);
      if (bucket) {
        bucket.expense += exp.amount;
        if (exp.category === "feed") {
          bucket.feedCost += exp.amount;
        }
      }
    }

    // Compute net profit
    return Array.from(map.values()).map((b) => ({
      ...b,
      revenue: parseFloat(b.revenue.toFixed(2)),
      expense: parseFloat(b.expense.toFixed(2)),
      feedCost: parseFloat(b.feedCost.toFixed(2)),
      netProfit: parseFloat((b.revenue - b.expense).toFixed(2)),
    }));
  }
}
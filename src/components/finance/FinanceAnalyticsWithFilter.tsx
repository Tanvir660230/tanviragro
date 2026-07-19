"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import type { SaleRecord } from "./PLSummary";
import type { CostEntry } from "./CostList";

const FinanceAnalyticsPanel = dynamic(
  () => import("./FinanceAnalyticsPanel").then(m => m.FinanceAnalyticsPanel),
  { ssr: false }
);
import type { MonthlyPoint } from "@/lib/supabase/queries/analytics";

type Range = "this-month" | "last-30" | "last-3m" | "last-6m" | "all" | "custom";

const RANGES: { value: Range; label: string }[] = [
  { value: "this-month", label: "This Month" },
  { value: "last-30", label: "Last 30 Days" },
  { value: "last-3m", label: "Last 3 Months" },
  { value: "last-6m", label: "Last 6 Months" },
  { value: "all", label: "All Time" },
  { value: "custom", label: "Custom" },
];

function getRangeDates(range: Range, customFrom: string, customTo: string): { from: Date | null; to: Date } {
  const to = new Date();
  to.setHours(23, 59, 59, 999);

  if (range === "custom") {
    const f = customFrom ? new Date(customFrom + "T00:00:00") : null;
    const t = customTo ? new Date(customTo + "T23:59:59") : to;
    return { from: f, to: t };
  }

  if (range === "all") return { from: null, to };

  const from = new Date();
  if (range === "this-month") {
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
  } else if (range === "last-30") {
    from.setDate(from.getDate() - 30);
    from.setHours(0, 0, 0, 0);
  } else if (range === "last-3m") {
    from.setMonth(from.getMonth() - 3);
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
  } else if (range === "last-6m") {
    from.setMonth(from.getMonth() - 6);
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
  }

  return { from, to };
}

function buildMonthlyData(
  filteredSales: SaleRecord[],
  filteredCosts: CostEntry[],
  monthlyConsumptions: { month_yr: string; category: string; total_cost: number }[],
  from: Date | null,
  to: Date
): MonthlyPoint[] {
  // Determine month range to display
  const start = from ?? (filteredSales.length || filteredCosts.length || monthlyConsumptions.length
    ? new Date(
        Math.min(
          ...[
            ...filteredSales.map((s) => new Date(s.sold_at).getTime()),
            ...filteredCosts.map((c) => new Date(c.recorded_at).getTime()),
            ...monthlyConsumptions.map((c) => new Date(c.month_yr + "-01T00:00:00").getTime()),
          ]
        )
      )
    : new Date());

  const monthMap: Record<string, { revenue: number; cost: number }> = {};

  // Build month skeleton from start to to
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cur <= endMonth) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
    monthMap[key] = { revenue: 0, cost: 0 };
    cur.setMonth(cur.getMonth() + 1);
  }

  for (const s of filteredSales) {
    const key = s.sold_at.slice(0, 7);
    if (monthMap[key]) {
      monthMap[key].revenue += Number(s.sale_price_total);
      // Include cattle purchase cost in the sale month so chart P&L matches summary
      monthMap[key].cost += Number(s.purchase_price ?? 0);
    }
  }
  for (const c of filteredCosts) {
    const key = c.recorded_at.slice(0, 7);
    if (monthMap[key]) monthMap[key].cost += Number(c.amount);
  }
  for (const c of monthlyConsumptions) {
    // If there is a date range filter, skip months entirely outside the range.
    // Since we only have month_yr, we assume the whole month is included if the month is >= from month and <= to month
    const mDate = new Date(c.month_yr + "-01T00:00:00");
    if (from && mDate < new Date(from.getFullYear(), from.getMonth(), 1)) continue;
    if (mDate > new Date(to.getFullYear(), to.getMonth(), 1)) continue;

    if (monthMap[c.month_yr]) {
      monthMap[c.month_yr].cost += Number(c.total_cost);
    }
  }

  return Object.entries(monthMap).map(([month, { revenue, cost }]) => {
    const [y, m] = month.split("-");
    const label = new Date(+y, +m - 1, 1).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
    return { month, label, revenue, cost };
  });
}

interface Props {
  allSales: SaleRecord[];
  allCosts: CostEntry[];
  monthlyConsumptions: { month_yr: string; category: string; total_cost: number }[];
  unrealizedInvestment: number;
  feedCostByCattle?: Record<string, number>;
  directCostByCattle?: Record<string, number>;
}

export function FinanceAnalyticsWithFilter({ allSales, allCosts, monthlyConsumptions, unrealizedInvestment, feedCostByCattle = {}, directCostByCattle = {} }: Props) {
  const [range, setRange] = useState<Range>("last-6m");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { filteredSales, filteredCosts, monthlyData, totalFixed, totalVariable, totalFeed, totalOtherInv } = useMemo(() => {
    const { from, to } = getRangeDates(range, customFrom, customTo);

    const filteredSales = from
      ? allSales.filter((s) => new Date(s.sold_at) >= from && new Date(s.sold_at) <= to)
      : allSales.filter((s) => new Date(s.sold_at) <= to);

    const filteredCosts = from
      ? allCosts.filter((c) => new Date(c.recorded_at) >= from && new Date(c.recorded_at) <= to)
      : allCosts.filter((c) => new Date(c.recorded_at) <= to);

    const totalFixed = filteredCosts
      .filter((e) => e.type === "fixed")
      .reduce((s, e) => s + Number(e.amount), 0);
    const totalVariable = filteredCosts
      .filter((e) => e.type === "variable")
      .reduce((s, e) => s + Number(e.amount), 0);

    const filteredMonthlyConsumptions = monthlyConsumptions.filter(c => {
        const mDate = new Date(c.month_yr + "-01T00:00:00");
        if (from && mDate < new Date(from.getFullYear(), from.getMonth(), 1)) return false;
        if (mDate > new Date(to.getFullYear(), to.getMonth(), 1)) return false;
        return true;
    });

    const totalFeed = filteredMonthlyConsumptions
      .filter((c) => c.category === "feed")
      .reduce((s, c) => s + Number(c.total_cost), 0);
    const totalOtherInv = filteredMonthlyConsumptions
      .filter((c) => c.category !== "feed")
      .reduce((s, c) => s + Number(c.total_cost), 0);

    const monthlyData = buildMonthlyData(filteredSales, filteredCosts, filteredMonthlyConsumptions, from, to);

    return { filteredSales, filteredCosts, monthlyData, totalFixed, totalVariable, totalFeed, totalOtherInv };
  }, [range, customFrom, customTo, allSales, allCosts, monthlyConsumptions]);

  return (
    <div className="space-y-5">
      {/* Date range selector */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1 overflow-x-auto scrollbar-none flex-nowrap shrink-0 max-w-full">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0",
                  range === r.value
                    ? "bg-background text-foreground shadow-card"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground shrink-0 hidden sm:block">
            {filteredSales.length} sale{filteredSales.length !== 1 ? "s" : ""} · {filteredCosts.length} entr{filteredCosts.length !== 1 ? "ies" : "y"}
          </p>
        </div>
        {range === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm flex-1"
            />
            <span className="text-muted-foreground text-sm shrink-0">–</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm flex-1"
            />
          </div>
        )}
      </div>

      <FinanceAnalyticsPanel
        monthlyData={monthlyData}
        sales={filteredSales}
        totalFixedCosts={totalFixed}
        totalVariableCosts={totalVariable}
        totalFeedCosts={totalFeed}
        totalOtherInventoryCosts={totalOtherInv}
        unrealizedInvestment={unrealizedInvestment}
        feedCostByCattle={feedCostByCattle}
        directCostByCattle={directCostByCattle}
      />
    </div>
  );
}

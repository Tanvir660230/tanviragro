"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { fmtBDTFull, fmtDate } from "@/lib/format";
import type { SaleRecord } from "./PLSummary";

const SHOW_LIMIT = 20;

function daysInPen(purchaseDate: string | undefined, soldAt: string): number {
  if (!purchaseDate) return 0;
  const p = new Date(purchaseDate + "T00:00:00").getTime();
  const s = new Date(soldAt + "T00:00:00").getTime();
  return Math.max(0, Math.round((s - p) / 86_400_000));
}

export function PerHeadROITable({
  sales,
  totalFixedCosts,
  feedCostByCattle = {},
  directCostByCattle = {},
}: {
  sales: SaleRecord[];
  totalFixedCosts: number;
  feedCostByCattle?: Record<string, number>;
  directCostByCattle?: Record<string, number>;
}) {
  const [showAll, setShowAll] = useState(false);

  if (!sales.length) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No sales recorded yet.
      </p>
    );
  }

  const enriched = sales.map((s) => ({
    ...s,
    days: daysInPen(s.purchase_date, s.sold_at),
  }));

  const totalDays = enriched.reduce((sum, s) => sum + s.days, 0);
  const showFixedShare = totalFixedCosts > 0;

  const rows = enriched
    .map((s) => {
      // If no purchase dates recorded, split fixed costs equally among all sales
      const fixedShare =
        totalDays > 0
          ? (s.days / totalDays) * totalFixedCosts
          : totalFixedCosts / enriched.length;
      const feedCost = feedCostByCattle[s.cattle_id] ?? 0;
      const directCost = directCostByCattle[s.cattle_id] ?? 0;
      const totalCost = (s.purchase_price ?? 0) + feedCost + directCost + fixedShare;
      const profit = s.sale_price_total - totalCost;
      const margin = s.sale_price_total > 0
        ? (profit / s.sale_price_total) * 100
        : profit >= 0 ? 0 : -100;
      return { ...s, fixedShare, profit, margin };
    })
    .sort((a, b) => b.profit - a.profit);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {[
              { h: "#", left: true },
              { h: "Cattle", left: true },
              { h: "Sold", left: false },
              { h: "Days in Pen", left: false },
              { h: "Revenue", left: false },
              ...(showFixedShare ? [{ h: "Fixed Share", left: false }] : []),
              { h: "Net Profit", left: false },
              { h: "Margin", left: false },
            ].map(({ h, left }) => (
              <th
                key={h}
                className={cn(
                  "px-3 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap",
                  left ? "text-left" : "text-right"
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {(showAll ? rows : rows.slice(0, SHOW_LIMIT)).map((s, i) => (
            <tr key={s.id} className="hover:bg-muted/20 transition-colors">
              <td className="px-3 py-2.5 text-muted-foreground text-xs">
                {i + 1}
              </td>
              <td className="px-3 py-2.5 font-medium">
                #{s.cattle_tag ?? s.cattle_id.slice(0, 6)}
              </td>
              <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">
                {fmtDate(s.sold_at, { day: "numeric", month: "short" })}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {s.days > 0 ? `${s.days}d` : "—"}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {fmtBDTFull(s.sale_price_total)}
              </td>
              {showFixedShare && (
                <td className="px-3 py-2.5 text-right tabular-nums text-orange-600 dark:text-orange-400">
                  {fmtBDTFull(s.fixedShare)}
                </td>
              )}
              <td
                className={cn(
                  "px-3 py-2.5 text-right tabular-nums font-semibold",
                  s.profit >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive"
                )}
              >
                {s.profit >= 0 ? "+" : "−"}
                {fmtBDTFull(Math.abs(s.profit))}
              </td>
              <td className="px-3 py-2.5 text-right">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    s.margin >= 20
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                      : s.margin >= 5
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                        : "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
                  )}
                >
                  {s.margin.toFixed(1)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!showAll && rows.length > SHOW_LIMIT && (
        <div className="border-t border-border px-4 py-3 text-center">
          <button
            onClick={() => setShowAll(true)}
            className="text-sm text-primary hover:underline font-medium"
          >
            Show {rows.length - SHOW_LIMIT} more sale{rows.length - SHOW_LIMIT !== 1 ? "s" : ""}
          </button>
        </div>
      )}
      {showFixedShare && totalDays === 0 && (
        <p className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
          Add cattle purchase dates to enable proportional fixed cost allocation.
        </p>
      )}
    </div>
  );
}

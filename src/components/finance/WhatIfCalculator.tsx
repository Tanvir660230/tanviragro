"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, Users, Banknote, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/I18nProvider";

export type WhatIfCattle = {
  id: string;
  tag_id: string;
  initial_weight_kg: number;
  purchase_date: string;
  purchase_price: number;
  latestWeight: number | null;
  weightIsEstimated?: boolean; // true when there's no real weight log to base latestWeight on
  feed_cost: number;
  direct_cost: number;
  overhead_cost: number;
  totalCostBasis: number; // purchase + feed + vet + overhead
};

type RowState = {
  selected: boolean;
  pricePerKg: string;
};

function bdt(n: number) {
  return "৳" + Math.round(n).toLocaleString("en-IN");
}

function estimateCurrentWeight(c: WhatIfCattle, defaultDailyGainKg: number, now: number) {
  if (c.latestWeight != null) return c.latestWeight;
  const days = Math.max(0, Math.floor(
    (now - new Date(c.purchase_date + "T00:00:00").getTime()) / 86400000
  ));
  return c.initial_weight_kg + days * defaultDailyGainKg;
}

export function WhatIfCalculator({
  cattle,
  defaultMarketPricePerKg,
  defaultDailyGainKg,
}: {
  cattle: WhatIfCattle[];
  defaultMarketPricePerKg: number;
  defaultDailyGainKg: number;
}) {
  const { t } = useTranslation();
  const tr = t.finance.whatif;
  const [now] = useState(() => Date.now());
  const defaultPrice = defaultMarketPricePerKg > 0 ? String(defaultMarketPricePerKg) : "";

  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(cattle.map((c) => [c.id, { selected: false, pricePerKg: defaultPrice }]))
  );
  const [globalPrice, setGlobalPrice] = useState(defaultPrice);

  function applyGlobalPrice(price: string) {
    setGlobalPrice(price);
    setRows((prev) => {
      const next = { ...prev };
      for (const c of cattle) {
        next[c.id] = { ...(next[c.id] || { selected: false }), pricePerKg: price };
      }
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setRows((prev) => {
      const next = { ...prev };
      for (const c of cattle) {
        next[c.id] = { ...(next[c.id] || { pricePerKg: globalPrice }), selected: checked };
      }
      return next;
    });
  }

  const selectedCattle = cattle.filter((c) => rows[c.id]?.selected);

  const results = selectedCattle.map((c) => {
    const weight = estimateCurrentWeight(c, defaultDailyGainKg, now);
    const price = parseFloat(rows[c.id]?.pricePerKg ?? "0") || 0;
    const revenue = weight * price;
    const cost = c.totalCostBasis;
    const profit = revenue - cost;
    const roi = cost > 0 ? (profit / cost) * 100 : 0;
    return { c, weight, revenue, cost, profit, roi };
  });

  const totalRevenue = results.reduce((s, r) => s + r.revenue, 0);
  const totalCost    = results.reduce((s, r) => s + r.cost, 0);
  const totalProfit  = totalRevenue - totalCost;
  const totalROI     = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  const allSelected = cattle.length > 0 && cattle.every((c) => rows[c.id]?.selected);

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-card p-5 space-y-4 shadow-card ring-1 ring-black/5">
        <div>
          <h2 className="font-semibold text-base tracking-tight">{tr.title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tr.subtitle}
          </p>
        </div>

        {/* Global price setter */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/40 px-4 py-3">
          <label className="text-sm text-muted-foreground shrink-0">{tr.global_price_label}</label>
          <input
            type="number"
            min="0"
            step="10"
            value={globalPrice}
            onChange={(e) => applyGlobalPrice(e.target.value)}
            placeholder="যেমন: ৩৫০"
            className="w-32 rounded-lg border border-input bg-background px-3 py-1.5 text-sm shadow-card"
          />
          <span className="text-xs text-muted-foreground">{tr.global_price_hint}</span>
        </div>

        {cattle.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">{tr.no_active_cattle}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl ring-1 ring-black/5">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border/60">
                  <th className="px-3 py-2.5 text-left">
                    <input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} className="rounded" />
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold text-xs text-muted-foreground uppercase tracking-wider">{tr.col_tag}</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-xs text-muted-foreground uppercase tracking-wider">{tr.col_weight}</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-xs text-muted-foreground uppercase tracking-wider">{tr.col_cost}</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-xs text-muted-foreground uppercase tracking-wider">{tr.col_price}</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-xs text-muted-foreground uppercase tracking-wider">{tr.col_revenue}</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-xs text-muted-foreground uppercase tracking-wider">{tr.col_profit}</th>
                </tr>
              </thead>
              <tbody>
                {cattle.map((c) => {
                  const row = rows[c.id] ?? { selected: false, pricePerKg: defaultPrice };
                  const weight = estimateCurrentWeight(c, defaultDailyGainKg, now);
                  const price  = parseFloat(row.pricePerKg) || 0;
                  const revenue = row.selected ? weight * price : 0;
                  const profit  = row.selected ? revenue - c.totalCostBasis : 0;

                  return (
                    <tr key={c.id} className={cn("border-b border-border/40 transition-colors", row.selected ? "bg-primary/5" : "hover:bg-muted/20")}>
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={(e) => setRows((prev) => ({ ...prev, [c.id]: { ...(prev[c.id] || { pricePerKg: globalPrice }), selected: e.target.checked } }))}
                          className="rounded"
                        />
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-primary">#{c.tag_id}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {weight.toFixed(1)} {tr.kg_unit}
                        {c.weightIsEstimated && <span className="text-xs text-muted-foreground ml-1">{tr.estimated_tag}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        <div>{bdt(c.totalCostBasis)}</div>
                        {(c.feed_cost > 0 || c.direct_cost > 0 || c.overhead_cost > 0) && (
                          <div className="text-[10px] text-muted-foreground/60 leading-tight">
                            pur {bdt(c.purchase_price)}
                            {c.feed_cost > 0 ? `, f ${bdt(c.feed_cost)}` : ""}
                            {c.direct_cost > 0 ? `, m ${bdt(c.direct_cost)}` : ""}
                            {c.overhead_cost > 0 ? `, oh ${bdt(c.overhead_cost)}` : ""}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={row.pricePerKg}
                          onChange={(e) => setRows((prev) => ({ ...prev, [c.id]: { ...(prev[c.id] || { selected: false }), pricePerKg: e.target.value } }))}
                          className="w-20 rounded-lg border border-input bg-background px-2 py-1 text-sm text-center mx-auto block"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                        {row.selected ? bdt(revenue) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                        {row.selected ? (
                          <span className={profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                            {profit >= 0 ? "+" : ""}{bdt(profit)}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      {selectedCattle.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="group relative overflow-hidden rounded-xl bg-card p-4 shadow-card ring-1 ring-black/5 transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.03] to-transparent" />
            <div className="relative flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tr.selected_cattle}</p>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.06] text-foreground/70">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <p className="relative mt-2.5 text-2xl font-bold tracking-tight tabular-nums">{selectedCattle.length}{tr.head_unit}</p>
          </div>
          <div className="group relative overflow-hidden rounded-xl bg-card p-4 shadow-card border border-blue-500/10 transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-500/[0.06] to-transparent" />
            <div className="relative flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tr.total_revenue}</p>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Banknote className="h-4 w-4" />
              </div>
            </div>
            <p className="relative mt-2.5 text-2xl font-bold tracking-tight tabular-nums text-blue-600 dark:text-blue-400">{bdt(totalRevenue)}</p>
          </div>
          <div className="group relative overflow-hidden rounded-xl bg-card p-4 shadow-card ring-1 ring-black/5 transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.03] to-transparent" />
            <div className="relative flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tr.total_cost}</p>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.06] text-foreground/70">
                <Receipt className="h-4 w-4" />
              </div>
            </div>
            <p className="relative mt-2.5 text-2xl font-bold tracking-tight tabular-nums text-muted-foreground">{bdt(totalCost)}</p>
          </div>
          <div className={cn(
            "group relative overflow-hidden rounded-xl bg-card p-4 shadow-card ring-1 transition-all hover:-translate-y-0.5 hover:shadow-md",
            totalProfit >= 0 ? "ring-emerald-500/10" : "ring-red-500/10"
          )}>
            <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent", totalProfit >= 0 ? "from-emerald-500/[0.06]" : "from-red-500/[0.06]")} />
            <div className="relative flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tr.estimated_profit}</p>
              <div className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                totalProfit > 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : totalProfit < 0 ? "bg-red-500/10 text-destructive" : "bg-foreground/[0.06] text-foreground/70"
              )}>
                {totalProfit > 0 ? <TrendingUp className="h-4 w-4" /> : totalProfit < 0 ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
              </div>
            </div>
            <p className={cn("relative mt-2.5 text-2xl font-bold tracking-tight tabular-nums", totalProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
              {totalProfit >= 0 ? "+" : ""}{bdt(totalProfit)}
            </p>
            <p className="relative mt-1 text-xs text-muted-foreground">ROI: {totalROI.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {/* Per-cattle breakdown */}
      {results.length > 0 && (
        <div className="rounded-xl bg-card p-5 space-y-3 shadow-card ring-1 ring-black/5">
          <h3 className="font-semibold text-sm tracking-tight">{tr.per_cattle_breakdown}</h3>
          {results.map((r) => (
            <div key={r.c.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-4 py-3">
              <span className="font-semibold text-sm text-primary">#{r.c.tag_id}</span>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{r.weight.toFixed(1)} {tr.kg_unit} × ৳{rows[r.c.id]?.pricePerKg ?? 0}/{tr.kg_unit}</span>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-bold text-sm ${r.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                  {r.profit >= 0 ? "+" : ""}{bdt(r.profit)}
                </p>
                <p className="text-xs text-muted-foreground">ROI {r.roi.toFixed(1)}%</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { cn } from "@/lib/utils";
import {
  ShoppingCart,
  Wallet,
  Printer,
  Trophy,
  Clock,
  Target,
  Percent,
  Warehouse,
  ChevronDown,
  ChevronUp,
  Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export interface SaleRecord {
  id: string;
  cattle_id: string;
  sold_at: string;
  sale_price_total: number;
  weight_at_sale_kg: number | null;
  buyer_name: string | null;
  cattle_tag?: string;
  purchase_price?: number;
  initial_weight_kg?: number;
  purchase_date?: string;
}

interface Props {
  sales: SaleRecord[];
  totalFixedCosts: number;
  totalVariableCosts: number;
  totalFeedCosts: number;
  totalOtherInventoryCosts: number;
  feedCostByCattle: Record<string, number>;
  directCostByCattle?: Record<string, number>;
  // Inventory-only subset of directCostByCattle (no vet cost_entries).
  // Used for generalOtherInv so that vet fees don't over-subtract from the
  // inventory ceiling, which would clamp unattributed inventory costs to 0.
  directInventoryCostByCattle?: Record<string, number>;
  unrealizedInvestment: number;
  activeCattleCount: number;
  activeCattleIds: string[];
  totalAssetValue?: number;
  bizName?: string;
  /** Purchase cost of all dead cattle — a realized loss not captured in sales or active cattle */
  deadCattlePurchaseCost?: number;
  overheadPerHead?: number;
}

function fmt(n: number) {
  return `৳${Math.abs(n).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Shared premium primitives ──────────────────────────────────────

const TINT = {
  emerald: { badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", wash: "from-emerald-500/[0.06]", ring: "ring-emerald-500/10" },
  red:     { badge: "bg-red-500/10 text-red-500 dark:text-red-400",             wash: "from-red-500/[0.06]",     ring: "ring-red-500/10" },
  blue:    { badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400",          wash: "from-blue-500/[0.06]",    ring: "ring-blue-500/10" },
  amber:   { badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400",       wash: "from-amber-500/[0.06]",   ring: "ring-amber-500/10" },
  neutral: { badge: "bg-foreground/[0.06] text-foreground/70",                  wash: "from-foreground/[0.03]",  ring: "ring-black/5" },
} as const;

function SectionLabel({ icon: Icon, children, tint = "neutral" }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; tint?: keyof typeof TINT }) {
  const t = TINT[tint];
  return (
    <div className="flex items-center gap-2">
      <div className={cn("flex h-6 w-6 items-center justify-center rounded-lg", t.badge)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>
    </div>
  );
}

export function PLSummary({
  sales,
  totalFixedCosts,
  totalVariableCosts,
  totalFeedCosts,
  totalOtherInventoryCosts,
  feedCostByCattle,
  directCostByCattle = {},
  directInventoryCostByCattle,
  unrealizedInvestment,
  activeCattleCount,
  activeCattleIds,
  totalAssetValue = 0,
  bizName = "Farm",
  deadCattlePurchaseCost = 0,
  overheadPerHead = 0,
}: Props) {
  const [showAllSales, setShowAllSales] = useState(false);
  const [showBalanceSheet, setShowBalanceSheet] = useState(false);

  // Enrich each sale with per-cattle feed and direct costs → accurate net margin
  const enrichedSales = sales.map((s) => {
    const feedCost = feedCostByCattle[s.cattle_id] ?? 0;
    const directCost = directCostByCattle[s.cattle_id] ?? 0;
    const totalCostPerHead = (s.purchase_price ?? 0) + feedCost + directCost + overheadPerHead;
    const profit = s.sale_price_total - totalCostPerHead;
    const roi = totalCostPerHead > 0 ? (profit / totalCostPerHead) * 100 : null;
    const holdDays =
      s.purchase_date
        ? Math.floor(
            (new Date(s.sold_at + "T00:00:00").getTime() -
              new Date(s.purchase_date + "T00:00:00").getTime()) /
              86400000
          )
        : null;
    return { ...s, feedCost, directCost, totalCostPerHead, profit, roi, holdDays };
  });

  const totalRevenue = sales.reduce((s, r) => s + r.sale_price_total, 0);
  const totalPurchaseCost = sales.reduce((s, r) => s + (r.purchase_price ?? 0), 0);

  // Separate cattle into sold / active / dead so costs are realized correctly.
  // Active cattle costs = unrealized (still generating returns).
  // Dead cattle costs = realized loss (animal gone, cost already incurred).
  const soldIdSet   = new Set(sales.map((s) => s.cattle_id));
  const activeIdSet = new Set(activeCattleIds);

  const totalPerCattleFeed = Object.values(feedCostByCattle).reduce((s, v) => s + v, 0);
  const generalFeed    = Math.max(0, totalFeedCosts - totalPerCattleFeed);
  const feedCostSold   = sales.reduce((s, r) => s + (feedCostByCattle[r.cattle_id] ?? 0), 0);
  const feedCostDead   = Object.entries(feedCostByCattle)
    .filter(([id]) => !activeIdSet.has(id) && !soldIdSet.has(id))
    .reduce((s, [, v]) => s + v, 0);
  const realizedFeedCost = feedCostSold + feedCostDead + generalFeed;
  // Unrealized = all-time feed invested in active cattle not yet sold.
  // Derived directly from per-cattle data so period filters on totalFeedCosts don't distort it.
  const unrealizedFeedCost = Object.entries(feedCostByCattle)
    .filter(([id]) => activeIdSet.has(id))
    .reduce((s, [, v]) => s + v, 0);

  // For generalOtherInv we subtract only the INVENTORY portion attributed to specific cattle.
  // Using the full directCostByCattle (which includes vet cost_entries) would over-subtract
  // and clamp unattributed non-feed inventory costs to 0.
  const invOnlyByCattle = directInventoryCostByCattle ?? directCostByCattle;
  const totalPerCattleInvDirect = Object.values(invOnlyByCattle).reduce((s, v) => s + v, 0);
  const totalPerCattleDirect = Object.values(directCostByCattle).reduce((s, v) => s + v, 0);
  const generalOtherInv   = Math.max(0, totalOtherInventoryCosts - totalPerCattleInvDirect);
  const directCostSold    = sales.reduce((s, r) => s + (directCostByCattle[r.cattle_id] ?? 0), 0);
  const directCostDead    = Object.entries(directCostByCattle)
    .filter(([id]) => !activeIdSet.has(id) && !soldIdSet.has(id))
    .reduce((s, [, v]) => s + v, 0);
  const realizedDirectCost = directCostSold + directCostDead + generalOtherInv;
  // Same approach as unrealizedFeedCost: derive from per-cattle data, not period totals.
  const unrealizedDirectCost = Object.entries(directCostByCattle)
    .filter(([id]) => activeIdSet.has(id))
    .reduce((s, [, v]) => s + v, 0);

  const totalCosts =
    totalFixedCosts + totalVariableCosts + realizedFeedCost + realizedDirectCost +
    totalPurchaseCost + deadCattlePurchaseCost;
  const netPL = totalRevenue - totalCosts;
  const isProfit = netPL >= 0;

  const totalWeightGained = sales.reduce((s, r) => {
    const gained = (r.weight_at_sale_kg ?? 0) - (r.initial_weight_kg ?? 0);
    return s + Math.max(0, gained);
  }, 0);
  const totalWeightSold = sales.reduce((s, r) => s + (r.weight_at_sale_kg ?? 0), 0);

  // costPerKg: only include cattle with complete weight data so the denominator
  // (kg gained) and numerator (costs for those cattle) are consistent.
  // Using totalCosts / totalWeightGained inflates the metric whenever some cattle
  // lack sale weights — their costs stay in the numerator but contribute 0 to gain.
  const salesWithWeights = enrichedSales.filter(
    (s) => s.weight_at_sale_kg != null && s.initial_weight_kg != null
  );
  const weightedGain = salesWithWeights.reduce(
    (s, r) => s + Math.max(0, (r.weight_at_sale_kg ?? 0) - (r.initial_weight_kg ?? 0)), 0
  );
  const salesWithWeightsRevenue = salesWithWeights.reduce((s, r) => s + r.sale_price_total, 0);
  const costPerKg = weightedGain > 0
    ? salesWithWeights.reduce((s, r) => s + r.totalCostPerHead, 0) / weightedGain
    : null;
  // Use the same weight-gained denominator so costPerKg and revenuePerKg are directly comparable.
  const revenuePerKg = weightedGain > 0 ? salesWithWeightsRevenue / weightedGain : null;
  const margin = totalRevenue >= 1 ? ((netPL / totalRevenue) * 100).toFixed(1) : null;

  // ── Smart Insights ────────────────────────────────────────────────
  const profitable = enrichedSales.filter((s) => s.profit > 0);
  const winRate =
    enrichedSales.length > 0
      ? (profitable.length / enrichedSales.length) * 100
      : null;

  const avgROI =
    enrichedSales.filter((s) => s.roi !== null).length > 0
      ? enrichedSales
          .filter((s) => s.roi !== null)
          .reduce((s, r) => s + r.roi!, 0) /
        enrichedSales.filter((s) => s.roi !== null).length
      : null;

  const holdSales = enrichedSales.filter((s) => s.holdDays !== null && s.holdDays >= 0);
  const avgHoldDays =
    holdSales.length > 0
      ? Math.round(holdSales.reduce((s, r) => s + r.holdDays!, 0) / holdSales.length)
      : null;

  const bestSale =
    enrichedSales.length > 0
      ? enrichedSales.reduce((best, s) => (s.profit > best.profit ? s : best))
      : null;


  const VISIBLE_SALES = 5;
  const displayedSales = showAllSales ? enrichedSales : enrichedSales.slice(0, VISIBLE_SALES);

  return (
    <div className="space-y-6 pl-print-root">
      {/* Print-only header */}
      <div className="hidden print:block mb-6 border-b pb-4">
        <h1 className="text-2xl font-bold">{bizName} — P&amp;L Report</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generated:{" "}
          <span suppressHydrationWarning>
            {new Date().toLocaleDateString("en-US", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </p>
      </div>

      {/* ── Smart Insights ── */}
      {enrichedSales.length > 0 && (
        <div className="rounded-xl bg-card shadow-card ring-1 ring-black/5 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border/60">
            <SectionLabel icon={Target}>Smart Insights</SectionLabel>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y divide-border/60 md:grid-cols-4 md:divide-y-0">
            {/* জয়ের হার */}
            <div className="p-5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Target className="h-3.5 w-3.5" />
                Win Rate
              </div>
              <p className="text-2xl font-bold tracking-tight tabular-nums">
                {winRate !== null ? `${winRate.toFixed(0)}%` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {profitable.length}/{enrichedSales.length} sales profitable
              </p>
            </div>

            {/* গড় ROI */}
            <div className="p-5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Percent className="h-3.5 w-3.5" />
                Avg ROI / Head
              </div>
              <p className={cn(
                "text-2xl font-bold tracking-tight tabular-nums",
                avgROI !== null && avgROI >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive"
              )}>
                {avgROI !== null ? `${avgROI >= 0 ? "+" : ""}${avgROI.toFixed(1)}%` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">based on cost per head</p>
            </div>

            {/* গড় ধারণকাল */}
            <div className="p-5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Avg Hold Time
              </div>
              <p className="text-2xl font-bold tracking-tight tabular-nums">
                {avgHoldDays !== null ? `${avgHoldDays}d` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">purchase → sale</p>
            </div>

            {/* সেরা বিক্রয় */}
            <div className="p-5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Trophy className="h-3.5 w-3.5 text-amber-500" />
                Best Sale
              </div>
              {bestSale && bestSale.profit > 0 ? (
                <>
                  <p className="text-2xl font-bold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">
                    +{fmt(bestSale.profit)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cattle #{bestSale.cattle_tag ?? bestSale.cattle_id.slice(0, 6)}
                    {bestSale.roi !== null ? ` · ${bestSale.roi.toFixed(1)}% ROI` : ""}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No profitable sales yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Cost breakdown — compact stacked bar + chip legend ── */}
      {(() => {
        const segments = [
          { label: "Cattle Purchases", value: totalPurchaseCost + deadCattlePurchaseCost, bar: "bg-orange-500", dot: "bg-orange-500", note: unrealizedInvestment > 0 ? `+${fmt(unrealizedInvestment)} in active pen` : null },
          { label: "Feed (sold cattle)", value: realizedFeedCost, bar: "bg-emerald-500", dot: "bg-emerald-500", note: unrealizedFeedCost > 0 ? `+${fmt(unrealizedFeedCost)} in active pen` : null },
          ...(realizedDirectCost > 0 || unrealizedDirectCost > 0 ? [{ label: "Medicine & Direct", value: realizedDirectCost, bar: "bg-pink-500", dot: "bg-pink-500", note: unrealizedDirectCost > 0 ? `+${fmt(unrealizedDirectCost)} in active pen` : null }] : []),
          { label: "Fixed Ops Costs", value: totalFixedCosts, bar: "bg-blue-500", dot: "bg-blue-500", note: null },
          { label: "Variable Ops Costs", value: totalVariableCosts, bar: "bg-purple-500", dot: "bg-purple-500", note: null },
        ].filter((s) => s.value > 0);
        const segTotal = segments.reduce((s, x) => s + x.value, 0);

        if (segTotal <= 0) return null;

        return (
          <div className="rounded-xl bg-card shadow-card ring-1 ring-black/5 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <SectionLabel icon={Wallet}>Cost Breakdown</SectionLabel>
              <div className="flex items-center gap-3">
                {costPerKg && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    ৳{costPerKg.toFixed(0)}/kg cost
                  </span>
                )}
                <p className="text-sm font-bold tabular-nums">{fmt(segTotal)}</p>
              </div>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              {segments.map((s) => (
                <div
                  key={s.label}
                  className={cn("h-full transition-all", s.bar)}
                  style={{ width: `${(s.value / segTotal) * 100}%` }}
                  title={`${s.label}: ${fmt(s.value)}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {segments.map((s) => (
                <div key={s.label} className="flex items-center gap-1.5 text-xs">
                  <span className={cn("h-2 w-2 rounded-full shrink-0", s.dot)} />
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-semibold tabular-nums">{fmt(s.value)}</span>
                  {s.note && <span className="text-xs text-amber-600 dark:text-amber-400">{s.note}</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Balance Sheet Snapshot — collapsed by default ── */}
      {(activeCattleCount > 0 || totalAssetValue > 0) && (
        <div className="rounded-xl shadow-card border border-amber-500/15 bg-gradient-to-br from-amber-500/[0.06] to-transparent overflow-hidden">
          <button
            type="button"
            onClick={() => setShowBalanceSheet((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-5 py-4"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
                <Warehouse className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Balance Sheet Snapshot
              </p>
              <span className="text-xs text-amber-700/80 dark:text-amber-400/80 hidden sm:inline">
                — active herd &amp; capital assets not in P&amp;L
              </span>
            </div>
            {showBalanceSheet
              ? <ChevronUp className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              : <ChevronDown className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />}
          </button>

          {showBalanceSheet && (
            <div className="border-t border-amber-500/15 px-5 py-5 space-y-5">
              {activeCattleCount > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-3">Active Herd Investment</p>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-amber-700 dark:text-amber-400">Cattle in Pen</p>
                      <p className="text-xl font-bold tracking-tight text-amber-900 dark:text-amber-200 tabular-nums">
                        {activeCattleCount} head
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-amber-700 dark:text-amber-400">Capital at Risk</p>
                      <p className="text-xl font-bold tracking-tight text-amber-900 dark:text-amber-200 tabular-nums">
                        {fmt(unrealizedInvestment)}
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-400">purchase cost only</p>
                    </div>
                    <div>
                      <p className="text-xs text-amber-700 dark:text-amber-400">Total Deployed</p>
                      <p className="text-xl font-bold tracking-tight text-amber-900 dark:text-amber-200 tabular-nums">
                        {fmt(totalCosts + unrealizedInvestment + unrealizedFeedCost + unrealizedDirectCost)}
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-400">all capital to date</p>
                    </div>
                  </div>
                </div>
              )}

              {totalAssetValue > 0 && (
                <div className={activeCattleCount > 0 ? "border-t border-amber-500/15 pt-5" : ""}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
                        <Landmark className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                          Capital Assets
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          Equipment, infrastructure &amp; vehicles
                        </p>
                      </div>
                    </div>
                    <p className="text-xl font-bold tracking-tight tabular-nums text-amber-700 dark:text-amber-300">
                      {fmt(totalAssetValue)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Sales table ── */}
      {enrichedSales.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold tracking-tight">Sales Records</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                document.body.classList.add("pl-printing");
                window.print();
                window.addEventListener("afterprint", () => document.body.classList.remove("pl-printing"), { once: true });
              }}
              className="print:hidden"
            >
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Print Report
            </Button>
          </div>

          {/* Desktop */}
          <div className="hidden md:block overflow-hidden rounded-xl bg-card shadow-card ring-1 ring-black/5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  {["Date", "Cattle", "Buyer", "Sale Weight", "Sale Price", "Total Cost", "Net Margin"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground last:text-right"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {displayedSales.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {fmtDate(s.sold_at)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      #{s.cattle_tag ?? s.cattle_id.slice(0, 6)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{s.buyer_name ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {s.weight_at_sale_kg != null ? `${s.weight_at_sale_kg} kg` : "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums">
                      {fmt(s.sale_price_total)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      <span>{fmt(s.totalCostPerHead)}</span>
                      {(s.feedCost > 0 || s.directCost > 0 || overheadPerHead > 0) && (
                        <p className="text-xs text-muted-foreground/70">
                          pur{s.feedCost > 0 ? "+feed" : ""}{s.directCost > 0 ? "+med" : ""}{overheadPerHead > 0 ? "+overhead" : ""} {fmt(s.purchase_price ?? 0)}{s.feedCost > 0 ? `+${fmt(s.feedCost)}` : ""}{s.directCost > 0 ? `+${fmt(s.directCost)}` : ""}{overheadPerHead > 0 ? `+${fmt(overheadPerHead)}` : ""}
                        </p>
                      )}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 font-semibold tabular-nums text-right",
                        s.profit >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-destructive"
                      )}
                    >
                      {s.profit >= 0 ? "+" : "−"}{fmt(s.profit)}
                      {s.roi !== null && (
                        <p className="text-xs font-normal opacity-70">
                          {s.roi >= 0 ? "+" : ""}{s.roi.toFixed(1)}% ROI
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {displayedSales.map((s) => (
              <div key={s.id} className="rounded-xl bg-card p-4 shadow-card ring-1 ring-black/5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-semibold text-sm">
                      Cattle #{s.cattle_tag ?? s.cattle_id.slice(0, 6)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(s.sold_at)}
                      {s.buyer_name ? ` · ${s.buyer_name}` : ""}
                      {s.holdDays !== null ? ` · ${s.holdDays}d held` : ""}
                    </p>
                  </div>
                  <p className="text-lg font-bold tracking-tight tabular-nums">{fmt(s.sale_price_total)}</p>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-xs text-muted-foreground">
                    Cost {fmt(s.totalCostPerHead)}
                    {(s.feedCost > 0 || s.directCost > 0 || overheadPerHead > 0) && ` (pur ${fmt(s.purchase_price ?? 0)}${s.feedCost > 0 ? `, feed ${fmt(s.feedCost)}` : ""}${s.directCost > 0 ? `, med ${fmt(s.directCost)}` : ""}${overheadPerHead > 0 ? `, oh ${fmt(overheadPerHead)}` : ""})`}
                  </span>
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      s.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                    )}
                  >
                    {s.profit >= 0 ? "+" : "−"}{fmt(s.profit)}
                    {s.roi !== null ? ` (${s.roi.toFixed(1)}%)` : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Show more / less */}
          {enrichedSales.length > VISIBLE_SALES && (
            <button
              type="button"
              onClick={() => setShowAllSales((v) => !v)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            >
              {showAllSales ? (
                <><ChevronUp className="h-4 w-4" /> Show less</>
              ) : (
                <><ChevronDown className="h-4 w-4" /> Show all {enrichedSales.length} sales</>
              )}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <ShoppingCart className="h-5 w-5 text-muted-foreground/60" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            No sales recorded yet. Use <strong>Record Sale</strong> on a cattle profile to log a sale.
          </p>
        </div>
      )}
    </div>
  );
}

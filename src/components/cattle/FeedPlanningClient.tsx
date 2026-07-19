"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Wheat, Settings, AlertCircle, ArrowRight, ChevronUp, ChevronDown, ChevronsUpDown, CalendarDays, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  calculateDailyFeedRequirement,
  ROUGHAGE_TYPES,
  type RoughageTypeId,
} from "@/utils/feed-calculator";
import type { FeedCattle } from "@/app/dashboard/(app)/cattle/feed/page";

type Props = {
  cattle: FeedCattle[];
  defaultRoughageType: RoughageTypeId;
  activeRoughage: { id: string; name: string; unit: string } | null;
  activeRecipeName: string | null;
  mixUnitCostPerKg: number;
  roughageUnitCost: number;
  todayISO: string;
};

type ViewMode = "today" | "week" | "month";
type SortKey = "tag" | "weight" | "concentrate" | "roughage" | "cost";
type SortDir = "asc" | "desc";

function fmt(n: number) {
  if (n >= 100_000) return `৳${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000)   return `৳${(n / 1_000).toFixed(0)}K`;
  return `৳${Math.round(n)}`;
}

export function FeedPlanningClient({
  cattle,
  defaultRoughageType,
  activeRoughage,
  activeRecipeName,
  mixUnitCostPerKg,
  roughageUnitCost,
  todayISO,
}: Props) {
  const [roughageType, setRoughageType] = useState<RoughageTypeId>(defaultRoughageType);
  const [view, setView]       = useState<ViewMode>("today");
  const [sortKey, setSortKey] = useState<SortKey>("tag");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const selectedRoughage = ROUGHAGE_TYPES.find((r) => r.id === roughageType) ?? ROUGHAGE_TYPES[0];
  const multiplier = view === "today" ? 1 : view === "week" ? 7 : 30;

  // Compute per-cattle feed requirements
  const rows = useMemo(() => {
    return cattle.map((c) => {
      const req = calculateDailyFeedRequirement(
        {
          initialWeightKg: c.initialWeight,
          latestLoggedWeightKg: c.latestWeight,
          lastWeighedAt: c.lastWeighedAt,
          purchaseDate: c.purchaseDate,
          expectedDailyGainKg: c.expectedDailyGainKg,
          roughageDmPercent: selectedRoughage.dmPercent,
        },
        todayISO
      );
      const effectiveRoughageKg = c.roughageOverrideKg ?? req.roughageKg;
      const dailyCost =
        req.actualConcentrateKg * mixUnitCostPerKg +
        effectiveRoughageKg * roughageUnitCost;
      return { ...c, req, effectiveRoughageKg, dailyCost };
    });
  }, [cattle, selectedRoughage.dmPercent, todayISO, mixUnitCostPerKg, roughageUnitCost]);

  // Herd totals
  const totals = useMemo(() => ({
    concentrate: rows.reduce((s, r) => s + r.req.actualConcentrateKg, 0),
    roughage:    rows.reduce((s, r) => s + r.effectiveRoughageKg, 0),
    cost:        rows.reduce((s, r) => s + r.dailyCost, 0),
    acclim:      rows.filter((r) => r.req.acclimatizationFactor < 1).length,
  }), [rows]);

  const hasCosts = mixUnitCostPerKg > 0 || roughageUnitCost > 0;

  // Sorting
  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "tag" ? "asc" : "desc"); }
  }

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av: number | string, bv: number | string;
      switch (sortKey) {
        case "tag":         av = a.tagId;                  bv = b.tagId; break;
        case "weight":      av = a.req.projectedWeightKg;  bv = b.req.projectedWeightKg; break;
        case "concentrate": av = a.req.actualConcentrateKg; bv = b.req.actualConcentrateKg; break;
        case "roughage":    av = a.effectiveRoughageKg;    bv = b.effectiveRoughageKg; break;
        case "cost":        av = a.dailyCost;               bv = b.dailyCost; break;
        default:            av = a.tagId; bv = b.tagId;
      }
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(String(bv)) : String(bv).localeCompare(av);
      return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
  }, [rows, sortKey, sortDir]);

  return (
    <div className="space-y-5">
      {/* ── Active Feed Setup Banner ── */}
      <div className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
        activeRoughage && activeRecipeName
          ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
          : "bg-muted/40 border-border"
      )}>
        <div className="flex items-center gap-2 flex-wrap">
          <Package className={cn("h-4 w-4 shrink-0", activeRoughage ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")} />
          {activeRoughage ? (
            <span className="text-sm">
              <span className="font-semibold">Roughage:</span> {activeRoughage.name}
              {activeRecipeName && (
                <> &nbsp;·&nbsp; <span className="font-semibold">Mix:</span> {activeRecipeName}</>
              )}
              {!activeRecipeName && (
                <span className="ml-2 text-amber-700 dark:text-amber-400 text-xs font-medium">No active recipe</span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">No roughage or recipe configured.</span>
          )}
        </div>
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings className="h-3.5 w-3.5" /> Feed Settings
        </Link>
      </div>

      {/* ── Summary Stat Cards ── */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          icon={<Wheat className="h-4 w-4" />}
          label="Concentrate"
          value={`${(totals.concentrate * multiplier).toFixed(1)} kg`}
          sub={view !== "today" ? `${totals.concentrate.toFixed(1)} kg/day` : "today"}
          color="amber"
        />
        <StatCard
          icon={<Wheat className="h-4 w-4" />}
          label="Roughage"
          value={`${(totals.roughage * multiplier).toFixed(1)} kg`}
          sub={`${selectedRoughage.label.split(" ")[0]} · ${view !== "today" ? `${totals.roughage.toFixed(1)} kg/day` : "today"}`}
          color="emerald"
        />
        {hasCosts ? (
          <StatCard
            icon={<span className="text-sm font-bold">৳</span>}
            label="Feed Cost"
            value={fmt(totals.cost * multiplier)}
            sub={view !== "today" ? `${fmt(totals.cost)}/day` : "estimated"}
            color="blue"
          />
        ) : (
          <div className="rounded-xl bg-muted/40 border border-border/60 p-3 sm:p-4 flex flex-col gap-2 justify-between">
            <AlertCircle className="h-4 w-4 text-muted-foreground/50" />
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Cost unknown</p>
              <p className="text-xs text-muted-foreground leading-tight">Add purchase prices in Inventory</p>
            </div>
          </div>
        )}
      </div>

      {/* ── View Toggle + Roughage Type ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* View tabs */}
        <div className="flex items-center gap-1 rounded-xl bg-muted/40 p-1">
          {(["today", "week", "month"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                view === v ? "bg-background shadow-card text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CalendarDays className="h-3 w-3" />
              {v === "today" ? "Today" : v === "week" ? "7-Day" : "30-Day"}
            </button>
          ))}
        </div>

        {/* Roughage type selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Roughage type:</span>
          <select
            value={roughageType}
            onChange={(e) => setRoughageType(e.target.value as RoughageTypeId)}
            className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
          >
            {ROUGHAGE_TYPES.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Per-Cattle Table ── */}
      <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Per-Cattle Requirements</h2>
          {totals.acclim > 0 && (
            <span className="text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 px-2.5 py-0.5">
              {totals.acclim} acclimatizing
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <Th label="Cattle" sortKey="tag"         active={sortKey} dir={sortDir} onSort={toggleSort} className="text-left pl-4 sm:pl-5" />
                <Th label="Est. Weight" sortKey="weight"      active={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                <Th
                  label={`Concentrate${view !== "today" ? ` (${multiplier}d)` : ""}`}
                  sortKey="concentrate"
                  active={sortKey} dir={sortDir} onSort={toggleSort}
                  className="text-right"
                />
                <Th
                  label={`Roughage${view !== "today" ? ` (${multiplier}d)` : ""}`}
                  sortKey="roughage"
                  active={sortKey} dir={sortDir} onSort={toggleSort}
                  className="text-right"
                />
                {hasCosts && (
                  <Th
                    label={`Cost${view !== "today" ? ` (${multiplier}d)` : ""}`}
                    sortKey="cost"
                    active={sortKey} dir={sortDir} onSort={toggleSort}
                    className="text-right pr-4 sm:pr-5"
                  />
                )}
                {!hasCosts && <th className="pr-4 sm:pr-5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((row, i) => {
                const isAcclim = row.req.acclimatizationFactor < 1;
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "transition-colors group",
                      i % 2 === 0 ? "bg-card" : "bg-muted/20",
                      "hover:bg-muted/40"
                    )}
                  >
                    {/* Cattle */}
                    <td className="pl-4 sm:pl-5 py-2.5">
                      <Link
                        href={`/dashboard/cattle/${row.id}`}
                        className="flex items-center gap-1.5 w-fit group/link"
                      >
                        <span className="font-semibold group-hover/link:text-primary group-hover/link:underline underline-offset-2 transition-colors">
                          #{row.tagId}
                        </span>
                        <ArrowRight className="h-3 w-3 opacity-0 group-hover/link:opacity-100 text-primary transition-opacity" />
                      </Link>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {row.breed && <span className="text-xs text-muted-foreground">{row.breed}</span>}
                        {isAcclim && (
                          <span className="text-xs font-semibold rounded bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 px-1 py-px">
                            {Math.round(row.req.acclimatizationFactor * 100)}% acclim.
                          </span>
                        )}
                        {row.roughageOverrideKg !== null && (
                          <span className="text-xs font-semibold rounded bg-primary/10 text-primary px-1 py-px">manual</span>
                        )}
                      </div>
                    </td>

                    {/* Est. Weight */}
                    <td className="text-right py-2.5 tabular-nums text-xs text-muted-foreground">
                      {row.req.projectedWeightKg.toFixed(0)} kg
                    </td>

                    {/* Concentrate */}
                    <td className="text-right py-2.5 tabular-nums text-xs font-semibold text-amber-700 dark:text-amber-300">
                      {(row.req.actualConcentrateKg * multiplier).toFixed(1)}
                      <span className="font-normal text-muted-foreground ml-0.5">kg</span>
                    </td>

                    {/* Roughage */}
                    <td className="text-right py-2.5 tabular-nums text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      {(row.effectiveRoughageKg * multiplier).toFixed(1)}
                      <span className="font-normal text-muted-foreground ml-0.5">kg</span>
                    </td>

                    {/* Cost */}
                    {hasCosts && (
                      <td className="text-right py-2.5 pr-4 sm:pr-5 tabular-nums text-xs text-muted-foreground">
                        {row.dailyCost > 0 ? fmt(row.dailyCost * multiplier) : "—"}
                      </td>
                    )}
                    {!hasCosts && <td className="pr-4 sm:pr-5" />}
                  </tr>
                );
              })}
            </tbody>

            {/* Totals footer */}
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/40">
                <td className="pl-4 sm:pl-5 py-2.5 text-xs font-bold text-foreground">
                  Total ({cattle.length} cattle)
                </td>
                <td />
                <td className="text-right py-2.5 tabular-nums text-sm font-bold text-amber-700 dark:text-amber-300">
                  {(totals.concentrate * multiplier).toFixed(1)}
                  <span className="text-xs font-normal text-muted-foreground ml-0.5">kg</span>
                </td>
                <td className="text-right py-2.5 tabular-nums text-sm font-bold text-emerald-700 dark:text-emerald-300">
                  {(totals.roughage * multiplier).toFixed(1)}
                  <span className="text-xs font-normal text-muted-foreground ml-0.5">kg</span>
                </td>
                {hasCosts && (
                  <td className="text-right py-2.5 pr-4 sm:pr-5 tabular-nums text-sm font-bold text-foreground">
                    {fmt(totals.cost * multiplier)}
                  </td>
                )}
                {!hasCosts && <td className="pr-4 sm:pr-5" />}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Legend */}
        <div className="px-4 sm:px-5 py-2.5 border-t border-border bg-muted/20 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" /> Concentrate (mix feed)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> Roughage (as-fed weight)
          </span>
          <span className="ml-auto">Projected weights assume {cattle[0]?.expectedDailyGainKg ?? 0.8} kg/day ADG</span>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: "amber" | "emerald" | "blue";
}) {
  const styles = {
    amber:   { bg: "bg-amber-50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/40",   icon: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",   val: "text-amber-700 dark:text-amber-300" },
    emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/40", icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400", val: "text-emerald-700 dark:text-emerald-300" },
    blue:    { bg: "bg-blue-50 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-800/40",       icon: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",       val: "text-blue-700 dark:text-blue-300" },
  }[color];

  return (
    <div className={cn("rounded-xl p-3 sm:p-4 space-y-2", styles.bg)}>
      <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", styles.icon)}>{icon}</div>
      <div>
        <p className={cn("text-2xl font-bold tabular-nums leading-none", styles.val)}>{value}</p>
        <p className="mt-0.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function Th({
  label, sortKey, active, dir, onSort, className,
}: {
  label: string;
  sortKey?: SortKey;
  active?: SortKey;
  dir?: SortDir;
  onSort?: (k: SortKey) => void;
  className?: string;
}) {
  const isActive = sortKey && sortKey === active;
  return (
    <th
      className={cn(
        "py-2.5 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap select-none",
        sortKey ? "cursor-pointer hover:text-foreground transition-colors" : "",
        className
      )}
      onClick={() => sortKey && onSort?.(sortKey)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {sortKey && (
          isActive
            ? dir === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
            : <ChevronsUpDown className="h-3 w-3 opacity-40" />
        )}
      </span>
    </th>
  );
}

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Beef,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnalyticsCattle } from "@/app/dashboard/(app)/cattle/analytics/page";

type SortKey = "adg" | "adg14" | "weightGain" | "fcr" | "feedCost" | "costPerKgGain" | "daysInPen";
type SortDir = "asc" | "desc";
type ViewTab = "adg" | "fcr" | "cost";

const ADG_TIER = (adg: number | null) =>
  adg === null ? "none" : adg >= 0.5 ? "good" : adg >= 0.3 ? "fair" : "poor";

const ADG_COLOR = {
  good: "#10b981",
  fair: "#f59e0b",
  poor: "#ef4444",
  none: "#94a3b8",
};

const ADG_TEXT = {
  good: "text-emerald-600 dark:text-emerald-400",
  fair: "text-amber-600 dark:text-amber-400",
  poor: "text-red-600 dark:text-red-400",
  none: "text-muted-foreground",
};

const FCR_TIER = (fcr: number | null) =>
  fcr === null ? "none" : fcr <= 7 ? "good" : fcr <= 10 ? "fair" : "poor";

function fmt(n: number) {
  if (n >= 100_000) return `৳${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `৳${(n / 1_000).toFixed(0)}K`;
  return `৳${Math.round(n)}`;
}

function avg(arr: number[]) {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

export function AnalyticsDashboardClient({ cattle }: { cattle: AnalyticsCattle[] }) {
  const [view, setView] = useState<ViewTab>("adg");
  const [sortKey, setSortKey] = useState<SortKey>("adg");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ── Herd-level stats ──────────────────────────────────────────────────────
  const withAdg  = cattle.filter((c) => c.adg !== null);
  const withFcr  = cattle.filter((c) => c.fcr !== null);
  const withFeed = cattle.filter((c) => c.feedCost > 0);

  const herdAvgAdg  = withAdg.length  ? avg(withAdg.map((c) => c.adg!))  : null;
  const herdAvgFcr  = withFcr.length  ? avg(withFcr.map((c) => c.fcr!))  : null;
  const totalFeedCost = cattle.reduce((s, c) => s + c.feedCost, 0);
  const bestAdg = withAdg.length ? Math.max(...withAdg.map((c) => c.adg!)) : null;
  const bestCattle = bestAdg !== null ? withAdg.find((c) => c.adg === bestAdg) : null;

  const pctOnTrack = withAdg.length
    ? Math.round((withAdg.filter((c) => c.adg! >= 0.5).length / withAdg.length) * 100)
    : null;

  // ── Sorting ───────────────────────────────────────────────────────────────
  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir(key === "fcr" || key === "costPerKgGain" ? "asc" : "desc"); }
  }

  const sorted = useMemo(() => {
    return [...cattle].sort((a, b) => {
      const av = a[sortKey] ?? (sortDir === "desc" ? -Infinity : Infinity);
      const bv = b[sortKey] ?? (sortDir === "desc" ? -Infinity : Infinity);
      return sortDir === "desc" ? Number(bv) - Number(av) : Number(av) - Number(bv);
    });
  }, [cattle, sortKey, sortDir]);

  // ── Chart data (ADG bar chart, max 40 cattle) ────────────────────────────
  const chartData = useMemo(() => {
    const src = view === "adg"
      ? [...cattle].sort((a, b) => (b.adg ?? -1) - (a.adg ?? -1))
      : view === "fcr"
      ? [...cattle].filter((c) => c.fcr !== null).sort((a, b) => a.fcr! - b.fcr!)
      : [...cattle].filter((c) => c.costPerKgGain !== null).sort((a, b) => a.costPerKgGain! - b.costPerKgGain!);
    return src.slice(0, 40).map((c) => ({
      tag: `#${c.tagId}`,
      value: view === "adg" ? (c.adg ?? 0) : view === "fcr" ? (c.fcr ?? 0) : (c.costPerKgGain ?? 0),
      tier: view === "adg" ? ADG_TIER(c.adg) : view === "fcr" ? FCR_TIER(c.fcr) : "info",
    }));
  }, [cattle, view]);

  // ── Breed summary ─────────────────────────────────────────────────────────
  const breedMap = useMemo(() => {
    const m: Record<string, { count: number; adgs: number[]; feedCosts: number[] }> = {};
    for (const c of cattle) {
      const b = c.breed ?? "Unknown";
      if (!m[b]) m[b] = { count: 0, adgs: [], feedCosts: [] };
      m[b].count++;
      if (c.adg !== null) m[b].adgs.push(c.adg);
      if (c.feedCost > 0) m[b].feedCosts.push(c.feedCost);
    }
    return Object.entries(m)
      .map(([breed, d]) => ({
        breed,
        count: d.count,
        avgAdg: d.adgs.length ? avg(d.adgs) : null,
        avgFeedCost: d.feedCosts.length ? avg(d.feedCosts) : null,
      }))
      .sort((a, b) => (b.avgAdg ?? -1) - (a.avgAdg ?? -1));
  }, [cattle]);

  const multipleBreeds = breedMap.length >= 2;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Herd Avg ADG"
          value={herdAvgAdg !== null ? `${herdAvgAdg.toFixed(2)} kg/d` : "—"}
          sub={pctOnTrack !== null ? `${pctOnTrack}% on track` : undefined}
          color={herdAvgAdg === null ? "muted" : herdAvgAdg >= 0.5 ? "emerald" : herdAvgAdg >= 0.3 ? "amber" : "red"}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Best Performer"
          value={bestCattle ? `#${bestCattle.tagId}` : "—"}
          sub={bestAdg !== null ? `ADG ${bestAdg.toFixed(2)} kg/d` : undefined}
          color="emerald"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Herd Avg FCR"
          value={herdAvgFcr !== null ? herdAvgFcr.toFixed(1) : "—"}
          sub="kg feed / kg gain"
          color={herdAvgFcr === null ? "muted" : herdAvgFcr <= 7 ? "emerald" : herdAvgFcr <= 10 ? "amber" : "red"}
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <StatCard
          label="Total Feed Spend"
          value={fmt(totalFeedCost)}
          sub={`${withFeed.length} cattle logged`}
          color="blue"
          icon={<Beef className="h-4 w-4" />}
        />
      </div>

      {/* Chart section */}
      {cattle.length >= 2 && (
        <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
          {/* View tabs */}
          <div className="flex items-center gap-1 px-4 pt-4 pb-2">
            {(["adg", "fcr", "cost"] as ViewTab[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                  view === v
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {v === "adg" ? "ADG Ranking" : v === "fcr" ? "FCR Ranking" : "Cost / kg Gain"}
              </button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              {view === "fcr" || view === "cost" ? "Lower is better" : "Higher is better"}
            </span>
          </div>
          <div className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={Math.max(160, Math.min(chartData.length * 28, 480))}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) =>
                    view === "adg" ? `${v.toFixed(2)}` : view === "fcr" ? v.toFixed(1) : fmt(v)
                  }
                />
                <YAxis
                  type="category"
                  dataKey="tag"
                  width={40}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0];
                    return (
                      <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                        <p className="font-semibold">{d.payload.tag}</p>
                        <p className="text-muted-foreground">
                          {view === "adg"
                            ? `ADG: ${Number(d.value).toFixed(2)} kg/d`
                            : view === "fcr"
                            ? `FCR: ${Number(d.value).toFixed(1)}`
                            : `Cost/kg: ${fmt(Number(d.value))}`}
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {chartData.map((d, i) => (
                    <Cell
                      key={i}
                      fill={
                        d.tier === "good"
                          ? ADG_COLOR.good
                          : d.tier === "fair"
                          ? ADG_COLOR.fair
                          : d.tier === "poor"
                          ? ADG_COLOR.poor
                          : "hsl(var(--primary))"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Breed comparison */}
      {multipleBreeds && (
        <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-border bg-muted/30">
            <h2 className="text-sm font-semibold">Breed Comparison</h2>
          </div>
          <div className="divide-y divide-border">
            {breedMap.map((b) => {
              const tier = ADG_TIER(b.avgAdg);
              const maxAdg = Math.max(...breedMap.map((x) => x.avgAdg ?? 0));
              const barPct = maxAdg > 0 && b.avgAdg !== null ? (b.avgAdg / maxAdg) * 100 : 0;
              return (
                <div key={b.breed} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                  <span className="text-sm font-semibold w-28 shrink-0 truncate" title={b.breed}>{b.breed}</span>
                  <div className="flex-1 space-y-1">
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${barPct}%`,
                          backgroundColor: ADG_COLOR[tier],
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {b.count} cattle
                      {b.avgFeedCost && ` · avg feed ৳${Math.round(b.avgFeedCost).toLocaleString("en-IN")}`}
                    </p>
                  </div>
                  <span className={cn("text-sm font-bold tabular-nums shrink-0", ADG_TEXT[tier])}>
                    {b.avgAdg !== null ? `${b.avgAdg.toFixed(2)} kg/d` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sortable performance table */}
      <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Performance Table</h2>
          <span className="text-xs text-muted-foreground">{cattle.length} cattle · click headers to sort</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <Th label="Cattle" className="text-left pl-4 sm:pl-5" />
                <Th label="Days" sortKey="daysInPen" active={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                <Th label="Weight" sortKey="weightGain" active={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                <Th label="ADG" sortKey="adg" active={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                <Th label="14d ADG" sortKey="adg14" active={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                <Th label="FCR" sortKey="fcr" active={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                <Th label="Feed Cost" sortKey="feedCost" active={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                <Th label="৳/kg gain" sortKey="costPerKgGain" active={sortKey} dir={sortDir} onSort={toggleSort} className="text-right pr-4 sm:pr-5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((c, i) => {
                const adgTier = ADG_TIER(c.adg);
                const adg14Tier = ADG_TIER(c.adg14);
                const fcrTier = FCR_TIER(c.fcr);
                return (
                  <tr
                    key={c.id}
                    className={cn(
                      "transition-colors",
                      i % 2 === 0 ? "bg-card" : "bg-muted/20",
                      "hover:bg-muted/40"
                    )}
                  >
                    {/* Cattle identity */}
                    <td className="pl-4 sm:pl-5 py-2.5">
                      <Link
                        href={`/dashboard/cattle/${c.id}`}
                        className="flex items-center gap-1.5 group w-fit"
                      >
                        <span className="font-semibold group-hover:text-primary group-hover:underline underline-offset-2 transition-colors">
                          #{c.tagId}
                        </span>
                        <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
                      </Link>
                      {c.breed && (
                        <p className="text-xs text-muted-foreground leading-none mt-0.5">{c.breed}</p>
                      )}
                    </td>
                    {/* Days */}
                    <td className="text-right py-2.5 tabular-nums text-xs text-muted-foreground">
                      {c.daysInPen}d
                    </td>
                    {/* Weight */}
                    <td className="text-right py-2.5 tabular-nums text-xs">
                      <span className="font-medium">{c.currentWeight.toFixed(0)} kg</span>
                      {c.weightGain > 0 && (
                        <span className="block text-xs text-emerald-600 dark:text-emerald-400">
                          +{c.weightGain.toFixed(0)}
                        </span>
                      )}
                    </td>
                    {/* ADG */}
                    <td className={cn("text-right py-2.5 tabular-nums text-xs font-bold", ADG_TEXT[adgTier])}>
                      {c.adg !== null ? c.adg.toFixed(2) : <span className="text-muted-foreground font-normal">—</span>}
                    </td>
                    {/* 14d ADG */}
                    <td className={cn("text-right py-2.5 tabular-nums text-xs font-semibold", ADG_TEXT[adg14Tier])}>
                      {c.adg14 !== null ? c.adg14.toFixed(2) : <span className="text-muted-foreground font-normal">—</span>}
                    </td>
                    {/* FCR */}
                    <td className={cn(
                      "text-right py-2.5 tabular-nums text-xs font-semibold",
                      fcrTier === "good" ? "text-emerald-600 dark:text-emerald-400"
                      : fcrTier === "fair" ? "text-amber-600 dark:text-amber-400"
                      : fcrTier === "poor" ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground"
                    )}>
                      {c.fcr !== null ? c.fcr.toFixed(1) : <span className="font-normal">—</span>}
                    </td>
                    {/* Feed Cost */}
                    <td className="text-right py-2.5 tabular-nums text-xs text-muted-foreground">
                      {c.feedCost > 0 ? fmt(c.feedCost) : "—"}
                    </td>
                    {/* Cost/kg Gain */}
                    <td className="text-right py-2.5 pr-4 sm:pr-5 tabular-nums text-xs text-muted-foreground">
                      {c.costPerKgGain !== null ? `৳${Math.round(c.costPerKgGain)}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="px-4 sm:px-5 py-2.5 border-t border-border bg-muted/20 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            ADG ≥ 0.5 kg/d
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            ADG 0.3–0.5
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
            ADG &lt; 0.3
          </span>
          <span className="ml-auto">FCR: lower is better · ≤7 good, ≤10 fair, &gt;10 poor</span>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color, icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color: "emerald" | "amber" | "red" | "blue" | "muted";
  icon: React.ReactNode;
}) {
  const styles = {
    emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/40", icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400", val: "text-emerald-700 dark:text-emerald-300" },
    amber:   { bg: "bg-amber-50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/40",   icon: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",   val: "text-amber-700 dark:text-amber-300" },
    red:     { bg: "bg-red-50 dark:bg-red-950/20 border border-red-200/70 dark:border-red-800/40",           icon: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",           val: "text-red-700 dark:text-red-300" },
    blue:    { bg: "bg-blue-50 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-800/40",       icon: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",       val: "text-blue-700 dark:text-blue-300" },
    muted:   { bg: "bg-muted/40 border border-border/60",                                                  icon: "bg-muted text-muted-foreground",                                          val: "text-foreground" },
  }[color];

  return (
    <div className={cn("rounded-xl p-3 sm:p-4 space-y-2", styles.bg)}>
      <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", styles.icon)}>{icon}</div>
      <div>
        <p className={cn("text-2xl font-bold tabular-nums leading-none", styles.val)}>{value}</p>
        <p className="mt-0.5 text-xs font-medium text-muted-foreground uppercase tracking-wide leading-tight">{label}</p>
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

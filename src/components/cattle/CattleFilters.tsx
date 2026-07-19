"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, SlidersHorizontal, X, ArrowUpDown, AlertTriangle, Scale, HeartPulse } from "lucide-react";
import { DataPagination } from "@/components/ui/data-pagination";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CattleTable } from "./CattleTable";
import { CattleCards } from "./CattleCards";
import type { CattleRowEnriched } from "@/app/dashboard/(app)/cattle/page";
import type { CattleStatus } from "@/types/database";
import { useTranslation } from "@/i18n/I18nProvider";

function fmtAmount(n: number): string {
  if (n >= 10000000) return `৳${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `৳${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)     return `৳${(n / 1000).toFixed(0)}K`;
  return `৳${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

interface Props {
  cattle: CattleRowEnriched[];
  allBreeds: string[];
  alerts: {
    unweighedCount: number;
    overdueHealthCount: number;
    highFcrCount: number;
  };
}

type CattleStatusFilter = CattleStatus | "all";
type SortKey = "default" | "adg_desc" | "adg_asc" | "days_desc" | "price_asc" | "last_weighed_asc";
type QuickFilter = "unweighed" | "high_fcr" | null;

const VALID_STATUSES: CattleStatus[] = ["active", "sold", "dead"];

export function CattleFilters({ cattle, allBreeds, alerts }: Props) {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") as CattleStatus | null;
  const { t } = useTranslation();

  const [search, setSearch] = useState("");
  const [statusFilter, setCattleStatus] = useState<CattleStatus[]>(
    initialStatus && VALID_STATUSES.includes(initialStatus) ? [initialStatus] : ["active"]
  );
  const [breedFilter, setBreedFilter] = useState<string[]>([]);
  const [minWeight, setMinWeight] = useState("");
  const [maxWeight, setMaxWeight] = useState("");
  const [minDays, setMinDays] = useState("");
  const [maxDays, setMaxDays] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null);
  const [page, setPage]       = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [nowMs] = useState(() => Date.now());

  const filtered = useMemo(() => {
    let list = cattle;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) => c.tag_id.toLowerCase().includes(q) || (c.breed ?? "").toLowerCase().includes(q)
      );
    }

    if (statusFilter.length > 0) list = list.filter((c) => statusFilter.includes(c.status));
    if (breedFilter.length > 0) list = list.filter((c) => breedFilter.includes(c.breed ?? ""));
    if (minWeight) list = list.filter((c) => c.initial_weight_kg >= Number(minWeight));
    if (maxWeight) list = list.filter((c) => c.initial_weight_kg <= Number(maxWeight));
    if (minDays)   list = list.filter((c) => c.daysInPen !== null && c.daysInPen >= Number(minDays));
    if (maxDays)   list = list.filter((c) => c.daysInPen !== null && c.daysInPen <= Number(maxDays));

    // Smart quick filters
    if (quickFilter === "unweighed") {
      const cutoff = nowMs - 7 * 86400000;
      list = list.filter(
        (c) => c.status === "active" && (!c.lastWeighedAt || new Date(c.lastWeighedAt).getTime() < cutoff)
      );
    } else if (quickFilter === "high_fcr") {
      list = list.filter((c) => c.fcr !== null && c.fcr > 10);
    }

    // Sort
    if (sortKey !== "default") {
      list = [...list].sort((a, b) => {
        if (sortKey === "adg_desc") {
          if (a.adg === null && b.adg === null) return 0;
          if (a.adg === null) return 1;
          if (b.adg === null) return -1;
          return b.adg - a.adg;
        }
        if (sortKey === "adg_asc") {
          if (a.adg === null && b.adg === null) return 0;
          if (a.adg === null) return 1;
          if (b.adg === null) return -1;
          return a.adg - b.adg;
        }
        if (sortKey === "days_desc") return (b.daysInPen ?? -1) - (a.daysInPen ?? -1);
        if (sortKey === "price_asc") return a.purchase_price - b.purchase_price;
        if (sortKey === "last_weighed_asc") {
          // Never-weighed cattle appear first, then oldest-weighed
          if (!a.lastWeighedAt && !b.lastWeighedAt) return 0;
          if (!a.lastWeighedAt) return -1;
          if (!b.lastWeighedAt) return 1;
          return new Date(a.lastWeighedAt).getTime() - new Date(b.lastWeighedAt).getTime();
        }
        return 0;
      });
    }

    return list;
  }, [cattle, search, statusFilter, breedFilter, minWeight, maxWeight, minDays, maxDays, sortKey, quickFilter, nowMs]);

  // Summary stats always reflect the filtered view so numbers match what's visible in the table
  const summaryStats = useMemo(() => {
    const active = filtered.filter((c) => c.status === "active");
    const sold   = filtered.filter((c) => c.status === "sold").length;
    const adgList = active.map((c) => c.adg).filter((a): a is number => a !== null);
    const avgAdg = adgList.length > 0
      ? adgList.reduce((s, a) => s + a, 0) / adgList.length : null;
    const totalInvestment = filtered.reduce(
      (s, c) => s + Number(c.purchase_price) + c.totalFeedCost, 0
    );
    return { activeCount: active.length, soldCount: sold, avgAdg, totalInvestment };
  }, [filtered]);

  // Reset page on any filter change
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(0); }, [search, statusFilter, breedFilter, minWeight, maxWeight, minDays, maxDays, sortKey, quickFilter, pageSize]);

  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);

  function toggleStatus(s: CattleStatus) {
    setCattleStatus((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  function toggleBreed(b: string) {
    setBreedFilter((prev) => prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]);
  }

  function clearAll() {
    setSearch("");
    setCattleStatus([]);
    setBreedFilter([]);
    setMinWeight("");
    setMaxWeight("");
    setMinDays("");
    setMaxDays("");
    setSortKey("default");
    setQuickFilter(null);
    setPage(0);
  }

  const hasFilters =
    search.trim() ||
    statusFilter.length > 0 ||
    breedFilter.length > 0 ||
    minWeight || maxWeight ||
    minDays || maxDays ||
    quickFilter !== null;

  const activeCount =
    (search.trim() ? 1 : 0) +
    (statusFilter.length > 0 ? 1 : 0) +
    (breedFilter.length > 0 ? 1 : 0) +
    (minWeight || maxWeight ? 1 : 0) +
    (minDays || maxDays ? 1 : 0) +
    (quickFilter !== null ? 1 : 0);

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "default",          label: t.cattle_details.smart.sort_default },
    { key: "adg_desc",         label: t.cattle_details.smart.sort_adg_desc },
    { key: "adg_asc",          label: t.cattle_details.smart.sort_adg_asc },
    { key: "last_weighed_asc", label: "Oldest Weighed First" },
    { key: "days_desc",        label: t.cattle_details.smart.sort_days_desc },
    { key: "price_asc",        label: t.cattle_details.smart.sort_price_asc },
  ];

  const showChips = alerts.unweighedCount > 0 || alerts.highFcrCount > 0 || alerts.overdueHealthCount > 0;

  return (
    <div className="space-y-4">

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          {
            label: t.cattle_details.summary.active,
            value: summaryStats.activeCount.toString(),
            accent: "text-emerald-600 dark:text-emerald-400",
          },
          {
            label: t.cattle_details.summary.avg_adg,
            value: summaryStats.avgAdg !== null ? `${summaryStats.avgAdg.toFixed(2)} kg/d` : "—",
            accent: summaryStats.avgAdg !== null
              ? summaryStats.avgAdg >= 0.5 ? "text-emerald-600 dark:text-emerald-400"
              : summaryStats.avgAdg >= 0.3 ? "text-amber-600 dark:text-amber-400"
              : "text-red-500 dark:text-red-400"
              : "text-muted-foreground",
          },
          {
            label: t.cattle_details.summary.invested,
            value: fmtAmount(summaryStats.totalInvestment),
            accent: "text-foreground",
          },
          {
            label: t.cattle_details.summary.sold,
            value: summaryStats.soldCount.toString(),
            accent: summaryStats.soldCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl bg-card border border-border/60 px-3 py-2.5 sm:px-4 sm:py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">
              {stat.label}
            </p>
            <p className={cn("mt-1 text-xl sm:text-2xl font-bold tabular-nums tracking-tight truncate", stat.accent)}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Smart action chips ── */}
      {showChips && (
        <div className="flex flex-wrap gap-2 print:hidden">
          {alerts.overdueHealthCount > 0 && (
            <Link
              href="/dashboard/cattle/health"
              className="inline-flex items-center gap-1.5 rounded-full border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/60 transition-colors"
            >
              <HeartPulse className="h-3.5 w-3.5" />
              {alerts.overdueHealthCount} overdue health
              <span className="opacity-60">→</span>
            </Link>
          )}
          {alerts.unweighedCount > 0 && (
            <button
              onClick={() => setQuickFilter((q) => q === "unweighed" ? null : "unweighed")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                quickFilter === "unweighed"
                  ? "bg-amber-500 text-white border-amber-500 shadow-card"
                  : "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/60"
              )}
            >
              <Scale className="h-3.5 w-3.5" />
              {alerts.unweighedCount} unweighed
              {quickFilter === "unweighed" && <X className="h-3 w-3 opacity-80" />}
            </button>
          )}
          {alerts.highFcrCount > 0 && (
            <button
              onClick={() => setQuickFilter((q) => q === "high_fcr" ? null : "high_fcr")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                quickFilter === "high_fcr"
                  ? "bg-orange-500 text-white border-orange-500 shadow-card"
                  : "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-950/60"
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {alerts.highFcrCount} high FCR
              {quickFilter === "high_fcr" && <X className="h-3 w-3 opacity-80" />}
            </button>
          )}
        </div>
      )}

      {/* ── Search + Filter + Sort bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-0 sm:min-w-[180px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t.cattle_details.filters.search_placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Sort */}
        <Popover>
          <PopoverTrigger className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}>
            <ArrowUpDown className="h-4 w-4" />
            {t.cattle_details.smart.sort_by}
            {sortKey !== "default" && (
              <Badge className="ml-1 h-4 min-w-4 rounded-full px-1 text-xs bg-primary text-primary-foreground">1</Badge>
            )}
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2" align="end">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortKey(opt.key)}
                className={`w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                  sortKey === opt.key ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {/* Filters */}
        <Popover>
          <PopoverTrigger className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5 relative")}>
            <SlidersHorizontal className="h-4 w-4" />
            {t.cattle_details.filters.filters}
            {activeCount > 0 && (
              <Badge className="ml-1 h-4 min-w-4 rounded-full px-1 text-xs bg-primary text-primary-foreground">
                {activeCount}
              </Badge>
            )}
          </PopoverTrigger>
          <PopoverContent className="w-76 p-4 space-y-4" align="end">
            {/* Status */}
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</Label>
              <div className="flex flex-wrap gap-1.5">
                {(["active", "sold", "dead"] as CattleStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleStatus(s)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                      statusFilter.includes(s)
                        ? s === "active" ? "bg-emerald-500 text-white"
                          : s === "sold" ? "bg-amber-500 text-white"
                          : "bg-muted-foreground text-background"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Breed */}
            {allBreeds.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Breed</Label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {allBreeds.map((b) => (
                    <button
                      key={b}
                      onClick={() => toggleBreed(b)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        breedFilter.includes(b)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Weight range */}
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t.cattle_details.filters.initial_weight_kg}
              </Label>
              <div className="flex items-center gap-2">
                <Input type="number" placeholder="Min" value={minWeight} onChange={(e) => setMinWeight(e.target.value)} className="h-8 text-sm" />
                <span className="text-muted-foreground text-sm">–</span>
                <Input type="number" placeholder="Max" value={maxWeight} onChange={(e) => setMaxWeight(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>

            {/* Days range */}
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t.cattle_details.filters.days_in_pen}
              </Label>
              <div className="flex items-center gap-2">
                <Input type="number" placeholder="Min" value={minDays} onChange={(e) => setMinDays(e.target.value)} className="h-8 text-sm" />
                <span className="text-muted-foreground text-sm">–</span>
                <Input type="number" placeholder="Max" value={maxDays} onChange={(e) => setMaxDays(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>

            {hasFilters && (
              <Button variant="ghost" size="sm" className="w-full gap-1.5 text-destructive" onClick={clearAll}>
                <X className="h-3.5 w-3.5" />
                {t.cattle_details.filters.clear_all_filters}
              </Button>
            )}
          </PopoverContent>
        </Popover>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1 text-muted-foreground">
            <X className="h-3.5 w-3.5" />
            {t.cattle_details.filters.clear}
          </Button>
        )}
      </div>

      {/* Result count */}
      {hasFilters && (
        <p className="text-sm text-muted-foreground">
          {t.cattle_details.filters.showing_cattle
            .replace("{{filtered}}", filtered.length.toString())
            .replace("{{total}}", cattle.length.toString())}
          {quickFilter && (
            <span className="ml-2 font-medium text-foreground">
              — {quickFilter === "unweighed" ? "showing unweighed cattle" : "showing high FCR cattle"}
            </span>
          )}
        </p>
      )}

      {/* Table / Cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-10 text-center">
          <p className="text-sm text-muted-foreground">{t.cattle_details.filters.no_cattle_found}</p>
          <Button variant="link" size="sm" onClick={clearAll}>
            {t.cattle_details.filters.clear_filters}
          </Button>
        </div>
      ) : (
        <>
          <div className="md:hidden">
            <CattleCards cattle={paginated} allTagIds={cattle.map((c) => c.tag_id)} allBreeds={allBreeds} />
          </div>
          <div className="hidden md:block">
            <CattleTable cattle={paginated} allTagIds={cattle.map((c) => c.tag_id)} allBreeds={allBreeds} />
          </div>
          <DataPagination
            total={filtered.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
          />
        </>
      )}
    </div>
  );
}

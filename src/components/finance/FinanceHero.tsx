import Link from "next/link";
import { FileDiff, AlertTriangle, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { getCashBalance } from "@/lib/supabase/queries/cash";
import { getCachedTopBarAlerts } from "@/lib/supabase/topbar-alerts";
import { AddCostDialog } from "@/components/finance/AddCostDialog";

function fmt(n: number): string {
  if (!isFinite(n) || isNaN(n)) return "৳—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 10_000_000) return `${sign}৳${(abs / 10_000_000).toFixed(1)}Cr`;
  if (abs >= 100_000)    return `${sign}৳${(abs / 100_000).toFixed(1)}L`;
  if (abs >= 1_000)      return `${sign}৳${(abs / 1_000).toFixed(0)}K`;
  return `${sign}৳${Math.round(abs)}`;
}

const PERIODS = [
  { value: "this-month", label: "This Month" },
  { value: "last-month", label: "Last Month" },
  { value: "last-3m",    label: "3 Months"  },
  { value: "this-year",  label: "This Year" },
  { value: "all",        label: "All Time"  },
] as const;

interface Props {
  periodRevenue: number;
  periodOperatingCosts: number;
  periodNetPL: number;
  salesCount: number;
  costsCount: number;
  activePeriod: string;
}

export async function FinanceHero({
  periodRevenue,
  periodOperatingCosts,
  periodNetPL,
  salesCount,
  costsCount,
  activePeriod,
}: Props) {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) return null;

  const today = new Date();
  const todayISO        = today.toISOString().slice(0, 10);
  const in7ISO          = new Date(today.getTime() +  7 * 86400000).toISOString().slice(0, 10);
  const in30ISO         = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const sevenDaysAgoISO = new Date(today.getTime() -  7 * 86400000).toISOString().slice(0, 10);

  const [cash, alerts, { data: loansRaw }] = await Promise.all([
    getCashBalance(supabase, businessId),
    getCachedTopBarAlerts(businessId, todayISO, in7ISO, in30ISO, sevenDaysAgoISO),
    supabase
      .from("loans")
      .select("due_date")
      .eq("business_id", businessId)
      .eq("status", "active")
      .is("deleted_at", null),
  ]);

  const { balance } = cash;
  const loans = (loansRaw ?? []) as { due_date: string | null }[];
  const overdueCount  = loans.filter(l => l.due_date && l.due_date <  todayISO).length;
  const dueSoonCount  = loans.filter(l => l.due_date && l.due_date >= todayISO && l.due_date <= in30ISO).length;
  const lowStockCount = alerts.lowStockItems.length;

  const isProfit   = periodNetPL >= 0;
  const hasSales   = salesCount > 0;
  const marginPct  = hasSales && periodRevenue > 0
    ? (periodNetPL / periodRevenue) * 100
    : null;
  const hasAlerts  = overdueCount > 0 || dueSoonCount > 0 || lowStockCount > 0;

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-card">

      {/* ── Header: title + quick actions ── */}
      <div className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Finance</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Financial overview</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/finance/bulk-add"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <FileDiff className="h-3.5 w-3.5" />
            Bulk Add
          </Link>
          <AddCostDialog />
        </div>
      </div>

      {/* ── Period selector ── */}
      <div className="flex items-center gap-0.5 border-b border-border/50 bg-muted/20 px-4 py-2">
        {PERIODS.map(({ value, label }) => (
          <Link
            key={value}
            href={`?fp=${value}`}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 whitespace-nowrap",
              activePeriod === value
                ? "bg-primary text-primary-foreground shadow-card"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* ── KPI grid — 4 columns, separated by rule lines ── */}
      <div className="grid grid-cols-2 divide-x divide-y divide-border/60 sm:grid-cols-4 sm:divide-y-0">

        {/* 1 — Revenue */}
        <div className="px-5 py-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">
            Revenue
          </p>
          <p className={cn(
            "mt-3 text-[28px] font-bold tabular-nums leading-none tracking-tight",
            hasSales ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
          )}>
            {fmt(periodRevenue)}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {hasSales ? `${salesCount} sale${salesCount !== 1 ? "s" : ""}` : "No sales yet"}
          </p>
        </div>

        {/* 2 — Operating Costs */}
        <div className="px-5 py-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">
            Operating Costs
          </p>
          <p className="mt-2.5 text-[26px] font-bold tabular-nums leading-none tracking-tight text-foreground">
            {fmt(periodOperatingCosts)}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {costsCount > 0 ? `${costsCount} entries` : "No costs yet"}
          </p>
        </div>

        {/* 3 — Net P&L */}
        <div className={cn(
          "px-5 py-5",
          isProfit && hasSales   ? "bg-emerald-50/40 dark:bg-emerald-950/10"
          : !isProfit             ? "bg-red-50/40 dark:bg-red-950/10"
          : ""
        )}>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">
            Net P&amp;L
          </p>
          <p className={cn(
            "mt-3 text-[28px] font-bold tabular-nums leading-none tracking-tight",
            isProfit && hasSales  ? "text-emerald-600 dark:text-emerald-400"
            : !isProfit            ? "text-red-600 dark:text-red-400"
            : "text-muted-foreground"
          )}>
            {periodNetPL > 0 ? "+" : periodNetPL < 0 ? "−" : ""}
            {fmt(Math.abs(periodNetPL))}
          </p>
          <p className={cn(
            "mt-1.5 text-xs",
            isProfit && hasSales  ? "text-emerald-600/80 dark:text-emerald-400/80"
            : !isProfit            ? "text-red-500/80 dark:text-red-400/80"
            : "text-muted-foreground"
          )}>
            {marginPct !== null
              ? isProfit
                ? `${marginPct.toFixed(1)}% margin ✓`
                : `${Math.abs(marginPct).toFixed(1)}% loss`
              : "No sales"}
          </p>
        </div>

        {/* 4 — Cash Balance (links to accounting) */}
        <Link href="/dashboard/accounting" className="group block">
          <div className="h-full px-5 py-5 transition-colors group-hover:bg-muted/20">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">
              Cash Balance
            </p>
            <p className={cn(
              "mt-3 text-[28px] font-bold tabular-nums leading-none tracking-tight",
              balance >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"
            )}>
              {fmt(balance)}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">
              View accounting →
            </p>
          </div>
        </Link>
      </div>

      {/* ── Alert strip (only shown when issues exist) ── */}
      {hasAlerts && (
        <div className="flex flex-wrap gap-2 border-t border-border/50 bg-muted/10 px-5 py-3">
          {overdueCount > 0 && (
            <Link
              href="/dashboard/finance/loans"
              className="inline-flex items-center gap-1.5 rounded-full border border-red-200/70 dark:border-red-800/40 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-600 dark:text-red-400 transition-colors hover:bg-red-500/20"
            >
              <AlertTriangle className="h-3 w-3" />
              {overdueCount} loan{overdueCount !== 1 ? "s" : ""} overdue — pay now
            </Link>
          )}
          {!overdueCount && dueSoonCount > 0 && (
            <Link
              href="/dashboard/finance/loans"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/70 dark:border-amber-800/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400 transition-colors hover:bg-amber-500/20"
            >
              <AlertTriangle className="h-3 w-3" />
              {dueSoonCount} loan{dueSoonCount !== 1 ? "s" : ""} due within 30 days
            </Link>
          )}
          {lowStockCount > 0 && (
            <Link
              href="/dashboard/inventory"
              className="inline-flex items-center gap-1.5 rounded-full border border-orange-200/70 dark:border-orange-800/40 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-600 dark:text-orange-400 transition-colors hover:bg-orange-500/20"
            >
              <Package className="h-3 w-3" />
              {lowStockCount} item{lowStockCount !== 1 ? "s" : ""} low on stock
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export function FinanceHeroSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        <div className="space-y-1.5">
          <div className="h-5 w-44 animate-pulse rounded-md bg-muted" />
          <div className="h-3 w-24 animate-pulse rounded bg-muted/70" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-20 animate-pulse rounded-lg bg-muted" />
          <div className="h-8 w-28 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
      {/* Period tabs */}
      <div className="flex gap-1 border-b border-border/50 bg-muted/20 px-4 py-2">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="h-8 w-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      {/* KPI grid */}
      <div className="grid grid-cols-2 divide-x divide-y divide-border/60 sm:grid-cols-4 sm:divide-y-0">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="space-y-3 px-5 py-5">
            <div className="h-2.5 w-20 animate-pulse rounded-full bg-muted" />
            <div className="h-8 w-28 animate-pulse rounded-md bg-muted" />
            <div className="h-2.5 w-16 animate-pulse rounded-full bg-muted/70" />
          </div>
        ))}
      </div>
    </div>
  );
}

import { ClientDate } from "@/components/shared/ClientDate";
import { fmtBDT } from "@/lib/format";
import type { DashboardStats } from "@/lib/supabase/queries/dashboard";
import type { Dictionary, Locale } from "@/i18n/getDictionary";
import type { HealthScore } from "@/lib/supabase/queries/analytics";
import type { LiveValuationResult } from "@/lib/supabase/queries/valuation";
import { Sparkles, CheckCircle2, TrendingUp, TrendingDown, ArrowUpRight, Activity, Beef, Wallet, Shield } from "lucide-react";
import Link from "next/link";

interface Props {
  stats: DashboardStats;
  healthScore?: HealthScore;
  valuation?: LiveValuationResult;
  t: Dictionary;
  locale: Locale;
}

export function DashboardHero({ stats, healthScore, valuation, t, locale }: Props) {
  const isProfit = stats.totalSales > 0 && stats.netProfitLoss > 0;
  const isLoss = stats.totalSales > 0 && stats.netProfitLoss < 0;

  const hasHealthData = healthScore && (healthScore.fcr !== null || healthScore.avgDaysInPen > 0 || healthScore.stockDays !== null);
  const healthTier = !hasHealthData ? null : healthScore.score >= 70 ? "excellent" : healthScore.score >= 40 ? "fair" : "needs-attention";
  const healthColor = healthTier === "excellent" ? "text-emerald-600 dark:text-emerald-400" : healthTier === "fair" ? "text-amber-600 dark:text-amber-400" : healthTier === "needs-attention" ? "text-red-600 dark:text-red-400" : "text-muted-foreground";
  const healthBg = healthTier === "excellent" ? "bg-emerald-500/10 border-emerald-500/20" : healthTier === "fair" ? "bg-amber-500/10 border-amber-500/20" : healthTier === "needs-attention" ? "bg-red-500/10 border-red-500/20" : "bg-muted/60 border-border/60";
  const activeCattle = valuation?.activeCattleCount ?? stats.totalCattle;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-card/60 backdrop-blur-md border border-border/40 p-5 sm:p-6 shadow-sm transition-all animate-fade-in-up">
      {/* Subtle executive background glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/5 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-emerald-500/5 blur-3xl" />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        {/* Left Column: Greeting + Operational Status */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Command Center
            </span>
            {healthTier && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold border ${healthBg} ${healthColor}`}>
                <Shield className="h-3 w-3" />
                {healthTier === "excellent" ? "Farm Healthy" : healthTier === "fair" ? "Fair Condition" : "Needs Attention"}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {t.dashboard.welcome}
          </h1>

          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-muted-foreground">
            <ClientDate locale={locale} />
            <span className="text-border">•</span>
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Operations Live
            </span>
            {activeCattle > 0 && (
              <>
                <span className="text-border">•</span>
                <span className="inline-flex items-center gap-1 font-medium">
                  <Beef className="h-3.5 w-3.5 text-amber-500" />
                  {activeCattle} Active Cattle
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right Column: P&L + Quick Stats Strip */}
        <div className="flex flex-wrap items-center gap-3">
          {hasHealthData && (
            <Link href="/dashboard/cattle" className="hidden sm:flex items-center gap-2.5 rounded-xl bg-background/80 dark:bg-card/80 backdrop-blur-md px-4 py-2.5 border border-border/70 shadow-xs hover:shadow-card transition-all group">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${healthBg}`}>
                <Activity className={`h-4 w-4 ${healthColor}`} />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">Health</p>
                <p className={`text-lg font-bold tabular-nums leading-tight ${healthColor}`}>{healthScore.score}<span className="text-xs font-normal opacity-60">/100</span></p>
              </div>
            </Link>
          )}

          {stats.totalSales > 0 ? (
            <div className="flex items-center gap-4 rounded-xl bg-background/80 dark:bg-card/80 backdrop-blur-md px-4 py-2.5 sm:px-5 sm:py-3 border border-border/70 shadow-xs">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-muted/60">
                {isProfit ? (
                  <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                ) : isLoss ? (
                  <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                ) : (
                  <Sparkles className="h-5 w-5 text-primary" />
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight">
                  Realized {t.dashboard.net_pl}
                </p>
                <p className={`text-xl sm:text-2xl font-bold tabular-nums tracking-tight ${
                  isProfit
                    ? "text-emerald-600 dark:text-emerald-400"
                    : isLoss
                    ? "text-red-600 dark:text-red-400"
                    : "text-foreground"
                }`}>
                  {isProfit ? "+" : ""}{fmtBDT(stats.netProfitLoss)}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl bg-background/80 dark:bg-card/80 backdrop-blur-md px-4 py-3 border border-border/70 shadow-xs text-xs text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <span>Record sales & costs to track net realized performance</span>
            </div>
          )}

          <Link
            href="/dashboard/finance"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all active:scale-[0.98]"
          >
            <Wallet className="h-4 w-4" />
            <span>Financial Hub</span>
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

import { TrendingUp, ArrowRight, Activity, Wallet, Beef, Sparkles, Scale } from "lucide-react";
import Link from "next/link";
import { fmtBDT } from "@/lib/format";
import type { LiveValuationResult } from "@/lib/supabase/queries/valuation";
import { cn } from "@/lib/utils";

interface Props {
  valuation: LiveValuationResult;
}

export function LiveHerdValueCard({ valuation }: Props) {
  const {
    totalEstimatedValue,
    totalCostBasis,
    unrealizedProfit,
    activeCattleCount,
    marketPricePerKg,
    readyToSellCattle,
    totalEstimatedWeightKg,
    averageWeightKg,
  } = valuation;

  // We only show it if there is a market price set and some active cattle
  if (activeCattleCount === 0 || marketPricePerKg === 0) {
    return null;
  }

  const isProfitable = unrealizedProfit >= 0;
  const readyCount = readyToSellCattle?.length ?? 0;

  return (
    <Link href="/dashboard/cattle" className="block group h-full">
      <div
        className={cn(
          "relative h-full flex flex-col justify-between rounded-xl border shadow-card p-5 transition-all group-hover:shadow-card-md group-hover:-translate-y-0.5",
          isProfitable
            ? "bg-gradient-to-br from-emerald-50/70 via-card to-emerald-50/40 dark:from-emerald-950/25 dark:via-card dark:to-emerald-950/10 border-emerald-200/70 dark:border-emerald-800/40"
            : "bg-gradient-to-br from-red-50/70 via-card to-red-50/40 dark:from-red-950/25 dark:via-card dark:to-red-950/10 border-red-200/70 dark:border-red-800/40"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-xl",
                isProfitable ? "bg-emerald-500/15" : "bg-red-500/15"
              )}
            >
              <Beef
                className={cn(
                  "h-4 w-4",
                  isProfitable
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-500 dark:text-red-400"
                )}
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                Live Herd &amp; Weight Valuation
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider",
                    isProfitable
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : "bg-red-500/15 text-red-700 dark:text-red-400"
                  )}
                >
                  {activeCattleCount} Active Head
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Today&apos;s expected weight @ ৳{marketPricePerKg}/kg live market rate
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
            <span className="hidden sm:inline">Cattle Manager</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>

        {/* Main Value Display */}
        <div className="flex items-end justify-between gap-4 my-2 flex-wrap">
          <div>
            <p
              className={cn(
                "text-3xl sm:text-4xl font-bold tabular-nums leading-none tracking-tight",
                isProfitable
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-red-700 dark:text-red-300"
              )}
            >
              {isProfitable ? "+" : ""}{fmtBDT(unrealizedProfit)}
            </p>
            <p
              className={cn(
                "text-xs mt-1 font-medium",
                isProfitable
                  ? "text-emerald-600/80 dark:text-emerald-400/80"
                  : "text-red-600/80 dark:text-red-400/80"
              )}
            >
              Estimated Unrealized {isProfitable ? "Profit" : "Loss"}
            </p>
          </div>

          <div className="text-right">
            <p className="text-sm font-bold text-foreground tabular-nums">
              {Math.round(totalEstimatedWeightKg).toLocaleString()} kg
            </p>
            <p className="text-[11px] text-muted-foreground">
              Avg: {Math.round(averageWeightKg)} kg / head
            </p>
          </div>
        </div>

        {/* Footnotes / Breakdown */}
        <div className="grid grid-cols-2 gap-2 mt-auto pt-3 border-t border-border/40">
          <div className="flex items-center justify-between rounded-lg bg-background/60 dark:bg-card/40 border border-border/40 px-3 py-1.5">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Wallet className="h-3 w-3 text-muted-foreground/70" /> Total Value
            </span>
            <span className="text-xs font-bold tabular-nums text-foreground">
              {fmtBDT(totalEstimatedValue)}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-background/60 dark:bg-card/40 border border-border/40 px-3 py-1.5">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Activity className="h-3 w-3 text-muted-foreground/70" /> Cost Basis
            </span>
            <span className="text-xs font-bold tabular-nums text-foreground">
              {fmtBDT(totalCostBasis)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}



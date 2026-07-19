import { TrendingUp, ArrowRight, Activity, Wallet } from "lucide-react";
import Link from "next/link";
import { fmtBDT } from "@/lib/format";
import type { LiveValuationResult } from "@/lib/supabase/queries/valuation";

interface Props {
  valuation: LiveValuationResult;
}

export function LiveHerdValueCard({ valuation }: Props) {
  const { totalEstimatedValue, totalCostBasis, unrealizedProfit, activeCattleCount, marketPricePerKg } = valuation;

  // We only show it if there is a market price set and some active cattle
  if (activeCattleCount === 0 || marketPricePerKg === 0) {
    return null;
  }

  const isProfitable = unrealizedProfit >= 0;

  return (
    <Link href="/dashboard/cattle" className="block group animate-fade-in-up delay-75 h-full">
      <div className={`relative h-full flex flex-col justify-center overflow-hidden rounded-2xl border px-6 py-5 transition-all duration-300 group-hover:shadow-lg group-hover:-translate-y-0.5 ${
        isProfitable
          ? "border-emerald-200/60 dark:border-emerald-800/40 bg-gradient-to-br from-emerald-50/50 to-emerald-100/30 dark:from-emerald-950/20 dark:to-emerald-900/10"
          : "border-red-200/60 dark:border-red-800/40 bg-gradient-to-br from-red-50/50 to-red-100/30 dark:from-red-950/20 dark:to-red-900/10"
      }`}>
        
        {/* Animated Background Glow */}
        <div className={`absolute -right-20 -top-20 h-40 w-40 rounded-full blur-3xl opacity-20 transition-opacity group-hover:opacity-40 ${
          isProfitable ? "bg-emerald-500" : "bg-red-500"
        }`} />

        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ${
              isProfitable 
                ? "bg-white/80 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400" 
                : "bg-white/80 dark:bg-red-950/50 text-red-600 dark:text-red-400"
            }`}>
              <TrendingUp className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-2">
                What-If Scenario
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  isProfitable ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400"
                }`}>
                  Live
                </span>
              </h3>
              
              <p className="text-sm font-medium text-foreground">
                If you sell all <span className="font-bold">{activeCattleCount}</span> active cattle today at ৳{marketPricePerKg}/kg:
              </p>

              <div className="flex items-baseline gap-3 mt-2">
                <p className={`text-3xl font-bold tracking-tight tabular-nums ${
                  isProfitable ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                }`}>
                  {isProfitable ? "+" : ""}{fmtBDT(unrealizedProfit)} <span className="text-lg font-semibold opacity-70">profit</span>
                </p>
              </div>

              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground/80 font-medium">
                <span className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Value: {fmtBDT(totalEstimatedValue)}</span>
                <span className="text-border">•</span>
                <span className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> Cost Basis: {fmtBDT(totalCostBasis)}</span>
              </div>
            </div>
          </div>
          
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background/50 shadow-sm backdrop-blur-sm transition-transform group-hover:translate-x-1 ${
             isProfitable ? "text-emerald-600" : "text-red-600"
          }`}>
            <ArrowRight className="h-5 w-5" />
          </div>
        </div>
      </div>
    </Link>
  );
}

import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getCashBalance } from "@/lib/supabase/queries/cash";
import {
  Wallet, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle,
  ArrowRight, BadgeDollarSign, Scale,
} from "lucide-react";
import type { Dictionary } from "@/i18n/getDictionary";

interface Props {
  businessId: string;
  tagId: string;
  latestWeightKg: number;
  /** Weight extrapolated to today using ADG × days since last weigh. Falls back to latestWeightKg if not provided. */
  estimatedWeightKg?: number;
  totalCost: number;
  marketPricePerKg: number | null | undefined;
  breakEvenPerKg: number | null;
  t: Dictionary;
}

function fmt(n: number) {
  return `৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
}

export async function SellCashImpactCard({
  businessId,
  tagId,
  latestWeightKg,
  estimatedWeightKg,
  totalCost,
  marketPricePerKg,
  breakEvenPerKg,
  t,
}: Props) {
  const si = t.cattle_details.sell_impact;
  const supabase = await createClient();
  const cash = await getCashBalance(supabase, businessId);
  const { balance } = cash;

  if (!marketPricePerKg || marketPricePerKg <= 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card shadow-card px-6 py-5">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10">
            <Wallet className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-sm font-semibold">{si.title}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          {si.set_market_price.split("cattle list page")[0]}
          <Link href="/dashboard/cattle" className="text-primary underline underline-offset-2">
            cattle list page
          </Link>
          {si.set_market_price.split("cattle list page")[1]}
        </p>
      </div>
    );
  }

  // Use extrapolated weight when available — sells "today" means today's estimated weight,
  // not the potentially weeks-old last weighed value.
  const saleWeightKg = estimatedWeightKg ?? latestWeightKg;
  const isEstimated = estimatedWeightKg !== undefined && estimatedWeightKg !== latestWeightKg;
  const estimatedSaleValue = Math.round(saleWeightKg * marketPricePerKg);
  const profitFromSale = estimatedSaleValue - totalCost;
  const isProfitable = profitFromSale >= 0;
  const projectedBalance = balance + estimatedSaleValue;
  // Break-even must match the weight we're actually selling at — not the stale logged weight.
  const effectiveBreakEvenPerKg = saleWeightKg > 0 ? totalCost / saleWeightKg : breakEvenPerKg;
  const isBreakEvenMet = effectiveBreakEvenPerKg !== null && marketPricePerKg >= effectiveBreakEvenPerKg;
  const profitPct = totalCost > 0 ? Math.round((profitFromSale / totalCost) * 100) : 0;

  return (
    <div className={cn(
      "rounded-xl border shadow-card overflow-hidden",
      isProfitable
        ? "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/40 dark:bg-emerald-950/15"
        : "border-red-200 dark:border-red-800/50 bg-red-50/40 dark:bg-red-950/15"
    )}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-inherit">
        <div className={cn(
          "flex h-7 w-7 items-center justify-center rounded-lg",
          isProfitable ? "bg-emerald-500/10" : "bg-red-500/10"
        )}>
          <Wallet className={cn(
            "h-4 w-4",
            isProfitable ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
          )} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">
            {si.title} — #{tagId}
          </p>
          <p className="text-xs text-muted-foreground">
            {si.subtitle.replace("{{price}}", String(marketPricePerKg))}
          </p>
        </div>
        {isProfitable
          ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          : <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
        }
      </div>

      {/* Sale value + profit */}
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border/50 border-b border-inherit">
        <div className="px-5 py-4">
          <div className="flex items-center gap-1.5 mb-1">
            <BadgeDollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{si.estimated_sale}</p>
          </div>
          <p className="text-xl font-bold tabular-nums text-foreground">{fmt(estimatedSaleValue)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isEstimated ? "~" : ""}{saleWeightKg} kg × ৳{marketPricePerKg}/kg
            {isEstimated && (
              <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">(est. — last weighed {latestWeightKg} kg)</span>
            )}
          </p>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center gap-1.5 mb-1">
            {isProfitable
              ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              : <TrendingDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
            }
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              {isProfitable ? si.profit : si.loss}
            </p>
          </div>
          <p className={cn(
            "text-xl font-bold tabular-nums",
            isProfitable ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
          )}>
            {isProfitable ? "+" : "−"}{fmt(profitFromSale)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isProfitable ? "+" : ""}{profitPct}% {si.on_cost.replace("{{amount}}", fmt(totalCost))}
          </p>
        </div>
      </div>

      {/* Cash flow projection */}
      <div className="px-5 py-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">{si.business_cash_flow}</p>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <div className="flex-1 rounded-lg bg-background/60 dark:bg-card/50 border border-border/50 px-4 py-2.5">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">{si.now}</p>
            <p className="text-base font-bold tabular-nums">{fmt(Math.abs(balance))}</p>
            <p className={cn(
              "text-xs font-medium",
              balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            )}>
              {balance >= 0 ? si.cash_available : si.cash_deficit}
            </p>
          </div>

          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />

          <div className={cn(
            "flex-1 rounded-lg border px-4 py-2.5",
            projectedBalance >= 0
              ? "bg-emerald-100/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700"
              : "bg-red-100/60 dark:bg-red-950/30 border-red-300 dark:border-red-700"
          )}>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">{si.after_sale}</p>
            <p className={cn(
              "text-base font-bold tabular-nums",
              projectedBalance >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
            )}>
              {projectedBalance >= 0 ? "" : "−"}{fmt(projectedBalance)}
            </p>
            <p className={cn(
              "text-xs font-medium",
              projectedBalance >= balance ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            )}>
              {projectedBalance >= balance
                ? `+${fmt(projectedBalance - balance)} more`
                : `−${fmt(balance - projectedBalance)} less`}
            </p>
          </div>
        </div>
      </div>

      {/* Break-even check */}
      {effectiveBreakEvenPerKg !== null && (
        <div className={cn(
          "flex items-center justify-between gap-3 px-5 py-3 border-t border-inherit",
          isBreakEvenMet
            ? "bg-emerald-100/40 dark:bg-emerald-950/20"
            : "bg-amber-50/60 dark:bg-amber-950/20"
        )}>
          <div className="flex items-center gap-2">
            <Scale className={cn("h-3.5 w-3.5", isBreakEvenMet ? "text-emerald-500" : "text-amber-500")} />
            <span className="text-xs text-muted-foreground">
              {t.cattle_details.smart.break_even}: <span className="font-semibold text-foreground">৳{Math.round(effectiveBreakEvenPerKg)}/kg</span>
            </span>
          </div>
          <span className={cn(
            "text-xs font-semibold flex items-center gap-1",
            isBreakEvenMet ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
          )}>
            {isBreakEvenMet ? (
              <><CheckCircle2 className="h-3 w-3" /> {si.above_break_even.replace("{{amount}}", String(Math.round(marketPricePerKg - effectiveBreakEvenPerKg)))}</>
            ) : (
              <><AlertTriangle className="h-3 w-3" /> {si.below_break_even.replace("{{amount}}", String(Math.round(effectiveBreakEvenPerKg - marketPricePerKg)))}</>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

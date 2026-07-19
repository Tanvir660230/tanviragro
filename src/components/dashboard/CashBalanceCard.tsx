import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { getDictionary } from "@/i18n/getDictionary";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Wallet, TrendingUp, TrendingDown, ArrowUpRight, Beef } from "lucide-react";
import { getCashBalance } from "@/lib/supabase/queries/cash";

function fmt(n: number) {
  return `৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
}

export async function CashBalanceCard() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();

  // No business → hide silently
  if (!businessId) return null;

  const t = await getDictionary();
  const cb = t.cash_balance;

  const [cash, activeCattleResult, marketPriceResult] = await Promise.all([
    getCashBalance(supabase, businessId),
    supabase
      .from("cattle")
      .select("purchase_price")
      .eq("business_id", businessId)
      .eq("status", "active"),
    supabase
      .from("market_prices")
      .select("price_per_kg")
      .eq("business_id", businessId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const { balance, opening, capitalIn, capitalOut, salesTotal, cattleCost, invCost, opCost, fixedAssetCost, financingNet } = cash;
  const isPositive = balance >= 0;

  const activeCattle = (activeCattleResult.data ?? []) as { purchase_price: number }[];
  const marketPrice = (marketPriceResult.data as { price_per_kg: number } | null)?.price_per_kg ?? null;

  const activeCattleCount = activeCattle.length;
  const activeCattleInvestment = activeCattle.reduce((s, c) => s + c.purchase_price, 0);

  const breakdown = [
    { label: cb.opening,      value: opening,         positive: true },
    { label: cb.capital_in,   value: capitalIn,        positive: true },
    { label: cb.sales,        value: salesTotal,       positive: true },
    ...(financingNet > 0
      ? [{ label: cb.loans_received, value: financingNet, positive: true }]
      : []),
    { label: cb.capital_out,  value: capitalOut,       positive: false },
    { label: cb.cattle_bought,value: cattleCost,       positive: false },
    { label: cb.inventory,    value: invCost,          positive: false },
    { label: cb.costs,        value: opCost,           positive: false },
    ...(fixedAssetCost > 0
      ? [{ label: cb.fixed_assets, value: fixedAssetCost, positive: false }]
      : []),
  ];

  return (
    <Link href="/dashboard/accounting" className="block group h-full">
      <div className={cn(
        "relative h-full flex flex-col rounded-xl border shadow-card px-4 py-4 sm:px-5 sm:py-5 transition-all group-hover:shadow-card-md",
        isPositive
          ? "bg-emerald-50/60 dark:bg-emerald-950/15 border-emerald-200/70 dark:border-emerald-800/40"
          : "bg-red-50/60 dark:bg-red-950/15 border-red-200/70 dark:border-red-800/40"
      )}>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl", isPositive ? "bg-emerald-500/15" : "bg-red-500/15")}>
              <Wallet className={cn("h-4 w-4", isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400")} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{cb.title}</p>
              <p className="text-xs text-muted-foreground">{cb.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
            <span className="hidden sm:inline">{cb.ledger_link}</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </div>
        </div>

        {/* Balance + active cattle context */}
        <div className="flex items-end gap-6 mb-4 flex-wrap">
          <div>
            <p className={cn(
              "text-3xl sm:text-4xl font-bold tabular-nums leading-none tracking-tight",
              isPositive ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
            )}>
              {isPositive ? "" : "−"}{fmt(balance)}
            </p>
            <p className={cn("text-xs mt-1 font-medium", isPositive ? "text-emerald-600/80 dark:text-emerald-400/80" : "text-red-600/80 dark:text-red-400/80")}>
              {isPositive ? cb.available_cash : cb.cash_deficit}
            </p>
          </div>

          {/* Active cattle asset summary */}
          {activeCattleCount > 0 && (
            <div className="shrink-0 rounded-xl bg-background/60 dark:bg-card/50 border border-border/40 px-4 py-2.5 text-right">
              <div className="flex items-center gap-1.5 justify-end mb-0.5">
                <Beef className="h-3 w-3 text-amber-500" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {activeCattleCount} {cb.active_cattle}
                </p>
              </div>
              <p className="text-sm font-bold tabular-nums">{fmt(activeCattleInvestment)}</p>
              <p className="text-xs text-muted-foreground">{cb.invested_not_sold}</p>
              {marketPrice && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                  {cb.market_price}: ৳{marketPrice}/kg
                </p>
              )}
            </div>
          )}
        </div>

        {/* Breakdown — compact row list */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 mt-auto pt-2">
          {breakdown.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-2 rounded-lg bg-background/50 dark:bg-card/30 border border-border/40 px-3 py-1.5">
              <p className="text-xs text-muted-foreground truncate">{item.label}</p>
              <p className={cn("text-xs font-semibold tabular-nums shrink-0", item.positive ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                {item.positive ? "+" : "−"}{fmt(item.value)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

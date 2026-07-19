import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { getDictionary } from "@/i18n/getDictionary";
import { getCashBalance } from "@/lib/supabase/queries/cash";
import { TrendingUp, CalendarDays, ArrowRight, Settings } from "lucide-react";
import Link from "next/link";

function fmt(n: number) {
  if (n >= 10_000_000) return `৳${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000)    return `৳${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000)      return `৳${(n / 1_000).toFixed(0)}K`;
  return `৳${Math.round(n).toLocaleString("en-IN")}`;
}

function EmptyState({ title, icon: Icon, message, linkHref, linkLabel }: {
  title: string;
  icon: React.ElementType;
  message: string;
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <div className="rounded-xl bg-card border border-border shadow-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60">
          <TrendingUp className="h-4 w-4 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-semibold text-muted-foreground">{title}</p>
      </div>
      <div className="flex flex-col items-center gap-3 py-8 px-5 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/60">
          <Icon className="h-5 w-5 text-muted-foreground/50" />
        </div>
        <p className="text-sm text-muted-foreground leading-snug">{message}</p>
        {linkHref && linkLabel && (
          <Link href={linkHref} className="text-xs font-medium text-primary hover:underline">
            {linkLabel} →
          </Link>
        )}
      </div>
    </div>
  );
}

export async function CashFlowForecastCard() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) return null;

  const [t, { data: cattleData }] = await Promise.all([
    getDictionary(),
    supabase
      .from("cattle")
      .select("id, initial_weight_kg, expected_daily_gain_kg, target_weight_kg")
      .eq("business_id", businessId)
      .eq("status", "active")
      .is("deleted_at", null),
  ]);

  const cf = t.cash_flow;

  const cattle = (cattleData ?? []) as {
    id: string;
    initial_weight_kg: number;
    expected_daily_gain_kg: number | null;
    target_weight_kg: number | null;
  }[];

  if (cattle.length === 0) {
    return <EmptyState title={cf.title} icon={TrendingUp} message={cf.no_cattle} />;
  }

  const cattleIds = cattle.map((c) => c.id);

  const [{ data: logsData }, { data: marketPriceData }, cash] = await Promise.all([
    supabase
      .from("weight_logs")
      .select("cattle_id, weight_kg")
      .in("cattle_id", cattleIds)
      .is("deleted_at", null)
      .order("recorded_at", { ascending: false })
      .limit(Math.max(cattle.length * 10, 200)),
    supabase
      .from("market_prices")
      .select("price_per_kg")
      .eq("business_id", businessId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getCashBalance(supabase, businessId),
  ]);

  const marketPrice = marketPriceData?.price_per_kg ?? 0;
  const currentBalance = cash.balance;

  if (!marketPrice) {
    return (
      <EmptyState
        title={cf.title}
        icon={Settings}
        message={cf.no_market_price}
        linkHref="/dashboard/settings"
        linkLabel={cf.go_to_settings}
      />
    );
  }

  const latestWeightMap = new Map<string, number>();
  for (const log of (logsData ?? []) as { cattle_id: string; weight_kg: number }[]) {
    if (!latestWeightMap.has(log.cattle_id)) {
      latestWeightMap.set(log.cattle_id, log.weight_kg);
    }
  }

  const HORIZONS = [30, 60, 90] as const;

  const forecasts = HORIZONS.map((days) => {
    let readyCount = 0;
    let projectedRevenue = 0;

    for (const c of cattle) {
      const currentWeight = latestWeightMap.get(c.id) ?? c.initial_weight_kg ?? 0;
      const adg = c.expected_daily_gain_kg ?? 0.8;
      const target = c.target_weight_kg ?? 350;
      const projectedWeight = currentWeight + days * adg;

      if (projectedWeight >= target) {
        readyCount++;
        projectedRevenue += projectedWeight * marketPrice;
      }
    }

    return { days, readyCount, projectedRevenue, projectedBalance: currentBalance + projectedRevenue };
  });

  if (forecasts.every((f) => f.readyCount === 0)) {
    return <EmptyState title={cf.title} icon={TrendingUp} message={cf.none_reaching_target} />;
  }

  // Find the nearest horizon with ready cattle for the footer balance projection
  const firstReadyForecast = forecasts.find((f) => f.readyCount > 0) ?? forecasts[0];

  return (
    <div className="rounded-xl h-full flex flex-col bg-card border border-border shadow-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
          <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-semibold">{cf.title}</p>
          <p className="text-xs text-muted-foreground">
            {cf.subtitle.replace("{{price}}", String(marketPrice))}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border mt-auto">
        {forecasts.map((f) => (
          <div key={f.days} className="px-2 sm:px-4 py-3 sm:py-4 space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
              <CalendarDays className="h-3 w-3" />
              {f.days} {cf.days}
            </div>
            <p className={`text-base sm:text-xl font-bold tabular-nums ${
              f.readyCount > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"
            }`}>
              {f.readyCount > 0 ? fmt(f.projectedRevenue) : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {f.readyCount > 0 ? `${f.readyCount} ${cf.cattle_ready}` : cf.none_at_target}
            </p>
          </div>
        ))}
      </div>

      {firstReadyForecast.readyCount > 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-2.5 bg-muted/20">
          <p className="text-xs text-muted-foreground">
            {cf.balance_after_Xd.replace("{{d}}", String(firstReadyForecast.days))}
          </p>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="text-muted-foreground tabular-nums">{fmt(Math.abs(currentBalance))}</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className={firstReadyForecast.projectedBalance >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400"}>
              {firstReadyForecast.projectedBalance < 0 ? "−" : ""}{fmt(Math.abs(firstReadyForecast.projectedBalance))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

import { Wheat, PackageOpen, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { getDictionary } from "@/i18n/getDictionary";
import { calculateDailyFeedRequirement } from "@/utils/feed-calculator";

export async function FarmFeedSummaryCard() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();

  if (!businessId) return null;

  const t = await getDictionary();
  const fs = t.feed_summary;

  // Step 1: parallel â€" cattle + feed inventory items
  const [{ data: cattleData }, { data: feedItems }] = await Promise.all([
    supabase
      .from("cattle")
      .select("id, initial_weight_kg, expected_daily_gain_kg, purchase_date, manual_feed_override")
      .eq("business_id", businessId)
      .eq("status", "active"),
    supabase
      .from("inventory_items")
      .select("id, name, unit")
      .eq("business_id", businessId)
      .eq("category", "feed")
      .is("deleted_at", null),
  ]);

  const activeIds = (cattleData ?? []).map((c) => c.id);
  const feedItemIds = (feedItems ?? []).map((i) => i.id);

  // Step 2: parallel â€" weight logs + feed transactions
  const [{ data: weightLogs }, { data: feedTxns }] = await Promise.all([
    activeIds.length > 0
      ? supabase
          .from("weight_logs")
          .select("cattle_id, weight_kg, recorded_at")
          .in("cattle_id", activeIds)
          .is("deleted_at", null)
          .order("recorded_at", { ascending: false })
      : Promise.resolve({ data: [] as { cattle_id: string; weight_kg: number; recorded_at: string }[] }),
    feedItemIds.length > 0
      ? supabase
          .from("inventory_transactions")
          .select("item_id, type, qty")
          .in("item_id", feedItemIds)
      : Promise.resolve({ data: [] as { item_id: string; type: string; qty: number }[] }),
  ]);

  const latestWeightMap: Record<string, { weight: number; date: string }> = {};
  for (const log of weightLogs ?? []) {
    if (!latestWeightMap[log.cattle_id]) {
      latestWeightMap[log.cattle_id] = { weight: log.weight_kg, date: log.recorded_at };
    }
  }

  let totalConcentrateRequired = 0;
  let totalRoughageRequired = 0;

  for (const cow of cattleData ?? []) {
    const latest = latestWeightMap[cow.id];
    const req = calculateDailyFeedRequirement({
      initialWeightKg: cow.initial_weight_kg ?? 0,
      latestLoggedWeightKg: latest?.weight ?? null,
      lastWeighedAt: latest?.date ?? null,
      purchaseDate: cow.purchase_date ?? new Date().toISOString(),
      expectedDailyGainKg: cow.expected_daily_gain_kg ?? 0.8,
    });
    totalConcentrateRequired += req.actualConcentrateKg;
    const roughageOverride = cow.manual_feed_override?.roughageKg;
    totalRoughageRequired += roughageOverride != null ? Number(roughageOverride) : req.roughageKg;
  }

  const stockMap: Record<string, number> = {};
  for (const txn of feedTxns ?? []) {
    const current = stockMap[txn.item_id] ?? 0;
    stockMap[txn.item_id] = txn.type === "purchase" ? current + Number(txn.qty) : current - Number(txn.qty);
  }

  let totalConcentrateStock = 0;
  for (const id of feedItemIds) {
    totalConcentrateStock += stockMap[id] ?? 0;
  }

  const daysRemaining = totalConcentrateRequired > 0
    ? Math.floor(totalConcentrateStock / totalConcentrateRequired)
    : null; // null = no concentrate tracked (can't compute runway)

  const isLow = daysRemaining !== null && daysRemaining <= 7;
  const cattleCount = (cattleData ?? []).length;

  return (
    <div className="relative h-full flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card animate-fade-in-up">
      <div className="relative flex-1 flex flex-col px-4 py-4 sm:px-6 sm:py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
              <Wheat className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{fs.title}</p>
              <p className="text-xs text-muted-foreground">
                {cattleCount > 0
                  ? fs.subtitle_active.replace("{{n}}", String(cattleCount))
                  : fs.subtitle_none}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isLow && (
              <div className="flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-950/50 px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-400">
                <AlertTriangle className="h-3 w-3" />
                {fs.low_stock}
              </div>
            )}
            <Link
              href="/dashboard/inventory"
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {t.dashboard_extra.view_all}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Stats row â€" 3 columns */}
        <div className="grid grid-cols-3 gap-2 mt-auto pt-2">
          {/* Concentrate */}
          <div className="rounded-xl bg-muted/40 border border-border/60 p-3 sm:p-4">
            <div className="flex items-center gap-1 mb-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
              <p className="text-xs sm:text-xs font-bold uppercase tracking-wide text-muted-foreground/70 leading-tight">
                <span className="sm:hidden">{fs.concentrate_short}</span>
                <span className="hidden sm:inline">{fs.daily_concentrate}</span>
              </p>
            </div>
            <p className="text-xl sm:text-2xl font-bold tabular-nums text-foreground">
              {totalConcentrateRequired.toFixed(1)}
              <span className="text-xs font-normal ml-0.5 opacity-70">kg</span>
            </p>
          </div>

          {/* Roughage */}
          <div className="rounded-xl bg-muted/40 border border-border/60 p-3 sm:p-4">
            <div className="flex items-center gap-1 mb-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
              <p className="text-xs sm:text-xs font-bold uppercase tracking-wide text-muted-foreground/70 leading-tight">
                <span className="sm:hidden">{fs.roughage_short}</span>
                <span className="hidden sm:inline">{fs.daily_roughage}</span>
              </p>
            </div>
            <p className="text-xl sm:text-2xl font-bold tabular-nums text-foreground">
              {totalRoughageRequired.toFixed(1)}
              <span className="text-xs font-normal ml-0.5 opacity-70">kg</span>
            </p>
          </div>

          {/* Stock runway */}
          <div className={cn(
            "relative overflow-hidden rounded-xl border p-2.5 sm:p-4",
            isLow ? "bg-red-50 dark:bg-red-950/20 border-red-200/60 dark:border-red-800/30" : "bg-muted/40 border-border/60"
          )}>
            <div className="flex items-center gap-1 mb-1.5">
              <PackageOpen className={cn("h-2.5 w-2.5 shrink-0", isLow ? "text-red-500" : "text-muted-foreground")} />
              <p className={cn(
                "text-xs sm:text-xs font-bold uppercase tracking-wide leading-tight",
                isLow ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
              )}>
                <span className="sm:hidden">{fs.stock_short}</span>
                <span className="hidden sm:inline">{fs.stock_runway}</span>
              </p>
            </div>
            <p className={cn(
              "text-base sm:text-2xl font-bold tabular-nums",
              isLow ? "text-red-600 dark:text-red-400" : "text-foreground"
            )}>
              {daysRemaining !== null ? daysRemaining : "-"}
              {daysRemaining !== null && <span className="text-xs font-normal ml-0.5 opacity-70">d</span>}
            </p>
            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/50">
              <div
                className={cn("h-full transition-all", isLow ? "bg-red-500" : "bg-amber-500")}
                style={{ width: daysRemaining !== null ? `${Math.min((daysRemaining / 14) * 100, 100)}%` : "0%" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

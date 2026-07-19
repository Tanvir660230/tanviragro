import Link from "next/link";
import { TrendingUp, ArrowRight } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { fmtBDT } from "@/lib/format";

function fmt(n: number) {
  if (n >= 10_000_000) return `৳${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000)    return `৳${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000)      return `৳${(n / 1_000).toFixed(0)}K`;
  return `৳${Math.round(n).toLocaleString("en-IN")}`;
}

export async function SellTodaySummary({ overheadPerHead = 0 }: { overheadPerHead?: number } = {}) {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) return null;

  const [{ data: activeCattleRaw }, { data: marketPriceRow }] = await Promise.all([
    supabase
      .from("cattle")
      .select("id, initial_weight_kg, purchase_price, purchase_date, expected_daily_gain_kg")
      .eq("business_id", businessId)
      .eq("status", "active")
      .is("deleted_at", null),
    supabase
      .from("market_prices")
      .select("price_per_kg")
      .eq("business_id", businessId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!activeCattleRaw || activeCattleRaw.length === 0) return null;

  const ids = activeCattleRaw.map((c) => c.id);
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();

  // Parallel: weight logs + feed costs + vet costs + individual cost entries
  const [
    { data: logsRaw },
    { data: feedTxns },
    { data: treatments },
    { data: costEntries },
  ] = await Promise.all([
    supabase
      .from("weight_logs")
      .select("cattle_id, weight_kg, recorded_at")
      .in("cattle_id", ids)
      .is("deleted_at", null)
      .order("recorded_at", { ascending: false }),

    supabase
      .from("inventory_transactions")
      .select("cattle_id, qty, unit_cost, inventory_items!inner(category, deleted_at)")
      .eq("type", "consumption")
      .eq("inventory_items.category", "feed")
      .is("inventory_items.deleted_at", null)
      .in("cattle_id", ids),

    supabase
      .from("cattle_treatments")
      .select("cattle_id, vet_fee, additional_medical_cost")
      .in("cattle_id", ids),

    supabase
      .from("cost_entries")
      .select("cattle_id, amount")
      .eq("business_id", businessId)
      .in("cattle_id", ids)
      .eq("entry_class", "expense")
      .is("deleted_at", null),
  ]);

  // Build per-cattle maps
  const latestLogMap: Record<string, { weight: number; recordedAt: string }> = {};
  for (const l of (logsRaw ?? []) as { cattle_id: string; weight_kg: number; recorded_at: string }[]) {
    if (!latestLogMap[l.cattle_id]) {
      latestLogMap[l.cattle_id] = { weight: l.weight_kg, recordedAt: l.recorded_at };
    }
  }

  const feedCostMap: Record<string, number> = {};
  for (const t of (feedTxns ?? []) as { cattle_id: string | null; qty: number; unit_cost: number | null }[]) {
    if (t.cattle_id) {
      feedCostMap[t.cattle_id] = (feedCostMap[t.cattle_id] ?? 0) + t.qty * (t.unit_cost ?? 0);
    }
  }

  const vetCostMap: Record<string, number> = {};
  for (const t of (treatments ?? []) as { cattle_id: string; vet_fee: number | null; additional_medical_cost: number | null }[]) {
    vetCostMap[t.cattle_id] = (vetCostMap[t.cattle_id] ?? 0) +
      Number(t.vet_fee ?? 0) + Number(t.additional_medical_cost ?? 0);
  }

  const otherCostMap: Record<string, number> = {};
  for (const e of (costEntries ?? []) as { cattle_id: string | null; amount: number }[]) {
    if (e.cattle_id) {
      otherCostMap[e.cattle_id] = (otherCostMap[e.cattle_id] ?? 0) + Number(e.amount);
    }
  }

  // Aggregate totals
  let totalPurchase = 0;
  let totalFeed     = 0;
  let totalVet      = 0;
  let totalOther    = 0;
  let totalWeight   = 0;

  for (const c of activeCattleRaw as {
    id: string;
    initial_weight_kg: number | null;
    purchase_price: number | null;
    purchase_date: string | null;
    expected_daily_gain_kg: number | null;
  }[]) {
    const log        = latestLogMap[c.id];
    const lastWeight = log?.weight ?? (c.initial_weight_kg ?? 0);

    // Estimate today's weight using ADG × days since last weigh
    let estWeight = lastWeight;
    if (log && c.purchase_date) {
      const purchaseMs = new Date(c.purchase_date + "T00:00:00").getTime();
      const lastLogMs  = new Date(log.recordedAt).getTime();
      const daysToLog  = Math.max(1, Math.floor((lastLogMs - purchaseMs) / 86400000));
      const adg        = (lastWeight - (c.initial_weight_kg ?? 0)) / daysToLog;
      const daysSince  = Math.max(0, Math.floor((nowMs - lastLogMs) / 86400000));
      if (adg > 0 && daysSince > 0) {
        estWeight = Math.min(650, lastWeight + adg * daysSince);
      }
    }

    totalWeight   += estWeight;
    totalPurchase += Number(c.purchase_price ?? 0);
    totalFeed     += feedCostMap[c.id] ?? 0;
    totalVet      += vetCostMap[c.id] ?? 0;
    totalOther    += otherCostMap[c.id] ?? 0;
  }

  const totalOverhead = overheadPerHead * activeCattleRaw.length;
  const totalCost    = totalPurchase + totalFeed + totalVet + totalOther + totalOverhead;
  const marketPrice  = (marketPriceRow as { price_per_kg: number } | null)?.price_per_kg;
  const saleValue    = marketPrice ? Math.round(totalWeight * marketPrice) : null;
  const profit       = saleValue !== null ? saleValue - totalCost : null;
  const isProfitable = profit !== null && profit >= 0;
  const hasCosts     = totalFeed > 0 || totalVet > 0 || totalOther > 0;

  return (
    <Link href="/dashboard/cattle" className="block group">
      <div className={`rounded-xl border px-5 py-4 transition-all group-hover:shadow-md ${
        saleValue
          ? isProfitable
            ? "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/40 dark:bg-emerald-950/15"
            : "border-red-200 dark:border-red-800/50 bg-red-50/40 dark:bg-red-950/15"
          : "border-border bg-card"
      }`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              saleValue ? isProfitable ? "bg-emerald-500/10" : "bg-red-500/10" : "bg-muted"
            }`}>
              <TrendingUp className={`h-4 w-4 ${
                saleValue
                  ? isProfitable ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                  : "text-muted-foreground"
              }`} />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
                সব গরু আজ বিক্রি করলে ({activeCattleRaw.length}টি · ~{Math.round(totalWeight)} kg)
              </p>

              {saleValue !== null ? (
                <>
                  <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
                    <p className={`text-xl font-bold tabular-nums ${
                      isProfitable ? "text-emerald-700 dark:text-emerald-300" : "text-destructive"
                    }`}>
                      {isProfitable ? "+" : "-"}{fmtBDT(Math.abs(profit!))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      বিক্রি {fmt(saleValue)} · মোট খরচ {fmt(totalCost)}
                    </p>
                  </div>

                  {/* Cost breakdown */}
                  <div className="flex flex-wrap gap-x-3 gap-y-0 mt-1">
                    <span className="text-xs text-muted-foreground">
                      ক্রয় {fmt(totalPurchase)}
                    </span>
                    {totalFeed > 0 && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        + খাদ্য {fmt(totalFeed)}
                      </span>
                    )}
                    {totalVet > 0 && (
                      <span className="text-xs text-red-500 dark:text-red-400">
                        + চিকিৎসা {fmt(totalVet)}
                      </span>
                    )}
                    {totalOther > 0 && (
                      <span className="text-xs text-muted-foreground">
                        + অন্যান্য {fmt(totalOther)}
                      </span>
                    )}
                    {totalOverhead > 0 && (
                      <span className="text-xs text-muted-foreground">
                        + ফার্মের খরচ (অংশ) {fmt(totalOverhead)}
                      </span>
                    )}
                    {!hasCosts && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        (খাদ্য খরচ লগ করা হয়নি)
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground mt-0.5">
                  Set market price — from the cattle list page
                </p>
              )}
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:text-muted-foreground transition-colors" />
        </div>

        {marketPrice && (
          <p className="text-xs text-muted-foreground/60 mt-2">
            বর্তমান বাজার দর: ৳{marketPrice}/kg
          </p>
        )}
      </div>
    </Link>
  );
}

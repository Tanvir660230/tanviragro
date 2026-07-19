import { createClient } from "@/lib/supabase/server";
import {
  TrendingUp, Package, AlertCircle,
  Wallet, Wrench, ShoppingBasket, Zap, Scale,
} from "lucide-react";
import { BudgetPeriodPicker } from "./BudgetPeriodPicker";
import { getDictionary } from "@/i18n/getDictionary";
import { cn } from "@/lib/utils";

const DEFAULT_ADG = 1.0; // kg/day — conservative fallback when no farm data exists

function fmtBDT(n: number) {
  return `৳${Math.round(n).toLocaleString("en-IN")}`;
}
function fmtDate(date: Date) {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtKg(n: number) {
  return `${parseFloat(n.toFixed(1))} kg`;
}

export async function BudgetForecastPanel({ days = 90 }: { days?: number }) {
  const [supabase, dict] = await Promise.all([createClient(), getDictionary()]);
  const tb = dict.budget;
  const tr = (key: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((s, [k, v]) => s.replace(`{{${k}}}`, v), key);

  const { data: { user } } = await supabase.auth.getUser();
  const { data: bizData } = user
    ? await supabase.from("businesses").select("id").eq("owner_id", user.id).maybeSingle()
    : { data: null };
  const businessId = bizData?.id;
  if (!businessId) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Business account not found. Please refresh the page.
      </div>
    );
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyStr = thirtyDaysAgo.toISOString().split("T")[0];

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const ninetyStr = ninetyDaysAgo.toISOString().split("T")[0];

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + days);

  // ── Initial parallel fetches ──────────────────────────────────────
  const [
    { data: recentCostsData },
    { data: itemsData },
    { data: allTxnData },
    { data: recent30TxnData },
    { data: activeCattleData },
  ] = await Promise.all([
    supabase.from("cost_entries")
      .select("type, category, amount, recorded_at")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .neq("entry_class", "asset")
      .gte("recorded_at", ninetyStr),
    supabase.from("inventory_items")
      .select("id, name, unit, category, low_stock_threshold")
      .eq("business_id", businessId)
      .is("deleted_at", null),
    supabase.from("inventory_transactions")
      .select("item_id, type, qty, unit_cost, recorded_at, inventory_items!inner(business_id)")
      .eq("inventory_items.business_id", businessId)
      .order("recorded_at", { ascending: true })
      .limit(10000),
    supabase.from("inventory_transactions")
      .select("item_id, qty, unit_cost, inventory_items!inner(category, business_id)")
      .eq("type", "consumption")
      .eq("inventory_items.business_id", businessId)
      .gte("recorded_at", thirtyStr),
    supabase.from("cattle")
      .select("id, initial_weight_kg, purchase_date")
      .eq("business_id", businessId)
      .eq("status", "active")
      .is("deleted_at", null),
  ]);

  type CattleRow = { id: string; initial_weight_kg: number; purchase_date: string };
  const activeCattleList = (activeCattleData ?? []) as CattleRow[];
  const activeCattle = activeCattleList.length;

  // ── Fetch weight logs for active cattle (sequential — needs IDs first) ──
  const cattleIds = activeCattleList.map((c) => c.id);
  const { data: weightLogsData } = await (
    cattleIds.length > 0
      ? supabase.from("weight_logs")
          .select("cattle_id, weight_kg, recorded_at")
          .in("cattle_id", cattleIds)
          .is("deleted_at", null)
          .order("recorded_at", { ascending: false })
      : Promise.resolve({ data: [] as { cattle_id: string; weight_kg: number; recorded_at: string }[] })
  );

  // ── 3-Tier Weight Prediction ──────────────────────────────────────
  // Tier 1: actual from weight_logs
  // Tier 2: estimated using this farm's own avg ADG
  // Tier 3: industry default 0.5 kg/day
  type WeightLogRow = { cattle_id: string; weight_kg: number; recorded_at: string };
  const weightLogs = (weightLogsData ?? []) as WeightLogRow[];

  // Latest weight log per cattle (logs are already ordered desc)
  const latestLogMap: Record<string, number> = {};
  for (const log of weightLogs) {
    if (!(log.cattle_id in latestLogMap)) latestLogMap[log.cattle_id] = log.weight_kg;
  }

  // eslint-disable-next-line react-hooks/purity
  const todayMs = Date.now();

  // Pass 1: gather ADGs from cattle that actually have weight gain data
  const confirmedADGs: number[] = [];
  for (const c of activeCattleList) {
    const latestWeight = latestLogMap[c.id];
    if (latestWeight != null && latestWeight > c.initial_weight_kg) {
      const daysSince = Math.max(1, Math.round(
        (todayMs - new Date(c.purchase_date + "T00:00:00").getTime()) / 86_400_000
      ));
      confirmedADGs.push((latestWeight - c.initial_weight_kg) / daysSince);
    }
  }
  const farmAvgADG = confirmedADGs.length > 0
    ? confirmedADGs.reduce((s, a) => s + a, 0) / confirmedADGs.length
    : DEFAULT_ADG;

  // Pass 2: assign each cattle a current weight + ADG, track source
  let totalCurrentWeight = 0;
  let totalADG = 0;
  let actualCount = 0;
  let estimatedCount = 0;
  let defaultCount = 0;

  for (const c of activeCattleList) {
    const latestWeight = latestLogMap[c.id];
    const daysSince = Math.max(1, Math.round(
      (todayMs - new Date(c.purchase_date + "T00:00:00").getTime()) / 86_400_000
    ));

    if (latestWeight != null) {
      // Tier 1 — actual log exists
      const adg = latestWeight > c.initial_weight_kg
        ? (latestWeight - c.initial_weight_kg) / daysSince
        : farmAvgADG;
      totalCurrentWeight += latestWeight;
      totalADG += adg;
      actualCount++;
    } else {
      // Tier 2 or 3 — predict current weight from purchase date
      const predictedWeight = c.initial_weight_kg + farmAvgADG * daysSince;
      totalCurrentWeight += predictedWeight;
      totalADG += farmAvgADG;
      if (confirmedADGs.length > 0) {
        estimatedCount++; // Tier 2: farm ADG available
      } else {
        defaultCount++;   // Tier 3: using industry default
      }
    }
  }

  const avgCurrentWeight  = activeCattle > 0 ? totalCurrentWeight / activeCattle : 0;
  const avgADG            = activeCattle > 0 ? totalADG / activeCattle : farmAvgADG;
  const projectedWeight   = avgCurrentWeight + avgADG * days;

  // Growth multiplier for FEED items only
  // Last-30-day consumption happened at this approx average weight:
  const W_last30 = Math.max(1, avgCurrentWeight - avgADG * 15);
  // Forecast period average weight (midpoint):
  const W_forecast = avgCurrentWeight + avgADG * (days / 2);
  const feedGrowthMultiplier = avgCurrentWeight > 0 ? W_forecast / W_last30 : 1;
  const growthPct = Math.round((feedGrowthMultiplier - 1) * 100);
  const hasGrowthData = activeCattle > 0 && avgADG > 0;

  // ── Cost calculations ─────────────────────────────────────────────
  const costs = (recentCostsData ?? []) as { type: string; category: string; amount: number; recorded_at: string }[];

  // feedSpend30 comes from inventory transactions; compute it first so we can
  // avoid double-counting when the same spend is also logged as a variable cost_entry.
  const feedSpend30 = (recent30TxnData ?? [])
    .filter((t) => t.unit_cost != null && t.inventory_items?.category === "feed")
    .reduce((s, t) => s + t.qty * (t.unit_cost ?? 0), 0);

  const fixedTotal = costs.filter((c) => c.type === "fixed").reduce((s, c) => s + c.amount, 0);
  // Exclude feed-category variable entries when inventory feed data is present to
  // prevent double-counting (feedSpend30 already covers feed cost from inventory).
  const varTotal = costs
    .filter((c) => {
      if (c.type !== "variable") return false;
      if (feedSpend30 > 0 && /feed|roughage|fodder|hay/i.test(c.category ?? "")) return false;
      return true;
    })
    .reduce((s, c) => s + c.amount, 0);

  const nowMs2 = ninetyDaysAgo.getTime() + 90 * 86_400_000;
  const oldestCostMs = costs.length > 0
    ? Math.min(...costs.map((c) => new Date(c.recorded_at).getTime()))
    : nowMs2;
  const dataMonths = Math.max(1, Math.min(3, Math.ceil((nowMs2 - oldestCostMs) / (30 * 86_400_000))));
  const avgMonthlyFixed    = fixedTotal / dataMonths;
  const avgMonthlyVariable = varTotal   / dataMonths;

  // ── FIFO unit costs ───────────────────────────────────────────────
  type TxnRow = { item_id: string; type: string; qty: number; unit_cost: number | null; recorded_at: string };
  const txns = (allTxnData ?? []) as TxnRow[];

  const stockMap: Record<string, number> = {};
  for (const t of txns) {
    const cur = stockMap[t.item_id] ?? 0;
    stockMap[t.item_id] = t.type === "purchase" ? cur + t.qty : cur - t.qty;
  }

  const fifoMap: Record<string, number | null> = {};
  for (const item of (itemsData ?? []) as { id: string }[]) {
    const itemTxns  = txns.filter((t) => t.item_id === item.id);
    const purchases = itemTxns
      .filter((t) => t.type === "purchase")
      .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
    const totalConsumed = itemTxns.filter((t) => t.type === "consumption").reduce((s, t) => s + t.qty, 0);
    const batches = purchases.map((p) => ({ qty: p.qty, unit_cost: p.unit_cost }));
    let rem = totalConsumed;
    for (const b of batches) {
      if (rem <= 0) break;
      const take = Math.min(rem, b.qty);
      b.qty -= take;
      rem -= take;
    }
    let tVal = 0, tQty = 0;
    for (const b of batches) {
      if (b.qty > 0 && b.unit_cost != null) { tVal += b.qty * b.unit_cost; tQty += b.qty; }
    }
    fifoMap[item.id] = tQty > 0 ? tVal / tQty : null;
  }

  // ── Average daily consumption map (last 30 days) ──────────────────
  const totalConsumed30Map: Record<string, number> = {};
  for (const t of (recent30TxnData ?? []) as { item_id: string; qty: number }[]) {
    totalConsumed30Map[t.item_id] = (totalConsumed30Map[t.item_id] ?? 0) + t.qty;
  }
  const avgDailyMap: Record<string, number> = {};
  for (const [id, total] of Object.entries(totalConsumed30Map)) {
    avgDailyMap[id] = total / 30;
  }

  // ── Production budget: growth-adjusted for feed, flat for others ──
  type ItemRow = { id: string; name: string; unit: string; category: string; low_stock_threshold: number | null };
  const items = (itemsData ?? []) as ItemRow[];

  const productionItems = items
    .map((item) => {
      const isFeed     = item.category === "feed";
      const multiplier = isFeed && hasGrowthData ? feedGrowthMultiplier : 1;
      const avgDaily   = avgDailyMap[item.id] ?? 0;
      const needTotal  = avgDaily * days * multiplier;
      const stock      = stockMap[item.id] ?? 0;
      const shortfall  = Math.max(0, needTotal - stock);
      const unitCost   = fifoMap[item.id];
      // days of stock uses current adjusted daily rate
      const adjCurrentDaily = isFeed && hasGrowthData
        ? avgDaily * (avgCurrentWeight / Math.max(1, W_last30))
        : avgDaily;
      const daysOfStock = adjCurrentDaily > 0 ? Math.floor(stock / adjCurrentDaily) : null;
      const coverage    = needTotal > 0 ? Math.min(1, stock / needTotal) : 1;
      return {
        name: item.name,
        unit: item.unit,
        isFeed,
        stock: parseFloat(stock.toFixed(2)),
        needTotal: parseFloat(needTotal.toFixed(2)),
        shortfall: parseFloat(shortfall.toFixed(2)),
        budget: unitCost != null ? shortfall * unitCost : null,
        daysOfStock,
        coverage,
      };
    })
    .filter((i) => i.needTotal > 0)
    .sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0));

  const inventoryBudget = productionItems.reduce((s, i) => s + (i.budget ?? 0), 0);
  const operatingBudget = (avgMonthlyFixed + avgMonthlyVariable) * (days / 30);
  const grandTotal      = inventoryBudget + operatingBudget;
  const cashOutlook     = avgMonthlyFixed + avgMonthlyVariable + feedSpend30;

  const opPct  = grandTotal > 0 ? (operatingBudget  / grandTotal) * 100 : 0;
  const invPct = grandTotal > 0 ? (inventoryBudget  / grandTotal) * 100 : 0;

  // ── Source summary string ─────────────────────────────────────────
  const sourceParts: string[] = [];
  if (actualCount > 0)    sourceParts.push(`${actualCount} ${tb.src_actual}`);
  if (estimatedCount > 0) sourceParts.push(`${estimatedCount} ${tb.src_estimated}`);
  if (defaultCount > 0)   sourceParts.push(`${defaultCount} ${tb.src_default}`);
  const sourceLabel = sourceParts.join(" · ");

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h2 className="text-base font-semibold">{tb.title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tb.from_until} <span className="font-medium text-foreground">{fmtDate(targetDate)}</span>
          </p>
        </div>
        <div className="sm:ml-auto">
          <BudgetPeriodPicker currentDays={days} />
        </div>
      </div>

      {/* ── Grand Total Hero ── */}
      <div className="rounded-xl overflow-hidden shadow-card ring-1 ring-primary/15">
        <div className="bg-gradient-to-br from-primary/[0.09] to-primary/[0.03] px-5 pt-5 pb-4">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">{tr(tb.total_needed, { days: String(days) })}</p>
              <p className="text-4xl font-bold tracking-tight mt-0.5">{fmtBDT(grandTotal)}</p>
            </div>
            {activeCattle > 0 && (
              <div className="shrink-0 rounded-lg bg-background/60 px-3 py-1.5 text-center">
                <p className="text-lg font-bold">{activeCattle}</p>
                <p className="text-xs text-muted-foreground leading-none mt-0.5">{tb.cattle_count}</p>
              </div>
            )}
          </div>
          {grandTotal > 0 && (
            <div className="mt-4 space-y-1.5">
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-background/40">
                <div className="bg-orange-400 transition-all" style={{ width: `${opPct}%` }} />
                <div className="bg-blue-400 transition-all"   style={{ width: `${invPct}%` }} />
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-sm bg-orange-400" />
                  {tb.operating} {fmtBDT(operatingBudget)}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-sm bg-blue-400" />
                  {tb.inventory} {fmtBDT(inventoryBudget)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Cattle Weight Forecast card ── */}
      {activeCattle > 0 && (
        <div className="rounded-xl bg-card shadow-card ring-1 ring-black/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900">
              <Scale className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <h3 className="text-sm font-semibold">{tb.weight_card_title}</h3>
            {hasGrowthData && growthPct > 0 && (
              <span className="ml-auto rounded-full bg-violet-100 dark:bg-violet-950/40 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:text-violet-400">
                {tr(tb.feed_adjusted, { pct: String(growthPct) })}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: tb.cattle_count,      value: String(activeCattle),               sub: sourceLabel || "—" },
              { label: tb.avg_weight_now,    value: avgCurrentWeight > 0 ? fmtKg(avgCurrentWeight) : "—", sub: "current" },
              { label: tb.avg_adg,           value: avgADG > 0 ? `${avgADG.toFixed(2)} kg/day` : "—",    sub: confirmedADGs.length > 0 ? `${confirmedADGs.length} logged` : (defaultCount > 0 ? "default" : "—") },
              { label: tb.projected_weight,  value: projectedWeight > 0 ? fmtKg(projectedWeight) : "—",  sub: `in ${days} days` },
            ].map(({ label, value, sub }) => (
              <div key={label} className="rounded-xl bg-muted/50 p-3.5">
                <p className="text-xs text-muted-foreground leading-none">{label}</p>
                <p className="text-base font-bold mt-1 tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>
              </div>
            ))}
          </div>

          {actualCount === 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {tb.no_weight_hint}
            </div>
          )}
        </div>
      )}

      {/* ── Monthly Cash Outlook ── */}
      <div className="rounded-xl bg-card shadow-card ring-1 ring-black/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-sm font-semibold">{tb.monthly_outlook}</h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {([
            { label: tb.fixed_costs,    value: avgMonthlyFixed,    icon: Wrench,         bg: "bg-orange-50 dark:bg-orange-950/30",   iconBg: "bg-orange-100 dark:bg-orange-900",   text: "text-orange-600 dark:text-orange-400"   },
            { label: tb.variable_costs, value: avgMonthlyVariable, icon: Zap,            bg: "bg-blue-50 dark:bg-blue-950/30",       iconBg: "bg-blue-100 dark:bg-blue-900",       text: "text-blue-600 dark:text-blue-400"       },
            { label: tb.feed_spend,     value: feedSpend30,        icon: ShoppingBasket, bg: "bg-emerald-50 dark:bg-emerald-950/30", iconBg: "bg-emerald-100 dark:bg-emerald-900", text: "text-emerald-600 dark:text-emerald-400" },
            { label: tb.total_month,    value: cashOutlook,        icon: Wallet,         bg: "bg-muted/60",                          iconBg: "bg-muted",                           text: "text-foreground"                        },
          ] as const).map(({ label, value, icon: Icon, bg, iconBg, text }) => (
            <div key={label} className={cn("rounded-xl p-3.5", bg)}>
              <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg mb-2", iconBg)}>
                <Icon className={cn("h-3.5 w-3.5", text)} />
              </div>
              <p className="text-xs text-muted-foreground leading-none">{label}</p>
              <p className={cn("text-base font-bold mt-1 tabular-nums", text)}>{fmtBDT(value)}</p>
            </div>
          ))}
        </div>
        {costs.length === 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {tb.add_cost_hint}
          </div>
        )}
      </div>

      {/* ── Inventory Budget Table ── */}
      <div className="rounded-xl bg-card shadow-card ring-1 ring-black/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Package className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">{tr(tb.inventory_budget, { days: String(days) })}</h3>
            <p className="text-xs text-muted-foreground">
              {hasGrowthData && growthPct > 0 ? tb.growth_adjusted : tb.flat_rate}
              {" · "}
              {tb.inventory_rate_hint}
            </p>
          </div>
          {inventoryBudget > 0 && (
            <span className="ml-auto rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
              {tr(tb.to_buy_badge, { amount: fmtBDT(inventoryBudget) })}
            </span>
          )}
        </div>

        {productionItems.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-3 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {tb.log_hint}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2.5 pl-1 pr-4 lg:pl-2 lg:pr-6 text-xs font-medium text-muted-foreground">{tb.col_item}</th>
                  <th className="pb-2.5 pr-4 lg:pr-6 text-xs font-medium text-muted-foreground text-right">{tb.col_stock}</th>
                  <th className="pb-2.5 pr-4 lg:pr-6 text-xs font-medium text-muted-foreground text-center">{tb.col_status}</th>
                  <th className="pb-2.5 pr-4 lg:pr-6 text-xs font-medium text-muted-foreground text-right">{tr(tb.col_need, { days: String(days) })}</th>
                  <th className="pb-2.5 pr-4 lg:pr-6 text-xs font-medium text-muted-foreground text-right">{tb.col_to_buy}</th>
                  <th className="pb-2.5 pr-1 lg:pr-3 text-xs font-medium text-muted-foreground text-right">{tb.col_budget}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {productionItems.map((item) => {
                  const urgency =
                    item.daysOfStock == null ? "none"
                    : item.daysOfStock < 14   ? "critical"
                    : item.daysOfStock < days ? "warning"
                    : "ok";
                  return (
                    <tr key={item.name} className="group hover:bg-muted/30 transition-colors">
                      <td className="py-3 pl-1 pr-4 lg:pl-2 lg:pr-6">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium leading-none">{item.name}</p>
                          {item.isFeed && hasGrowthData && growthPct > 0 && (
                            <span className="text-xs font-semibold text-violet-500 uppercase tracking-wide">↑{growthPct}%</span>
                          )}
                        </div>
                        <div className="mt-1.5 h-1 w-24 rounded-full bg-muted overflow-hidden">
                          <div
                            className={
                              urgency === "critical" ? "h-full rounded-full bg-destructive"
                              : urgency === "warning" ? "h-full rounded-full bg-amber-400"
                              : "h-full rounded-full bg-emerald-500"
                            }
                            style={{ width: `${Math.round(item.coverage * 100)}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3 pr-4 lg:pr-6 text-right tabular-nums text-muted-foreground text-xs">
                        {item.stock} {item.unit}
                      </td>
                      <td className="py-3 pr-4 lg:pr-6 text-center">
                        {urgency === "critical" && (
                          <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                            {tb.status_critical}
                          </span>
                        )}
                        {urgency === "warning" && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                            {tr(tb.status_warning, { days: String(item.daysOfStock ?? 0) })}
                          </span>
                        )}
                        {urgency === "ok" && (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            {tb.status_ok}
                          </span>
                        )}
                        {urgency === "none" && <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="py-3 pr-4 lg:pr-6 text-right tabular-nums text-xs">
                        {item.needTotal} {item.unit}
                      </td>
                      <td className={cn("py-3 pr-4 lg:pr-6 text-right tabular-nums text-xs font-medium", item.shortfall > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>
                        {item.shortfall > 0 ? `${item.shortfall} ${item.unit}` : tb.sufficient}
                      </td>
                      <td className="py-3 pr-1 lg:pr-3 text-right tabular-nums">
                        {item.budget != null ? (
                          item.shortfall > 0
                            ? <span className="font-semibold text-sm">{fmtBDT(item.budget)}</span>
                            : <span className="text-muted-foreground text-xs">—</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">{tb.no_price}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

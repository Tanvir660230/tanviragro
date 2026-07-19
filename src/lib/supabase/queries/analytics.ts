import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dictionary } from "@/i18n/getDictionary";

 
type Client = SupabaseClient<any>;

export interface MonthlyPoint {
  month: string;
  label: string;
  revenue: number;
  cost: number;
}

export interface HealthScore {
  score: number;
  fcr: number | null;
  avgDaysInPen: number;
  stockDays: number | null;
}

export interface InsightItem {
  id: string;
  type: "warning" | "info" | "success";
  message: string;
  href?: string;
}

export interface PreviousPeriodStats {
  totalCattle: number;
  totalInvestment: number;
  totalSales: number;
  netProfitLoss: number;
}

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}


export async function getMonthlyRevenueVsCost(
  supabase: Client,
  businessId: string | null
): Promise<MonthlyPoint[]> {
  if (!businessId) return [];
  const since = new Date();
  since.setMonth(since.getMonth() - 5);
  since.setDate(1);
  const sinceStr = since.toISOString().split("T")[0];

  const [{ data: salesRaw }, { data: costsRaw }, { data: cattleRaw }, { data: invRaw }, { data: treatmentRaw }] = await Promise.all([
    supabase
      .from("sales")
      .select("sale_price_total, sold_at, cattle!inner(business_id)")
      .eq("cattle.business_id", businessId)
      .is("deleted_at", null)
      .gte("sold_at", sinceStr),
    supabase
      .from("cost_entries")
      .select("amount, recorded_at")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .neq("entry_class", "asset")
      .gte("recorded_at", sinceStr),
    supabase
      .from("cattle")
      .select("purchase_price, purchase_date")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .gte("purchase_date", sinceStr),
    supabase
      .from("inventory_transactions")
      .select("qty, unit_cost, recorded_at, inventory_items!inner(business_id)")
      .eq("inventory_items.business_id", businessId)
      .eq("type", "consumption")
      .gte("recorded_at", sinceStr),
    supabase
      .from("cattle_treatments")
      .select("vet_fee, additional_medical_cost, treated_at, cattle!inner(business_id)")
      .eq("cattle.business_id", businessId)
      .gte("treated_at", sinceStr),
  ]);

  const monthMap: Record<string, { revenue: number; cost: number }> = {};

  // Build last 6 months skeleton
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap[key] = { revenue: 0, cost: 0 };
  }

  for (const s of salesRaw ?? []) {
    const key = (s.sold_at as string).slice(0, 7);
    if (monthMap[key]) monthMap[key].revenue += Number(s.sale_price_total);
  }
  for (const c of costsRaw ?? []) {
    const key = (c.recorded_at as string).slice(0, 7);
    if (monthMap[key]) monthMap[key].cost += Number(c.amount);
  }
  // Cattle purchase costs by month
  for (const c of cattleRaw ?? []) {
    const key = (c.purchase_date as string).slice(0, 7);
    if (monthMap[key]) monthMap[key].cost += Number(c.purchase_price ?? 0);
  }
  // Feed/inventory consumption costs by month
  for (const t of invRaw ?? []) {
    const key = (t.recorded_at as string).slice(0, 7);
    if (monthMap[key]) monthMap[key].cost += Number(t.qty) * Number(t.unit_cost ?? 0);
  }
  // Medical costs by month
  for (const t of treatmentRaw ?? []) {
    const key = (t.treated_at as string).slice(0, 7);
    if (monthMap[key]) monthMap[key].cost += Number(t.vet_fee ?? 0) + Number(t.additional_medical_cost ?? 0);
  }

  return Object.entries(monthMap).map(([month, { revenue, cost }]) => {
    const [y, m] = month.split("-");
    const label = new Date(+y, +m - 1, 1).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
    return { month, label, revenue, cost };
  });
}

export async function getPreviousPeriodStats(
  supabase: Client,
  businessId: string | null
): Promise<PreviousPeriodStats> {
  if (!businessId) {
    return { totalCattle: 0, totalInvestment: 0, totalSales: 0, netProfitLoss: 0 };
  }
  const now = new Date();
  const prev30Start = new Date(now);
  prev30Start.setDate(prev30Start.getDate() - 59);
  const prev30End = new Date(now);
  prev30End.setDate(prev30End.getDate() - 30);

  const startStr = prev30Start.toISOString().split("T")[0];
  const endStr = prev30End.toISOString().split("T")[0];

  const [countRes, cattlePurchasedRes, costsRes, salesRes, invPurchasesRes, treatmentRes] = await Promise.all([
    // Active cattle count as of prev30End (created before cutoff, not yet deleted/sold at cutoff)
    supabase
      .from("cattle")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "active")
      .is("deleted_at", null)
      .lte("created_at", prev30End.toISOString()),
    // All cattle purchased in that window
    supabase
      .from("cattle")
      .select("purchase_price")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .gte("purchase_date", startStr)
      .lte("purchase_date", endStr),
    supabase
      .from("cost_entries")
      .select("amount")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .neq("entry_class", "asset")
      .gte("recorded_at", startStr)
      .lte("recorded_at", endStr),
    supabase
      .from("sales")
      .select("sale_price_total, cattle!inner(business_id)")
      .eq("cattle.business_id", businessId)
      .is("deleted_at", null)
      .gte("sold_at", startStr)
      .lte("sold_at", endStr),
    supabase
      .from("inventory_transactions")
      .select("qty, unit_cost, inventory_items!inner(business_id)")
      .eq("inventory_items.business_id", businessId)
      .eq("type", "purchase")
      .not("unit_cost", "is", null)
      .gte("recorded_at", startStr)
      .lte("recorded_at", endStr),
    supabase
      .from("cattle_treatments")
      .select("vet_fee, additional_medical_cost, cattle!inner(business_id)")
      .eq("cattle.business_id", businessId)
      .gte("treated_at", startStr)
      .lte("treated_at", endStr),
  ]);

  const cattlePurchased = (cattlePurchasedRes.data ?? []) as { purchase_price: number | null }[];
  const costs = (costsRes.data ?? []) as { amount: number }[];
  const salesData = (salesRes.data ?? []) as { sale_price_total: number }[];
  const invPurchases = (invPurchasesRes.data ?? []) as { qty: number; unit_cost: number | null }[];

  const totalSales = salesData.reduce((s, r) => s + Number(r.sale_price_total), 0);
  const totalCattleCost = cattlePurchased.reduce((s, c) => s + Number(c.purchase_price ?? 0), 0);
  const medCosts = (treatmentRes.data ?? []).reduce((s: number, t: any) => s + Number(t.vet_fee ?? 0) + Number(t.additional_medical_cost ?? 0), 0);
  const totalOpCosts = costs.reduce((s, c) => s + Number(c.amount), 0) + medCosts;
  const totalInvCosts = invPurchases.reduce((s, t) => s + Number(t.qty) * Number(t.unit_cost ?? 0), 0);
  const totalInvestment = totalCattleCost + totalOpCosts + totalInvCosts;

  return {
    totalCattle: countRes.count ?? 0,
    totalInvestment,
    totalSales,
    netProfitLoss: totalSales - totalInvestment,
  };
}

export async function getPortfolioHealthScore(
  supabase: Client,
  businessId: string | null
): Promise<HealthScore> {
  if (!businessId) return { score: 0, fcr: null, avgDaysInPen: 0, stockDays: null };

  // Step 1: get cattle IDs (needed to scope weight_logs without a join)
  const { data: activeCattle } = await supabase
    .from("cattle")
    .select("id, purchase_date, initial_weight_kg")
    .eq("business_id", businessId)
    .eq("status", "active")
    .is("deleted_at", null);

  const cattle = (activeCattle ?? []) as {
    id: string;
    purchase_date: string;
    initial_weight_kg: number;
  }[];

  if (!cattle.length) return { score: 0, fcr: null, avgDaysInPen: 0, stockDays: null };

  const activeIds = cattle.map((c) => c.id);

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const oneYearAgoStr = oneYearAgo.toISOString().slice(0, 10);

  // Step 2: parallel — weight_logs scoped via .in() (no join), inventory via business join
  const [{ data: weightLogs }, { data: consumptions }, { data: stockData }] = await Promise.all([
    supabase
      .from("weight_logs")
      .select("cattle_id, weight_kg, recorded_at")
      .in("cattle_id", activeIds)
      .gte("recorded_at", oneYearAgoStr)
      .order("recorded_at", { ascending: false })
      .limit(2000),
    supabase
      .from("inventory_transactions")
      .select("cattle_id, qty, inventory_items!inner(category, business_id)")
      .eq("inventory_items.business_id", businessId)
      .eq("type", "consumption")
      .eq("inventory_items.category", "feed")
      .gte("recorded_at", oneYearAgoStr)
      .limit(5000),
    supabase
      .from("inventory_transactions")
      .select("item_id, type, qty, recorded_at, inventory_items!inner(category, business_id)")
      .eq("inventory_items.business_id", businessId)
      .eq("inventory_items.category", "feed")
      .gte("recorded_at", oneYearAgoStr)
      .limit(5000),
  ]);

  // Latest weight per cattle
  const latestWeightMap: Record<string, { weight: number; date: string }> = {};
  for (const log of (weightLogs ?? []) as {
    cattle_id: string;
    weight_kg: number;
    recorded_at: string;
  }[]) {
    if (!latestWeightMap[log.cattle_id]) {
      latestWeightMap[log.cattle_id] = { weight: log.weight_kg, date: log.recorded_at };
    }
  }

  // Total feed consumption per cattle
  const consumeMap: Record<string, number> = {};
  for (const c of (consumptions ?? []) as { cattle_id: string; qty: number }[]) {
    if (c.cattle_id) consumeMap[c.cattle_id] = (consumeMap[c.cattle_id] ?? 0) + c.qty;
  }

  // Farm-level FCR calculation (Total Feed / Total Gain)
  // We only include cattle that have ≥1 kg gain to avoid extreme noise
  let totalValidGain = 0;
  let totalValidFeed = 0;

  for (const c of cattle) {
    const latest = latestWeightMap[c.id];
    if (!latest) continue;
    const weightGain = latest.weight - c.initial_weight_kg;
    const consumed = consumeMap[c.id] ?? 0;
    if (weightGain >= 1 && consumed > 0) {
      totalValidGain += weightGain;
      totalValidFeed += consumed;
    }
  }

  const avgFCR = totalValidGain > 0 ? totalValidFeed / totalValidGain : null;

  // Average days in pen — parse purchase_date as local midnight (not UTC) for Bangladesh
  const today = Date.now();
  const daysInPenValues = cattle.map(
    (c) => (today - new Date(c.purchase_date + "T00:00:00").getTime()) / 86400000
  );
  const avgDaysInPen =
    daysInPenValues.reduce((a, b) => a + b, 0) / daysInPenValues.length;

  // Stock coverage: compute from last 30 days consumption
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const allTxns = (stockData ?? []) as {
    item_id: string;
    type: string;
    qty: number;
    recorded_at: string;
  }[];

  const stockByItem: Record<string, number> = {};
  const consume30ByItem: Record<string, number> = {};

  for (const t of allTxns) {
    if (t.type === "purchase") {
      stockByItem[t.item_id] = (stockByItem[t.item_id] ?? 0) + t.qty;
    } else {
      stockByItem[t.item_id] = (stockByItem[t.item_id] ?? 0) - t.qty;
      if (new Date(t.recorded_at) >= thirtyDaysAgo) {
        consume30ByItem[t.item_id] = (consume30ByItem[t.item_id] ?? 0) + t.qty;
      }
    }
  }

  const MIN_DAILY_CONSUMPTION = 0.01; // ignore items with negligible daily use
  const feedItemIds = Object.keys(consume30ByItem);
  let minStockDays: number | null = null;
  for (const itemId of feedItemIds) {
    const stock = Math.max(0, stockByItem[itemId] ?? 0);
    const daily = consume30ByItem[itemId] / 30;
    if (daily >= MIN_DAILY_CONSUMPTION) {
      const days = stock / daily;
      if (minStockDays === null || days < minStockDays) minStockDays = days;
    }
  }

  // Score computation — realistic baselines for Bangladesh cattle fattening
  //   FCR:   6 = excellent (typical BD range 6–9); score drops 8pts per unit above 6
  //   Pen:   ≤120 days = full marks; penalise 0.3pts/day after 120 (normal BD cycle 90-180d)
  //   Stock: 30+ days coverage = full marks; linear below that
  const fcrScore   = Math.round(avgFCR !== null ? clamp(40 - (avgFCR - 6) * 8, 0, 40) : 20);
  const penScore   = Math.round(clamp(30 - Math.max(0, avgDaysInPen - 120) * 0.3, 0, 30));
  const stockScore = Math.round(minStockDays !== null ? clamp(minStockDays, 0, 30) : 15);

  return {
    score: fcrScore + penScore + stockScore,
    fcr: avgFCR !== null ? Math.round(avgFCR * 10) / 10 : null,
    avgDaysInPen: Math.round(avgDaysInPen),
    stockDays: minStockDays !== null ? Math.round(minStockDays) : null,
  };
}

export async function getSmartInsights(
  supabase: Client,
  businessId: string | null,
  t?: Dictionary
): Promise<InsightItem[]> {
  if (!businessId) return [];
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysLater = new Date();
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
  const sevenDaysLaterStr = sevenDaysLater.toISOString().slice(0, 10);

  // Step 1: get active cattle IDs so we can scope weight_logs via .in() instead of a join
  const { data: activeCattleRaw } = await supabase
    .from("cattle")
    .select("id, tag_id, purchase_date, initial_weight_kg")
    .eq("business_id", businessId)
    .eq("status", "active")
    .is("deleted_at", null);

  const cattle = (activeCattleRaw ?? []) as { id: string; tag_id: string; purchase_date: string; initial_weight_kg: number }[];
  const activeIds = cattle.map((c) => c.id);

  // Step 2: remaining queries in parallel, weight_logs scoped via .in() (no join)
  const [{ data: recentWeights }, { data: allTxns }, { data: salesData }, { data: costsData }, { data: healthData }, { data: cattlePurchaseData }, { data: marketPriceRow }, { data: treatmentsData }] =
    await Promise.all([
      activeIds.length > 0
        ? supabase
            .from("weight_logs")
            .select("cattle_id, recorded_at")
            .in("cattle_id", activeIds)
            .gte("recorded_at", sevenDaysAgo.toISOString())
            .limit(500)
        : Promise.resolve({ data: [] as { cattle_id: string; recorded_at: string }[] }),
      supabase
        .from("inventory_transactions")
        .select("item_id, type, qty, unit_cost, cattle_id, recorded_at, inventory_items!inner(business_id)")
        .eq("inventory_items.business_id", businessId)
        .gte("recorded_at", (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().split("T")[0]; })())
        .order("recorded_at", { ascending: true })
        .limit(5000),
      // All sales for the business. Also fetch cattle_id so we can match purchase costs.
      supabase
        .from("sales")
        .select("sale_price_total, cattle_id, cattle!inner(business_id, deleted_at)")
        .eq("cattle.business_id", businessId)
        .is("cattle.deleted_at", null)
        .is("deleted_at", null)
        .limit(2000),
      supabase
        .from("cost_entries")
        .select("amount")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .neq("entry_class", "asset")
        .limit(5000),
      supabase
        .from("health_events")
        .select("id, title, scheduled_at, event_type, cattle_id")
        .eq("business_id", businessId)
        .is("completed_at", null)
        .is("deleted_at", null)
        .lte("scheduled_at", sevenDaysLaterStr),
      // Include id so we can filter to sold cattle only for the profitability check.
      supabase
        .from("cattle")
        .select("id, purchase_price")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .limit(1000),
      // Market price — needed to detect missing price (blocks forecast + sell-today)
      supabase
        .from("market_prices")
        .select("price_per_kg")
        .eq("business_id", businessId)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("cattle_treatments")
        .select("vet_fee, additional_medical_cost, cattle_id, cattle!inner(business_id)")
        .eq("cattle.business_id", businessId)
        .limit(5000),
    ]);

  // Build insights list
  const insights: InsightItem[] = [];

  // tag_id lookup map — used to label insights with specific cattle
  const tagById = new Map<string, string>(cattle.map((c) => [c.id, c.tag_id]));

  const ins = t?.dashboard.insights;
  function tagList(items: { id: string; tag_id: string }[], max = 3): string {
    const shown = items.slice(0, max).map((c) => `#${c.tag_id}`).join(", ");
    if (items.length <= max) return shown;
    const more = ins?.more.replace("{{n}}", String(items.length - max)) ?? `+${items.length - max}`;
    return `${shown} (${more})`;
  }

  const weightedIds = new Set(
    ((recentWeights ?? []) as { cattle_id: string }[]).map((w) => w.cattle_id)
  );
  const unweigedCattle = cattle.filter((c) => !weightedIds.has(c.id));
  if (unweigedCattle.length > 0) {
    insights.push({
      id: "unweighed",
      type: "warning",
      message: unweigedCattle.length === 1
        ? (ins?.unweighed_7d_single ?? `#${unweigedCattle[0].tag_id} not weighed in 7 days`).replace("{{tag}}", unweigedCattle[0].tag_id)
        : (ins?.unweighed_7d_multi ?? `${tagList(unweigedCattle)} — not weighed in 7 days`).replace("{{tags}}", tagList(unweigedCattle)),
      href: unweigedCattle.length === 1
        ? `/dashboard/cattle/${unweigedCattle[0].id}`
        : "/dashboard/cattle",
    });
  }

  const allTxnList = (allTxns ?? []) as {
    item_id: string;
    type: string;
    qty: number;
    unit_cost: number | null;
    cattle_id: string | null;
    recorded_at: string;
  }[];

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const stockByItem: Record<string, number> = {};
  const consume30ByItem: Record<string, number> = {};

  for (const t of allTxnList) {
    if (t.type === "purchase") {
      stockByItem[t.item_id] = (stockByItem[t.item_id] ?? 0) + t.qty;
    } else {
      stockByItem[t.item_id] = (stockByItem[t.item_id] ?? 0) - t.qty;
      if (new Date(t.recorded_at) >= thirtyDaysAgo) {
        consume30ByItem[t.item_id] = (consume30ByItem[t.item_id] ?? 0) + t.qty;
      }
    }
  }

  let lowStockCount = 0;
  for (const itemId of Object.keys(consume30ByItem)) {
    const stock = stockByItem[itemId] ?? 0;
    const daily = consume30ByItem[itemId] / 30;
    if (daily > 0 && stock / daily < 10) lowStockCount++;
  }
  if (lowStockCount > 0) {
    const stockKey = lowStockCount === 1 ? ins?.low_stock_one : ins?.low_stock_many;
    insights.push({
      id: "low-stock",
      type: "warning",
      message: (stockKey ?? `${lowStockCount} inventory item${lowStockCount > 1 ? "s" : ""} will run out within 10 days`).replace("{{n}}", String(lowStockCount)),
      href: "/dashboard/inventory",
    });
  }

  const totalSales = ((salesData ?? []) as { sale_price_total: number }[]).reduce(
    (s, r) => s + Number(r.sale_price_total),
    0
  );
  const opCosts = ((costsData ?? []) as { amount: number }[]).reduce(
    (s, c) => s + Number(c.amount),
    0
  );
  // Match expenses to revenues (Accrual principle)
  // Only count purchase costs of cattle that have actually been SOLD.
  const soldCattleIdSet = new Set(
    ((salesData ?? []) as { cattle_id?: string }[]).map((r) => r.cattle_id).filter(Boolean)
  );
  const cattlePurchaseCosts = ((cattlePurchaseData ?? []) as { id: string; purchase_price: number | null }[])
    .filter((c) => soldCattleIdSet.has(c.id))
    .reduce((s, c) => s + Number(c.purchase_price ?? 0), 0);

  // Prorate general operational costs and unattributed feed between sold vs active cattle
  const soldCount = soldCattleIdSet.size;
  const activeCount = cattle.length;
  const totalCattleCount = soldCount + activeCount;
  const prorateFactor = totalCattleCount > 0 ? (soldCount / totalCattleCount) : 0;
  
  const proratedOpCosts = opCosts * prorateFactor;

  let attributedFeedCosts = 0;
  let unattributedFeedCosts = 0;
  
  for (const t of allTxnList) {
    if (t.type === "consumption") {
      const cost = Number(t.qty) * Number(t.unit_cost ?? 0);
      if (t.cattle_id) {
        if (soldCattleIdSet.has(t.cattle_id)) attributedFeedCosts += cost;
      } else {
        unattributedFeedCosts += cost;
      }
    }
  }
  let attributedMedCosts = 0;
  let unattributedMedCosts = 0;
  for (const t of (treatmentsData ?? []) as { vet_fee: number; additional_medical_cost: number; cattle_id: string }[]) {
    const cost = Number(t.vet_fee ?? 0) + Number(t.additional_medical_cost ?? 0);
    if (soldCattleIdSet.has(t.cattle_id)) attributedMedCosts += cost;
    else unattributedMedCosts += cost;
  }
  
  const proratedUnattributedFeedCosts = unattributedFeedCosts * prorateFactor;
  const proratedUnattributedMedCosts = unattributedMedCosts * prorateFactor;
  const totalCosts = proratedOpCosts + cattlePurchaseCosts + attributedFeedCosts + proratedUnattributedFeedCosts + attributedMedCosts + proratedUnattributedMedCosts;

  if (totalSales > 0 && totalSales > totalCosts) {
    const net = Math.round(totalSales - totalCosts).toLocaleString("en-IN");
    insights.push({
      id: "profitable",
      type: "success",
      message: (ins?.profitable ?? `Currently profitable — ৳${net} net`).replace("{{net}}", net),
      href: "/dashboard/finance",
    });
  }

  // Feed consumption per cattle — derived from allTxns (no extra query)
  const consumeMap: Record<string, number> = {};
  for (const t of allTxnList) {
    if (t.type === "consumption" && t.cattle_id) {
      consumeMap[t.cattle_id] = (consumeMap[t.cattle_id] ?? 0) + t.qty;
    }
  }

  const nowMs = Date.now();
  // Only flag cattle that have been in the pen long enough to have expected feed logs
  const noFeedCattle = cattle.filter((c) => {
    if (consumeMap[c.id]) return false;
    const daysInPen = (nowMs - new Date(c.purchase_date + "T00:00:00").getTime()) / 86400000;
    return daysInPen > 7;
  });
  if (noFeedCattle.length > 0 && cattle.length > 0) {
    insights.push({
      id: "no-feed-log",
      type: "info",
      message: noFeedCattle.length === 1
        ? (ins?.no_feed_single ?? `#${noFeedCattle[0].tag_id} — no feed logged (FCR cannot be computed)`).replace("{{tag}}", noFeedCattle[0].tag_id)
        : (ins?.no_feed_multi ?? `${tagList(noFeedCattle)} — no feed logged, FCR cannot be computed`).replace("{{tags}}", tagList(noFeedCattle)),
      href: "/dashboard/inventory",
    });
  }

  // Cattle in pen 150+ days — high feed cost accumulation, timely sale matters
  const longPenCattle = cattle.filter((c) => {
    const days = (nowMs - new Date(c.purchase_date + "T00:00:00").getTime()) / 86400000;
    return days > 150;
  });
  if (longPenCattle.length > 0) {
    const days0 = Math.round((nowMs - new Date(longPenCattle[0].purchase_date + "T00:00:00").getTime()) / 86400000);
    insights.push({
      id: "long-pen-time",
      type: "warning",
      message: longPenCattle.length === 1
        ? `#${longPenCattle[0].tag_id} — ${days0} days in pen — review sale timing`
        : `${longPenCattle.length} cattle in pen 150+ days — review sale timing`,
      href: "/dashboard/cattle",
    });
  }

  const healthList = (healthData ?? []) as { id: string; title: string; scheduled_at: string; event_type: string; cattle_id: string }[];
  const overdueHealth = healthList.filter((e) => e.scheduled_at < today);
  const soonHealth    = healthList.filter((e) => e.scheduled_at >= today);

  if (overdueHealth.length > 0) {
    const overdueTagsUniq = [...new Set(overdueHealth.map((e) => e.cattle_id))]
      .slice(0, 3)
      .map((id) => tagById.get(id))
      .filter(Boolean) as string[];
    const tagPart   = overdueTagsUniq.map((tg) => `#${tg}`).join(", ");
    const moreCount = overdueHealth.length - 3;
    const moreText  = overdueHealth.length > 3
      ? " " + (ins?.more ?? `+${moreCount}`).replace("{{n}}", String(moreCount))
      : "";
    const firstTitle = overdueHealth[0].title;
    insights.push({
      id: "health-overdue",
      type: "warning",
      message: overdueHealth.length === 1
        ? (ins?.health_overdue_single ?? `${tagPart} — "${firstTitle}" overdue`)
            .replace("{{tag}}", tagPart)
            .replace("{{title}}", firstTitle)
        : (ins?.health_overdue_multi ?? `${overdueHealth.length} health events overdue (${tagPart}${moreText})`)
            .replace("{{n}}", String(overdueHealth.length))
            .replace("{{tags}}", tagPart)
            .replace("{{more}}", moreText),
      href: overdueHealth.length === 1
        ? `/dashboard/cattle/${overdueHealth[0].cattle_id}`
        : "/dashboard/compliance",
    });
  } else if (soonHealth.length > 0) {
    const soonTagsUniq = [...new Set(soonHealth.map((e) => e.cattle_id))]
      .slice(0, 3)
      .map((id) => tagById.get(id))
      .filter(Boolean) as string[];
    const tagPart = soonTagsUniq.map((tg) => `#${tg}`).join(", ");
    insights.push({
      id: "health-soon",
      type: "info",
      message: soonHealth.length === 1
        ? (ins?.health_soon_single ?? `${tagPart} — "${soonHealth[0].title}" due within 7 days`)
            .replace("{{tag}}", tagPart)
            .replace("{{title}}", soonHealth[0].title)
        : (ins?.health_soon_multi ?? `${soonHealth.length} health events due within 7 days (${tagPart})`)
            .replace("{{n}}", String(soonHealth.length))
            .replace("{{tags}}", tagPart),
      href: "/dashboard/compliance",
    });
  }

  // No market price set — silently blocks cash flow forecast and sell-today estimate
  const hasMarketPrice = !!(marketPriceRow as { price_per_kg: number } | null)?.price_per_kg;
  if (cattle.length > 0 && !hasMarketPrice) {
    insights.push({
      id: "no-market-price",
      type: "info",
      message: "Market price not set — cash flow forecast and sell-today estimate are unavailable",
      href: "/dashboard/settings",
    });
  }

  // Empty insights = all clear; InsightsPanel renders its own i18n empty state
  // Sort: warnings first, then info, then success
  const PRIORITY: Record<InsightItem["type"], number> = { warning: 0, info: 1, success: 2 };
  return insights.sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type]);
}


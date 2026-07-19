import type { SupabaseClient } from "@supabase/supabase-js";
import { buildWeightPredictions } from "@/lib/cattle-weight";
import { calculateAlgorithmicFeedCost, ROUGHAGE_TYPES } from "@/utils/feed-calculator";

type Client = SupabaseClient<any>;

export interface LiveValuationResult {
  activeCattleCount: number;
  totalEstimatedValue: number;
  totalCostBasis: number;
  unrealizedProfit: number;
  marketPricePerKg: number;
  readyToSellCattle: {
    id: string;
    tagId: string;
    profit: number;
    roi: number;
    daysInPen: number;
  }[];
}

export async function getLiveHerdValuation(
  supabase: Client,
  businessId: string | null
): Promise<LiveValuationResult> {
  if (!businessId) {
    return {
      activeCattleCount: 0,
      totalEstimatedValue: 0,
      totalCostBasis: 0,
      unrealizedProfit: 0,
      marketPricePerKg: 0,
      readyToSellCattle: [],
    };
  }

  // 1. Fetch Business Config
  const { data: bizData } = await supabase
    .from("businesses")
    .select("unit_price_bdt, default_daily_gain_kg, default_roughage_type")
    .eq("id", businessId)
    .maybeSingle();

  const dailyGainKg: number = bizData?.default_daily_gain_kg ?? 0.6;
  const bizDefaultRoughage = bizData?.default_roughage_type ?? "straw";
  const defaultRoughageDm = ROUGHAGE_TYPES.find(r => r.id === bizDefaultRoughage)?.dmPercent ?? 0.90;

  // 2. Fetch Data in Parallel
  const [
    { data: activeCattleData },
    { data: weightLogsData },
    { data: marketPriceData },
    { data: rpcFeedData },
    { data: activeCostData },
    { data: recentPurchasesData },
    { data: roughagesData },
    { data: recipesData },
    { data: treatmentsData },
  ] = await Promise.all([
    supabase
      .from("cattle")
      .select("id, tag_id, purchase_price, initial_weight_kg, purchase_date")
      .eq("business_id", businessId)
      .eq("status", "active"),
    supabase
      .from("weight_logs")
      .select("cattle_id, weight_kg, recorded_at, cattle!inner(business_id, status)")
      .eq("cattle.business_id", businessId)
      .eq("cattle.status", "active")
      .order("recorded_at", { ascending: false }),
    supabase
      .from("market_prices")
      .select("price_per_kg")
      .eq("business_id", businessId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc("get_cattle_consumptions", { p_business_id: businessId }),
    // Direct non-feed costs
    supabase
      .from("cost_entries")
      .select("cattle_id, amount")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .not("cattle_id", "is", null)
      .eq("type", "variable")
      .neq("entry_class", "asset"),
    supabase
      .from("inventory_transactions")
      .select("item_id, unit_cost, inventory_items!inner(business_id)")
      .eq("inventory_items.business_id", businessId)
      .eq("type", "purchase")
      .order("recorded_at", { ascending: false })
      .limit(300),
    supabase
      .from("inventory_items")
      .select("id, name, unit, roughage_active_from, roughage_active_until")
      .eq("business_id", businessId)
      .not("roughage_active_from", "is", null),
    supabase
      .from("feed_recipes")
      .select("id, active_from, active_until, recipe_ingredients(item_id, qty_per_batch)")
      .eq("business_id", businessId)
      .not("active_from", "is", null),
    supabase
      .from("cattle_treatments")
      .select("cattle_id, vet_fee, additional_medical_cost, cattle!inner(business_id)")
      .eq("cattle.business_id", businessId),
  ]);

  const activeCattle = (activeCattleData ?? []) as any[];
  if (activeCattle.length === 0) {
    return {
      activeCattleCount: 0,
      totalEstimatedValue: 0,
      totalCostBasis: 0,
      unrealizedProfit: 0,
      marketPricePerKg: 0,
      readyToSellCattle: [],
    };
  }

  const marketPricePerKg = marketPriceData?.price_per_kg ?? 0;
  const today = new Date();

  // 3. Build Cost Maps
  const feedCostByCattle: Record<string, number> = {};
  for (const t of (rpcFeedData ?? []) as any[]) {
    if (t.cattle_id) {
      feedCostByCattle[t.cattle_id] = (feedCostByCattle[t.cattle_id] ?? 0) + Number(t.total_cost);
    }
  }

  const costsByCattle: Record<string, number> = {};
  for (const c of (activeCostData ?? []) as any[]) {
    if (c.cattle_id) {
      costsByCattle[c.cattle_id] = (costsByCattle[c.cattle_id] ?? 0) + Number(c.amount);
    }
  }
  for (const t of (treatmentsData ?? []) as any[]) {
    if (t.cattle_id) {
      costsByCattle[t.cattle_id] = (costsByCattle[t.cattle_id] ?? 0) + Number(t.vet_fee ?? 0) + Number(t.additional_medical_cost ?? 0);
    }
  }

  const unitCostMap: Record<string, number> = {};
  for (const p of (recentPurchasesData ?? []) as any[]) {
    if (p.unit_cost != null && !unitCostMap[p.item_id]) {
      unitCostMap[p.item_id] = p.unit_cost;
    }
  }

  const roughages = (roughagesData ?? []) as any[];
  const recipes = (recipesData ?? []) as any[];

  // 4. Predict Weights
  const weightPredictions = buildWeightPredictions(
    activeCattle.map((c) => ({
      cattleId: c.id,
      initialWeightKg: c.initial_weight_kg,
      purchaseDate: c.purchase_date,
      defaultDailyGainKg: dailyGainKg,
    })),
    ((weightLogsData ?? []) as any[]).map((l) => ({ cattle_id: l.cattle_id, weight_kg: l.weight_kg, recorded_at: l.recorded_at })),
    today
  );

  // 5. Calculate Valuation & Profits
  let totalEstimatedValue = 0;
  let totalCostBasis = 0;
  const readyToSellCattle: LiveValuationResult["readyToSellCattle"] = [];

  for (const c of activeCattle) {
    const startMs = new Date(c.purchase_date + "T00:00:00").getTime();
    const daysInPen = Math.max(0, Math.floor((today.getTime() - startMs) / 86400000));
    
    const pred = weightPredictions[c.id];
    const estimatedWeight = pred?.predictedWeight ?? (c.initial_weight_kg + daysInPen * dailyGainKg);

    // Algorithmic Feed Cost Fallback
    if ((feedCostByCattle[c.id] ?? 0) === 0) {
      const { allocatedFeedCost } = calculateAlgorithmicFeedCost({
        daysInPen,
        startMs,
        recipes,
        roughages,
        unitCostMap,
        feedData: {
          initialWeightKg: c.initial_weight_kg ?? 0,
          latestLoggedWeightKg: estimatedWeight,
          lastWeighedAt: null,
          purchaseDate: c.purchase_date,
          expectedDailyGainKg: dailyGainKg,
          roughageDmPercent: defaultRoughageDm,
        },
        overrideRoughage: null,
      });
      feedCostByCattle[c.id] = allocatedFeedCost;
    }

    const estimatedMarketValue = marketPricePerKg > 0 ? estimatedWeight * marketPricePerKg : 0;
    const costBasis = Number(c.purchase_price) + (feedCostByCattle[c.id] ?? 0) + (costsByCattle[c.id] ?? 0);
    const profit = estimatedMarketValue - costBasis;

    totalEstimatedValue += estimatedMarketValue;
    totalCostBasis += costBasis;

    // A cow is "ready to sell" if its ROI is decent (e.g. > 10%) or it has been held for a long time with positive profit.
    // Let's flag any active cow with >12% ROI as a candidate.
    const roi = costBasis > 0 ? (profit / costBasis) * 100 : 0;
    if (roi >= 12 && profit > 0) {
      readyToSellCattle.push({
        id: c.id,
        tagId: c.tag_id,
        profit: profit,
        roi: roi,
        daysInPen,
      });
    }
  }

  // Sort readyToSell by highest ROI
  readyToSellCattle.sort((a, b) => b.roi - a.roi);

  return {
    activeCattleCount: activeCattle.length,
    totalEstimatedValue,
    totalCostBasis,
    unrealizedProfit: totalEstimatedValue - totalCostBasis,
    marketPricePerKg,
    readyToSellCattle,
  };
}

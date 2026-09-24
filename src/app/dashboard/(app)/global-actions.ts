"use server";

import { createClient } from "@/lib/supabase/server";
import { LivestockProfitabilityEngine } from "@/lib/financial/profitability-engine";
import { buildWeightPredictions } from "@/lib/cattle-weight";
import { getHerdFeedShareByCattle } from "@/lib/inventory/herd-feed-share";

export async function getGlobalFormData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return {
      success: false,
      cattle: [],
      breeds: [],
      inventoryItems: [],
      error: "Not authenticated"
    };
  }

  const { data: biz } = await supabase
    .from("businesses")
    .select("id, unit_price_bdt, default_daily_gain_kg, default_roughage_type")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!biz) {
    return {
      success: false,
      cattle: [],
      breeds: [],
      inventoryItems: [],
      error: "No business found"
    };
  }

  const [
    { data: cattleData },
    { data: inventoryData },
    { data: weightLogsData },
    { data: marketPriceData },
    { data: costEntriesData },
    { data: treatmentsData },
    { data: rpcFeedData },
    { data: roughagesData },
    { data: recipesData },
    { data: recentPurchasesData }
  ] = await Promise.all([
    supabase
      .from("cattle")
      .select("id, tag_id, breed, initial_weight_kg, purchase_date, expected_daily_gain_kg, created_at, purchase_price")
      .eq("business_id", biz.id)
      .eq("status", "active")
      .order("tag_id"),
    supabase
      .from("inventory_items")
      .select("id, name, unit, category")
      .eq("business_id", biz.id)
      .order("name"),
    supabase
      .from("weight_logs")
      .select("cattle_id, weight_kg, recorded_at")
      .is("deleted_at", null)
      .in("cattle_id", (await supabase.from("cattle").select("id").eq("business_id", biz.id).eq("status", "active")).data?.map(c => c.id) || [])
      .order("recorded_at", { ascending: false }),
    supabase
      .from("market_prices")
      .select("price_per_kg")
      .eq("business_id", biz.id)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("cost_entries")
      .select("cattle_id, amount, category, description, type")
      .eq("business_id", biz.id)
      .is("deleted_at", null)
      .not("cattle_id", "is", null),
    supabase
      .from("cattle_treatments")
      .select("cattle_id, vet_fee, additional_medical_cost, cattle!inner(business_id)")
      .eq("cattle.business_id", biz.id),
    supabase.rpc("get_cattle_consumptions", { p_business_id: biz.id }),
    supabase
      .from("inventory_items")
      .select("id, name, unit, kg_per_unit, roughage_active_from, roughage_active_until")
      .eq("business_id", biz.id)
      .not("roughage_active_from", "is", null),
    supabase
      .from("feed_recipes")
      .select("id, active_from, active_until, recipe_ingredients(item_id, qty_per_batch)")
      .eq("business_id", biz.id)
      .not("active_from", "is", null),
    supabase
      .from("inventory_transactions")
      .select("item_id, qty, unit_cost, inventory_items!inner(business_id)")
      .eq("inventory_items.business_id", biz.id)
      .eq("type", "purchase")
      .order("recorded_at", { ascending: false })
  ]);

  const marketPricePerKg = marketPriceData?.price_per_kg ?? biz.unit_price_bdt ?? 450;
  const defaultDailyGain = biz.default_daily_gain_kg ?? 0.8;
  const now = new Date();

  const cattleRaw = (cattleData ?? []) as any[];
  const weightLogs = (weightLogsData ?? []) as any[];
  const costEntries = (costEntriesData ?? []) as any[];
  const treatments = (treatmentsData ?? []) as any[];
  const feedConsumptions = (rpcFeedData ?? []) as any[];

  const feedCostByCattle: Record<string, number> = {};
  for (const t of feedConsumptions) {
    if (t.cattle_id) {
      feedCostByCattle[t.cattle_id] = (feedCostByCattle[t.cattle_id] ?? 0) + Number(t.total_cost || 0);
    }
  }

  const costsByCattle: Record<string, number> = {};
  for (const ce of costEntries) {
    if (ce.cattle_id) {
      costsByCattle[ce.cattle_id] = (costsByCattle[ce.cattle_id] ?? 0) + Number(ce.amount || 0);
    }
  }
  for (const t of treatments) {
    if (t.cattle_id) {
      costsByCattle[t.cattle_id] = (costsByCattle[t.cattle_id] ?? 0) + Number(t.vet_fee ?? 0) + Number(t.additional_medical_cost ?? 0);
    }
  }

  const weightPredictions = buildWeightPredictions(
    cattleRaw.map(c => ({
      cattleId: c.id,
      initialWeightKg: c.initial_weight_kg,
      purchaseDate: c.purchase_date,
      defaultDailyGainKg: defaultDailyGain,
    })),
    weightLogs.map(l => ({ cattle_id: l.cattle_id, weight_kg: l.weight_kg, recorded_at: l.recorded_at })),
    now
  );

  // Actual herd feeding allocated to each animal (see lib/inventory/herd-feed-share.ts)
  const herdFeedShare = await getHerdFeedShareByCattle(supabase, biz.id);
  for (const c of cattleRaw) {
    // Recorded herd feeding shared by head-days (actual), never a ration estimate
    feedCostByCattle[c.id] = (feedCostByCattle[c.id] ?? 0) + (herdFeedShare[c.id] ?? 0);
  }

  const cattle = cattleRaw.map(c => {
    const adg = c.expected_daily_gain_kg ? Number(c.expected_daily_gain_kg) : defaultDailyGain;
    const purchaseDateStr = c.purchase_date ? c.purchase_date : new Date(c.created_at || Date.now()).toISOString().split('T')[0];
    const purchaseDateObj = new Date(purchaseDateStr);
    const daysOnFarm = Math.max(1, Math.floor((now.getTime() - purchaseDateObj.getTime()) / (1000 * 60 * 60 * 24)));

    const cLogs = weightLogs.filter(l => l.cattle_id === c.id).sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
    const latestLog = cLogs[cLogs.length - 1];
    let baseWeight = c.initial_weight_kg ? Number(c.initial_weight_kg) : 250;
    let latestLogMs = new Date(purchaseDateStr + "T00:00:00").getTime();

    if (latestLog && latestLog.weight_kg) {
      baseWeight = Number(latestLog.weight_kg);
      latestLogMs = new Date(latestLog.recorded_at).getTime();
    }

    const daysSinceLastLog = Math.max(0, Math.floor((now.getTime() - latestLogMs) / (1000 * 60 * 60 * 24)));
    const expectedWeight = adg !== null && daysSinceLastLog > 0
      ? Math.min(650, parseFloat((baseWeight + adg * daysSinceLastLog).toFixed(1)))
      : baseWeight;
    const suggestedPrice = Math.round(expectedWeight * marketPricePerKg);

    const purchasePrice = Number(c.purchase_price || 0);
    const feedCost = feedCostByCattle[c.id] ?? 0;
    const directCosts = costsByCattle[c.id] ?? 0;

    // Use LivestockProfitabilityEngine with saleRevenue set to suggestedPrice matching valuation.ts
    const ledger = LivestockProfitabilityEngine.calculateAnimalUnitEconomics({
      cattleId: c.id,
      businessId: biz.id,
      tagId: c.tag_id,
      purchaseCost: purchasePrice,
      purchaseWeightKg: Number(c.initial_weight_kg || 200),
      currentWeightKg: expectedWeight,
      feedCost: feedCost,
      medicineCost: directCosts,
      transportCost: 0,
      saleRevenue: suggestedPrice,
      currentBiologicalValue: suggestedPrice,
      status: "active"
    });

    return {
      id: c.id,
      tag_id: c.tag_id,
      breed: c.breed,
      estimated_weight_kg: expectedWeight,
      suggested_market_price_bdt: suggestedPrice,
      market_price_per_kg: marketPricePerKg,
      purchase_price: purchasePrice,
      feed_cost: ledger.feedCost,
      medical_cost: ledger.medicineCost + ledger.vaccineCost,
      other_cost: ledger.transportCost,
      days_on_farm: daysOnFarm,
      total_cost_basis: ledger.totalAccumulatedCost,
      estimated_profit_bdt: ledger.netProfit,
      estimated_roi_pct: ledger.roiPct
    };
  });

  const existingTags = cattle.map((c) => c.tag_id);
  const existingBreeds = [...new Set(cattle.map((c) => c.breed).filter((b): b is string => Boolean(b)))].sort();

  return {
    success: true,
    cattle,
    existingTags,
    existingBreeds,
    inventoryItems: (inventoryData || []) as { id: string, name: string, unit: string, category: string }[],
  };
}

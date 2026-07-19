import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PartnerDashboard } from "@/components/partners/PartnerDashboard";
import { CapitalLedger, type CapitalTxn } from "@/components/partners/CapitalLedger";
import type { Partner, PartnerTransaction, ManagementFeeRate } from "@/types/database";
import { cookies } from "next/headers";
import { getDictionary } from "@/i18n/getDictionary";
import { buildWeightPredictions } from "@/lib/cattle-weight";
import { calculateAlgorithmicFeedCost, ROUGHAGE_TYPES } from "@/utils/feed-calculator";
import { PageHeader } from "@/components/shared/PageHeader";
import { Users } from "lucide-react";

export const metadata: Metadata = { title: "Partners" };

export default async function PartnersPage() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "bn" ? "bn" : "en";
  const dict = await getDictionary(locale as "en" | "bn");

  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? "";

  const { data: bizData } = await supabase
    .from("businesses")
    .select("id, unit_price_bdt, default_daily_gain_kg, default_roughage_type")
    .eq("owner_id", userId)
    .maybeSingle();

  const businessId: string | null = bizData?.id ?? null;
  // unit_price_bdt is no longer used for partners logic
  const dailyGainKg: number = bizData?.default_daily_gain_kg ?? 0.6;

  const [
    { data: partnersData },
    { data: txnsData },
    { data: salesData },
    { data: costsData },
    { data: feedData },
    { data: feeRatesData },
    // Active cattle for unrealized valuation
    { data: activeCattleData },
    // Latest weight log per cattle (most recent first)
    { data: weightLogsData },
    // Feed consumed per active cattle
    { data: activeFeedData },
    // Cost entries for active cattle
    { data: activeCostData },
    // Latest market price
    { data: marketPriceData },
    // Feed logic dependencies
    { data: recentPurchasesData },
    { data: roughagesData },
    { data: recipesData },
    { data: treatmentsData },
  ] = await Promise.all([
    businessId
      ? supabase
          .from("partners")
          .select("*")
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .order("joined_at", { ascending: true })
      : Promise.resolve({ data: [] }),

    businessId
      ? supabase
          .from("partner_transactions")
          .select("*, partners!inner(business_id)")
          .eq("partners.business_id", businessId)
          .is("deleted_at", null)
          .order("recorded_at", { ascending: false })
      : Promise.resolve({ data: [] }),

    businessId
      ? supabase
          .from("sales")
          .select("cattle_id, sale_price_total, cattle!inner(purchase_price, business_id)")
          .eq("cattle.business_id", businessId)
          .is("deleted_at", null)
      : Promise.resolve({ data: [] }),

    businessId
      ? supabase
          .from("cost_entries")
          .select("amount, entry_class, cattle_id, type")
          .eq("business_id", businessId)
          .is("deleted_at", null)
      : Promise.resolve({ data: [] }),

    businessId
      ? supabase.rpc("get_cattle_consumptions", { p_business_id: businessId })
      : Promise.resolve({ data: [] }),

    businessId
      ? supabase
          .from("management_fee_rates")
          .select("*")
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .order("effective_from", { ascending: false })
          .limit(1)
      : Promise.resolve({ data: [] }),

    // Active cattle: id, purchase_price, initial_weight_kg, purchase_date
    businessId
      ? supabase
          .from("cattle")
          .select("id, purchase_price, initial_weight_kg, purchase_date")
          .eq("business_id", businessId)
          .eq("status", "active")
      : Promise.resolve({ data: [] }),

    // Weight logs for all active cattle, newest first
    businessId
      ? supabase
          .from("weight_logs")
          .select("cattle_id, weight_kg, recorded_at, cattle!inner(business_id, status)")
          .eq("cattle.business_id", businessId)
          .eq("cattle.status", "active")
          .order("recorded_at", { ascending: false })
      : Promise.resolve({ data: [] }),

    // We reuse the single feedData RPC above instead of hitting the DB twice.
    Promise.resolve({ data: [] }),

    // Variable expense cost entries tied to specific cattle (matches finance page logic).
    // Exclude fixed costs and asset-classified entries — they don't belong in per-cattle cost basis.
    businessId
      ? supabase
          .from("cost_entries")
          .select("cattle_id, amount")
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .not("cattle_id", "is", null)
          .eq("type", "variable")
          .neq("entry_class", "asset")
      : Promise.resolve({ data: [] }),

    // Most recent market price
    businessId
      ? supabase
          .from("market_prices")
          .select("price_per_kg, date")
          .eq("business_id", businessId)
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
      
    // Feed dependencies
    businessId
      ? supabase
          .from("inventory_transactions")
          .select("item_id, unit_cost, inventory_items!inner(business_id)")
          .eq("inventory_items.business_id", businessId)
          .eq("type", "purchase")
          .order("recorded_at", { ascending: false })
          .limit(300)
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase
          .from("inventory_items")
          .select("id, name, unit, roughage_active_from, roughage_active_until")
          .eq("business_id", businessId)
          .not("roughage_active_from", "is", null)
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase
          .from("feed_recipes")
          .select("id, active_from, active_until, recipe_ingredients(item_id, qty_per_batch)")
          .eq("business_id", businessId)
          .not("active_from", "is", null)
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase
          .from("cattle_treatments")
          .select("cattle_id, vet_fee, additional_medical_cost, cattle!inner(business_id)")
          .eq("cattle.business_id", businessId)
      : Promise.resolve({ data: [] }),
  ]);

  const partners = (partnersData ?? []) as Partner[];
  const validPartnerIds = new Set(partners.map((p) => p.id));

  const transactions = ((txnsData ?? []) as (PartnerTransaction & {
    partners: { business_id: string };
  })[]).filter((t) => validPartnerIds.has(t.partner_id));

  // ── Realized P&L ────────────────────────────────────────────────────────────
  type SaleRow = { cattle_id: string; sale_price_total: number; cattle: { purchase_price: number | null } };
  const typedSales = (salesData ?? []) as SaleRow[];
  const totalRevenue = typedSales.reduce((s, r) => s + Number(r.sale_price_total ?? 0), 0);
  const soldCattleCosts = typedSales.reduce((s, r) => s + Number(r.cattle?.purchase_price ?? 0), 0);

  type CostRow = { amount: number; entry_class?: string; cattle_id?: string | null; type?: string };
  const typedCosts = (costsData ?? []) as CostRow[];

  // For realized P&L: only include costs that are NOT attributed to active (unsold) cattle.
  // Feed for active cattle is already excluded via feedCosts (sold+general only).
  // Medical and other per-cattle costs for active cattle are also unrealized and excluded here
  // to keep the treatment consistent — both feed and medical use the same logic.
  const activeCattleIdSetPL = new Set((activeCattleData ?? []).map((c) => (c as { id: string }).id));
  
  // Total medical treatments (exclude active cattle for realized operating costs)
  const allTreatments = (treatmentsData ?? []) as { cattle_id: string; vet_fee: number; additional_medical_cost: number }[];
  const realizedMedicalCosts = allTreatments
    .filter((t) => !activeCattleIdSetPL.has(t.cattle_id))
    .reduce((s, t) => s + Number(t.vet_fee ?? 0) + Number(t.additional_medical_cost ?? 0), 0);

  const operatingCosts = typedCosts
    .filter((c) => (c.entry_class ?? "expense") === "expense")
    .filter((c) => !c.cattle_id || !activeCattleIdSetPL.has(c.cattle_id))
    .reduce((s, c) => s + Number(c.amount ?? 0), 0) + realizedMedicalCosts;

  const totalAssetValue = typedCosts
    .filter((c) => c.entry_class === "asset")
    .reduce((s, c) => s + Number(c.amount ?? 0), 0);

  const soldCattleIdSet = new Set(typedSales.map((r) => r.cattle_id).filter(Boolean));
  const rpcFeedData = (feedData ?? []) as { cattle_id: string | null; category: string; total_cost: number }[];
  
  // netPL is calculated below, after unrealized valuation 

  // ── Unrealized Cattle Valuation ──────────────────────────────────────────────
  const marketPricePerKg: number = marketPriceData?.price_per_kg ?? 0;
  const marketPriceDate: string | null = marketPriceData?.date ?? null;

  const today = new Date();
  type ActiveCattleRow = { id: string; purchase_price: number; initial_weight_kg: number; purchase_date: string };
  const activeCattle = (activeCattleData ?? []) as ActiveCattleRow[];

  // Smart per-cattle weight predictions using actual gain rates
  const weightPredictions = buildWeightPredictions(
    activeCattle.map((c) => ({
      cattleId:           c.id,
      initialWeightKg:    c.initial_weight_kg,
      purchaseDate:       c.purchase_date,
      defaultDailyGainKg: dailyGainKg,
    })),
    ((weightLogsData ?? []) as { cattle_id: string; weight_kg: number; recorded_at: string }[])
      .map((l) => ({ cattle_id: l.cattle_id, weight_kg: l.weight_kg, recorded_at: l.recorded_at })),
    today
  );

  const feedCostByCattle: Record<string, number> = {};
  for (const t of rpcFeedData) {
    if (t.cattle_id) {
      feedCostByCattle[t.cattle_id] = (feedCostByCattle[t.cattle_id] ?? 0) + Number(t.total_cost);
    }
  }

  const costsByCattle: Record<string, number> = {};
  for (const c of (activeCostData ?? []) as { cattle_id: string | null; amount: number }[]) {
    if (c.cattle_id) {
      costsByCattle[c.cattle_id] = (costsByCattle[c.cattle_id] ?? 0) + Number(c.amount);
    }
  }
  for (const t of allTreatments) {
    if (t.cattle_id) {
      costsByCattle[t.cattle_id] = (costsByCattle[t.cattle_id] ?? 0) + Number(t.vet_fee ?? 0) + Number(t.additional_medical_cost ?? 0);
    }
  }

  const bizDefaultRoughage = bizData?.default_roughage_type ?? "straw";
  const defaultRoughageDm = ROUGHAGE_TYPES.find(r => r.id === bizDefaultRoughage)?.dmPercent ?? 0.90;

  const unitCostMap: Record<string, number> = {};
  for (const p of ((recentPurchasesData ?? []) as any[])) {
    if (p.unit_cost != null && !unitCostMap[p.item_id]) {
      unitCostMap[p.item_id] = p.unit_cost; 
    }
  }
  const roughages = (roughagesData ?? []) as { id: string; roughage_active_from: string; roughage_active_until: string | null }[];
  const recipes = (recipesData ?? []) as { active_from: string; active_until: string | null; recipe_ingredients: { item_id: string; qty_per_batch: number }[] }[];

  const cattleValuationRows = activeCattle.map((c) => {
    const startMs = new Date(c.purchase_date + "T00:00:00").getTime();
    const daysInPen = Math.max(0, Math.floor((today.getTime() - startMs) / 86400000));
    
    const pred = weightPredictions[c.id];
    const estimatedWeight = pred?.predictedWeight ?? (c.initial_weight_kg + daysInPen * dailyGainKg);
    const weightSource: "weighed" | "estimated" =
      pred?.source === "weighed" || pred?.source === "weighed+predicted" ? "weighed" : "estimated";

    // Algorithmic Feed Cost fallback for valuation
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
    const unrealizedGain = estimatedMarketValue - costBasis;

    return { id: c.id, daysInPen, estimatedWeight, weightSource, estimatedMarketValue, costBasis, unrealizedGain };
  });

  // Re-calculate feedCosts (Realized) after attributing algorithmic feed to active cattle
  // Any feed cost not attributed to an active cattle is considered realized (consumed by sold/dead or wasted)
  const totalFeedCostAllTime = rpcFeedData.reduce((s, t) => s + Number(t.total_cost ?? 0), 0);
  const activeCattleFeedCost = activeCattle.reduce((s, c) => s + (feedCostByCattle[c.id] ?? 0), 0);
  const realizedFeedCosts = Math.max(0, totalFeedCostAllTime - activeCattleFeedCost);

  // Update netPL using the accurate realizedFeedCosts
  const netPL = totalRevenue - soldCattleCosts - operatingCosts - realizedFeedCosts;

  const totalEstimatedValue = cattleValuationRows.reduce((s, r) => s + r.estimatedMarketValue, 0);
  const totalActiveCostBasis = cattleValuationRows.reduce((s, r) => s + r.costBasis, 0);

  const totalUnrealizedGain = totalEstimatedValue - totalActiveCostBasis;

  const cattleValuation = {
    activeCattleCount: activeCattle.length,
    marketPricePerKg,
    marketPriceDate,
    totalEstimatedValue,
    totalActiveCostBasis,
    totalUnrealizedGain,
    hasMarketPrice: marketPricePerKg > 0,
    rows: cattleValuationRows,
  };

  // ── Management fee ────────────────────────────────────────────────────────────
  const feeRates = (feeRatesData ?? []) as ManagementFeeRate[];
  const currentFeeRate = feeRates[0]?.rate_percent ?? 0;

  // ── Capital Ledger ────────────────────────────────────────────────────────────
  const partnerNameById: Record<string, string> = {};
  for (const p of partners) partnerNameById[p.id] = p.name;

  const capitalTxns: CapitalTxn[] = transactions
    .filter((t) => t.type === "investment" || t.type === "withdrawal")
    .map((t) => ({
      id: t.id,
      partner_id: t.partner_id,
      partner_name: partnerNameById[t.partner_id] ?? "Unknown",
      amount: t.amount,
      type: t.type as "investment" | "withdrawal",
      recorded_at: t.recorded_at,
      notes: t.notes,
    }));

  const txnsByPartner: Record<string, PartnerTransaction[]> = {};
  for (const txn of transactions) {
    if (!txnsByPartner[txn.partner_id]) txnsByPartner[txn.partner_id] = [];
    txnsByPartner[txn.partner_id].push(txn);
  }

  return (
    <div className="space-y-5">
      <PageHeader title={dict.partners.title} subtitle={dict.partners.subtitle} icon={Users} />
      <PartnerDashboard
        partners={partners}
        txnsByPartner={txnsByPartner}
        netPL={netPL}
        mgmtFeeRate={currentFeeRate}
        cattleValuation={cattleValuation}
        totalAssetValue={totalAssetValue}
      />
      <div className="rounded-xl border border-border/60 bg-card shadow-card px-6 py-5">
        <CapitalLedger
          transactions={capitalTxns}
          partners={partners.map((p) => ({ id: p.id, name: p.name }))}
          mgmtFeeRate={currentFeeRate}
        />
      </div>
    </div>
  );
}

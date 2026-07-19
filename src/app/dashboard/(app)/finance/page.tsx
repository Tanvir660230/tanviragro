import type { Metadata } from "next";
import { Suspense } from "react";
import { SellTodaySummary } from "@/components/finance/SellTodaySummary";
import { FinanceHero, FinanceHeroSkeleton } from "@/components/finance/FinanceHero";
import { createClient } from "@/lib/supabase/server";
import { CostList, type CostEntry, type InventoryPurchaseEntry } from "@/components/finance/CostList";
import { AssetTabPanel, type SimpleFixedAsset } from "@/components/finance/AssetTabPanel";
import { computeDepreciation } from "@/lib/accounting/engine";
import { PLSummary, type SaleRecord } from "@/components/finance/PLSummary";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { FinanceAnalyticsWithFilter } from "@/components/finance/FinanceAnalyticsWithFilter";
import { BudgetForecastPanel } from "@/components/finance/BudgetForecastPanel";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { TransactionStatement } from "@/components/finance/TransactionStatement";
import { WhatIfCalculator } from "@/components/finance/WhatIfCalculator";
import type { WhatIfCattle } from "@/components/finance/WhatIfCalculator";
import { LoanDashboard } from "@/components/finance/LoanDashboard";
import type { LoanRow } from "@/components/finance/LoanDashboard";
import { getCurrentBusiness } from "@/lib/supabase/get-business";
import { buildWeightPredictions } from "@/lib/cattle-weight";
import { calculateAlgorithmicFeedCost, ROUGHAGE_TYPES } from "@/utils/feed-calculator";
import { MarketPriceCard } from "@/components/finance/MarketPriceCard";

export const metadata: Metadata = { title: "Finance & P&L" };

function computeFinanceDateRange(
  fp: string | undefined,
  fs: string | undefined,
  fe: string | undefined,
  fiscalYearStartMonth = 7,   // 1-based; default July for Bangladesh
): { start: string | null; end: string | null } {
  const today    = new Date();
  const todayStr = today.toISOString().split("T")[0];

  if (fp === "all") return { start: null, end: null };
  if (!fp && fs)    return { start: fs, end: fe ?? todayStr };

  const preset = fp ?? "this-month";

  if (preset === "last-month") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end   = new Date(today.getFullYear(), today.getMonth(),     0);
    return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
  }
  if (preset === "last-3m") {
    const start = new Date(today.getFullYear(), today.getMonth() - 3, 1);
    return { start: start.toISOString().split("T")[0], end: todayStr };
  }
  if (preset === "this-year") {
    // Use the business's configured fiscal year start month (1-indexed).
    // Build date string directly (avoids toISOString() UTC-offset bug on non-UTC servers).
    const fyMonth0 = fiscalYearStartMonth - 1; // 0-indexed for getMonth() comparison
    const currentMonth = today.getMonth();
    const fyYear = currentMonth >= fyMonth0 ? today.getFullYear() : today.getFullYear() - 1;
    const fyMonthStr = String(fiscalYearStartMonth).padStart(2, "0");
    return { start: `${fyYear}-${fyMonthStr}-01`, end: todayStr };
  }

  // Default / "this-month"
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return { start: start.toISOString().split("T")[0], end: todayStr };
}

export default async function FinancePage(props: {
  searchParams: Promise<{ bd?: string; fp?: string; fs?: string; fe?: string }>;
}) {
  const { bd, fp, fs, fe } = await props.searchParams;
  const budgetDays = Math.min(365, Math.max(7, parseInt(bd ?? "90") || 90));

  const supabase = await createClient();
  const biz = await getCurrentBusiness(supabase);
  const fiscalYearStartMonth: number = biz?.fiscal_year_start_month ?? 7;
  const { start: filterStart, end: filterEnd } = computeFinanceDateRange(fp, fs, fe, fiscalYearStartMonth);
  const businessId = biz?.id ?? null;
  const bizName: string = biz?.name ?? "Farm";

  const [
    { data: costsData },
    { data: salesData },
    { data: activeCattleData },
    { data: monthlyConsumptionsData },
    { data: cattleConsumptionsData },
    { data: bizConfig },
    { data: loansData },
    { data: invPurchasesData },
    { data: weightLogsData },
    { data: rawFixedAssetsData },
    { data: treatmentsData },
    { data: deadCattleData },
    { data: recentPurchasesData },
    { data: roughagesData },
    { data: recipesData },
  ] = await Promise.all([
    businessId
      ? supabase
          .from("cost_entries")
          .select("id, type, entry_class, category, amount, recorded_at, description, cattle_id")
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .order("recorded_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase
          .from("sales")
          .select(
            "id, cattle_id, sold_at, sale_price_total, weight_at_sale_kg, buyer_name, cattle!inner(tag_id, purchase_price, initial_weight_kg, purchase_date, business_id)"
          )
          .eq("cattle.business_id", businessId)
          .is("deleted_at", null)
          .order("sold_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase
          .from("cattle")
          .select("id, tag_id, purchase_price, initial_weight_kg, purchase_date")
          .eq("business_id", businessId)
          .eq("status", "active")
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase.rpc("get_monthly_consumptions", { p_business_id: businessId })
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase.rpc("get_cattle_consumptions", { p_business_id: businessId })
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase.from("businesses").select("unit_price_bdt, default_daily_gain_kg, default_roughage_type").eq("id", businessId).maybeSingle()
      : Promise.resolve({ data: null }),
    businessId
      ? supabase
          .from("loans")
          .select("*, loan_payments(id, amount, paid_at, notes)")
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .order("loan_date", { ascending: false })
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase
          .from("inventory_transactions")
          .select("id, qty, unit_cost, recorded_at, notes, inventory_items!inner(name, category, unit, business_id)")
          .eq("inventory_items.business_id", businessId)
          .eq("type", "purchase")
          .not("unit_cost", "is", null)
          .order("recorded_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase
          .from("weight_logs")
          .select("cattle_id, weight_kg, recorded_at, cattle!inner(business_id, status)")
          .eq("cattle.business_id", businessId)
          .eq("cattle.status", "active")
          .is("deleted_at", null)
          .order("recorded_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase
          .from("fixed_assets")
          .select("id, name, category, description, purchase_date, purchase_cost, salvage_value, useful_life_years, depreciation_method, declining_rate, disposed_at")
          .eq("business_id", businessId)
          .eq("is_active", true)
          .order("purchase_date", { ascending: false })
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase
          .from("cattle_treatments")
          .select("cattle_id, vet_fee, additional_medical_cost, cattle!inner(business_id)")
          .eq("cattle.business_id", businessId)
      : Promise.resolve({ data: [] }),
    // Dead cattle purchase prices are a realized loss — they are not sales revenue,
    // not in activeCattle, so they would be invisible in P&L without this query.
    businessId
      ? supabase
          .from("cattle")
          .select("purchase_price")
          .eq("business_id", businessId)
          .eq("status", "dead")
          .is("deleted_at", null)
      : Promise.resolve({ data: [] }),
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
  ]);

  const entries: CostEntry[] = (costsData ?? []) as CostEntry[];
  // Assets are NOT operating costs — separate them before any P&L calculation
  const expenseEntries = entries.filter((e) => (e.entry_class ?? "expense") === "expense");
  const assetEntries   = entries.filter((e) => e.entry_class === "asset");
  const totalAssetValue = assetEntries.reduce((s, e) => s + Number(e.amount), 0);

  type RawFixedAsset = {
    id: string; name: string; category: string; description: string | null;
    purchase_date: string; purchase_cost: number; salvage_value: number;
    useful_life_years: number; depreciation_method: string; declining_rate: number | null;
    disposed_at: string | null;
  };
  const fixedAssets: SimpleFixedAsset[] = ((rawFixedAssetsData ?? []) as RawFixedAsset[]).map((a) => {
    // Supabase numeric columns come back as strings — coerce before passing to arithmetic.
    const dep = computeDepreciation({
      ...a,
      purchase_cost:     Number(a.purchase_cost),
      salvage_value:     Number(a.salvage_value),
      useful_life_years: Number(a.useful_life_years),
      declining_rate:    a.declining_rate != null ? Number(a.declining_rate) : null,
    });
    return {
      id: a.id,
      name: a.name,
      category: a.category,
      description: a.description,
      purchaseDate: a.purchase_date,
      purchaseCost: Number(a.purchase_cost),
      bookValue: dep.bookValue,
      annualDepreciation: dep.annual,
      usefulLifeYears: a.useful_life_years,
    };
  });

  const sales: SaleRecord[] = (salesData ?? []).map(
    (r: {
      id: string;
      cattle_id: string;
      sold_at: string;
      sale_price_total: number;
      weight_at_sale_kg: number | null;
      buyer_name: string | null;
      cattle: { tag_id: string; purchase_price: number; initial_weight_kg: number; purchase_date: string };
    }) => ({
      id: r.id,
      cattle_id: r.cattle_id,
      sold_at: r.sold_at,
      sale_price_total: Number(r.sale_price_total),
      weight_at_sale_kg: r.weight_at_sale_kg ? Number(r.weight_at_sale_kg) : null,
      buyer_name: r.buyer_name,
      cattle_tag: r.cattle?.tag_id ?? undefined,
      purchase_price: Number(r.cattle?.purchase_price ?? 0),
      initial_weight_kg: r.cattle?.initial_weight_kg ? Number(r.cattle?.initial_weight_kg) : 0,
      purchase_date: r.cattle?.purchase_date ?? undefined,
    })
  );

  type ActiveCattleRow = { id: string; tag_id: string; purchase_price: number; initial_weight_kg: number; purchase_date: string };
  const activeCattleList = (activeCattleData ?? []) as ActiveCattleRow[];
  const unrealizedInvestment = activeCattleList.reduce((s, c) => s + Number(c.purchase_price), 0);
  const activeCattleCount = activeCattleList.length;
  const deadCattlePurchaseCost = ((deadCattleData ?? []) as { purchase_price: number | null }[])
    .reduce((s, c) => s + Number(c.purchase_price ?? 0), 0);

  const monthlyConsumptions = (monthlyConsumptionsData ?? []) as { month_yr: string; category: string; total_cost: number }[];
  const cattleConsumptions  = (cattleConsumptionsData ?? [])  as { cattle_id: string; category: string; total_cost: number }[];

  // Period-filtered subsets for P&L and Cost List — expenses only for P&L
  const filteredEntries: CostEntry[] = filterStart
    ? expenseEntries.filter(e => {
        const d = e.recorded_at.slice(0, 10);
        return d >= filterStart! && (!filterEnd || d <= filterEnd);
      })
    : expenseEntries;

  const filteredSales: SaleRecord[] = filterStart
    ? sales.filter(s => {
        const d = s.sold_at.slice(0, 10);
        return d >= filterStart! && (!filterEnd || d <= filterEnd);
      })
    : sales;

  const filteredMonthly = filterStart
    ? monthlyConsumptions.filter(item => {
        const m = item.month_yr; // "YYYY-MM"
        return m >= filterStart!.slice(0, 7) && (!filterEnd || m <= filterEnd.slice(0, 7));
      })
    : monthlyConsumptions;

  // Totals for PLSummary — from expense entries only (assets excluded)
  const totalFixedCosts = filteredEntries
    .filter((e) => e.type === "fixed")
    .reduce((s, e) => s + Number(e.amount), 0);
  const totalVariableCosts = filteredEntries
    .filter((e) => e.type === "variable" && !e.cattle_id)
    .reduce((s, e) => s + Number(e.amount), 0);
  // Use all-time consumption totals so generalFeed/generalOtherInv in PLSummary stay
  // consistent with the all-time per-cattle cost maps (feedCostByCattle, directCostByCattle).
  // Period filtering of feed/inventory is already captured via the per-cattle COGS figures.
  const totalFeedCosts = monthlyConsumptions
    .filter((m) => m.category === "feed")
    .reduce((s, m) => s + Number(m.total_cost), 0);
  const totalOtherInventoryCosts = monthlyConsumptions
    .filter((m) => m.category !== "feed")
    .reduce((s, m) => s + Number(m.total_cost), 0);

  // Per-cattle cost maps stay all-time (used for per-head margin on sold cattle)
  const feedCostByCattle: Record<string, number> = {};
  for (const c of cattleConsumptions.filter(c => c.category === "feed")) {
    feedCostByCattle[c.cattle_id] = (feedCostByCattle[c.cattle_id] ?? 0) + Number(c.total_cost);
  }

  // Inventory-only per-cattle direct costs (from RPC, no vet cost_entries).
  // Used for generalOtherInv in PLSummary to avoid over-subtracting from the inventory ceiling.
  const directInventoryCostByCattle: Record<string, number> = {};
  for (const c of cattleConsumptions.filter(c => c.category !== "feed")) {
    directInventoryCostByCattle[c.cattle_id] = (directInventoryCostByCattle[c.cattle_id] ?? 0) + Number(c.total_cost);
  }

  // Combined per-cattle direct costs: inventory consumption + vet cost_entries + cattle_treatments.
  // cattle_treatments (vet_fee + additional_medical_cost) is fetched separately because
  // medical-actions.ts writes to that table rather than cost_entries — without this merge
  // all treatment fees would be invisible in the P&L.
  const directCostByCattle: Record<string, number> = { ...directInventoryCostByCattle };
  for (const e of expenseEntries) {
    if (e.cattle_id && e.type === "variable") {
      directCostByCattle[e.cattle_id] = (directCostByCattle[e.cattle_id] ?? 0) + e.amount;
    }
  }
  for (const t of (treatmentsData ?? []) as { cattle_id: string; vet_fee: number | null; additional_medical_cost: number | null }[]) {
    const vetCost = Number(t.vet_fee ?? 0) + Number(t.additional_medical_cost ?? 0);
    if (vetCost > 0) {
      directCostByCattle[t.cattle_id] = (directCostByCattle[t.cattle_id] ?? 0) + vetCost;
    }
  }

  type RawLoan = Omit<LoanRow, "payments"> & { loan_payments: LoanRow["payments"] };
  const loans: LoanRow[] = ((loansData ?? []) as RawLoan[]).map((l) => ({
    ...l,
    payments: (l.loan_payments ?? []).sort(
      (a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()
    ),
  }));
  const activeLoanCount = loans.filter((l) => l.status === "active").length;

  type InvPurchaseRow = {
    id: string;
    qty: number;
    unit_cost: number;
    recorded_at: string;
    notes: string | null;
    inventory_items: { name: string; category: string; unit: string } | null;
  };
  const inventoryPurchases: InventoryPurchaseEntry[] = ((invPurchasesData ?? []) as InvPurchaseRow[]).map((r) => ({
    id: r.id,
    item_name: r.inventory_items?.name ?? "Item",
    item_category: r.inventory_items?.category ?? "other",
    qty: Number(r.qty),
    unit: r.inventory_items?.unit ?? "",
    unit_cost: Number(r.unit_cost),
    amount: Number(r.qty) * Number(r.unit_cost),
    recorded_at: r.recorded_at,
    notes: r.notes,
  }));

  const defaultMarketPricePerKg: number = (bizConfig as { unit_price_bdt?: number } | null)?.unit_price_bdt ?? 0;
  const defaultDailyGainKg: number = (bizConfig as { default_daily_gain_kg?: number } | null)?.default_daily_gain_kg ?? 0.6;
  const bizDefaultRoughage = (bizConfig as { default_roughage_type?: string } | null)?.default_roughage_type ?? "straw";
  const defaultRoughageDm = ROUGHAGE_TYPES.find(r => r.id === bizDefaultRoughage)?.dmPercent ?? 0.90;

  const unitCostMap: Record<string, number> = {};
  for (const p of ((recentPurchasesData ?? []) as any[])) {
    if (p.unit_cost != null && !unitCostMap[p.item_id]) {
      unitCostMap[p.item_id] = p.unit_cost; // First one found is most recent
    }
  }
  
  const roughages = (roughagesData ?? []) as { id: string; roughage_active_from: string; roughage_active_until: string | null }[];
  const recipes = (recipesData ?? []) as { active_from: string; active_until: string | null; recipe_ingredients: { item_id: string; qty_per_batch: number }[] }[];

  const weightPredictions = buildWeightPredictions(
    activeCattleList.map((c) => ({
      cattleId: c.id,
      initialWeightKg: c.initial_weight_kg,
      purchaseDate: c.purchase_date,
      defaultDailyGainKg,
    })),
    ((weightLogsData ?? []) as { cattle_id: string; weight_kg: number; recorded_at: string }[])
      .map((l) => ({ cattle_id: l.cattle_id, weight_kg: l.weight_kg, recorded_at: l.recorded_at }))
  );
  const nowMs = new Date().getTime();
  // Apply Algorithmic Feed Cost fallback for any cattle without direct feed logs
  for (const c of activeCattleList) {
    if ((feedCostByCattle[c.id] ?? 0) === 0) {
      const startMs = new Date(c.purchase_date + "T00:00:00").getTime();
      const daysInPen = Math.max(0, Math.floor((nowMs - startMs) / 86400000));
      const latestWeight = weightPredictions[c.id]?.predictedWeight ?? c.initial_weight_kg;
      
      const { allocatedFeedCost } = calculateAlgorithmicFeedCost({
        daysInPen,
        startMs,
        recipes,
        roughages,
        unitCostMap,
        feedData: {
          initialWeightKg: c.initial_weight_kg ?? 0,
          latestLoggedWeightKg: latestWeight,
          lastWeighedAt: null,
          purchaseDate: c.purchase_date ?? "",
          expectedDailyGainKg: defaultDailyGainKg,
          roughageDmPercent: defaultRoughageDm,
        },
        overrideRoughage: null,
      });
      feedCostByCattle[c.id] = allocatedFeedCost;
    }
  }

  for (const s of sales) {
    if ((feedCostByCattle[s.cattle_id] ?? 0) === 0 && s.purchase_date) {
      const startMs = new Date(s.purchase_date + "T00:00:00").getTime();
      const daysInPen = Math.max(0, Math.floor((new Date(s.sold_at + "T00:00:00").getTime() - startMs) / 86400000));
      const latestWeight = s.weight_at_sale_kg ?? s.initial_weight_kg;
      
      const { allocatedFeedCost } = calculateAlgorithmicFeedCost({
        daysInPen,
        startMs,
        recipes,
        roughages,
        unitCostMap,
        feedData: {
          initialWeightKg: s.initial_weight_kg ?? 0,
          latestLoggedWeightKg: latestWeight ?? null,
          lastWeighedAt: s.sold_at,
          purchaseDate: s.purchase_date,
          expectedDailyGainKg: defaultDailyGainKg,
          roughageDmPercent: defaultRoughageDm,
        },
        overrideRoughage: null,
      });
      feedCostByCattle[s.cattle_id] = allocatedFeedCost;
    }
  }

  const allTimeCattleCount = activeCattleList.length + sales.length + ((deadCattleData ?? []) as any[]).length;
  const totalAttributedFeed = Object.values(feedCostByCattle).reduce((a, b) => a + b, 0);
  const unattributedFeed = Math.max(0, totalFeedCosts - totalAttributedFeed);
  
  const totalAttributedInv = Object.values(directInventoryCostByCattle).reduce((a, b) => a + b, 0);
  const unattributedInv = Math.max(0, totalOtherInventoryCosts - totalAttributedInv);

  const allTimeFixedCosts = expenseEntries
    .filter((e) => e.type === "fixed")
    .reduce((s, e) => s + Number(e.amount), 0);
  const allTimeVariableCosts = expenseEntries
    .filter((e) => e.type === "variable" && !e.cattle_id)
    .reduce((s, e) => s + Number(e.amount), 0);

  const overheadPerHead = allTimeCattleCount > 0 
    ? (allTimeFixedCosts + allTimeVariableCosts + unattributedFeed + unattributedInv) / allTimeCattleCount
    : 0;

  const whatIfCattle: WhatIfCattle[] = activeCattleList.map((c) => {
    const finalFeedCost = feedCostByCattle[c.id] ?? 0;
    return {
      id: c.id,
      tag_id: c.tag_id,
      initial_weight_kg: c.initial_weight_kg,
      purchase_date: c.purchase_date,
      purchase_price: Number(c.purchase_price),
      latestWeight: weightPredictions[c.id]?.predictedWeight ?? null,
      weightIsEstimated: weightPredictions[c.id]?.source === "estimated",
      feed_cost: finalFeedCost,
      direct_cost: directCostByCattle[c.id] ?? 0,
      overhead_cost: 0, // Overhead explicitly requested to be removed by user
      totalCostBasis:
        Number(c.purchase_price) +
        finalFeedCost +
        (directCostByCattle[c.id] ?? 0),
    };
  });

  // ── Period stats for FinanceHero ────────────────────────────
  const periodRevenueFH    = filteredSales.reduce((s, r) => s + Number(r.sale_price_total), 0);
  const periodFeedInvCosts = filteredMonthly.reduce((s, m) => s + Number(m.total_cost), 0);
  const periodOpCosts      = totalFixedCosts + totalVariableCosts + periodFeedInvCosts;
  const periodNetPLFH      = periodRevenueFH - periodOpCosts;
  const activePeriodStr    = fp ?? "this-month";

  return (
    <div className="space-y-4">
      {/* ── Finance Hero — unified header, period tabs, KPIs, alerts ── */}
      <Suspense fallback={<FinanceHeroSkeleton />}>
        <FinanceHero
          periodRevenue={periodRevenueFH}
          periodOperatingCosts={periodOpCosts}
          periodNetPL={periodNetPLFH}
          salesCount={filteredSales.length}
          costsCount={filteredEntries.length}
          activePeriod={activePeriodStr}
        />
      </Suspense>

      {/* ── Market Price Log ── */}
      <Suspense fallback={null}>
        <MarketPriceCard />
      </Suspense>

      {/* ── Finance Tabs ── */}
      <FinanceTabs
        salesCount={filteredSales.length}
        costsCount={filteredEntries.length}
        assetCount={assetEntries.length + fixedAssets.length}
        loansCount={activeLoanCount}
        plSummary={
          <div className="space-y-4">
            <Suspense fallback={null}>
              <SellTodaySummary overheadPerHead={overheadPerHead} />
            </Suspense>
            <PLSummary
              sales={filteredSales}
              totalFixedCosts={totalFixedCosts}
              totalVariableCosts={totalVariableCosts}
              totalFeedCosts={totalFeedCosts}
              totalOtherInventoryCosts={totalOtherInventoryCosts}
              feedCostByCattle={feedCostByCattle}
              directCostByCattle={directCostByCattle}
              directInventoryCostByCattle={directInventoryCostByCattle}
              unrealizedInvestment={unrealizedInvestment}
              activeCattleCount={activeCattleCount}
              activeCattleIds={activeCattleList.map((c) => c.id)}
              totalAssetValue={totalAssetValue}
              bizName={bizName}
              deadCattlePurchaseCost={deadCattlePurchaseCost}
              overheadPerHead={overheadPerHead}
            />
            <ErrorBoundary label="Finance Analytics">
              <FinanceAnalyticsWithFilter
                allSales={sales}
                allCosts={expenseEntries}
                monthlyConsumptions={monthlyConsumptions}
                unrealizedInvestment={unrealizedInvestment}
                feedCostByCattle={feedCostByCattle}
                directCostByCattle={directCostByCattle}
              />
            </ErrorBoundary>
          </div>
        }
        costList={<CostList entries={filteredEntries} inventoryPurchases={inventoryPurchases} />}
        assets={<AssetTabPanel costAssets={assetEntries} fixedAssets={fixedAssets} />}
        budget={<ErrorBoundary label="Budget Forecast"><BudgetForecastPanel days={budgetDays} /></ErrorBoundary>}
        loans={<LoanDashboard loans={loans} />}
        statement={<TransactionStatement />}
        whatif={
          <WhatIfCalculator
            cattle={whatIfCattle}
            defaultMarketPricePerKg={defaultMarketPricePerKg}
            defaultDailyGainKg={defaultDailyGainKg}
          />
        }
      />
    </div>
  );
}

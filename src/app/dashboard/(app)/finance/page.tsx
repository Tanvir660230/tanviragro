import type { Metadata } from "next";
import { Suspense } from "react";
import { SellTodaySummary } from "@/components/finance/SellTodaySummary";
import { AddCostDialog } from "@/components/finance/AddCostDialog";
import { CapitalSummaryCard } from "@/components/finance/CapitalSummaryCard";
import { createClient } from "@/lib/supabase/server";
import { CostList, type CostEntry, type InventoryPurchaseEntry, type TreatmentFeeEntry } from "@/components/finance/CostList";
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
import { MarketPriceCard } from "@/components/finance/MarketPriceCard";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PERMISSIONS } from "@/constants/roles";
import { getHerdFeedShareByCattle } from "@/lib/inventory/herd-feed-share";
import { loadMonthlyConsumptions } from "@/lib/inventory/consumption-stats";
import { PageHeader } from "@/components/shared/PageHeader";
import { Landmark } from "lucide-react";
import { addDays, startOfMonth, todayDhaka } from "@/lib/dates";


export const metadata: Metadata = { title: "Finance & P&L" };

function computeFinanceDateRange(
  fp: string | undefined,
  fs: string | undefined,
  fe: string | undefined,
  fiscalYearStartMonth = 7,   // 1-based; default July for Bangladesh
): { start: string | null; end: string | null } {
  // Dhaka calendar dates as strings: toISOString() gave the UTC date (yesterday before 06:00)
  // and shifted month starts by a day on a UTC+6 machine.
  const todayStr = todayDhaka();
  const year = Number(todayStr.slice(0, 4));
  const month = Number(todayStr.slice(5, 7));   // 1-based
  const ym = (y: number, m: number) => {        // m may be ≤ 0: roll back into earlier years
    const t = y * 12 + (m - 1);
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
  };

  if (fp === "all") return { start: null, end: null };
  if (!fp && fs)    return { start: fs, end: fe ?? todayStr };

  const preset = fp ?? "this-month";

  if (preset === "last-month") {
    const start = `${ym(year, month - 1)}-01`;
    return { start, end: addDays(`${ym(year, month)}-01`, -1) };
  }
  if (preset === "last-3m") {
    return { start: `${ym(year, month - 3)}-01`, end: todayStr };
  }
  if (preset === "this-year") {
    const fyYear = month >= fiscalYearStartMonth ? year : year - 1;
    return { start: `${fyYear}-${String(fiscalYearStartMonth).padStart(2, "0")}-01`, end: todayStr };
  }

  // Default / "this-month"
  return { start: startOfMonth(todayStr), end: todayStr };
}

export default async function FinancePage(props: {
  searchParams: Promise<{ bd?: string; fp?: string; fs?: string; fe?: string }>;
}) {
  await requirePagePermission(PERMISSIONS.FINANCE_VIEW);
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
      ? loadMonthlyConsumptions(supabase, businessId).then((data) => ({ data }))   // feed eaten, net of undos
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase.rpc("get_cattle_consumptions", { p_business_id: businessId })
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase.from("businesses").select("default_daily_gain_kg, default_roughage_type").eq("id", businessId).maybeSingle()
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
          .eq("movement_type", "purchase")
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
          .select("id, name, category, description, purchase_date, purchase_cost, salvage_value, useful_life_years, depreciation_method, declining_rate, disposed_at, source_cost_entry_id")
          .eq("business_id", businessId)
          .eq("is_active", true)
          .order("purchase_date", { ascending: false })
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase
          .from("cattle_treatments")
          .select("id, cattle_id, vet_fee, additional_medical_cost, treated_at, diagnosis, cattle!inner(business_id, tag_id)")
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
  ]);


  const entries: CostEntry[] = (costsData ?? []) as CostEntry[];
  // Assets are NOT operating costs — separate them before any P&L calculation
  const expenseEntries = entries.filter((e) => (e.entry_class ?? "expense") === "expense");
  const allAssetEntries = entries.filter((e) => e.entry_class === "asset");

  type RawFixedAsset = {
    id: string; name: string; category: string; description: string | null;
    purchase_date: string; purchase_cost: number; salvage_value: number;
    useful_life_years: number; depreciation_method: string; declining_rate: number | null;
    disposed_at: string | null;
    source_cost_entry_id: string | null;
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
  // An asset payment that has a fixed-asset record is shown (and valued, depreciated) through that
  // record only — listing both showed the same purchase twice.
  const linkedPaymentIds = new Set(((rawFixedAssetsData ?? []) as RawFixedAsset[]).map((a) => a.source_cost_entry_id).filter(Boolean));
  const assetEntries = allAssetEntries.filter((e) => !linkedPaymentIds.has(e.id));
  // asset value = fixed assets after depreciation + asset payments without a fixed-asset record
  const totalAssetValue = fixedAssets.reduce((s, a) => s + a.bookValue, 0) + assetEntries.reduce((s, e) => s + Number(e.amount), 0);

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

  // vet fees live on the treatment rows; the expense list shows them for the same period
  const treatmentFees: TreatmentFeeEntry[] = ((treatmentsData ?? []) as unknown as { id: string; cattle_id: string; vet_fee: number | null; additional_medical_cost: number | null; treated_at: string; diagnosis: string | null; cattle: { tag_id: string | null } | null }[])
    .map((t) => ({ id: t.id, cattle_id: t.cattle_id, date: String(t.treated_at).slice(0, 10), tag: t.cattle?.tag_id ?? null, diagnosis: t.diagnosis, amount: Number(t.vet_fee ?? 0) + Number(t.additional_medical_cost ?? 0) }))
    .filter((t) => t.amount > 0 && (!filterStart || (t.date >= filterStart && (!filterEnd || t.date <= filterEnd))))
    .sort((a, b) => b.date.localeCompare(a.date));

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

  // What-if starts from the latest price in the market price log (it used the old ৳1,000 "unit share" value)
  const { data: lastMarket } = businessId
    ? await supabase.from("market_prices").select("price_per_kg").eq("business_id", businessId).order("date", { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const defaultMarketPricePerKg: number = Number((lastMarket as { price_per_kg?: number } | null)?.price_per_kg ?? 0);
  const defaultDailyGainKg: number = (bizConfig as { default_daily_gain_kg?: number } | null)?.default_daily_gain_kg ?? 0.6;

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
  // Actual herd feeding allocated to each animal (see lib/inventory/herd-feed-share.ts)
  const herdFeedShare = await getHerdFeedShareByCattle(supabase, businessId);
  // Apply Algorithmic Feed Cost fallback for any cattle without direct feed logs
  for (const c of activeCattleList) {
    // Recorded herd feeding shared by head-days (actual), never a ration estimate
    feedCostByCattle[c.id] = (feedCostByCattle[c.id] ?? 0) + (herdFeedShare[c.id] ?? 0);
  }

  for (const s of sales) {
    // Recorded herd feeding shared by head-days (actual), never a ration estimate
    feedCostByCattle[s.cattle_id] = (feedCostByCattle[s.cattle_id] ?? 0) + (herdFeedShare[s.cattle_id] ?? 0);
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

  return (
    <div className="space-y-6">
      <PageHeader title="Money" icon={Landmark} actions={<AddCostDialog />} className="mb-0" />
      <Suspense fallback={null}>
        <CapitalSummaryCard />
      </Suspense>
      {/* ── Market Price Log ── */}
      <Suspense fallback={null}>
        <MarketPriceCard />
      </Suspense>

      {/* ── Legacy Analytics & Statement Tabs ── */}
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
        costList={<CostList entries={filteredEntries} inventoryPurchases={inventoryPurchases} treatmentFees={treatmentFees} />}
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

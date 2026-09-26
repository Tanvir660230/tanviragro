import type { Metadata } from "next";
import { siteTitle } from "@/components/navigation/site-map";
import { Suspense } from "react";
import { Beef, Building2, History, Landmark, LayoutDashboard, Receipt } from "lucide-react";
import { AddCostDialog } from "@/components/finance/AddCostDialog";
import { CostList, type CostEntry, type InventoryPurchaseEntry, type TreatmentFeeEntry } from "@/components/finance/CostList";
import { AssetTabPanel, type SimpleFixedAsset } from "@/components/finance/AssetTabPanel";
import { TransactionStatement } from "@/components/finance/TransactionStatement";
import { MarketPriceCard } from "@/components/finance/MarketPriceCard";
import { MoneyToday } from "@/components/finance/money/MoneyToday";
import { MoneyChecks } from "@/components/finance/money/MoneyChecks";
import { CashCountPanel } from "@/components/finance/money/CashCountPanel";
import { PeriodOverview } from "@/components/finance/money/PeriodOverview";
import { MonthlyTrend } from "@/components/finance/money/MonthlyTrend";
import { SellPlanner } from "@/components/finance/money/SellPlanner";
import { MoneyTabs } from "@/components/finance/money/MoneyTabs";
import { PeriodBar } from "@/components/finance/money/PeriodBar";
import { AnimalResultsTable } from "@/components/partners/AnimalResultsTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PERMISSIONS } from "@/constants/roles";
import { getCurrentBusiness } from "@/lib/supabase/get-business";
import { getServerClient } from "@/lib/supabase/cached";
import { selectAll } from "@/lib/supabase/select-all";
import { financePeriod } from "@/lib/money/period";
import { loadMoneyData } from "@/lib/money/money-data";
import { loadPartnerData } from "@/lib/partners/load-positions";
import { getL } from "@/i18n/server-text";

export const metadata: Metadata = { title: "টাকা-পয়সা" };

/**
 * The Money page. Every figure comes from the central sources (lib/money/money-data.ts:
 * the accounting engine, its cash ledger, the farm position and the home model); this page only
 * reads the rows its lists show.
 */
export default async function FinancePage(props: { searchParams: Promise<{ fp?: string; fs?: string; fe?: string }> }) {
  await requirePagePermission(PERMISSIONS.FINANCE_VIEW);
  const L = await getL();
  const { fp, fs, fe } = await props.searchParams;
  const supabase = await getServerClient();
  const biz = await getCurrentBusiness(supabase);
  const businessId = biz?.id ?? "";
  const { start, end } = financePeriod(fp, fs, fe, biz?.fiscal_year_start_month ?? 7);

  // the lists read only the chosen period's rows (date columns, so no time-zone edge); the asset
  // payments are read in full because an asset is owned until it is sold
  const COST_COLS = "id, type, entry_class, category, amount, recorded_at, description, cattle_id";
  const [m, partner, costsRes, assetCostsRes, purchasesRes, treatmentsRes, payersRes, cyclesProbe] = await Promise.all([
    loadMoneyData(supabase, businessId, { from: start, to: end }),
    loadPartnerData(supabase, businessId),
    selectAll(() => {
      let q = supabase.from("cost_entries").select(COST_COLS).eq("business_id", businessId).is("deleted_at", null);
      if (start) q = q.gte("recorded_at", start);
      if (end) q = q.lte("recorded_at", end);
      return q.order("id");
    }).then((data) => ({ data })),
    selectAll(() => supabase.from("cost_entries").select(COST_COLS).eq("business_id", businessId).is("deleted_at", null)
      .eq("entry_class", "asset").order("id")).then((data) => ({ data })),
    selectAll(() => {
      let q = supabase.from("inventory_transactions").select("id, qty, unit_cost, recorded_at, notes, inventory_items!inner(name, category, unit, business_id)")
        .eq("inventory_items.business_id", businessId).eq("movement_type", "purchase").not("unit_cost", "is", null);
      if (start) q = q.gte("recorded_at", start);
      if (end) q = q.lte("recorded_at", end);
      return q.order("id");
    }).then((data) => ({ data })),
    selectAll(() => {
      let q = supabase.from("cattle_treatments").select("id, cattle_id, vet_fee, additional_medical_cost, treated_at, diagnosis, cattle!inner(business_id, tag_id)").eq("cattle.business_id", businessId);
      if (start) q = q.gte("treated_at", start);
      if (end) q = q.lte("treated_at", end);
      return q.order("id");
    }).then((data) => ({ data })),
    supabase.from("partners").select("id, name").eq("business_id", businessId).is("deleted_at", null).order("name"),
    supabase.from("partner_cycles").select("id", { head: true, count: "exact" }).eq("business_id", businessId),
  ]);

  // ── the lists for the chosen period ──
  const inPeriod = (d: string) => (!start || d.slice(0, 10) >= start) && (!end || d.slice(0, 10) <= end);
  const entries = ((costsRes.data ?? []) as CostEntry[]).sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
  const expenseEntries = entries.filter((e) => (e.entry_class ?? "expense") === "expense" && inPeriod(e.recorded_at));
  const purchases: InventoryPurchaseEntry[] = ((purchasesRes.data ?? []) as unknown as { id: string; qty: number; unit_cost: number; recorded_at: string; notes: string | null; inventory_items: { name: string; category: string; unit: string } | null }[])
    .filter((r) => inPeriod(r.recorded_at))
    .map((r) => ({ id: r.id, item_name: r.inventory_items?.name ?? "—", item_category: r.inventory_items?.category ?? "other", qty: Number(r.qty), unit: r.inventory_items?.unit ?? "",
      unit_cost: Number(r.unit_cost), amount: Number(r.qty) * Number(r.unit_cost), recorded_at: r.recorded_at, notes: r.notes }))
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
  const treatmentFees: TreatmentFeeEntry[] = ((treatmentsRes.data ?? []) as unknown as { id: string; cattle_id: string; vet_fee: number | null; additional_medical_cost: number | null; treated_at: string; diagnosis: string | null; cattle: { tag_id: string | null } | null }[])
    .map((t) => ({ id: t.id, cattle_id: t.cattle_id, date: String(t.treated_at).slice(0, 10), tag: t.cattle?.tag_id ?? null, diagnosis: t.diagnosis, amount: Number(t.vet_fee ?? 0) + Number(t.additional_medical_cost ?? 0) }))
    .filter((t) => t.amount > 0 && inPeriod(t.date))
    .sort((a, b) => b.date.localeCompare(a.date));
  const payers = cyclesProbe.error ? [] : ((payersRes.data ?? []) as { id: string; name: string }[]);

  // ── assets: the engine's register (value after depreciation) + asset payments without one ──
  const linked = new Set(m.fixedAssets.map((a) => a.sourceCostEntryId).filter(Boolean));
  const costAssets = ((assetCostsRes.data ?? []) as CostEntry[]).filter((e) => !linked.has(e.id)).sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
  const fixedAssets: SimpleFixedAsset[] = m.fixedAssets.filter((a) => a.isActive).map((a) => ({
    id: a.id, name: a.name, category: a.category, description: a.description, purchaseDate: a.purchaseDate,
    purchaseCost: a.purchaseCost, bookValue: a.bookValue, annualDepreciation: a.annualDepreciation, usefulLifeYears: a.usefulLifeYears,
  }));

  return (
    <div className="space-y-5">
      <PageHeader title={siteTitle(L, "/dashboard/finance", "Money")} icon={Landmark} actions={<AddCostDialog payers={payers} />} className="mb-0" />
      <MoneyToday m={m} />
      <MoneyChecks checks={m.checks} />
      <Suspense fallback={null}>
        <PeriodBar from={m.period.from} to={m.period.to} />
      </Suspense>
      <Suspense fallback={null}>
        <MoneyTabs tabs={[
          { value: "overview", bn: "সারসংক্ষেপ", en: "Overview", icon: <LayoutDashboard />, content: (
            <div className="space-y-4">
              <PeriodOverview m={m} />
              <MonthlyTrend months={m.months} />
              <div id="market-price"><Suspense fallback={null}><MarketPriceCard /></Suspense></div>
            </div>
          ) },
          { value: "costs", bn: "খরচের তালিকা", en: "Expenses", icon: <Receipt />, count: expenseEntries.length,
            content: <CostList entries={expenseEntries} inventoryPurchases={purchases} treatmentFees={treatmentFees}
              cattleTags={Object.fromEntries(partner.farm.animals.map((a) => [a.id, a.tag]))} /> },
          { value: "cash", bn: "নগদ বিবরণী", en: "Cash statement", icon: <History />, content: (
            <div className="space-y-4">
              <CashCountPanel count={m.cashCount} cashToday={m.cash} />
              <TransactionStatement />
            </div>
          ) },
          { value: "cattle", bn: "প্রতি গরু", en: "Per animal", icon: <Beef />, count: m.animals.length, content: (
            <div className="space-y-4">
              <SellPlanner animals={m.animals} costPerHeadDay={m.costPerHeadDay} defaultPrice={m.marketPrice?.perKg ?? null} />
              <details className="group rounded-xl border border-border bg-card shadow-card">
                <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-2 px-5 py-4 [&::-webkit-details-marker]:hidden">
                  <span className="text-sm font-semibold">{L("খরচের বিস্তারিত (প্রতিটি গরু, বিক্রি ও মৃতসহ)", "Cost detail (each animal, sold and dead too)")}</span>
                  <span className="text-xs text-muted-foreground">{L("কেনা + নিজের খরচ + খামারে থাকার দিনের চলতি খরচ", "bought + own costs + running costs for its days")}</span>
                </summary>
                <AnimalResultsTable animals={partner.farm.animals} />
              </details>
            </div>
          ) },
          { value: "assets", bn: "সম্পদ", en: "Assets", icon: <Building2 />, count: costAssets.length + fixedAssets.length,
            content: <AssetTabPanel costAssets={costAssets} fixedAssets={fixedAssets} /> },
        ]} />
      </Suspense>
    </div>
  );
}

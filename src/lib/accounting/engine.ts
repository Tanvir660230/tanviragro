import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { calcAccruedInterest } from "@/lib/loan-utils";
import { calculateAlgorithmicFeedCost, ROUGHAGE_TYPES } from "@/utils/feed-calculator";

 
type Client = SupabaseClient<any>;

// ── Public types ──────────────────────────────────────────────────

export interface AccountLine {
  code: string;
  name: string;
  section: "assets" | "liabilities" | "equity" | "revenue" | "expenses";
  normalBalance: "debit" | "credit";
  debit: number;
  credit: number;
  /** Absolute balance in the account's normal direction */
  balance: number;
}

export interface TrialBalance {
  lines: AccountLine[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

export interface BalanceSheet {
  cashAndBank: number;
  feedInventory: number;
  livestock: number;
  fixedAssets: number;
  accumulatedDepreciation: number;
  netFixedAssets: number;
  totalAssets: number;
  totalLiabilities: number;
  principalOutstanding: number;   // cash-affecting portion (from liabilities + loans tables)
  accruedInterestPayable: number; // non-cash accrued interest on loans
  partnerCapital: number;
  retainedEarnings: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
  discrepancy: number;
}

export interface IncomeStatement {
  cattleSales: number;
  totalRevenue: number;
  cogs: number;           // cattle purchase cost (sold animals)
  directCattleCosts: number; // per-cattle variable expenses attributed to sold animals
  feedExpenses: number;
  vetMedical: number;
  laborWages: number;
  utilities: number;
  rentLease: number;
  transport: number;
  repairsMaintenance: number;
  depreciation: number;
  interestExpense: number;
  livestockLoss: number;  // write-off for cattle that died (non-cash)
  generalExpenses: number;
  totalExpenses: number;
  grossProfit: number;
  netIncome: number;
}

export interface CashFlowStatement {
  cashFromSales: number;
  cashPaidCattle: number;
  cashPaidCosts: number;
  cashPaidInventory: number;
  netOperating: number;
  fixedAssetPurchases: number;
  netInvesting: number;
  partnerInvestments: number;
  partnerWithdrawals: number;
  netFinancing: number;
  netCashFlow: number;
}

export interface FixedAssetRow {
  id: string;
  name: string;
  category: string;
  description: string | null;
  purchaseDate: string;
  purchaseCost: number;
  salvageValue: number;
  usefulLifeYears: number;
  depreciationMethod: "straight_line" | "declining_balance";
  decliningRate: number | null;
  isActive: boolean;
  disposedAt: string | null;
  disposalValue: number | null;
  notes: string | null;
  accumulatedDepreciation: number;
  bookValue: number;
  monthlyDepreciation: number;
  annualDepreciation: number;
}

export interface AccountingData {
  trialBalance: TrialBalance;
  balanceSheet: BalanceSheet;
  incomeStatement: IncomeStatement;
  cashFlow: CashFlowStatement;
  fixedAssets: FixedAssetRow[];
  asOf: string;
}

export interface LiabilitySummary {
  id: string;
  name: string;
  category: string;
  principal: number;
  outstanding: number;
  lender: string | null;
  due_date: string | null;
  settled_at: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────

function mapCostCategory(category: string): { code: string; name: string } {
  const c = category.toLowerCase();
  if (/vet|med|vacc|health|drug|dew/.test(c)) return { code: "6100", name: "Veterinary & Medical" };
  if (/lab|wage|salary|worker|staff|employ/.test(c)) return { code: "6200", name: "Labor & Wages" };
  if (/elect|water|gas|util|fuel|power/.test(c)) return { code: "6300", name: "Utilities" };
  if (/rent|lease/.test(c)) return { code: "6400", name: "Rent & Lease" };
  if (/deprec/.test(c)) return { code: "6500", name: "Depreciation" };
  if (/transport|deliver|freight|shipping/.test(c)) return { code: "6700", name: "Transport" };
  if (/repair|maint|fix/.test(c)) return { code: "6800", name: "Repairs & Maintenance" };
  return { code: "6600", name: "General Expenses" };
}

function monthsBetween(from: Date, to: Date): number {
  let months =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  // Clamp from's day to the last day of to's month before comparing — assets purchased on
  // the 29th/30th/31st must not lose a month's depreciation in shorter months (e.g. Feb).
  const lastDayOfToMonth = new Date(to.getFullYear(), to.getMonth() + 1, 0).getDate();
  const effectiveFromDay = Math.min(from.getDate(), lastDayOfToMonth);
  if (to.getDate() < effectiveFromDay) months--;
  return Math.max(0, months);
}

export function computeDepreciation(asset: {
  purchase_cost: number;
  salvage_value: number;
  useful_life_years: number;
  depreciation_method: string;
  declining_rate: number | null;
  purchase_date: string;
  disposed_at: string | null;
}): { monthly: number; annual: number; accumulated: number; bookValue: number } {
  const cost = asset.purchase_cost;
  const salvage = Math.min(asset.salvage_value, cost);
  const lifeYears = asset.useful_life_years;

  // Guard: no useful life means no depreciation
  if (lifeYears <= 0 || cost <= 0) {
    return { monthly: 0, annual: 0, accumulated: 0, bookValue: cost };
  }

  const startDate = new Date(asset.purchase_date);
  const endDate = asset.disposed_at ? new Date(asset.disposed_at) : new Date();
  const ageMonths = monthsBetween(startDate, endDate);

  if (asset.depreciation_method === "straight_line") {
    const annualDep = (cost - salvage) / lifeYears;
    const monthlyDep = annualDep / 12;
    const maxDep = cost - salvage;
    const accumulated = Math.min(monthlyDep * ageMonths, maxDep);
    const rounded = Math.round(accumulated * 100) / 100;
    return {
      monthly: Math.round(monthlyDep * 100) / 100,
      annual: Math.round(annualDep * 100) / 100,
      accumulated: rounded,
      bookValue: Math.round(Math.max(salvage, cost - rounded) * 100) / 100,
    };
  } else {
    // Declining Balance — apply annual rate annually, and prorate the final fractional year
    const annualRate = Math.min(asset.declining_rate ?? 1 / lifeYears, 0.99);
    let bookVal = cost;
    const totalYears = Math.floor(ageMonths / 12);
    const extraMonths = ageMonths % 12;

    for (let y = 0; y < totalYears; y++) {
      const dep = bookVal * annualRate;
      if (bookVal - dep <= salvage) { bookVal = salvage; break; }
      bookVal -= dep;
    }
    
    // Final fractional year
    if (bookVal > salvage && extraMonths > 0) {
      const dep = (bookVal * annualRate) * (extraMonths / 12);
      bookVal = Math.max(salvage, bookVal - dep);
    }
    
    // Accumulated = cost minus current bookVal
    const accumulated = Math.round((cost - bookVal) * 100) / 100;
    const fullyDepreciated = bookVal <= salvage;
    return {
      monthly: fullyDepreciated ? 0 : Math.round(bookVal * annualRate / 12 * 100) / 100,
      annual:  fullyDepreciated ? 0 : Math.round(bookVal * annualRate * 100) / 100,
      accumulated,
      bookValue: Math.round(bookVal * 100) / 100,
    };
  }
}

// ── Cached Database Fetch ─────────────────────────────────────────
// Extracts all heavy Supabase queries into a single unstable_cache block.
// This executes 1 time and is cached infinitely until revalidateTag('accounting') is called.
export const getCachedDbData = async (businessId: string) => {
  const fetcher = unstable_cache(
    async () => {
      // We must use the Service Role Key here because unstable_cache is a server-side
      // cache that does not have access to cookies or user-specific auth headers.
      const supabaseAdmin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

    const [
      cattleRes, salesRes, costsRes,
      invTxRes, partnerTxRes, fixedAssetRes, liabRes, loansRes, treatmentsRes,
      bizDataRes, rpcFeedRes, recentPurchasesRes, roughagesRes, recipesRes,
    ] = await Promise.all([
      supabaseAdmin.from("cattle").select("id, purchase_price, status, purchase_date, updated_at, initial_weight_kg").eq("business_id", businessId).is("deleted_at", null),
      supabaseAdmin.from("sales").select("id, cattle_id, sale_price_total, sold_at, cattle!inner(business_id)").eq("cattle.business_id", businessId).is("deleted_at", null),
      supabaseAdmin.from("cost_entries").select("id, category, amount, type, recorded_at, entry_class, cattle_id").eq("business_id", businessId).is("deleted_at", null),
      supabaseAdmin.from("inventory_transactions").select("id, type, qty, unit_cost, recorded_at, inventory_items!inner(business_id, category)").eq("inventory_items.business_id", businessId),
      supabaseAdmin.from("partner_transactions").select("id, amount, type, recorded_at, partners!inner(business_id)").eq("partners.business_id", businessId).is("deleted_at", null),
      supabaseAdmin.from("fixed_assets").select("*").eq("business_id", businessId),
      supabaseAdmin.from("liabilities").select("id, outstanding, settled_at").eq("business_id", businessId).is("deleted_at", null),
      supabaseAdmin.from("loans").select("id, principal_amount, interest_rate_pct, loan_date, status, loan_payments(amount, paid_at)").eq("business_id", businessId).is("deleted_at", null),
      // Vet fees from medical treatments — these are capitalized costs per cattle,
      // parallel to cost_entries with type="variable" and cattle_id. Without this,
      // all veterinary fees logged via the treatment system are invisible in the P&L.
      supabaseAdmin.from("cattle_treatments").select("cattle_id, vet_fee, additional_medical_cost, treated_at, cattle!inner(business_id)").eq("cattle.business_id", businessId),
      supabaseAdmin.from("businesses").select("default_daily_gain_kg, default_roughage_type").eq("id", businessId).maybeSingle(),
      supabaseAdmin.rpc("get_cattle_consumptions", { p_business_id: businessId }),
      supabaseAdmin.from("inventory_transactions").select("item_id, unit_cost, inventory_items!inner(business_id)").eq("inventory_items.business_id", businessId).eq("type", "purchase").order("recorded_at", { ascending: false }).limit(300),
      supabaseAdmin.from("inventory_items").select("id, name, unit, roughage_active_from, roughage_active_until").eq("business_id", businessId).not("roughage_active_from", "is", null),
      supabaseAdmin.from("feed_recipes").select("id, active_from, active_until, recipe_ingredients(item_id, qty_per_batch)").eq("business_id", businessId).not("active_from", "is", null),
    ]);

    type CattleRow = { id: string; purchase_price: number; status: string; purchase_date: string; updated_at: string | null; initial_weight_kg: number | null };
    type SaleRow = { id: string; cattle_id: string; sale_price_total: number; sold_at: string };
    type CostRow = { id: string; category: string; amount: number; type: string; recorded_at: string; entry_class: string | null; cattle_id: string | null };
    type InvTxRow = { id: string; type: string; qty: number; unit_cost: number | null; recorded_at: string; inventory_items?: { category?: string } | null };
    type PartnerTxRow = { id: string; amount: number; type: string; recorded_at: string };
    type TreatmentRow = { cattle_id: string; vet_fee: number | null; additional_medical_cost: number | null; treated_at: string };
    type LiabilityRow = { id: string; outstanding: number; settled_at: string | null };
    type LoanEngineRow = { id: string; principal_amount: number; interest_rate_pct: number; loan_date: string; status: string; loan_payments: { amount: number; paid_at: string }[] | null };
    type FixedAssetDbRow = {
      id: string; name: string; category: string; description: string | null;
      purchase_date: string; purchase_cost: number; salvage_value: number;
      useful_life_years: number; depreciation_method: string; declining_rate: number | null;
      is_active: boolean; disposed_at: string | null; disposal_value: number | null; notes: string | null;
    };

    return {
      cattle: (cattleRes.data ?? []) as unknown as CattleRow[],
      sales: (salesRes.data ?? []) as unknown as SaleRow[],
      costs: (costsRes.data ?? []) as unknown as CostRow[],
      invTx: (invTxRes.data ?? []) as unknown as InvTxRow[],
      partnerTx: (partnerTxRes.data ?? []) as unknown as PartnerTxRow[],
      fixedAssetDb: (fixedAssetRes.data ?? []) as unknown as FixedAssetDbRow[],
      liabData: (liabRes.data ?? []) as unknown as LiabilityRow[],
      loansData: (loansRes.data ?? []) as unknown as LoanEngineRow[],
      treatments: (treatmentsRes.data ?? []) as unknown as TreatmentRow[],
      bizData: (bizDataRes.data ?? null) as any,
      rpcFeedData: (rpcFeedRes.data ?? []) as any[],
      recentPurchasesData: (recentPurchasesRes.data ?? []) as any[],
      roughagesData: (roughagesRes.data ?? []) as any[],
      recipesData: (recipesRes.data ?? []) as any[],
    };
  },
  [`accounting-db-${businessId}`],
  { tags: ['accounting', `accounting-${businessId}`], revalidate: 3600 * 24 * 30 } // 30 days, revalidated via tag
  );
  return fetcher();
};

// ── Main query ────────────────────────────────────────────────────

/**
 * @param from  Optional YYYY-MM-DD — when provided, the income statement and cash
 *              flow cover only [from, to]. The balance sheet is always all-time.
 * @param to    Optional YYYY-MM-DD upper bound (inclusive).
 */
export async function getAccountingData(
  supabase: SupabaseClient,
  from?: string,
  to?: string
): Promise<AccountingData> {
  // getUser() verifies the JWT server-side — required for auth-gated queries.
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;
  const { data: bizData } = userId
    ? await supabase.from("businesses").select("id, opening_cash_balance").eq("owner_id", userId).maybeSingle()
    : { data: null };
  const openingCash = Number((bizData as { opening_cash_balance?: number } | null)?.opening_cash_balance ?? 0);
  const businessId = (bizData as { id?: string } | null)?.id ?? null;

  if (!businessId) {
    throw new Error("Business ID not found for user");
  }

  const {
    cattle, sales, costs, invTx, partnerTx, fixedAssetDb, liabData, loansData, treatments,
    bizData: cachedBizData, rpcFeedData, recentPurchasesData, roughagesData, recipesData
  } = await getCachedDbData(businessId);

  // Build cattle lookup for COGS
  const cattleMap = new Map<string, number>();
  for (const c of cattle) cattleMap.set(c.id, Number(c.purchase_price));

  // ── Algorithmic Feed Cost per cow ─────────────────────────────
  const dailyGainKg = cachedBizData?.default_daily_gain_kg ?? 0.6;
  const bizDefaultRoughage = cachedBizData?.default_roughage_type ?? "straw";
  const defaultRoughageDm = ROUGHAGE_TYPES.find(r => r.id === bizDefaultRoughage)?.dmPercent ?? 0.90;

  const feedCostByCattle: Record<string, number> = {};
  for (const t of rpcFeedData) {
    if (t.cattle_id) {
      feedCostByCattle[t.cattle_id] = (feedCostByCattle[t.cattle_id] ?? 0) + Number(t.total_cost);
    }
  }

  const unitCostMap: Record<string, number> = {};
  for (const p of recentPurchasesData) {
    if (p.unit_cost != null && !unitCostMap[p.item_id]) {
      unitCostMap[p.item_id] = p.unit_cost;
    }
  }

  const nowMs = new Date().getTime();
  let totalAlgorithmicFeedAdded = 0;

  for (const c of cattle) {
    // Only apply algorithmic fallback if explicit logged consumption is 0
    if ((feedCostByCattle[c.id] ?? 0) === 0) {
      const startMs = new Date(c.purchase_date + "T00:00:00").getTime();
      let endMs = nowMs;
      if (c.status === "sold" || c.status === "dead") {
        const saleRec = sales.find(s => s.cattle_id === c.id);
        endMs = saleRec ? new Date(saleRec.sold_at).getTime() : (c.updated_at ? new Date(c.updated_at).getTime() : nowMs);
      }
      
      const daysInPen = Math.max(0, Math.floor((endMs - startMs) / 86400000));
      const estimatedFinalWeight = (c.initial_weight_kg ?? 0) + daysInPen * dailyGainKg;

      const { allocatedFeedCost } = calculateAlgorithmicFeedCost({
        daysInPen,
        startMs,
        recipes: recipesData,
        roughages: roughagesData,
        unitCostMap,
        feedData: {
          initialWeightKg: c.initial_weight_kg ?? 0,
          latestLoggedWeightKg: estimatedFinalWeight,
          lastWeighedAt: new Date(endMs).toISOString().slice(0, 10),
          purchaseDate: c.purchase_date,
          expectedDailyGainKg: dailyGainKg,
          roughageDmPercent: defaultRoughageDm,
        },
        overrideRoughage: null,
      });

      feedCostByCattle[c.id] = allocatedFeedCost;
      totalAlgorithmicFeedAdded += allocatedFeedCost;
    }
  }

  // ── Compute fixed assets with depreciation ─────────────────────
  const fixedAssets: FixedAssetRow[] = fixedAssetDb.map((a) => {
    // Supabase returns numeric columns as strings — coerce before arithmetic.
    const dep = computeDepreciation({
      ...a,
      purchase_cost:    Number(a.purchase_cost),
      salvage_value:    Number(a.salvage_value),
      useful_life_years: Number(a.useful_life_years),
      declining_rate:   a.declining_rate != null ? Number(a.declining_rate) : null,
    });
    return {
      id: a.id,
      name: a.name,
      category: a.category,
      description: a.description,
      purchaseDate: a.purchase_date,
      purchaseCost: Number(a.purchase_cost),
      salvageValue: Number(a.salvage_value),
      usefulLifeYears: a.useful_life_years,
      depreciationMethod: a.depreciation_method as "straight_line" | "declining_balance",
      decliningRate: a.declining_rate,
      isActive: a.is_active,
      disposedAt: a.disposed_at,
      disposalValue: a.disposal_value != null ? Number(a.disposal_value) : null,
      notes: a.notes,
      accumulatedDepreciation: dep.accumulated,
      bookValue: dep.bookValue,
      monthlyDepreciation: dep.monthly,
      annualDepreciation: dep.annual,
    };
  });

  // ── Period filter ──────────────────────────────────────────────
  // Balance sheet uses all-time data (position statement).
  // Income statement and cash flow use [from, to] when provided.
  function inPeriod(date: string): boolean {
    if (from && date < from) return false;
    if (to   && date > to)   return false;
    return true;
  }

  const periodSales  = sales.filter(s  => inPeriod(s.sold_at));
  const periodCosts  = costs.filter(c  => inPeriod(c.recorded_at));
  const periodInvTx  = invTx.filter(t  => inPeriod(t.recorded_at));
  const periodPartTx = partnerTx.filter(t => inPeriod(t.recorded_at));

  // ── ALL-TIME aggregates (balance sheet) ───────────────────────

  const activeCattleCost = cattle
    .filter((c) => c.status === "active")
    .reduce((s, c) => s + Number(c.purchase_price ?? 0), 0);
  const allCattleCost = cattle.reduce((s, c) => s + Number(c.purchase_price ?? 0), 0);
  // Deceased cattle: purchase price is written off as a non-cash loss (asset → expense).
  // Cash already went out at purchase; this entry reduces retained earnings without
  // affecting cashAndBank again.
  const allTimePurchaseValue = invTx
    .filter((t) => t.type === "purchase")
    .reduce((s, t) => s + Number(t.qty) * Number(t.unit_cost ?? 0), 0);
  const allTimeInvConsumption = invTx
    .filter((t) => t.type === "consumption")
    .reduce((s, t) => s + Math.round(Number(t.qty) * Number(t.unit_cost ?? 0) * 100) / 100, 0);
  
  // Deduct the algorithmic feed from the inventory value so the balance sheet balances!
  const feedInventoryValue = Math.max(0, allTimePurchaseValue - allTimeInvConsumption - totalAlgorithmicFeedAdded);

  const allCostEntries = costs.filter((c) => (c.entry_class ?? "expense") !== "asset");
  
  // Split into period expenses and capitalized costs
  const allExpenseCosts = allCostEntries.filter(c => !(c.cattle_id && c.type === "variable"));
  const allCapitalizedCattleCosts = [
    ...allCostEntries.filter(c => c.cattle_id && c.type === "variable"),
    // Vet fees from cattle_treatments are capitalized per-cattle costs identical in
    // accounting treatment to cost_entries(type="variable", cattle_id=...) — they
    // must be here so COGS, livestock loss, and cash flow are all complete.
    ...treatments
      .map(t => ({
        id: `treatment-${t.cattle_id}-${t.treated_at}`,
        category: "Medical/Vet Fee",
        amount: Number(t.vet_fee ?? 0) + Number(t.additional_medical_cost ?? 0),
        type: "variable" as const,
        recorded_at: t.treated_at,
        entry_class: "expense" as const,
        cattle_id: t.cattle_id,
      }))
      .filter(t => t.amount > 0),
  ];

  // Distribute capitalized costs
  const activeCattleIds = new Set(cattle.filter(c => c.status === "active").map(c => c.id));
  const soldCattleIds = new Set(cattle.filter(c => c.status === "sold").map(c => c.id));
  const deadCattleIds = new Set(cattle.filter(c => c.status === "dead").map(c => c.id));

  const capitalizedActiveCosts = allCapitalizedCattleCosts.filter(c => c.cattle_id && activeCattleIds.has(c.cattle_id)).reduce((s, c) => s + Number(c.amount), 0)
    + Array.from(activeCattleIds).reduce((s, id) => s + (feedCostByCattle[id] ?? 0), 0);
  const capitalizedSoldCosts = allCapitalizedCattleCosts.filter(c => c.cattle_id && soldCattleIds.has(c.cattle_id)).reduce((s, c) => s + Number(c.amount), 0)
    + Array.from(soldCattleIds).reduce((s, id) => s + (feedCostByCattle[id] ?? 0), 0);
  const capitalizedDeadCosts = allCapitalizedCattleCosts.filter(c => c.cattle_id && deadCattleIds.has(c.cattle_id)).reduce((s, c) => s + Number(c.amount), 0)
    + Array.from(deadCattleIds).reduce((s, id) => s + (feedCostByCattle[id] ?? 0), 0);

  // All-time deceased loss (for balance sheet / retained earnings)
  const deceasedCattleLoss = cattle
    .filter((c) => c.status === "dead")
    .reduce((s, c) => s + Number(c.purchase_price ?? 0), 0) + capitalizedDeadCosts;

  // Period-scoped deceased loss for the income statement: only cattle whose status changed
  // to "dead" within the selected period (using updated_at as a proxy for the death date).
  const periodDeceasedCattleLoss = (from || to)
    ? cattle
        .filter((c) => c.status === "dead" && c.updated_at && inPeriod(c.updated_at.slice(0, 10)))
        .reduce((s, c) => {
          const deadCap = allCapitalizedCattleCosts
            .filter(cap => cap.cattle_id === c.id)
            .reduce((cs, cap) => cs + Number(cap.amount), 0);
          return s + Number(c.purchase_price ?? 0) + deadCap + (feedCostByCattle[c.id] ?? 0);
        }, 0)
    : deceasedCattleLoss;
  const allAssetCosts   = costs.filter((c) => c.entry_class === "asset");
  const costEntryAssetTotal = allAssetCosts.reduce((s, c) => s + Number(c.amount), 0);

  // All-time partner transactions (for equity on balance sheet)
  const allPartnerInvestments = partnerTx
    .filter((t) => t.type === "investment")
    .reduce((s, t) => s + Number(t.amount), 0);
  // Capital withdrawals (return of invested capital) and profit distributions are
  // separated so Partner Capital and Retained Earnings are presented correctly.
  const allPartnerCapitalWithdrawals = partnerTx
    .filter((t) => t.type === "withdrawal")
    .reduce((s, t) => s + Number(t.amount), 0);
  const allPartnerProfitDistributions = partnerTx
    .filter((t) => t.type === "profit")
    .reduce((s, t) => s + Number(t.amount), 0);
  const allPartnerWithdrawals = allPartnerCapitalWithdrawals + allPartnerProfitDistributions;

  // Fixed asset totals (all-time for balance sheet)
  const totalFixedAssetCost = fixedAssets.reduce((s, a) => s + a.purchaseCost, 0);
  const totalAccumDep = fixedAssets.reduce((s, a) => s + a.accumulatedDepreciation, 0);

  // All-time accrued interest on loans (for retained earnings and income statement).
  // For paid loans, interest stops accruing on the date the last payment was made —
  // interest CANNOT accrue past the loan payoff date, so cap interestTo at that date.
  // For active loans, accrue through today.
  const todayStr = new Date().toISOString().slice(0, 10);
  const allTimeInterestExpense = loansData.reduce((s, l) => {
    let interestTo = todayStr;
    if (l.status === "paid" && l.loan_payments && l.loan_payments.length > 0) {
      const lastPaidAt = l.loan_payments
        .map((p) => p.paid_at)
        .filter(Boolean)
        .sort()
        .pop() ?? todayStr;
      interestTo = lastPaidAt.slice(0, 10);
    }
    return s + calcAccruedInterest(Number(l.principal_amount), Number(l.interest_rate_pct ?? 0), l.loan_date, interestTo, l.loan_payments || [], "active");
  }, 0);

  // Cash-affecting liabilities: net outstanding principal on both tables.
  // Settled liabilities and fully-paid loans contribute 0 (received = repaid).
  const liabilitiesOutstanding = liabData
    .filter((l) => !l.settled_at)
    .reduce((s, l) => s + Number(l.outstanding), 0);
  const loanNetOutstanding = loansData.reduce((s, l) => {
    if (l.status === "paid") return s;
    const paid = (l.loan_payments ?? []).reduce((ps, p) => ps + Number(p.amount), 0);
    return s + Math.max(0, Number(l.principal_amount) - paid);
  }, 0);
  const allTimeFinancingCash = liabilitiesOutstanding + loanNetOutstanding;

  // Total liabilities = cash outstanding + accrued interest payable (non-cash).
  // allTimeInterestExpense reduces retainedEarnings; it must also appear here so
  // both sides of Assets = Liabilities + Equity move by the same amount.
  const totalLiabilities = allTimeFinancingCash + allTimeInterestExpense;

  // All-time cash position (for balance sheet cashAndBank).
  // Operating: sales - all cattle purchases - all op costs - all inv purchases
  // Investing: -(all fixed asset purchases)
  // Financing: all partner investments - all partner withdrawals
  const allTimeSalesRevenue = sales.reduce((s, x) => s + Number(x.sale_price_total), 0);
  const allTimeTotalOpCosts = allExpenseCosts.reduce((s, c) => s + Number(c.amount), 0);
  // allTimeFinancingCash = cash received from all loans net of repayments (cash basis).
  // allTimeInterestExpense is accrued but not yet cash-paid — excluded from cash flow.
  // Capitalized cattle costs (vet fees etc. tied to specific cattle) are real cash outflows
  // excluded from allTimeTotalOpCosts. Subtract them from cashAndBank to keep it accurate.
  const capitalizedCashOutflow = capitalizedActiveCosts + capitalizedSoldCosts + capitalizedDeadCosts;
  const allTimeNetCashFlow =
    (allTimeSalesRevenue - allCattleCost - allTimeTotalOpCosts - allTimePurchaseValue - capitalizedCashOutflow)
    + (-(totalFixedAssetCost + costEntryAssetTotal))
    + (allPartnerInvestments - allPartnerWithdrawals)
    + allTimeFinancingCash;

  // Retained earnings = cumulative net income minus profit distributions paid to partners.
  // Uses totalAccumDep (all-time accumulated) and allTimeInterestExpense for correctness.
  const allTimeCogs = sales.reduce((s, x) => s + (cattleMap.get(x.cattle_id) ?? 0), 0) + capitalizedSoldCosts;
  const retainedEarnings =
    allTimeSalesRevenue - allTimeCogs - allTimeTotalOpCosts
    - totalAccumDep - allTimeInterestExpense - allPartnerProfitDistributions - deceasedCattleLoss;

  // ── PERIOD aggregates (income statement + cash flow) ──────────

  const totalSalesRevenue = periodSales.reduce((s, x) => s + Number(x.sale_price_total), 0);
  const purchaseCogs = periodSales.reduce((s, x) => s + (cattleMap.get(x.cattle_id) ?? 0), 0);

  // COGS is purchase cost + capitalized costs of cattle sold THIS period (including capitalized feed)
  const periodSoldCattleIds = new Set(periodSales.map(s => s.cattle_id));
  const directCattleCogs = allCapitalizedCattleCosts.filter(c => c.cattle_id && periodSoldCattleIds.has(c.cattle_id)).reduce((s, c) => s + Number(c.amount), 0)
    + Array.from(periodSoldCattleIds).reduce((s, id) => s + (feedCostByCattle[id] ?? 0), 0);
  const cogs = purchaseCogs + directCattleCogs;

  // Operating expenses exclude capitalized cattle costs
  const periodAllCostEntries = periodCosts.filter((c) => (c.entry_class ?? "expense") !== "asset");
  const periodExpenseCosts = periodAllCostEntries.filter(c => !(c.cattle_id && c.type === "variable"));
  const periodAssetCosts   = periodCosts.filter((c) => c.entry_class === "asset");
  const periodCostEntryAssetTotal = periodAssetCosts.reduce((s, c) => s + Number(c.amount), 0);

  const costBreakdown: Record<string, number> = {};
  for (const c of periodExpenseCosts) {
    const { code } = mapCostCategory(c.category);
    costBreakdown[code] = (costBreakdown[code] ?? 0) + Number(c.amount);
  }
  const totalCosts = periodExpenseCosts.reduce((s, c) => s + Number(c.amount), 0);

  // Period inventory purchases (cash flow outflow)
  const invPurchases = periodInvTx
    .filter((t) => t.type === "purchase")
    .reduce((s, t) => s + Number(t.qty) * Number(t.unit_cost ?? 0), 0);

  for (const t of periodInvTx.filter((tx) => tx.type === "consumption")) {
    const cat = (t.inventory_items as { category?: string } | null)?.category ?? "feed";
    const cost = Math.round(Number(t.qty) * Number(t.unit_cost ?? 0) * 100) / 100;
    if (cat === "medicine" || cat === "supplement") {
      costBreakdown["6100"] = (costBreakdown["6100"] ?? 0) + cost; // vetMedical account
    }
  }
  // All feed expenses are now capitalized per-cow. They are no longer treated as operating expenses on the Income Statement!
  const feedExpenses = 0;

  // Period depreciation: delta of accumulated depreciation between period boundaries.
  // For all-time (no filter) use all-time accumulated from the pre-computed array.
  // For a date range, call computeDepreciation twice per asset (at periodTo and periodFrom)
  // so the result is exact for both straight-line AND declining-balance methods, and
  // correctly handles assets purchased or disposed within the period.
  let totalDepreciationExpense: number;
  if (!from && !to) {
    totalDepreciationExpense = totalAccumDep;
  } else {
    const periodFrom = from ?? "0000-01-01";
    const periodTo   = to   ?? todayStr;
    totalDepreciationExpense = fixedAssetDb
      .filter((a) => a.purchase_date <= periodTo && (!a.disposed_at || a.disposed_at >= periodFrom))
      .reduce((s, a) => {
        const base = {
          purchase_cost:     Number(a.purchase_cost),
          salvage_value:     Number(a.salvage_value),
          useful_life_years: Number(a.useful_life_years),
          depreciation_method: a.depreciation_method,
          declining_rate:    a.declining_rate != null ? Number(a.declining_rate) : null,
          purchase_date:     a.purchase_date,
        };
        // Cap the period end at the disposal date if the asset was disposed this period
        const effectiveTo = a.disposed_at && a.disposed_at < periodTo ? a.disposed_at : periodTo;
        const depAtEnd   = computeDepreciation({ ...base, disposed_at: effectiveTo });
        // If the asset existed before the period, subtract what had already accumulated
        const depAtStart = a.purchase_date < periodFrom
          ? computeDepreciation({ ...base, disposed_at: periodFrom })
          : { accumulated: 0 };
        return s + Math.max(0, Math.round((depAtEnd.accumulated - depAtStart.accumulated) * 100) / 100);
      }, 0);
  }

  // Period interest expense on loans.
  // For paid loans, cap interestTo at the last payment date so interest stops accruing
  // at payoff. For active loans, accrue through the period end.
  const periodInterestExpense = loansData.reduce((s, l) => {
    const interestFrom = from && l.loan_date < from ? from : l.loan_date;
    let interestTo = to ?? todayStr;
    if (l.status === "paid" && l.loan_payments && l.loan_payments.length > 0) {
      const lastPaidAt = l.loan_payments
        .map((p) => p.paid_at)
        .filter(Boolean)
        .sort()
        .pop() ?? interestTo;
      interestTo = lastPaidAt.slice(0, 10) < interestTo ? lastPaidAt.slice(0, 10) : interestTo;
    }
    if (interestFrom >= interestTo) return s;
    const intTo   = calcAccruedInterest(Number(l.principal_amount), Number(l.interest_rate_pct ?? 0), l.loan_date, interestTo,   l.loan_payments || [], "active");
    const intFrom = calcAccruedInterest(Number(l.principal_amount), Number(l.interest_rate_pct ?? 0), l.loan_date, interestFrom, l.loan_payments || [], "active");
    return s + Math.max(0, intTo - intFrom);
  }, 0);

  // Period partner transactions (cash flow financing)
  const partnerInvestments = periodPartTx
    .filter((t) => t.type === "investment")
    .reduce((s, t) => s + Number(t.amount), 0);
  const partnerWithdrawals = periodPartTx
    .filter((t) => t.type === "withdrawal" || t.type === "profit")
    .reduce((s, t) => s + Number(t.amount), 0);

  // Cash paid for cattle purchased in the period only + capitalized costs paid in period
  const cashPaidCapitalizedCosts = periodAllCostEntries
    .filter(c => c.cattle_id && c.type === "variable")
    .reduce((s, c) => s + Number(c.amount), 0);
  const cashPaidCattle = cattle
    .filter((c) => inPeriod(c.purchase_date))
    .reduce((s, c) => s + Number(c.purchase_price ?? 0), 0) + cashPaidCapitalizedCosts;

  // Fixed asset purchases in period (for cash flow investing section)
  const periodFixedAssetPurchases = fixedAssets
    .filter((a) => inPeriod(a.purchaseDate))
    .reduce((s, a) => s + a.purchaseCost, 0);

  // ── INCOME STATEMENT ──────────────────────────────────────────
  const vetMedical = costBreakdown["6100"] ?? 0;
  const laborWages = costBreakdown["6200"] ?? 0;
  const utilities = costBreakdown["6300"] ?? 0;
  const rentLease = costBreakdown["6400"] ?? 0;
  const transport = costBreakdown["6700"] ?? 0;
  const repairsMaintenance = costBreakdown["6800"] ?? 0;
  const generalExpenses = costBreakdown["6600"] ?? 0;

  const totalExpenses =
    purchaseCogs + directCattleCogs + feedExpenses + vetMedical + laborWages + utilities + rentLease +
    transport + repairsMaintenance + totalDepreciationExpense + periodInterestExpense + generalExpenses + periodDeceasedCattleLoss;

  const grossProfit = totalSalesRevenue - purchaseCogs - directCattleCogs;
  const netIncome = totalSalesRevenue - totalExpenses;

  const incomeStatement: IncomeStatement = {
    cattleSales: totalSalesRevenue,
    totalRevenue: totalSalesRevenue,
    cogs: purchaseCogs,
    directCattleCosts: directCattleCogs,
    feedExpenses,
    vetMedical,
    laborWages,
    utilities,
    rentLease,
    transport,
    repairsMaintenance,
    depreciation: totalDepreciationExpense,
    interestExpense: periodInterestExpense,
    livestockLoss: periodDeceasedCattleLoss,
    generalExpenses,
    totalExpenses,
    grossProfit,
    netIncome,
  };

  // ── CASH FLOW (period) ────────────────────────────────────────
  const cashFromSales = totalSalesRevenue;
  const cashPaidCosts = totalCosts;
  const cashPaidInventory = invPurchases;
  const netOperating = cashFromSales - cashPaidCattle - cashPaidCosts - cashPaidInventory;

  const fixedAssetPurchases = periodFixedAssetPurchases + periodCostEntryAssetTotal;
  const netInvesting = -fixedAssetPurchases;

  const netFinancing = partnerInvestments - partnerWithdrawals;
  const netCashFlow = netOperating + netInvesting + netFinancing;

  const cashFlow: CashFlowStatement = {
    cashFromSales,
    cashPaidCattle,
    cashPaidCosts,
    cashPaidInventory,
    netOperating,
    fixedAssetPurchases,
    netInvesting,
    partnerInvestments,
    partnerWithdrawals,
    netFinancing,
    netCashFlow,
  };

  // ── BALANCE SHEET (always all-time) ───────────────────────────
  const cashAndBank = allTimeNetCashFlow + openingCash;
  const livestock = activeCattleCost + capitalizedActiveCosts;
  const netFixedAssets = totalFixedAssetCost - totalAccumDep + costEntryAssetTotal;
  const totalAssets = cashAndBank + feedInventoryValue + livestock + netFixedAssets;

  // Partner Capital = contributed capital only (investments minus capital returns).
  // Profit distributions reduce Retained Earnings, not Contributed Capital.
  const partnerCapital = allPartnerInvestments - allPartnerCapitalWithdrawals + openingCash;
  const totalEquity = partnerCapital + retainedEarnings;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
  const discrepancy = Math.abs(totalAssets - totalLiabilitiesAndEquity);

  const balanceSheet: BalanceSheet = {
    cashAndBank,
    feedInventory: feedInventoryValue,
    livestock,
    fixedAssets: totalFixedAssetCost,
    accumulatedDepreciation: totalAccumDep,
    netFixedAssets,
    totalAssets,
    totalLiabilities,
    principalOutstanding: allTimeFinancingCash,
    accruedInterestPayable: allTimeInterestExpense,
    partnerCapital,
    retainedEarnings,
    totalEquity,
    totalLiabilitiesAndEquity,
    isBalanced: discrepancy < 1,
    discrepancy,
  };

  // ── TRIAL BALANCE ─────────────────────────────────────────────
  // The trial balance reflects cumulative ledger balances since inception
  // (no period-end closing entries). Expense/depreciation accounts therefore
  // show all-time totals rather than the current-period income statement amounts.
  const accounts: Record<string, AccountLine> = {
    "1100": { code: "1100", name: "Cash & Bank", section: "assets", normalBalance: "debit", debit: 0, credit: 0, balance: 0 },
    "1300": { code: "1300", name: "Feed & Supplies Inventory", section: "assets", normalBalance: "debit", debit: 0, credit: 0, balance: 0 },
    "1400": { code: "1400", name: "Livestock (Active)", section: "assets", normalBalance: "debit", debit: 0, credit: 0, balance: 0 },
    "1500": { code: "1500", name: "Fixed Assets", section: "assets", normalBalance: "debit", debit: 0, credit: 0, balance: 0 },
    "1600": { code: "1600", name: "Accumulated Depreciation", section: "assets", normalBalance: "credit", debit: 0, credit: 0, balance: 0 },
    "2100": { code: "2100", name: "Liabilities", section: "liabilities", normalBalance: "credit", debit: 0, credit: 0, balance: 0 },
    "2200": { code: "2200", name: "Accrued Interest Payable", section: "liabilities", normalBalance: "credit", debit: 0, credit: 0, balance: 0 },
    "3100": { code: "3100", name: "Partner Capital", section: "equity", normalBalance: "credit", debit: 0, credit: 0, balance: 0 },
    "3200": { code: "3200", name: "Partner Withdrawals", section: "equity", normalBalance: "debit", debit: 0, credit: 0, balance: 0 },
    "4100": { code: "4100", name: "Cattle Sales Revenue", section: "revenue", normalBalance: "credit", debit: 0, credit: 0, balance: 0 },
    "5100": { code: "5100", name: "Cost of Goods Sold", section: "expenses", normalBalance: "debit", debit: 0, credit: 0, balance: 0 },
    "5200": { code: "5200", name: "Feed Expenses", section: "expenses", normalBalance: "debit", debit: 0, credit: 0, balance: 0 },
    "6100": { code: "6100", name: "Veterinary & Medical", section: "expenses", normalBalance: "debit", debit: 0, credit: 0, balance: 0 },
    "6200": { code: "6200", name: "Labor & Wages", section: "expenses", normalBalance: "debit", debit: 0, credit: 0, balance: 0 },
    "6300": { code: "6300", name: "Utilities", section: "expenses", normalBalance: "debit", debit: 0, credit: 0, balance: 0 },
    "6400": { code: "6400", name: "Rent & Lease", section: "expenses", normalBalance: "debit", debit: 0, credit: 0, balance: 0 },
    "6500": { code: "6500", name: "Depreciation Expense", section: "expenses", normalBalance: "debit", debit: 0, credit: 0, balance: 0 },
    "6600": { code: "6600", name: "General Expenses", section: "expenses", normalBalance: "debit", debit: 0, credit: 0, balance: 0 },
    "6700": { code: "6700", name: "Transport", section: "expenses", normalBalance: "debit", debit: 0, credit: 0, balance: 0 },
    "6800": { code: "6800", name: "Repairs & Maintenance", section: "expenses", normalBalance: "debit", debit: 0, credit: 0, balance: 0 },
    "6900": { code: "6900", name: "Interest Expense", section: "expenses", normalBalance: "debit", debit: 0, credit: 0, balance: 0 },
  };

  function dr(code: string, amount: number) {
    if (amount <= 0) return;
    accounts[code].debit += amount;
  }
  function cr(code: string, amount: number) {
    if (amount <= 0) return;
    accounts[code].credit += amount;
  }

  // Opening cash balance: DR Cash, CR Partner Capital (treated as initial equity)
  dr("1100", openingCash);
  cr("3100", openingCash);

  // Loan proceeds: DR Cash, CR Liabilities (cash outstanding from both liability tables)
  dr("1100", allTimeFinancingCash);
  cr("2100", allTimeFinancingCash);

  // Partner investments: DR Cash, CR Partner Capital
  dr("1100", allPartnerInvestments);
  cr("3100", allPartnerInvestments);

  // Partner withdrawals: DR Partner Withdrawals, CR Cash
  dr("3200", allPartnerWithdrawals);
  cr("1100", allPartnerWithdrawals);

  // Cattle purchases: DR Livestock, CR Cash
  dr("1400", allCattleCost);
  cr("1100", allCattleCost);

  // Sales: DR Cash, CR Revenue
  dr("1100", allTimeSalesRevenue);
  cr("4100", allTimeSalesRevenue);

  // COGS on sold cattle: DR COGS, CR Livestock
  dr("5100", allTimeCogs);
  cr("1400", allTimeCogs);

  // Capitalized cattle costs: DR Livestock, CR Cash
  const allTimeCapitalizedCosts = capitalizedActiveCosts + capitalizedSoldCosts + capitalizedDeadCosts;
  dr("1400", allTimeCapitalizedCosts);
  cr("1100", allTimeCapitalizedCosts);

  // Inventory purchases: DR Inventory, CR Cash
  dr("1300", allTimePurchaseValue);
  cr("1100", allTimePurchaseValue);

  // Instead of an operating Feed Expense, feed consumption is capitalized: DR Livestock, CR Inventory.
  // This applies to both actual logged consumptions AND algorithmic fallback.
  const totalCapitalizedFeed = Object.values(feedCostByCattle).reduce((s, val) => s + val, 0);
  dr("1400", totalCapitalizedFeed);
  cr("1300", totalCapitalizedFeed);

  // Operating costs (expense entries only — assets are capitalized, not expensed)
  for (const c of allExpenseCosts) {
    const { code } = mapCostCategory(c.category);
    dr(code, Number(c.amount));
    cr("1100", Number(c.amount));
  }

  // cost_entries marked as assets: DR Fixed Assets, CR Cash
  for (const c of allAssetCosts) {
    dr("1500", Number(c.amount));
    cr("1100", Number(c.amount));
  }

  // Fixed assets from the fixed_assets table: DR Fixed Assets, CR Cash
  dr("1500", totalFixedAssetCost);
  cr("1100", totalFixedAssetCost);

  // Depreciation (all-time accumulated): DR Depreciation Expense, CR Accumulated Depreciation
  dr("6500", totalAccumDep);
  cr("1600", totalAccumDep);

  // Interest expense (accrued, all-time): DR Interest Expense, CR Accrued Interest Payable
  dr("6900", allTimeInterestExpense);
  cr("2200", allTimeInterestExpense);

  // Compute balances
  for (const acct of Object.values(accounts)) {
    if (acct.normalBalance === "debit") {
      acct.balance = acct.debit - acct.credit;
    } else {
      acct.balance = acct.credit - acct.debit;
    }
  }

  // Build sorted trial balance lines
  const sortOrder = ["assets", "liabilities", "equity", "revenue", "expenses"];
  const lines = Object.values(accounts)
    .filter((a) => a.debit > 0 || a.credit > 0)
    .sort((a, b) => {
      const si = sortOrder.indexOf(a.section) - sortOrder.indexOf(b.section);
      return si !== 0 ? si : a.code.localeCompare(b.code);
    });

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

  const trialBalance: TrialBalance = {
    lines,
    totalDebit,
    totalCredit,
    isBalanced: Math.abs(totalDebit - totalCredit) < 1,
  };

  return {
    trialBalance,
    balanceSheet,
    incomeStatement,
    cashFlow,
    fixedAssets,
    asOf: new Date().toISOString(),
  };
}

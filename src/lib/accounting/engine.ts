import { calculateDepreciation } from "@/lib/financial/calculations";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { selectAll } from "@/lib/supabase/select-all";
import { calcAccruedInterest } from "@/lib/loan-utils";
import { getBusinessContext } from "@/lib/context/business-context";
import { requireAnyPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/constants/roles";
import { summarizeInventoryLedger, unallocatedInventoryCost } from "@/lib/accounting/inventory-ledger";
import { buildCashLedger, cashNet, type CashRow } from "@/lib/accounting/cash-ledger";
import { accountForCostEntry } from "@/lib/expenses/categories";
import type { ExpenseKind } from "@/types/database";

 
import { todayDhaka } from "@/lib/dates";
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
  assetDisposalGain: number;   // money got for a sold/scrapped asset minus its value then (− = a loss)
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
  assetSaleProceeds: number;
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
  /** payment record (cost entry) this asset was bought with — cash is counted there, not here */
  sourceCostEntryId: string | null;
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
  /** every cash movement, dated (lib/accounting/cash-ledger.ts): cashAndBank = openingCash + Σ rows */
  cashLedger: CashRow[];
  openingCash: number;
  businessName: string;
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

/** Account of a cost entry: its category's kind when linked, else the legacy text rule. */
function mapCostCategory(category: string, kind?: ExpenseKind | null): { code: string; name: string } {
  return accountForCostEntry({ category, kind });
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

export const computeDepreciation = calculateDepreciation;

// ── Database Fetch ────────────────────────────────────────────────
// Every query of the engine, read with the SIGNED-IN user's client (row-level security), once per
// request (React cache: the homepage asks for all-time and this month in the same render).
// It used to read through a cross-request cache with the service-role key; on the live site that
// failed, and the homepage showed "—" for cash and the month's spending. Always fresh now, so a
// write is visible on the next page load without relying on revalidateTag("accounting").
// A failed query throws: a partial read would show a wrong cash figure without any sign.
function must<T>(res: { data: T | null; error?: { message?: string } | null }, what: string): T {
  if (res.error) throw new Error(`accounting: could not read ${what}: ${res.error.message ?? "unknown error"}`);
  return (res.data ?? []) as T;
}

export const getCachedDbData = cache(async (db: Client, businessId: string) => {
    const [
      cattleRes, salesRes, costsRes,
      invTxRes, partnerTxRes, fixedAssetRes, liabRes, loansRes, treatmentsRes,
      rpcFeedRes,
    ] = await Promise.all([
      db.from("cattle").select("id, tag_id, purchase_price, status, purchase_date, updated_at, initial_weight_kg").eq("business_id", businessId).is("deleted_at", null),
      // money tables are read page by page too: a plain select stops silently at row 1000
      selectAll(() => db.from("sales").select("id, cattle_id, sale_price_total, sold_at, buyer_name, cattle!inner(business_id, tag_id)").eq("cattle.business_id", businessId).is("deleted_at", null).order("id")).then((data) => ({ data })),
      selectAll(() => db.from("cost_entries").select("id, category, amount, type, recorded_at, description, entry_class, cattle_id, expense_categories(kind)").eq("business_id", businessId).is("deleted_at", null).order("id")).then((data) => ({ data })),
      // every ledger row (the API returns at most 1000 per request)
      selectAll(() => db.from("inventory_transactions").select("id, type, movement_type, qty, unit_cost, recorded_at, cattle_id, inventory_items!inner(business_id, category, name)").eq("inventory_items.business_id", businessId).order("id")).then((data) => ({ data })),
      selectAll(() => db.from("partner_transactions").select("id, amount, type, recorded_at, partners!inner(business_id, name)").eq("partners.business_id", businessId).is("deleted_at", null).order("id")).then((data) => ({ data })),
      db.from("fixed_assets").select("*").eq("business_id", businessId),
      db.from("liabilities").select("id, name, lender, outstanding, recorded_at, settled_at, notes").eq("business_id", businessId).is("deleted_at", null),
      db.from("loans").select("id, lender_name, principal_amount, interest_rate_pct, loan_date, status, loan_payments(id, amount, paid_at)").eq("business_id", businessId).is("deleted_at", null),
      // Vet fees from medical treatments — these are capitalized costs per cattle,
      // parallel to cost_entries with type="variable" and cattle_id. Without this,
      // all veterinary fees logged via the treatment system are invisible in the P&L.
      selectAll(() => db.from("cattle_treatments").select("id, cattle_id, vet_fee, additional_medical_cost, treated_at, diagnosis, cattle!inner(business_id, tag_id)").eq("cattle.business_id", businessId).order("id")).then((data) => ({ data })),
      db.rpc("get_cattle_consumptions", { p_business_id: businessId }),
    ]);

    type CattleRow = { id: string; tag_id: string | null; purchase_price: number; status: string; purchase_date: string; updated_at: string | null; initial_weight_kg: number | null };
    type SaleRow = { id: string; cattle_id: string; sale_price_total: number; sold_at: string; buyer_name: string | null; cattle?: { tag_id?: string | null } | null };
    type CostRow = { id: string; category: string; amount: number; type: string; recorded_at: string; description: string | null; entry_class: string | null; cattle_id: string | null; expense_categories?: { kind: ExpenseKind } | null };
    type InvTxRow = { id: string; type: string; movement_type: string | null; qty: number; unit_cost: number | null; recorded_at: string; cattle_id: string | null; inventory_items?: { category?: string; name?: string } | null };
    type PartnerTxRow = { id: string; amount: number; type: string; recorded_at: string; partners?: { name?: string | null } | null };
    type TreatmentRow = { id: string; cattle_id: string; vet_fee: number | null; additional_medical_cost: number | null; treated_at: string; diagnosis: string | null; cattle?: { tag_id?: string | null } | null };
    type LiabilityRow = { id: string; name: string | null; lender: string | null; outstanding: number; recorded_at: string | null; settled_at: string | null; notes: string | null };
    type LoanEngineRow = { id: string; lender_name: string | null; principal_amount: number; interest_rate_pct: number; loan_date: string; status: string; loan_payments: { id: string; amount: number; paid_at: string }[] | null };
    type FixedAssetDbRow = {
      id: string; name: string; category: string; description: string | null;
      purchase_date: string; purchase_cost: number; salvage_value: number;
      useful_life_years: number; depreciation_method: string; declining_rate: number | null;
      is_active: boolean; disposed_at: string | null; disposal_value: number | null; notes: string | null;
      source_cost_entry_id?: string | null;
    };

    return {
      cattle: must(cattleRes, "cattle") as unknown as CattleRow[],
      sales: must(salesRes, "sales") as unknown as SaleRow[],
      costs: must(costsRes, "costs") as unknown as CostRow[],
      invTx: must(invTxRes, "stock ledger") as unknown as InvTxRow[],
      partnerTx: must(partnerTxRes, "partner entries") as unknown as PartnerTxRow[],
      fixedAssetDb: must(fixedAssetRes, "fixed assets") as unknown as FixedAssetDbRow[],
      liabData: must(liabRes, "dues") as unknown as LiabilityRow[],
      loansData: must(loansRes, "loans") as unknown as LoanEngineRow[],
      treatments: must(treatmentsRes, "treatments") as unknown as TreatmentRow[],
      rpcFeedData: must(rpcFeedRes, "feed per animal") as any[],
    };
});

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
  // The cached fetch below uses the service-role key (bypasses RLS), so authorization
  // must happen here: tenant + role come from the DB via getBusinessContext().
  const ctx = await getBusinessContext(supabase);
  requireAnyPermission(ctx, [PERMISSIONS.ACCOUNTING_VIEW, PERMISSIONS.ASSET_VIEW, PERMISSIONS.FINANCE_VIEW]);
  const businessId = ctx.businessId;
  const openingCash = Number(ctx.business.opening_cash_balance ?? 0);

  const {
    cattle, sales, costs, invTx, partnerTx, fixedAssetDb, liabData, loansData, treatments,
    rpcFeedData
  } = await getCachedDbData(supabase as Client, businessId);

  // Build cattle lookup for COGS
  const cattleMap = new Map<string, number>();
  for (const c of cattle) cattleMap.set(c.id, Number(c.purchase_price));

  // ── Feed capitalised per animal: RECORDED consumption only ─────
  // Rows recorded against an animal (cattle_id) are capitalised into it. The ration
  // formula ESTIMATE is never booked — it used to be capitalised on top of the herd
  // consumption that was already expensed, counting the same feed twice (P-07).
  const feedCostByCattle: Record<string, number> = {};
  for (const t of rpcFeedData) {
    if (t.cattle_id) {
      feedCostByCattle[t.cattle_id] = (feedCostByCattle[t.cattle_id] ?? 0) + Number(t.total_cost);
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
      sourceCostEntryId: a.source_cost_entry_id ?? null,
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
  // One accounting path per ledger movement (see lib/accounting/inventory-ledger.ts).
  const invLedger = summarizeInventoryLedger(invTx.map((t) => ({ ...t, category: t.inventory_items?.category ?? null })));
  // Only supplier purchases are cash. Opening stock, mixing output and count gains are not.
  const allTimePurchaseValue = invLedger.cashPurchases;
  const openingInventoryValue = invLedger.openingBalance;
  // Signed ledger value — never clamped, never reduced by an estimate.
  const feedInventoryValue = invLedger.inventoryValue;

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
  // Asset purchases paid through a cost entry (entry_class = asset). The payment is the CASH
  // record; when a fixed asset points at it (source_cost_entry_id) the fixed asset is the VALUE
  // record (depreciated) — so its amount is cash once and value once, never twice.
  const allAssetCosts   = costs.filter((c) => c.entry_class === "asset");
  const costEntryAssetTotal = allAssetCosts.reduce((s, c) => s + Number(c.amount), 0);   // cash
  const linkedPaymentIds = new Set(fixedAssets.map((a) => a.sourceCostEntryId).filter(Boolean) as string[]);
  const unlinkedAssetCostValue = allAssetCosts
    .filter((c) => !linkedPaymentIds.has(c.id))
    .reduce((s, c) => s + Number(c.amount), 0);                                            // value without a register entry

  // All-time partner transactions (for equity on balance sheet)
  const allPartnerInvestments = partnerTx
    .filter((t) => t.type === "investment")
    .reduce((s, t) => s + Number(t.amount), 0);
  // Capital withdrawals (return of invested capital) and profit distributions are
  // separated so Partner Capital and Retained Earnings are presented correctly.
  const allPartnerCapitalWithdrawals = partnerTx
    .filter((t) => t.type === "withdrawal")
    .reduce((s, t) => s + Number(t.amount), 0);
  // a profit advance is a drawing against profit, like a profit payout
  const allPartnerProfitDistributions = partnerTx
    .filter((t) => t.type === "profit" || t.type === "advance")
    .reduce((s, t) => s + Number(t.amount), 0);
  // a partner's loan to the farm is owed back: a liability, not capital
  const partnerLoansOutstanding = partnerTx
    .reduce((s, t) => s + (t.type === "loan_in" ? Number(t.amount) : t.type === "loan_repay" ? -Number(t.amount) : 0), 0);
  const allPartnerWithdrawals = allPartnerCapitalWithdrawals + allPartnerProfitDistributions;

  // Fixed asset totals (all-time for balance sheet)
  const totalFixedAssetCost = fixedAssets.reduce((s, a) => s + a.purchaseCost, 0);                 // value (gross)
  const totalAccumDep = fixedAssets.reduce((s, a) => s + a.accumulatedDepreciation, 0);           // all depreciation ever charged
  // A sold or scrapped asset leaves the books on its disposal date: its value goes, the money got for
  // it comes into cash (cash ledger "Asset Sale"), and the difference is a gain or a loss. Before,
  // it stayed on the balance sheet and the money never reached cash.
  const disposedAssets = fixedAssets.filter((a) => !a.isActive && a.disposedAt);
  const disposalGain = (a: FixedAssetRow) => (a.disposalValue ?? 0) - (a.purchaseCost - a.accumulatedDepreciation);
  const disposedCost = disposedAssets.reduce((s, a) => s + a.purchaseCost, 0);
  const disposedAccumDep = disposedAssets.reduce((s, a) => s + a.accumulatedDepreciation, 0);
  const disposedProceeds = disposedAssets.reduce((s, a) => s + (a.disposalValue ?? 0), 0);
  const allTimeDisposalGain = disposedAssets.reduce((s, a) => s + disposalGain(a), 0);
  // Register assets WITHOUT a payment record are paid here; linked ones were paid by their cost entry.
  const unlinkedFixedAssetCash = fixedAssets.filter((a) => !a.sourceCostEntryId).reduce((s, a) => s + a.purchaseCost, 0);

  // All-time accrued interest on loans (for retained earnings and income statement).
  // For paid loans, interest stops accruing on the date the last payment was made —
  // interest CANNOT accrue past the loan payoff date, so cap interestTo at that date.
  // For active loans, accrue through today.
  const todayStr = todayDhaka();
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
  // principal received − payments made, for every loan: the same cash the cash ledger moves
  // (a paid loan whose payments included interest nets below 0; the accrued interest below
  // brings the liability back, so Assets = Liabilities + Equity still holds)
  const loanNetOutstanding = loansData.reduce((s, l) => {
    const paid = (l.loan_payments ?? []).reduce((ps, p) => ps + Number(p.amount), 0);
    return s + Number(l.principal_amount) - paid;
  }, 0);
  const allTimeFinancingCash = liabilitiesOutstanding + loanNetOutstanding + partnerLoansOutstanding;

  // Total liabilities = cash outstanding + accrued interest payable (non-cash).
  // allTimeInterestExpense reduces retainedEarnings; it must also appear here so
  // both sides of Assets = Liabilities + Equity move by the same amount.
  const totalLiabilities = allTimeFinancingCash + allTimeInterestExpense;

  // All-time cash position: ONE dated list of every cash movement (lib/accounting/cash-ledger.ts).
  // The cash statement shows these same rows, so its closing balance is this figure.
  const allTimeSalesRevenue = sales.reduce((s, x) => s + Number(x.sale_price_total), 0);
  const allTimeTotalOpCosts = allExpenseCosts.reduce((s, c) => s + Number(c.amount), 0);
  const cashLedger = buildCashLedger({
    partnerTx: partnerTx.map((t) => ({ ...t, partner_name: t.partners?.name ?? null })),
    sales: sales.map((x) => ({ ...x, tag: x.cattle?.tag_id ?? null })),
    cattle,
    costs,
    treatments: treatments.map((t) => ({ ...t, tag: t.cattle?.tag_id ?? null })),
    invTx: invTx.map((t) => ({ ...t, item_name: t.inventory_items?.name ?? null })),
    fixedAssets: fixedAssetDb,
    liabilities: liabData,
    loans: loansData,
  });
  const allTimeNetCashFlow = cashNet(cashLedger);

  // Retained earnings = cumulative net income minus profit distributions paid to partners.
  // Uses totalAccumDep (all-time accumulated) and allTimeInterestExpense for correctness.
  const allTimeCogs = sales.reduce((s, x) => s + (cattleMap.get(x.cattle_id) ?? 0), 0) + capitalizedSoldCosts;
  
  // Stock that left inventory without going into an animal, net of stock gains (not clamped).
  const allTimeUnallocatedInv = unallocatedInventoryCost(invLedger);

  const retainedEarnings =
    allTimeSalesRevenue - allTimeCogs - allTimeTotalOpCosts
    - totalAccumDep - allTimeInterestExpense - allPartnerProfitDistributions - deceasedCattleLoss - allTimeUnallocatedInv
    + allTimeDisposalGain;

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
    const { code } = mapCostCategory(c.category, c.expense_categories?.kind);
    costBreakdown[code] = (costBreakdown[code] ?? 0) + Number(c.amount);
  }
  const totalCosts = periodExpenseCosts.reduce((s, c) => s + Number(c.amount), 0);

  // Period inventory movements, one path each (see inventory-ledger.ts)
  const periodLedger = summarizeInventoryLedger(periodInvTx.map((t) => ({ ...t, category: t.inventory_items?.category ?? null })));
  // Cash flow: supplier purchases only
  const invPurchases = periodLedger.cashPurchases;
  // Herd feed eaten (recorded, not tied to one animal) + feed-related cash costs (e.g. straw
  // cutting) booked as cost entries — both are the period's feed expense.
  const feedExpenses = periodLedger.feedExpense + (costBreakdown["5200"] ?? 0);
  costBreakdown["6100"] = (costBreakdown["6100"] ?? 0) + periodLedger.medicineExpense;
  // Wastage, count differences and mixing variance (may be negative = gain)
  costBreakdown["6600"] = (costBreakdown["6600"] ?? 0) + periodLedger.otherNet;

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
        // not rounded per asset: the balance sheet adds the same accumulated depreciation unrounded,
        // so rounding here left assets and equity 1 poisha apart
        return s + Math.max(0, depAtEnd.accumulated - depAtStart.accumulated);
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
    .filter((t) => t.type === "investment" || t.type === "loan_in")
    .reduce((s, t) => s + Number(t.amount), 0);
  const partnerWithdrawals = periodPartTx
    .filter((t) => t.type === "withdrawal" || t.type === "profit" || t.type === "advance" || t.type === "loan_repay")
    .reduce((s, t) => s + Number(t.amount), 0);

  // Cash paid for cattle purchased in the period only + capitalized costs paid in period
  // Treatment fees are paid in cash too (the balance sheet already subtracts them, via
  // allCapitalizedCattleCosts) — the statement must agree with the balance sheet.
  const cashPaidCapitalizedCosts = periodAllCostEntries
    .filter(c => c.cattle_id && c.type === "variable")
    .reduce((s, c) => s + Number(c.amount), 0)
    + treatments
      .filter((t) => inPeriod(t.treated_at))
      .reduce((s, t) => s + Number(t.vet_fee ?? 0) + Number(t.additional_medical_cost ?? 0), 0);
  const cashPaidCattle = cattle
    .filter((c) => inPeriod(c.purchase_date))
    .reduce((s, c) => s + Number(c.purchase_price ?? 0), 0) + cashPaidCapitalizedCosts;

  // Fixed asset purchases in period (for cash flow investing section)
  const periodFixedAssetPurchases = fixedAssets
    .filter((a) => inPeriod(a.purchaseDate) && !a.sourceCostEntryId)   // linked ones: paid by their cost entry
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
  const periodDisposed = disposedAssets.filter((a) => inPeriod(a.disposedAt!));
  const assetDisposalGain = periodDisposed.reduce((s, a) => s + disposalGain(a), 0);
  const assetSaleProceeds = periodDisposed.reduce((s, a) => s + (a.disposalValue ?? 0), 0);
  const netIncome = totalSalesRevenue - totalExpenses + assetDisposalGain;

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
    assetDisposalGain,
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
  const netInvesting = -fixedAssetPurchases + assetSaleProceeds;

  const netFinancing = partnerInvestments - partnerWithdrawals;
  const netCashFlow = netOperating + netInvesting + netFinancing;

  const cashFlow: CashFlowStatement = {
    cashFromSales,
    cashPaidCattle,
    cashPaidCosts,
    cashPaidInventory,
    netOperating,
    fixedAssetPurchases,
    assetSaleProceeds,
    netInvesting,
    partnerInvestments,
    partnerWithdrawals,
    netFinancing,
    netCashFlow,
  };

  // ── BALANCE SHEET (always all-time) ───────────────────────────
  const cashAndBank = allTimeNetCashFlow + openingCash;
  const livestock = activeCattleCost + capitalizedActiveCosts;
  const netFixedAssets = (totalFixedAssetCost - disposedCost) - (totalAccumDep - disposedAccumDep) + unlinkedAssetCostValue;
  const totalAssets = cashAndBank + feedInventoryValue + livestock + netFixedAssets;

  // Partner Capital = contributed capital only (investments minus capital returns).
  // Profit distributions reduce Retained Earnings, not Contributed Capital.
  // Opening stock is owned from the start like opening cash: contributed, not bought.
  const partnerCapital = allPartnerInvestments - allPartnerCapitalWithdrawals + openingCash + openingInventoryValue;
  const totalEquity = partnerCapital + retainedEarnings;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
  const discrepancy = Math.abs(totalAssets - totalLiabilitiesAndEquity);

  const balanceSheet: BalanceSheet = {
    cashAndBank,
    feedInventory: feedInventoryValue,
    livestock,
    fixedAssets: totalFixedAssetCost - disposedCost + unlinkedAssetCostValue,   // gross cost of what is still owned
    accumulatedDepreciation: totalAccumDep - disposedAccumDep,
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
    "4200": { code: "4200", name: "Gain/Loss on Asset Disposal", section: "revenue", normalBalance: "credit", debit: 0, credit: 0, balance: 0 },
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
  if (allTimeFinancingCash >= 0) { dr("1100", allTimeFinancingCash); cr("2100", allTimeFinancingCash); }
  else { dr("2100", -allTimeFinancingCash); cr("1100", -allTimeFinancingCash); }   // repaid more than received (interest)

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

  // Capitalized cattle costs paid in cash (vet fees, costs tied to an animal): DR Livestock, CR Cash.
  // Feed eaten by an animal is NOT cash here — it was paid when bought and moves from inventory
  // below; it used to be credited to cash as well, so the trial balance showed less cash than
  // the balance sheet.
  const allTimeCapitalizedCash = allCapitalizedCattleCosts.reduce((s, c) => s + Number(c.amount), 0);
  dr("1400", allTimeCapitalizedCash);
  cr("1100", allTimeCapitalizedCash);

  // Inventory purchases (supplier invoices only): DR Inventory, CR Cash
  dr("1300", allTimePurchaseValue);
  cr("1100", allTimePurchaseValue);

  // Opening stock: DR Inventory, CR Partner Capital (owned before the books started)
  dr("1300", openingInventoryValue);
  cr("3100", openingInventoryValue);

  // Stock used without an animal: DR expense, CR Inventory
  dr("5200", invLedger.feedExpense);
  dr("6100", invLedger.medicineExpense);
  cr("1300", invLedger.feedExpense + invLedger.medicineExpense);
  // Wastage / count differences / mixing variance: loss (DR 6600) or gain (CR 6600)
  if (invLedger.otherNet >= 0) { dr("6600", invLedger.otherNet); cr("1300", invLedger.otherNet); }
  else { dr("1300", -invLedger.otherNet); cr("6600", -invLedger.otherNet); }

  // Feed recorded against an animal is capitalized: DR Livestock, CR Inventory.
  // (Recorded rows only; the ration estimate is never booked.)
  const totalCapitalizedFeed = Object.values(feedCostByCattle).reduce((s, val) => s + val, 0);
  dr("1400", totalCapitalizedFeed);
  cr("1300", totalCapitalizedFeed);

  // Operating costs (expense entries only — assets are capitalized, not expensed)
  for (const c of allExpenseCosts) {
    const { code } = mapCostCategory(c.category, c.expense_categories?.kind);
    dr(code, Number(c.amount));
    cr("1100", Number(c.amount));
  }

  // cost_entries marked as assets: DR Fixed Assets, CR Cash
  for (const c of allAssetCosts) {
    dr("1500", Number(c.amount));
    cr("1100", Number(c.amount));
  }

  // Fixed assets from the fixed_assets table: DR Fixed Assets, CR Cash — only those without a
  // payment record (a linked asset's payment was posted just above)
  dr("1500", unlinkedFixedAssetCash);
  cr("1100", unlinkedFixedAssetCash);

  // Depreciation (all-time accumulated): DR Depreciation Expense, CR Accumulated Depreciation
  dr("6500", totalAccumDep);
  cr("1600", totalAccumDep);

  // Disposals: DR Cash (money got), DR Accumulated Depreciation, CR Fixed Assets (cost);
  // the difference is a gain (CR 4200) or a loss (DR 4200)
  dr("1100", disposedProceeds);
  dr("1600", disposedAccumDep);
  cr("1500", disposedCost);
  if (allTimeDisposalGain >= 0) cr("4200", allTimeDisposalGain); else dr("4200", -allTimeDisposalGain);

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
    cashLedger,
    openingCash,
    businessName: String(ctx.business.name ?? ""),
    asOf: new Date().toISOString(),
  };
}

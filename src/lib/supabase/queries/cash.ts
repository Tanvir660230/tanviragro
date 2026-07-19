import type { SupabaseClient } from "@supabase/supabase-js";
import { calcAccruedInterest } from "@/lib/loan-utils";

export interface CashBalance {
  balance: number;
  opening: number;
  capitalIn: number;
  capitalOut: number;       // withdrawals + profit distributions paid out
  salesTotal: number;
  cattleCost: number;
  invCost: number;
  opCost: number;
  fixedAssetCost: number;
  financingNet: number;     // net cash received from loans + liabilities (proceeds minus repayments)
  accruedInterest: number;  // accrued interest on loans (non-cash liability, shown separately)
  totalIn: number;
  totalOut: number;
}

export async function getCashBalance(
  supabase: SupabaseClient,
  businessId: string
): Promise<CashBalance> {
  const [
    { data: bizData },
    { data: capitalTxns },
    { data: salesData },
    { data: cattleData },
    { data: invPurchases },
    { data: costData },
    { data: assetCostData },
    { data: fixedAssetData },
    { data: loansData },
    { data: liabilitiesData },
  ] = await Promise.all([
    supabase
      .from("businesses")
      .select("opening_cash_balance")
      .eq("id", businessId)
      .maybeSingle(),

    // investment = cash in, withdrawal + profit = cash out
    // partner.deleted_at refers to partner removal — their transactions remain real.
    // partner_transactions.deleted_at marks individually voided/erroneous entries.
    supabase
      .from("partner_transactions")
      .select("amount, type, partners!inner(business_id)")
      .eq("partners.business_id", businessId)
      .in("type", ["investment", "withdrawal", "profit"])
      .is("deleted_at", null),

    supabase
      .from("sales")
      .select("sale_price_total, cattle!inner(business_id, deleted_at)")
      .eq("cattle.business_id", businessId)
      .is("cattle.deleted_at", null)
      .is("deleted_at", null),

    supabase
      .from("cattle")
      .select("purchase_price")
      .eq("business_id", businessId)
      .is("deleted_at", null),

    supabase
      .from("inventory_transactions")
      .select("qty, unit_cost, inventory_items!inner(business_id)")
      .eq("inventory_items.business_id", businessId)
      .eq("type", "purchase")
      .not("unit_cost", "is", null),

    // Operating expense entries only (entry_class='expense')
    supabase
      .from("cost_entries")
      .select("amount")
      .eq("business_id", businessId)
      .eq("entry_class", "expense")
      .is("deleted_at", null),

    // Capital expenditures logged via cost_entries (entry_class='asset') — real cash outflows
    supabase
      .from("cost_entries")
      .select("amount")
      .eq("business_id", businessId)
      .eq("entry_class", "asset")
      .is("deleted_at", null),

    // Fixed assets (added via Fixed Assets page) are cash outflows not captured in cost_entries
    supabase
      .from("fixed_assets")
      .select("purchase_cost")
      .eq("business_id", businessId),

    // Loans: include payments so we can compute net outstanding (proceeds - repaid)
    supabase
      .from("loans")
      .select("principal_amount, interest_rate_pct, loan_date, status, loan_payments(amount)")
      .eq("business_id", businessId)
      .is("deleted_at", null),

    // Liabilities (vendor credit, informal loans) — cash received, still outstanding
    supabase
      .from("liabilities")
      .select("outstanding, settled_at")
      .eq("business_id", businessId)
      .is("deleted_at", null),
  ]);

  const opening = Number((bizData as { opening_cash_balance: number } | null)?.opening_cash_balance ?? 0);

  const txns = (capitalTxns ?? []) as { amount: number; type: string }[];
  const capitalIn = txns
    .filter((t) => t.type === "investment")
    .reduce((s, t) => s + Number(t.amount), 0);
  const capitalOut = txns
    .filter((t) => t.type === "withdrawal" || t.type === "profit")
    .reduce((s, t) => s + Number(t.amount), 0);

  const salesTotal = ((salesData ?? []) as { sale_price_total: number }[])
    .reduce((s, r) => s + Number(r.sale_price_total), 0);

  const cattleCost = ((cattleData ?? []) as { purchase_price: number }[])
    .reduce((s, r) => s + Number(r.purchase_price), 0);

  const invCost = ((invPurchases ?? []) as { qty: number; unit_cost: number | null }[])
    .reduce((s, r) => s + Number(r.qty) * Number(r.unit_cost ?? 0), 0);

  const opCost = ((costData ?? []) as { amount: number }[])
    .reduce((s, r) => s + Number(r.amount), 0);

  // Fixed asset outflows = fixed_assets table + cost_entries logged as capital expenditures
  const fixedAssetTableCost = ((fixedAssetData ?? []) as { purchase_cost: number }[])
    .reduce((s, r) => s + Number(r.purchase_cost), 0);
  const assetCostEntries = ((assetCostData ?? []) as { amount: number }[])
    .reduce((s, r) => s + Number(r.amount), 0);
  const fixedAssetCost = fixedAssetTableCost + assetCostEntries;

  // Net cash from loans = principal received minus repayments already made.
  // Fully-paid loans contribute 0 (received == repaid).
  const loanFinancingNet = ((loansData ?? []) as {
    principal_amount: number;
    interest_rate_pct: number;
    loan_date: string;
    status: string;
    loan_payments: { amount: number }[] | null;
  }[]).reduce((s, l) => {
    if (l.status === "paid") return s;
    const paid = (l.loan_payments ?? []).reduce((ps, p) => ps + Number(p.amount), 0);
    return s + Math.max(0, Number(l.principal_amount) - paid);
  }, 0);

  // Liabilities (vendor credit, informal borrowings) = cash received, not yet repaid
  const liabilitiesNet = ((liabilitiesData ?? []) as { outstanding: number; settled_at: string | null }[])
    .filter((l) => !l.settled_at)
    .reduce((s, l) => s + Number(l.outstanding), 0);

  const financingNet = loanFinancingNet + liabilitiesNet;

  const today = new Date().toISOString().slice(0, 10);
  const accruedInterest = ((loansData ?? []) as { principal_amount: number; interest_rate_pct: number; loan_date: string; status: string }[])
    .reduce((s, l) => s + calcAccruedInterest(Number(l.principal_amount), Number(l.interest_rate_pct ?? 0), l.loan_date, today, [], l.status), 0);

  // financingNet is real cash in the bank from outstanding loans/liabilities.
  // accruedInterest is a non-cash liability — shown for display but excluded from balance.
  const totalIn = opening + capitalIn + salesTotal + financingNet;
  const totalOut = capitalOut + cattleCost + invCost + opCost + fixedAssetCost;

  return {
    balance: totalIn - totalOut,
    opening,
    capitalIn,
    capitalOut,
    salesTotal,
    cattleCost,
    invCost,
    opCost,
    fixedAssetCost,
    financingNet,
    accruedInterest,
    totalIn,
    totalOut,
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { CashEngine } from "@/lib/financial/cash-engine";

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

    supabase
      .from("partner_transactions")
      .select("amount, type, deleted_at, partners!inner(business_id)")
      .eq("partners.business_id", businessId)
      .in("type", ["investment", "withdrawal", "profit", "draw"])
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
      .eq("business_id", businessId),

    supabase
      .from("inventory_transactions")
      .select("qty, unit_cost, inventory_items!inner(business_id)")
      .eq("inventory_items.business_id", businessId)
      .eq("movement_type", "purchase")
      .not("unit_cost", "is", null),

    supabase
      .from("cost_entries")
      .select("amount")
      .eq("business_id", businessId)
      .eq("entry_class", "expense")
      .is("deleted_at", null),

    supabase
      .from("cost_entries")
      .select("amount")
      .eq("business_id", businessId)
      .eq("entry_class", "asset")
      .is("deleted_at", null),

    supabase
      .from("fixed_assets")
      .select("purchase_cost")
      .eq("business_id", businessId),

    supabase
      .from("loans")
      .select("principal_amount, interest_rate_pct, loan_date, status, loan_payments(amount)")
      .eq("business_id", businessId)
      .is("deleted_at", null),

    supabase
      .from("liabilities")
      .select("outstanding, settled_at")
      .eq("business_id", businessId)
      .is("deleted_at", null),
  ]);

  const opening = Number((bizData as { opening_cash_balance: number } | null)?.opening_cash_balance ?? 0);

  const pos = CashEngine.calculateCashPosition({
    openingBalance: opening,
    partnerTransactions: (capitalTxns ?? []) as any[],
    sales: (salesData ?? []) as any[],
    cattle: (cattleData ?? []) as any[],
    inventoryPurchases: (invPurchases ?? []) as any[],
    operatingExpenses: (costData ?? []) as any[],
    costEntryAssets: (assetCostData ?? []) as any[],
    fixedAssets: (fixedAssetData ?? []) as any[],
    loans: (loansData ?? []) as any[],
    liabilities: (liabilitiesData ?? []) as any[],
  });

  return {
    balance: pos.balance,
    opening: pos.opening,
    capitalIn: pos.inflows.capitalIn,
    capitalOut: pos.outflows.capitalOut,
    salesTotal: pos.inflows.salesRevenue,
    cattleCost: pos.outflows.cattlePurchases,
    invCost: pos.outflows.inventoryPurchases,
    opCost: pos.outflows.operatingExpenses,
    fixedAssetCost: pos.outflows.fixedAssetPurchases,
    financingNet: pos.financingNet,
    accruedInterest: pos.accruedInterestPayable,
    totalIn: pos.totalInflow,
    totalOut: pos.totalOutflow,
  };
}
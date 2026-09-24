import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { CashEngine } from "./cash-engine";
import { LoanEngine, type LoanDetails } from "./loan-engine";
import { AssetEngine, type FixedAssetEntity } from "./asset-engine";
import { ExpenseEngine, type ExpenseRecord } from "./expense-engine";
import { RevenueEngine, type SaleRecord } from "./revenue-engine";
import type { CashPosition } from "./types";

export class CentralFinancialRepository {
  /**
   * Fetches all raw financial data with 30-day ISR caching, keyed per business tenant.
   */
  public static async getCachedFinancialData(businessId: string) {
    const fetcher = unstable_cache(
      async () => {
        const supabaseAdmin = createSupabaseClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const [
          bizRes,
          cattleRes,
          salesRes,
          costsRes,
          invTxRes,
          partnerTxRes,
          fixedAssetRes,
          liabRes,
          loansRes,
        ] = await Promise.all([
          supabaseAdmin
            .from("businesses")
            .select("id, opening_cash_balance, name")
            .eq("id", businessId)
            .maybeSingle(),

          supabaseAdmin
            .from("cattle")
            .select("id, purchase_price, purchase_date, status")
            .eq("business_id", businessId)
            .is("deleted_at", null),

          supabaseAdmin
            .from("sales")
            .select("id, cattle_id, sale_price_total, sold_at, buyer_name, buyer_phone, cattle!inner(business_id)")
            .eq("cattle.business_id", businessId)
            .is("deleted_at", null),

          supabaseAdmin
            .from("cost_entries")
            .select("id, category, amount, type, recorded_at, entry_class, cattle_id, description")
            .eq("business_id", businessId)
            .is("deleted_at", null),

          supabaseAdmin
            .from("inventory_transactions")
            .select("id, type, qty, unit_cost, recorded_at, cattle_id, inventory_items!inner(business_id)")
            .eq("inventory_items.business_id", businessId),

          supabaseAdmin
            .from("partner_transactions")
            .select("id, amount, type, recorded_at, notes, deleted_at, partners!inner(business_id, name)")
            .eq("partners.business_id", businessId)
            .is("deleted_at", null),

          supabaseAdmin
            .from("fixed_assets")
            .select("id, name, category, description, purchase_date, purchase_cost, salvage_value, useful_life_years, depreciation_method, declining_rate, is_active, disposed_at, disposal_value, notes, source_cost_entry_id")
            .eq("business_id", businessId),

          supabaseAdmin
            .from("liabilities")
            .select("id, name, category, principal, outstanding, lender, due_date, settled_at")
            .eq("business_id", businessId)
            .is("deleted_at", null),

          supabaseAdmin
            .from("loans")
            .select("id, lender_name, principal_amount, interest_rate_pct, loan_date, due_date, status, loan_payments(id, amount, payment_date, notes)")
            .eq("business_id", businessId)
            .is("deleted_at", null),
        ]);

        return {
          business: bizRes.data,
          cattle: cattleRes.data ?? [],
          sales: salesRes.data ?? [],
          costs: costsRes.data ?? [],
          inventoryTransactions: invTxRes.data ?? [],
          partnerTransactions: partnerTxRes.data ?? [],
          fixedAssets: fixedAssetRes.data ?? [],
          liabilities: liabRes.data ?? [],
          loans: loansRes.data ?? [],
        };
      },
      [`central-financial-${businessId}`],
      { tags: ["accounting", `accounting-${businessId}`, `financial-${businessId}`], revalidate: 3600 * 24 * 30 }
    );

    return fetcher();
  }

  /**
   * Retrieves the authoritative Cash Position for the tenant.
   */
  public static async getAuthoritativeCashPosition(businessId: string): Promise<CashPosition> {
    const raw = await this.getCachedFinancialData(businessId);
    const openingBalance = Number(raw.business?.opening_cash_balance) || 0;

    const opExpenses = (raw.costs ?? []).filter((c) => (c.entry_class ?? "expense") === "expense");
    const assetCosts = (raw.costs ?? []).filter((c) => c.entry_class === "asset");
    const invPurchases = (raw.inventoryTransactions ?? []).filter((i) => i.type === "purchase");

    return CashEngine.calculateCashPosition({
      openingBalance,
      partnerTransactions: raw.partnerTransactions.map((p) => ({
        amount: Number(p.amount) || 0,
        type: p.type,
        deleted_at: p.deleted_at,
      })),
      sales: raw.sales.map((s) => ({ sale_price_total: Number(s.sale_price_total) || 0 })),
      cattle: raw.cattle.map((c) => ({ purchase_price: Number(c.purchase_price) || 0 })),
      inventoryPurchases: invPurchases.map((i) => ({
        qty: Number(i.qty) || 0,
        unit_cost: i.unit_cost !== null ? Number(i.unit_cost) : null,
      })),
      operatingExpenses: opExpenses.map((c) => ({ amount: Number(c.amount) || 0 })),
      costEntryAssets: assetCosts.map((c) => ({ amount: Number(c.amount) || 0 })),
      // cash: register assets without a payment record only (linked ones are in costEntryAssets)
      fixedAssets: raw.fixedAssets.filter((f: { source_cost_entry_id?: string | null }) => !f.source_cost_entry_id)
        .map((f) => ({ purchase_cost: Number(f.purchase_cost) || 0 })),
      loans: raw.loans.map((l: any) => ({
        principal_amount: Number(l.principal_amount) || 0,
        interest_rate_pct: Number(l.interest_rate_pct) || 0,
        loan_date: l.loan_date,
        status: l.status,
        loan_payments: (l.loan_payments ?? []).map((p: any) => ({ amount: Number(p.amount) || 0 })),
      })),
      liabilities: raw.liabilities.map((l) => ({
        outstanding: Number(l.outstanding) || 0,
        settled_at: l.settled_at,
      })),
    });
  }
}
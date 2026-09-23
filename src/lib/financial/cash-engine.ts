import type { CashPosition } from "./types";
import { calculateAccruedInterest } from "./calculations";

export interface RawCashDataSources {
  openingBalance: number;
  partnerTransactions: { amount: number; type: string; deleted_at?: string | null }[];
  sales: { sale_price_total: number }[];
  cattle: { purchase_price: number }[];
  inventoryPurchases: { qty: number; unit_cost: number | null }[];
  operatingExpenses: { amount: number }[];
  costEntryAssets: { amount: number }[];
  fixedAssets: { purchase_cost: number }[];
  loans: {
    principal_amount: number;
    interest_rate_pct: number;
    loan_date: string;
    status: string;
    loan_payments?: { amount: number }[] | null;
  }[];
  liabilities: { outstanding: number; settled_at?: string | null }[];
  asOfDate?: string;
}

export class CashEngine {
  /**
   * Calculates the exact authoritative cash position from consolidated raw data.
   */
  public static calculateCashPosition(data: RawCashDataSources): CashPosition {
    const opening = Number(data.openingBalance) || 0;
    const asOf = data.asOfDate || new Date().toISOString().slice(0, 10);

    // Partner Capital
    const validPartnerTxns = data.partnerTransactions.filter((t) => !t.deleted_at);
    const capitalIn = validPartnerTxns
      .filter((t) => t.type === "investment")
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const capitalOut = validPartnerTxns
      .filter((t) => t.type === "withdrawal" || t.type === "profit" || t.type === "draw")
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);

    // Sales Revenue
    const salesRevenue = data.sales.reduce(
      (s, r) => s + (Number(r.sale_price_total) || 0),
      0
    );

    // Cattle Purchases
    const cattlePurchases = data.cattle.reduce(
      (s, r) => s + (Number(r.purchase_price) || 0),
      0
    );

    // Inventory Purchases
    const inventoryPurchases = data.inventoryPurchases.reduce(
      (s, r) => s + (Number(r.qty) || 0) * (Number(r.unit_cost) || 0),
      0
    );

    // Operating Expenses
    const operatingExpenses = data.operatingExpenses.reduce(
      (s, r) => s + (Number(r.amount) || 0),
      0
    );

    // Fixed Assets
    const costEntryAssetAmount = data.costEntryAssets.reduce(
      (s, r) => s + (Number(r.amount) || 0),
      0
    );
    const fixedAssetPurchases =
      data.fixedAssets.reduce((s, r) => s + (Number(r.purchase_cost) || 0), 0) +
      costEntryAssetAmount;

    // Loans Net Proceeds
    const loanProceeds = data.loans.reduce((s, l) => {
      if (l.status === "paid") return s;
      const principal = Number(l.principal_amount) || 0;
      const paid = (l.loan_payments ?? []).reduce(
        (ps, p) => ps + (Number(p.amount) || 0),
        0
      );
      return s + Math.max(0, principal - paid);
    }, 0);

    // Liabilities Net
    const liabilityProceeds = data.liabilities
      .filter((l) => !l.settled_at)
      .reduce((s, l) => s + (Number(l.outstanding) || 0), 0);

    const financingNet = loanProceeds + liabilityProceeds;

    // Accrued Interest (non-cash liability)
    const accruedInterestPayable = data.loans.reduce(
      (s, l) =>
        s +
        calculateAccruedInterest(
          Number(l.principal_amount) || 0,
          Number(l.interest_rate_pct) || 0,
          l.loan_date,
          asOf,
          [],
          l.status
        ),
      0
    );

    const totalInflow = opening + capitalIn + salesRevenue + financingNet;
    const totalOutflow =
      capitalOut +
      cattlePurchases +
      inventoryPurchases +
      operatingExpenses +
      fixedAssetPurchases;

    const balance = totalInflow - totalOutflow;

    return {
      balance: Math.round(balance * 100) / 100,
      opening: Math.round(opening * 100) / 100,
      totalInflow: Math.round(totalInflow * 100) / 100,
      totalOutflow: Math.round(totalOutflow * 100) / 100,
      inflows: {
        capitalIn: Math.round(capitalIn * 100) / 100,
        salesRevenue: Math.round(salesRevenue * 100) / 100,
        loanProceeds: Math.round(loanProceeds * 100) / 100,
        liabilityProceeds: Math.round(liabilityProceeds * 100) / 100,
        otherIncome: 0,
      },
      outflows: {
        capitalOut: Math.round(capitalOut * 100) / 100,
        cattlePurchases: Math.round(cattlePurchases * 100) / 100,
        inventoryPurchases: Math.round(inventoryPurchases * 100) / 100,
        operatingExpenses: Math.round(operatingExpenses * 100) / 100,
        fixedAssetPurchases: Math.round(fixedAssetPurchases * 100) / 100,
        loanRepayments: 0,
        liabilityRepayments: 0,
      },
      financingNet: Math.round(financingNet * 100) / 100,
      accruedInterestPayable: Math.round(accruedInterestPayable * 100) / 100,
      asOf,
    };
  }
}
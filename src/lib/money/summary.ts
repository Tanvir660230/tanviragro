import type { AccountingData } from "@/lib/accounting/engine";

/**
 * The money figures kept apart: cash out ≠ operating expense ≠ asset value.
 * Operating expenses = the farm's running costs (feed eaten, vet, labour, utilities, rent,
 * transport, repairs, general) — not asset purchases, not depreciation, not cattle sold.
 */
export function capitalSummary(a: AccountingData) {
  const is = a.incomeStatement, bs = a.balanceSheet, cf = a.cashFlow;
  const operatingExpenses = is.feedExpenses + is.vetMedical + is.laborWages + is.utilities + is.rentLease
    + is.transport + is.repairsMaintenance + is.generalExpenses;
  const operatingProfit = is.totalRevenue - is.cogs - is.directCattleCosts - operatingExpenses - is.depreciation;
  const totalCashOutflow = cf.cashPaidCattle + cf.cashPaidCosts + cf.cashPaidInventory + cf.fixedAssetPurchases + cf.partnerWithdrawals;
  return {
    cash: bs.cashAndBank,
    operatingExpenses,
    operatingProfit,
    assetValue: bs.netFixedAssets,
    capitalExpenditure: cf.fixedAssetPurchases,
    depreciation: is.depreciation,
    totalCashOutflow,
  };
}

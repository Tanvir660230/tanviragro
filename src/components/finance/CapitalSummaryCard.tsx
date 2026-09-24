import { getServerClient } from "@/lib/supabase/cached";
import { getAccountingData, type AccountingData } from "@/lib/accounting/engine";

function bdt(n: number): string {
  if (!isFinite(n)) return "৳—";
  const sign = n < 0 ? "−" : "";
  return `${sign}৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
}

/** The seven money figures kept apart: cash out ≠ operating expense ≠ asset value. */
export function capitalSummary(a: AccountingData) {
  const is = a.incomeStatement, bs = a.balanceSheet, cf = a.cashFlow;
  // running costs of the farm — not asset purchases, not depreciation, not the cost of cattle sold
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

export async function CapitalSummaryCard() {
  let data: AccountingData;
  try {
    data = await getAccountingData(await getServerClient());
  } catch {
    return null;   // no accounting permission → the card is not shown
  }
  const s = capitalSummary(data);
  const tiles: { label: string; value: number; note: string }[] = [
    { label: "Cash / bank", value: s.cash, note: "money on hand now" },
    { label: "Operating expenses", value: s.operatingExpenses, note: "feed, vet, labour, utilities, transport, general" },
    { label: "Depreciation", value: s.depreciation, note: "share of asset cost used up" },
    { label: "Operating profit", value: s.operatingProfit, note: "sales − cattle sold − operating expenses − depreciation" },
    { label: "Asset value", value: s.assetValue, note: "shed, machines, equipment after depreciation" },
    { label: "Capital expenditure", value: s.capitalExpenditure, note: "paid for assets (not an expense)" },
    { label: "Total cash outflow", value: s.totalCashOutflow, note: "everything paid out, incl. assets and cattle" },
  ];
  return (
    <section className="rounded-xl border border-border/70 bg-card shadow-card" aria-label="Money summary">
      <div className="flex items-baseline justify-between gap-3 border-b border-border/60 px-5 py-3">
        <h2 className="text-sm font-semibold">Money summary</h2>
        <p className="text-xs text-muted-foreground">All time · cash out ≠ expense ≠ asset value</p>
      </div>
      <div className="grid grid-cols-2 gap-px bg-border/60 sm:grid-cols-4 lg:grid-cols-7">
        {tiles.map((t) => (
          <div key={t.label} className="bg-card px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t.label}</p>
            <p className={`mt-1 text-lg font-bold tabular-nums ${t.value < 0 ? "text-red-600 dark:text-red-400" : ""}`}>{bdt(t.value)}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{t.note}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

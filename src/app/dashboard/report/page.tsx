import { Metadata } from "next";
import { getServerClient } from "@/lib/supabase/cached";
import { getCashBalance } from "@/lib/supabase/queries/cash";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/ui/print-button";
import { ZakatCalculator } from "@/components/finance/ZakatCalculator";

export const metadata: Metadata = { title: "Farm Report" };

function fmt(n: number) {
  return "৳" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.abs(n));
}

export default async function ReportPage() {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? "";

  const { data: bizRow } = userId
    ? await supabase
        .from("businesses")
        .select("id, name")
        .eq("owner_id", userId)
        .maybeSingle()
    : { data: null };

  const businessId: string | null = (bizRow as { id?: string } | null)?.id ?? null;
  const bizName: string           = (bizRow as { name?: string } | null)?.name ?? "Farm";

  const [
    { data: cattleData },
    { data: costsData },
    { data: salesData },
    { data: inventoryData },
    { data: loansData },
    { data: monthlyConsumptionsData },
    // Proper cash balance — same function used by the dashboard Cash Balance widget
    cashBalanceResult,
    { data: treatmentsData },
  ] = await Promise.all([
    businessId
      ? supabase
          .from("cattle")
          .select("id, status, purchase_price")
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .limit(1000)
      : Promise.resolve({ data: [] }),

    // Expense entries only (no assets), matches finance page
    businessId
      ? supabase
          .from("cost_entries")
          .select("amount, type, cattle_id")
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .eq("entry_class", "expense")
          .limit(5000)
      : Promise.resolve({ data: [] }),

    businessId
      ? supabase
          .from("sales")
          .select("cattle_id, sale_price_total, cattle!inner(business_id, purchase_price)")
          .eq("cattle.business_id", businessId)
          .is("deleted_at", null)
          .limit(2000)
      : Promise.resolve({ data: [] }),

    businessId
      ? supabase
          .from("inventory_items")
          .select("name, category, unit, inventory_transactions(qty, type, unit_cost)")
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .limit(500)
      : Promise.resolve({ data: [] }),

    businessId
      ? supabase
          .from("loans")
          .select("principal_amount, status, loan_payments(amount)")
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .limit(500)
      : Promise.resolve({ data: [] }),

    // Same RPC the finance page PLSummary uses for feed/inventory costs
    businessId
      ? supabase.rpc("get_monthly_consumptions", { p_business_id: businessId })
      : Promise.resolve({ data: [] }),

    // Proper cash balance — fetches all sources correctly (cattle cost, inv purchases, loans, etc.)
    businessId
      ? getCashBalance(supabase, businessId)
      : Promise.resolve({ balance: 0, opening: 0, capitalIn: 0, capitalOut: 0, salesTotal: 0, cattleCost: 0, invCost: 0, opCost: 0, fixedAssetCost: 0, financingNet: 0, accruedInterest: 0, totalIn: 0, totalOut: 0 }),
    businessId
      ? supabase
          .from("cattle_treatments")
          .select("cattle_id, vet_fee, additional_medical_cost, cattle!inner(business_id)")
          .eq("cattle.business_id", businessId)
      : Promise.resolve({ data: [] }),
  ]);

  // ── Types ─────────────────────────────────────────────────────────────────────
  type CRow    = { id: string; status: string; purchase_price: number };
  type CoRow   = { amount: number; type: string; cattle_id?: string | null };
  type SRow    = { cattle_id: string; sale_price_total: number; cattle: { purchase_price: number } | null };
  type InvRow  = { name: string; category: string; unit: string; inventory_transactions: { qty: number; type: string; unit_cost: number | null }[] };
  type MonthRow = { month_yr: string; category: string; total_cost: number };

  const cattle              = (cattleData               ?? []) as CRow[];
  const costs               = (costsData                ?? []) as CoRow[];
  const sales               = (salesData                ?? []) as SRow[];
  const inventory           = (inventoryData            ?? []) as InvRow[];
  const monthlyConsumptions = (monthlyConsumptionsData  ?? []) as MonthRow[];

  // ── Cattle ────────────────────────────────────────────────────────────────────
  const activeCattle    = cattle.filter((c) => c.status === "active");
  const activeCattleIds = new Set(activeCattle.map((c) => c.id));
  const soldCattle      = cattle.filter((c) => c.status === "sold");
  const totalCattleValue = activeCattle.reduce((s, c) => s + Number(c.purchase_price), 0);

  // ── Revenue ───────────────────────────────────────────────────────────────────
  const totalRevenue = sales.reduce((s, r) => s + Number(r.sale_price_total ?? 0), 0);

  // ── COGS (purchase price of sold cattle only) ─────────────────────────────────
  const totalCOGS = sales.reduce((s, r) => s + Number(r.cattle?.purchase_price ?? 0), 0);

  // ── Fixed operating costs ─────────────────────────────────────────────────────
  const totalFixedCosts = costs
    .filter((c) => c.type === "fixed")
    .reduce((s, c) => s + Number(c.amount ?? 0), 0);

  // ── Variable operating costs — general only (no cattle_id), matches finance page
  // Per-cattle variable costs are excluded here (same as finance page PLSummary).
  const totalVariableCosts = costs
    .filter((c) => c.type === "variable" && !c.cattle_id)
    .reduce((s, c) => s + Number(c.amount ?? 0), 0);

  // ── Feed & inventory consumption costs (from RPC, matches finance page) ────────
  const totalFeedCosts = monthlyConsumptions
    .filter((m) => m.category === "feed")
    .reduce((s, m) => s + Number(m.total_cost ?? 0), 0);
  const totalOtherInventoryCosts = monthlyConsumptions
    .filter((m) => m.category !== "feed")
    .reduce((s, m) => s + Number(m.total_cost ?? 0), 0);

  // ── Medical Costs ─────────────────────────────────────────────────────────────
  const treatments = (treatmentsData ?? []) as { cattle_id: string; vet_fee: number; additional_medical_cost: number }[];
  const totalMedicalCosts = treatments.reduce((s, t) => s + Number(t.vet_fee ?? 0) + Number(t.additional_medical_cost ?? 0), 0);

  // ── Net P&L (matches finance page "all time" filter) ──────────────────────────
  const totalExpenses = totalCOGS + totalFixedCosts + totalVariableCosts + totalFeedCosts + totalOtherInventoryCosts + totalMedicalCosts;
  const netPL         = totalRevenue - totalExpenses;

  // ── Inventory (current stock value) ───────────────────────────────────────────
  const currentInventory = inventory
    .map((item) => {
      let stock = 0;
      let purchasedQty = 0;
      let purchasedValue = 0;
      for (const tx of item.inventory_transactions ?? []) {
        const qty = Number(tx.qty);
        if (tx.type === "purchase") {
          stock += qty;
          purchasedQty += qty;
          purchasedValue += qty * Number(tx.unit_cost ?? 0);
        } else {
          stock -= qty;
        }
      }
      const avgCost = purchasedQty > 0 ? purchasedValue / purchasedQty : 0;
      return { name: item.name, unit: item.unit, stock, value: Math.max(0, stock) * avgCost };
    })
    .filter((i) => i.stock > 0)
    .sort((a, b) => b.value - a.value);

  const totalInventoryValue = currentInventory.reduce((s, i) => s + i.value, 0);

  // ── Outstanding loans (for Zakat deduction) ──────────────────────────────────
  type LoanRow = { principal_amount: number; status: string; loan_payments: { amount: number }[] };
  const outstandingLoans = ((loansData ?? []) as LoanRow[]).reduce((s, l) => {
    if (l.status === "paid") return s;
    const paid = (l.loan_payments ?? []).reduce((p, r) => p + Number(r.amount), 0);
    return s + Math.max(0, Number(l.principal_amount) - paid);
  }, 0);

  // ── Cash balance — from the same function the dashboard widget uses ────────────
  // This correctly accounts for: opening cash, capital in/out, all cattle purchases
  // (not just COGS), inventory purchases (not just consumed), fixed assets, loans.
  const cashBalance = Math.max(0, cashBalanceResult.balance);

  const reportDate = new Date().toLocaleDateString("en-US", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-muted/40 print:bg-white">
      {/* ── Top controls (screen only) ─────────────────────────────────── */}
      <div className="print:hidden sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/60 px-4 py-2.5 flex items-center justify-between gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <span className="text-sm font-semibold text-muted-foreground hidden sm:block">
          Farm Report — All-Time Summary
        </span>
        <PrintButton />
      </div>

      {/* ── Zakat Calculator (screen only) ─────────────────────────────── */}
      <div className="print:hidden max-w-4xl mx-auto px-4 pt-4 pb-2">
        <ZakatCalculator
          cattlePurchaseValue={totalCattleValue}
          activeCattleCount={activeCattle.length}
          inventoryValue={totalInventoryValue}
          outstandingLoans={outstandingLoans}
          cashBalance={cashBalance}
        />
      </div>

      {/* ── Printable Report ────────────────────────────────────────────── */}
      <div className="py-6 px-4 print:p-0">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg print:shadow-none print:rounded-none print:max-w-none">

          {/* Header */}
          <div className="bg-slate-900 text-white rounded-t-xl print:rounded-none px-8 py-6 print:px-8 print:py-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-1">
                  Full Farm Status Report
                </p>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{bizName}</h1>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-slate-400 text-xs uppercase tracking-widest">Report Date</p>
                <p className="text-base font-semibold mt-0.5">{reportDate}</p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-8">

            {/* ── KPI Strip ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiTile
                label="Active Cattle"
                value={activeCattle.length.toString()}
                sub={soldCattle.length > 0 ? `${soldCattle.length} sold` : undefined}
              />
              <KpiTile
                label="Cattle Value"
                value={fmt(totalCattleValue)}
                sub="at purchase cost"
              />
              <KpiTile
                label="Total Revenue"
                value={fmt(totalRevenue)}
                color="green"
              />
              <KpiTile
                label="Net P&L"
                value={(netPL < 0 ? "−" : "") + fmt(netPL)}
                color={netPL >= 0 ? "green" : "red"}
                sub={netPL >= 0 ? "Profitable" : "Loss"}
              />
            </div>

            {/* ── P&L Statement ──────────────────────────────────────────── */}
            <section>
              <SectionHeader>Profit &amp; Loss Statement</SectionHeader>
              <table className="w-full text-sm border-collapse">
                <tbody>
                  {/* Revenue */}
                  <PLRow
                    label="Total Revenue (Sales)"
                    value={fmt(totalRevenue)}
                    valueColor="green"
                    bold
                  />
                  <tr><td colSpan={2} className="py-1" /></tr>

                  {/* Expenses */}
                  <tr>
                    <td colSpan={2} className="px-0 py-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Expenses
                      </p>
                    </td>
                  </tr>
                  <PLRow label="Cattle Purchase Cost (COGS)" value={"−" + fmt(totalCOGS)} indent />
                  <PLRow label="Fixed Operating Costs" value={"−" + fmt(totalFixedCosts)} indent />
                  <PLRow label="Variable Operating Costs" value={"−" + fmt(totalVariableCosts)} indent />
                  {totalMedicalCosts > 0 && (
                    <PLRow label="Medical Expenses" value={"−" + fmt(totalMedicalCosts)} indent />
                  )}
                  <PLRow label="Feed Costs" value={"−" + fmt(totalFeedCosts)} indent />
                  {totalOtherInventoryCosts > 0 && (
                    <PLRow label="Other Inventory Costs" value={"−" + fmt(totalOtherInventoryCosts)} indent />
                  )}
                  <PLRow
                    label="Total Expenses"
                    value={"−" + fmt(totalExpenses)}
                    valueColor="red"
                    bold
                    borderTop
                  />
                  <tr><td colSpan={2} className="py-1" /></tr>

                  {/* Net P&L */}
                  <PLRow
                    label="Net P&L"
                    value={(netPL < 0 ? "−" : "+") + fmt(netPL)}
                    valueColor={netPL >= 0 ? "green" : "red"}
                    bold
                    borderTop
                    highlight
                  />
                </tbody>
              </table>
            </section>

            {/* ── Assets ──────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {/* Cattle Summary */}
              <section>
                <SectionHeader>Cattle Summary</SectionHeader>
                <table className="w-full text-sm border-collapse">
                  <tbody className="divide-y divide-slate-100">
                    <AssetRow label="Active (in pen)" value={activeCattle.length.toString()} />
                    <AssetRow label="Sold (all-time)" value={soldCattle.length.toString()} />
                    <AssetRow label="Total cattle value" value={fmt(totalCattleValue)} bold />
                  </tbody>
                </table>
              </section>

              {/* Inventory Stock */}
              <section>
                <SectionHeader>Inventory Assets</SectionHeader>
                {currentInventory.length > 0 ? (
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-200">
                        <th className="py-2 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Item</th>
                        <th className="py-2 text-right text-xs font-bold text-slate-500 uppercase tracking-wide">Stock</th>
                        <th className="py-2 text-right text-xs font-bold text-slate-500 uppercase tracking-wide">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentInventory.map((item, i) => (
                        <tr key={i}>
                          <td className="py-2 font-medium">{item.name}</td>
                          <td className="py-2 text-right text-slate-600">
                            {item.stock.toFixed(1)} {item.unit}
                          </td>
                          <td className="py-2 text-right font-semibold">{fmt(item.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50">
                        <td colSpan={2} className="py-2 px-0 font-bold text-sm">Total Inventory</td>
                        <td className="py-2 text-right font-black">{fmt(totalInventoryValue)}</td>
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  <p className="text-slate-400 italic text-sm">No inventory in stock.</p>
                )}
              </section>
            </div>

            {/* ── Footer ──────────────────────────────────────────────────── */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400">
              <span>Generated by {bizName} ERP</span>
              <span>{reportDate}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 border-b border-slate-200 pb-2 mb-3">
      {children}
    </h2>
  );
}

function KpiTile({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: "green" | "red";
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
      <p
        className={
          "text-xl font-black tabular-nums " +
          (color === "green"
            ? "text-emerald-700"
            : color === "red"
            ? "text-red-600"
            : "text-slate-900")
        }
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function PLRow({
  label,
  value,
  valueColor,
  bold,
  indent,
  borderTop,
  highlight,
}: {
  label: string;
  value: string;
  valueColor?: "green" | "red";
  bold?: boolean;
  indent?: boolean;
  borderTop?: boolean;
  highlight?: boolean;
}) {
  return (
    <tr
      className={
        (borderTop ? "border-t-2 border-slate-300 " : "") +
        (highlight ? "bg-slate-50 " : "")
      }
    >
      <td
        className={
          "py-2.5 " +
          (indent ? "pl-5 " : "") +
          (bold ? "font-bold " : "font-medium text-slate-600 ")
        }
      >
        {label}
      </td>
      <td
        className={
          "py-2.5 text-right tabular-nums " +
          (bold ? "font-black " : "font-semibold ") +
          (valueColor === "green"
            ? "text-emerald-700 "
            : valueColor === "red"
            ? "text-red-600 "
            : "text-slate-700 ")
        }
      >
        {value}
      </td>
    </tr>
  );
}

function AssetRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <tr>
      <td className={"py-2 " + (bold ? "font-bold" : "text-slate-600")}>{label}</td>
      <td className={"py-2 text-right tabular-nums " + (bold ? "font-black" : "font-medium")}>
        {value}
      </td>
    </tr>
  );
}

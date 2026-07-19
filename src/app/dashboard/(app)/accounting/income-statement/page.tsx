import { PageHeader } from "@/components/shared/PageHeader";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccountingData } from "@/lib/accounting/engine";
import { buttonVariants } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = { title: "Income Statement" };

function fmt(n: number) {
  return `৳${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Row({ label, value, indent, bold, border, negative }: {
  label: string;
  value: number;
  indent?: boolean;
  bold?: boolean;
  border?: boolean;
  negative?: boolean;
}) {
  return (
    <div className={`flex items-start justify-between py-2 px-4 gap-4 ${border ? "border-t border-foreground/20" : "border-b border-border/40"} ${bold ? "font-semibold" : ""}`}>
      <span className={indent ? "pl-4 text-sm text-muted-foreground" : "text-sm"}>{label}</span>
      <span className={`tabular-nums font-mono text-sm shrink-0 ${
        negative && value > 0 ? "text-red-600 dark:text-red-400" : ""
      }`}>
        {negative && value > 0 ? `(${fmt(value)})` : fmt(value)}
      </span>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-2 bg-muted/30 border-b border-border">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>
    </div>
  );
}

export default async function IncomeStatementPage() {
   
  const supabase = await createClient();
  const { incomeStatement: is, asOf } = await getAccountingData(supabase);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Income Statement"
        subtitle={`All periods · as of ${new Date(asOf).toLocaleDateString("en-US", { dateStyle: "long" })}`}
        back="/dashboard/accounting"
      />

      {/* Revenue + COGS — side by side on large screens */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl bg-card border border-border/60 shadow-card overflow-hidden">
          <SectionHeader>REVENUE</SectionHeader>
          <Row label="Cattle Sales" value={is.cattleSales} indent />
          <Row label="TOTAL REVENUE" value={is.totalRevenue} bold border />
        </div>
        <div className="rounded-xl bg-card border border-border/60 shadow-card overflow-hidden">
          <SectionHeader>COST OF GOODS SOLD</SectionHeader>
          <Row label="Cattle Purchase Cost" value={is.cogs} indent negative />
          {is.directCattleCosts > 0 && <Row label="Direct Cattle Costs (Vet, Transport etc.)" value={is.directCattleCosts} indent negative />}
          <Row label="GROSS PROFIT" value={is.grossProfit} bold border />
        </div>
      </div>

      {/* Operating expenses — full width (many rows) */}
      <div className="rounded-xl bg-card border border-border/60 shadow-card overflow-hidden">
        <SectionHeader>OPERATING EXPENSES</SectionHeader>
        {is.feedExpenses > 0 && <Row label="Feed Expenses" value={is.feedExpenses} indent negative />}
        {is.vetMedical > 0 && <Row label="Veterinary & Medical" value={is.vetMedical} indent negative />}
        {is.laborWages > 0 && <Row label="Labor & Wages" value={is.laborWages} indent negative />}
        {is.utilities > 0 && <Row label="Utilities" value={is.utilities} indent negative />}
        {is.rentLease > 0 && <Row label="Rent & Lease" value={is.rentLease} indent negative />}
        {is.transport > 0 && <Row label="Transport" value={is.transport} indent negative />}
        {is.repairsMaintenance > 0 && <Row label="Repairs & Maintenance" value={is.repairsMaintenance} indent negative />}
        {is.depreciation > 0 && <Row label="Depreciation" value={is.depreciation} indent negative />}
        {is.interestExpense > 0 && <Row label="Interest Expense" value={is.interestExpense} indent negative />}
        {is.livestockLoss > 0 && <Row label="Livestock Mortality Write-off" value={is.livestockLoss} indent negative />}
        {is.generalExpenses > 0 && <Row label="General Expenses" value={is.generalExpenses} indent negative />}
        <Row label="TOTAL EXPENSES" value={is.totalExpenses} bold border negative />
      </div>

      {/* Net income */}
      <div className="rounded-xl ring-2 overflow-hidden" style={{
        borderColor: is.netIncome >= 0 ? "oklch(0.6 0.15 145 / 0.5)" : "rgb(220 38 38 / 0.3)"
      }}>
        <div className={`px-4 py-4 ${is.netIncome >= 0 ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-red-50 dark:bg-red-950/30"}`}>
          <div className="flex items-center justify-between">
            <span className="font-bold text-base">NET INCOME</span>
            <span className={`text-2xl font-bold tabular-nums ${
              is.netIncome >= 0
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}>
              {is.netIncome < 0 && "-"}{fmt(is.netIncome)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

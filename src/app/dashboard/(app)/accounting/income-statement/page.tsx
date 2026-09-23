import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccountingData } from "@/lib/accounting/engine";
import { ArrowLeft, TrendingUp, DollarSign, Activity, Percent, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { StatementReportHeader } from "@/components/finance/finance-ui";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PERMISSIONS } from "@/constants/roles";

export const metadata: Metadata = { title: "Income Statement | Tanvir Agro Accounting" };

function fmt(n: number) {
  return `৳${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Row({
  label,
  value,
  indent,
  bold,
  border,
  negative,
  highlight,
  subtext,
}: {
  label: string;
  value: number;
  indent?: boolean;
  bold?: boolean;
  border?: boolean;
  negative?: boolean;
  highlight?: boolean;
  subtext?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between py-2.5 px-5 gap-4 transition-colors ${
        border ? "border-t border-border/80 bg-muted/20" : ""
      } ${highlight ? "bg-muted/40 font-semibold" : "hover:bg-muted/20"} ${bold ? "font-bold" : ""}`}
    >
      <div className={indent ? "pl-5" : ""}>
        <span className={indent ? "text-xs text-muted-foreground font-medium" : "text-sm text-foreground font-medium"}>
          {label}
        </span>
        {subtext && <p className="text-[10px] text-muted-foreground">{subtext}</p>}
      </div>
      <span
        className={`tabular-nums font-mono text-sm shrink-0 font-medium ${
          negative && value > 0
            ? "text-rose-600 dark:text-rose-400"
            : bold
            ? "text-foreground font-bold"
            : "text-foreground"
        }`}
      >
        {negative && value > 0 ? `(${fmt(value)})` : fmt(value)}
      </span>
    </div>
  );
}

function SectionHeader({
  children,
  badge,
  icon: Icon,
}: {
  children: React.ReactNode;
  badge?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="px-5 py-3 bg-muted/40 border-b border-border/70 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <p className="text-xs font-bold uppercase tracking-wider text-foreground">{children}</p>
      </div>
      {badge && (
        <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground border border-border/60">
          {badge}
        </span>
      )}
    </div>
  );
}

export default async function IncomeStatementPage() {
  await requirePagePermission(PERMISSIONS.ACCOUNTING_VIEW);
  const supabase = await createClient();
  const { incomeStatement: is, trialBalance: tb, asOf } = await getAccountingData(supabase);

  const grossMarginPct = is.totalRevenue > 0 ? ((is.grossProfit / is.totalRevenue) * 100).toFixed(1) : "0.0";
  const netMarginPct = is.totalRevenue > 0 ? ((is.netIncome / is.totalRevenue) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Back link */}
      <div className="print:hidden">
        <Link
          href="/dashboard/accounting"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Accounting Hub
        </Link>
      </div>

      {/* Statement Header */}
      <StatementReportHeader
        title="Income Statement"
        subtitle="Statement of Profit & Loss · Multi-Step GAAP Format"
        asOfDate={asOf}
        isAuditedBalanced={tb.isBalanced}
      />

      {/* High-Level Executive Summary Pill Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.03] p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Total Revenue</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1">{fmt(is.totalRevenue)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Livestock &amp; agro sales</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Gross Profit</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1">{fmt(is.grossProfit)}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">{grossMarginPct}% gross margin</p>
        </div>
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.03] p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">Total OpEx</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1">{fmt(is.totalExpenses)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Feed, wages &amp; operations</p>
        </div>
        <div className={`rounded-2xl border p-4 shadow-sm ${
          is.netIncome >= 0
            ? "border-emerald-500/30 bg-emerald-500/[0.05]"
            : "border-rose-500/30 bg-rose-500/[0.05]"
        }`}>
          <p className={`text-[11px] font-bold uppercase tracking-wider ${
            is.netIncome >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
          }`}>Net Income</p>
          <p className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
            is.netIncome >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
          }`}>
            {is.netIncome < 0 && "-"}{fmt(is.netIncome)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 font-medium">{netMarginPct}% net margin</p>
        </div>
      </div>

      {/* REVENUE & COST OF GOODS SOLD */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">1. Trading Performance</h2>
          <div className="h-px flex-1 bg-border/60" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Revenue */}
          <div className="rounded-2xl bg-card border border-border/80 shadow-sm overflow-hidden flex flex-col justify-between">
            <div>
              <SectionHeader icon={TrendingUp} badge="4000">Operating Revenue</SectionHeader>
              <div className="divide-y divide-border/30">
                <Row label="Livestock Sales (Cattle/Goats)" value={is.cattleSales} indent />
              </div>
            </div>
            <Row label="TOTAL OPERATING REVENUE" value={is.totalRevenue} bold border highlight />
          </div>

          {/* COGS */}
          <div className="rounded-2xl bg-card border border-border/80 shadow-sm overflow-hidden flex flex-col justify-between">
            <div>
              <SectionHeader icon={DollarSign} badge="5000">Cost of Goods Sold (COGS)</SectionHeader>
              <div className="divide-y divide-border/30">
                <Row label="Cattle / Livestock Purchase Cost" value={is.cogs} indent negative />
                {is.directCattleCosts > 0 && (
                  <Row label="Direct Cattle Sourcing Costs (Vet, Transport)" value={is.directCattleCosts} indent negative />
                )}
              </div>
            </div>
            <Row label="GROSS PROFIT" value={is.grossProfit} bold border highlight subtext={`Gross Margin: ${grossMarginPct}%`} />
          </div>
        </div>
      </div>

      {/* OPERATING EXPENSES */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">2. Operating Expenses (OpEx)</h2>
          <div className="h-px flex-1 bg-border/60" />
        </div>

        <div className="rounded-2xl bg-card border border-border/80 shadow-sm overflow-hidden">
          <SectionHeader icon={Activity} badge="6000-6900">General &amp; Administrative Expenses</SectionHeader>
          <div className="divide-y divide-border/30">
            {is.feedExpenses > 0 && <Row label="Feed & Nutritional Supplements" value={is.feedExpenses} indent negative />}
            {is.vetMedical > 0 && <Row label="Veterinary, Vaccines & Medical" value={is.vetMedical} indent negative />}
            {is.laborWages > 0 && <Row label="Labor, Wages & Security" value={is.laborWages} indent negative />}
            {is.utilities > 0 && <Row label="Utilities (Electricity, Water)" value={is.utilities} indent negative />}
            {is.rentLease > 0 && <Row label="Land & Shed Rent / Lease" value={is.rentLease} indent negative />}
            {is.transport > 0 && <Row label="Logistics & Vehicle Transport" value={is.transport} indent negative />}
            {is.repairsMaintenance > 0 && <Row label="Repairs & Shed Maintenance" value={is.repairsMaintenance} indent negative />}
            {is.depreciation > 0 && <Row label="Fixed Assets Depreciation" value={is.depreciation} indent negative />}
            {is.interestExpense > 0 && <Row label="Financing / Interest Expense" value={is.interestExpense} indent negative />}
            {is.livestockLoss > 0 && <Row label="Livestock Mortality Write-off" value={is.livestockLoss} indent negative />}
            {is.generalExpenses > 0 && <Row label="General Administration & Other Costs" value={is.generalExpenses} indent negative />}
          </div>
          <Row label="TOTAL OPERATING EXPENSES" value={is.totalExpenses} bold border highlight negative />
        </div>
      </div>

      {/* NET INCOME CARD */}
      <div className={`rounded-2xl border p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
        is.netIncome >= 0
          ? "border-emerald-500/30 bg-emerald-500/[0.04]"
          : "border-rose-500/30 bg-rose-500/[0.04]"
      }`}>
        <div>
          <div className="flex items-center gap-2">
            {is.netIncome >= 0 ? (
              <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            ) : (
              <div className="h-7 w-7 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <ArrowDownRight className="h-4 w-4" />
              </div>
            )}
            <h3 className="text-lg font-bold text-foreground">
              {is.netIncome >= 0 ? "Net Profit for Period" : "Net Loss for Period"}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Revenue minus COGS and total operating expenses across all recorded transactions.
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-3xl font-bold font-mono tabular-nums ${
            is.netIncome >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
          }`}>
            {is.netIncome < 0 && "-"}{fmt(is.netIncome)}
          </p>
          <p className="text-xs font-semibold text-muted-foreground mt-0.5">
            Net Margin: {netMarginPct}%
          </p>
        </div>
      </div>
    </div>
  );
}

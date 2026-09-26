import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAccountingData } from "@/lib/accounting/engine";
import {
  TrendingUp,
  DollarSign,
  Activity,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import { StatementReportHeader } from "@/components/finance/finance-ui";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PERMISSIONS } from "@/constants/roles";

import { getL } from "@/i18n/server-text";
export const metadata: Metadata = { title: "আয়-ব্যয়" };

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
  const L = await getL();
  await requirePagePermission(PERMISSIONS.ACCOUNTING_VIEW);
  const supabase = await createClient();
  const { incomeStatement: is, trialBalance: tb, asOf } = await getAccountingData(supabase);

  const grossMarginPct = is.totalRevenue > 0 ? ((is.grossProfit / is.totalRevenue) * 100).toFixed(1) : "0.0";
  const netMarginPct = is.totalRevenue > 0 ? ((is.netIncome / is.totalRevenue) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">

      {/* Statement Header */}
      <StatementReportHeader
        title="Income Statement"
        subtitle={L("বিক্রি থেকে সব খরচ বাদ দিয়ে লাভ বা ক্ষতি", "Statement of Profit & Loss · Multi-Step GAAP Format")}
        asOfDate={asOf}
        isAuditedBalanced={tb.isBalanced}
      />

      {/* High-Level Executive Summary Pill Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.03] p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">{L("মোট বিক্রি", "Total Revenue")}</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1">{fmt(is.totalRevenue)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{L("গরু ও খামারের বিক্রি", "Livestock & agro sales")}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">{L("মোট লাভ (গ্রস)", "Gross Profit")}</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1">{fmt(is.grossProfit)}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">{L(`${grossMarginPct}% গ্রস মার্জিন`, `${grossMarginPct}% gross margin`)}</p>
        </div>
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.03] p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">{L("মোট চলতি খরচ", "Total OpEx")}</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1">{fmt(is.totalExpenses)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{L("খাবার, মজুরি ও অন্যান্য", "Feed, wages & operations")}</p>
        </div>
        <div className={`rounded-2xl border p-4 shadow-sm ${
          is.netIncome >= 0
            ? "border-emerald-500/30 bg-emerald-500/[0.05]"
            : "border-rose-500/30 bg-rose-500/[0.05]"
        }`}>
          <p className={`text-[11px] font-bold uppercase tracking-wider ${
            is.netIncome >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
          }`}>{L("নিট লাভ/ক্ষতি", "Net Income")}</p>
          <p className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
            is.netIncome >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
          }`}>
            {is.netIncome < 0 && "-"}{fmt(is.netIncome)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 font-medium">{L(`${netMarginPct}% নিট মার্জিন`, `${netMarginPct}% net margin`)}</p>
        </div>
      </div>

      {/* REVENUE & COST OF GOODS SOLD */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{L("১. বিক্রি ও বিক্রি করা গরুর খরচ", "1. Trading Performance")}</h2>
          <div className="h-px flex-1 bg-border/60" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Revenue */}
          <div className="rounded-2xl bg-card border border-border/80 shadow-sm overflow-hidden flex flex-col justify-between">
            <div>
              <SectionHeader icon={TrendingUp} badge="4000">{L("বিক্রি", "Operating Revenue")}</SectionHeader>
              <div className="divide-y divide-border/30">
                <Row label={L("গরু বিক্রি", "Livestock Sales (Cattle/Goats)")} value={is.cattleSales} indent />
              </div>
            </div>
            <Row label={L("মোট বিক্রি", "TOTAL OPERATING REVENUE")} value={is.totalRevenue} bold border highlight />
          </div>

          {/* COGS */}
          <div className="rounded-2xl bg-card border border-border/80 shadow-sm overflow-hidden flex flex-col justify-between">
            <div>
              <SectionHeader icon={DollarSign} badge="5000">{L("বিক্রি করা গরুর খরচ", "Cost of Goods Sold (COGS)")}</SectionHeader>
              <div className="divide-y divide-border/30">
                <Row label={L("বিক্রি করা গরুর কেনা দাম", "Cattle / Livestock Purchase Cost")} value={is.cogs} indent negative />
                {is.directCattleCosts > 0 && (
                  <Row label={L("গরু কেনার সরাসরি খরচ (ডাক্তার, পরিবহন)", "Direct Cattle Sourcing Costs (Vet, Transport)")} value={is.directCattleCosts} indent negative />
                )}
              </div>
            </div>
            <Row label={L("মোট লাভ (গ্রস)", "GROSS PROFIT")} value={is.grossProfit} bold border highlight subtext={L(`গ্রস মার্জিন: ${grossMarginPct}%`, `Gross margin: ${grossMarginPct}%`)} />
          </div>
        </div>
      </div>

      {/* OPERATING EXPENSES */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{L("২. চলতি খরচ", "2. Operating Expenses (OpEx)")}</h2>
          <div className="h-px flex-1 bg-border/60" />
        </div>

        <div className="rounded-2xl bg-card border border-border/80 shadow-sm overflow-hidden">
          <SectionHeader icon={Activity} badge="6000-6900">{L("খামারের খরচ", "General & Administrative Expenses")}</SectionHeader>
          <div className="divide-y divide-border/30">
            {is.feedExpenses > 0 && <Row label={L("খাবার ও সাপ্লিমেন্ট", "Feed & Nutritional Supplements")} value={is.feedExpenses} indent negative />}
            {is.vetMedical > 0 && <Row label={L("ডাক্তার, টিকা ও ওষুধ", "Veterinary, Vaccines & Medical")} value={is.vetMedical} indent negative />}
            {is.laborWages > 0 && <Row label={L("মজুরি ও পাহারা", "Labor, Wages & Security")} value={is.laborWages} indent negative />}
            {is.utilities > 0 && <Row label={L("বিদ্যুৎ, পানি ইত্যাদি", "Utilities (Electricity, Water)")} value={is.utilities} indent negative />}
            {is.rentLease > 0 && <Row label={L("জমি ও শেড ভাড়া", "Land & Shed Rent / Lease")} value={is.rentLease} indent negative />}
            {is.transport > 0 && <Row label={L("পরিবহন", "Logistics & Vehicle Transport")} value={is.transport} indent negative />}
            {is.repairsMaintenance > 0 && <Row label={L("মেরামত", "Repairs & Shed Maintenance")} value={is.repairsMaintenance} indent negative />}
            {is.depreciation > 0 && <Row label={L("স্থায়ী সম্পদের অবচয়", "Fixed Assets Depreciation")} value={is.depreciation} indent negative />}
            {is.interestExpense > 0 && <Row label={L("সুদ", "Financing / Interest Expense")} value={is.interestExpense} indent negative />}
            {is.livestockLoss > 0 && <Row label={L("গরু মারা যাওয়ার ক্ষতি", "Livestock Mortality Write-off")} value={is.livestockLoss} indent negative />}
            {is.generalExpenses > 0 && <Row label={L("অন্যান্য খরচ", "General Administration & Other Costs")} value={is.generalExpenses} indent negative />}
          </div>
          <Row label={L("মোট চলতি খরচ", "TOTAL OPERATING EXPENSES")} value={is.totalExpenses} bold border highlight negative />
          {/* a sold asset: money got minus its value then — part of the net result, not an expense */}
          {Math.abs(is.assetDisposalGain) >= 0.5 && (
            <Row label={is.assetDisposalGain >= 0 ? L("সম্পদ বিক্রিতে লাভ", "Gain on asset sale") : L("সম্পদ বিক্রিতে ক্ষতি", "Loss on asset sale")}
              value={Math.abs(is.assetDisposalGain)} negative={is.assetDisposalGain < 0} />
          )}
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
              {is.netIncome >= 0 ? L("নিট লাভ", "Net profit") : L("নিট ক্ষতি", "Net loss")}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {L("বিক্রি − বিক্রি করা গরুর খরচ − সব চলতি খরচ (লেখা সব লেনদেন থেকে)।", "Revenue minus COGS and total operating expenses across all recorded transactions.")}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-3xl font-bold font-mono tabular-nums ${
            is.netIncome >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
          }`}>
            {is.netIncome < 0 && "-"}{fmt(is.netIncome)}
          </p>
          <p className="text-xs font-semibold text-muted-foreground mt-0.5">
            {L("নিট মার্জিন", "Net margin")}: {netMarginPct}%
          </p>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { siteTitle } from "@/components/navigation/site-map";
import { createClient } from "@/lib/supabase/server";
import { getAccountingData } from "@/lib/accounting/engine";
import { ArrowDownRight, ArrowUpRight, Activity, Building, Landmark } from "lucide-react";
import { StatementReportHeader } from "@/components/finance/finance-ui";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PERMISSIONS } from "@/constants/roles";

import { getL } from "@/i18n/server-text";
export const metadata: Metadata = { title: "নগদ প্রবাহ" };

function fmt(n: number) {
  const abs = `৳${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return n < 0 ? `(${abs})` : abs;
}

function Row({
  label,
  value,
  indent,
  bold,
  border,
  highlight,
  subtext,
}: {
  label: string;
  value: number;
  indent?: boolean;
  bold?: boolean;
  border?: boolean;
  highlight?: boolean;
  subtext?: string;
}) {
  const isNeg = value < 0;
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
          isNeg ? "text-rose-600 dark:text-rose-400" : bold ? "text-foreground font-bold" : "text-foreground"
        }`}
      >
        {fmt(value)}
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

export default async function CashFlowPage() {
  const L = await getL();
  await requirePagePermission(PERMISSIONS.ACCOUNTING_VIEW);
  const supabase = await createClient();
  const { cashFlow: cf, trialBalance: tb, asOf } = await getAccountingData(supabase);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">

      {/* Statement Header */}
      <StatementReportHeader
        title={siteTitle(L, "/dashboard/accounting/cash-flow", "Cash Flow Statement")}
        subtitle={L("টাকা কোথা থেকে এলো আর কোথায় গেলো", "Statement of Cash Flows · Direct Method")}
        asOfDate={asOf}
        isAuditedBalanced={tb.isBalanced}
      />

      {/* Summary KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.03] p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">{L("খামার চালানোর নগদ", "Operating Cash")}</p>
          <p className={`text-2xl font-bold font-mono tabular-nums mt-1 ${cf.netOperating < 0 ? "text-rose-600" : "text-foreground"}`}>
            {fmt(cf.netOperating)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{L("বিক্রি ও খরচ থেকে", "Core operations flow")}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">{L("বিনিয়োগের নগদ", "Investing Cash")}</p>
          <p className={`text-2xl font-bold font-mono tabular-nums mt-1 ${cf.netInvesting < 0 ? "text-rose-600" : "text-foreground"}`}>
            {fmt(cf.netInvesting)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{L("শেড ও যন্ত্রপাতি কেনা", "CapEx & equipment")}</p>
        </div>
        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.03] p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">{L("মূলধনের নগদ", "Financing Cash")}</p>
          <p className={`text-2xl font-bold font-mono tabular-nums mt-1 ${cf.netFinancing < 0 ? "text-rose-600" : "text-foreground"}`}>
            {fmt(cf.netFinancing)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{L("অংশীদারের টাকা / ঋণ", "Partner capital / loans")}</p>
        </div>
        <div className={`rounded-2xl border p-4 shadow-sm ${
          cf.netCashFlow >= 0 ? "border-emerald-500/30 bg-emerald-500/[0.05]" : "border-rose-500/30 bg-rose-500/[0.05]"
        }`}>
          <p className={`text-[11px] font-bold uppercase tracking-wider ${
            cf.netCashFlow >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
          }`}>{L("নিট নগদ পরিবর্তন", "Net Cash Flow")}</p>
          <p className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
            cf.netCashFlow >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
          }`}>
            {fmt(cf.netCashFlow)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{L("নগদ কত বাড়ল/কমল", "Net liquidity change")}</p>
        </div>
      </div>

      {/* 1. OPERATING ACTIVITIES */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{L("১. খামার চালানো", "1. Operating Activities")}</h2>
          <div className="h-px flex-1 bg-border/60" />
        </div>

        <div className="rounded-2xl bg-card border border-border/80 shadow-sm overflow-hidden">
          <SectionHeader icon={Activity} badge={L("আসা / যাওয়া", "Direct Inflows / Outflows")}>{L("খামার চালানোর নগদ", "Operating Cash Flows")}</SectionHeader>
          <div className="divide-y divide-border/30">
            <Row label={L("গরু বিক্রি থেকে পাওয়া", "Cash received from livestock sales")} value={cf.cashFromSales} indent />
            <Row label={L("গরু কেনায় দেওয়া", "Cash paid for livestock cattle purchases")} value={-cf.cashPaidCattle} indent />
            <Row label={L("খামারের খরচ ও মজুরিতে দেওয়া", "Cash paid for farm operating expenses & wages")} value={-cf.cashPaidCosts} indent />
            <Row label={L("খাবার ও স্টক কেনায় দেওয়া", "Cash paid for feed & supplies inventory")} value={-cf.cashPaidInventory} indent />
          </div>
          <Row label={L("খামার চালানো থেকে নিট নগদ", "NET CASH FROM OPERATING ACTIVITIES")} value={cf.netOperating} bold border highlight />
        </div>
      </div>

      {/* 2. INVESTING & FINANCING ACTIVITIES */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{L("২. বিনিয়োগ ও মূলধন", "2. Investing & Financing Activities")}</h2>
          <div className="h-px flex-1 bg-border/60" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Investing */}
          <div className="rounded-2xl bg-card border border-border/80 shadow-sm overflow-hidden flex flex-col justify-between">
            <div>
              <SectionHeader icon={Building} badge={L("স্থায়ী সম্পদ", "CapEx")}>{L("বিনিয়োগ", "Investing Activities")}</SectionHeader>
              <div className="divide-y divide-border/30">
                <Row label={L("শেড ও যন্ত্রপাতি কেনা", "Fixed asset & equipment purchases")} value={-cf.fixedAssetPurchases} indent />
                {cf.fixedAssetPurchases === 0 && (
                  <div className="py-4 px-5 text-xs text-muted-foreground italic">{L("কোনো স্থায়ী সম্পদ কেনা হয়নি।", "No capital asset investments recorded.")}</div>
                )}
              </div>
            </div>
            <Row label={L("বিনিয়োগ থেকে নিট নগদ", "NET CASH FROM INVESTING")} value={cf.netInvesting} bold border highlight />
          </div>

          {/* Financing */}
          <div className="rounded-2xl bg-card border border-border/80 shadow-sm overflow-hidden flex flex-col justify-between">
            <div>
              <SectionHeader icon={Landmark} badge={L("মূলধন", "Capital / Equity")}>{L("মূলধন ও ঋণ", "Financing Activities")}</SectionHeader>
              <div className="divide-y divide-border/30">
                <Row label={L("অংশীদারদের জমা", "Partner investments received")} value={cf.partnerInvestments} indent />
                <Row label={L("অংশীদারদের তোলা টাকা", "Partner withdrawals / drawings paid")} value={-cf.partnerWithdrawals} indent />
                {cf.partnerInvestments === 0 && cf.partnerWithdrawals === 0 && (
                  <div className="py-4 px-5 text-xs text-muted-foreground italic">{L("কোনো মূলধন লেনদেন নেই।", "No capital financing activities recorded.")}</div>
                )}
              </div>
            </div>
            <Row label={L("মূলধন থেকে নিট নগদ", "NET CASH FROM FINANCING")} value={cf.netFinancing} bold border highlight />
          </div>
        </div>
      </div>

      {/* NET CHANGE IN CASH CARD */}
      <div className={`rounded-2xl border p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
        cf.netCashFlow >= 0 ? "border-emerald-500/30 bg-emerald-500/[0.04]" : "border-rose-500/30 bg-rose-500/[0.04]"
      }`}>
        <div>
          <div className="flex items-center gap-2">
            {cf.netCashFlow >= 0 ? (
              <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            ) : (
              <div className="h-7 w-7 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <ArrowDownRight className="h-4 w-4" />
              </div>
            )}
            <h3 className="text-lg font-bold text-foreground">
              {cf.netCashFlow >= 0 ? L("নগদ বেড়েছে", "Cash increased") : L("নগদ কমেছে", "Cash decreased")}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {L("খামার চালানো + বিনিয়োগ + মূলধন — তিনটির যোগফল।", "Sum of direct operating, capital investment, and financing cash flows.")}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-3xl font-bold font-mono tabular-nums ${
            cf.netCashFlow >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
          }`}>
            {fmt(cf.netCashFlow)}
          </p>
          <p className="text-xs font-semibold text-muted-foreground mt-0.5">
            {L("নগদের নিট পরিবর্তন", "Net Direct Liquidity Change")}
          </p>
        </div>
      </div>
    </div>
  );
}

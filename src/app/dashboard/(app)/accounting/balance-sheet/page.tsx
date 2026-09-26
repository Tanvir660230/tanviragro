import type { Metadata } from "next";
import { siteTitle } from "@/components/navigation/site-map";
import { createClient } from "@/lib/supabase/server";
import { getAccountingData } from "@/lib/accounting/engine";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import {
  AlertTriangle,
  ShieldCheck,
  Scale,
  Building2,
  Landmark,
  Wallet,
} from "lucide-react";
import { AssetDepreciationTable, type AssetEntry } from "@/components/accounting/AssetDepreciationTable";
import { StatementReportHeader } from "@/components/finance/finance-ui";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PERMISSIONS } from "@/constants/roles";

import { getL } from "@/i18n/server-text";
export const metadata: Metadata = { title: "ব্যালেন্স শিট" };

function fmt(n: number) {
  const abs = Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(৳${abs})` : `৳${abs}`;
}

function Row({
  label,
  value,
  indent,
  bold,
  border,
  highlight,
}: {
  label: string;
  value: number | string;
  indent?: boolean;
  bold?: boolean;
  border?: boolean;
  highlight?: boolean;
}) {
  const formatted = typeof value === "number" ? fmt(value) : value;
  return (
    <div
      className={`flex items-start justify-between py-2.5 px-4 gap-4 ${
        border ? "border-t border-border/80" : "border-b border-border/40"
      } ${bold ? "font-bold text-foreground" : "text-sm"} ${
        highlight ? "bg-muted/40 font-semibold" : ""
      }`}
    >
      <span className={indent ? "pl-5 text-sm text-muted-foreground" : ""}>{label}</span>
      <span className="tabular-nums font-mono text-sm shrink-0">{formatted}</span>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  children,
  badge,
}: {
  icon?: React.ElementType;
  children: React.ReactNode;
  badge?: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border/70">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-primary" />}
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

export default async function BalanceSheetPage() {
  const L = await getL();
  await requirePagePermission(PERMISSIONS.ACCOUNTING_VIEW);
  const supabase = await createClient();
  const [{ balanceSheet: bs, trialBalance: tb, asOf }, businessId] = await Promise.all([
    getAccountingData(supabase),
    getCurrentBusinessId(supabase),
  ]);

  const { data: assetEntriesData } = businessId
    ? await supabase
        .from("cost_entries")
        .select("id, description, category, amount, recorded_at")
        .eq("business_id", businessId)
        .eq("entry_class", "asset")
        .is("deleted_at", null)
        .order("recorded_at", { ascending: false })
    : { data: [] };
  // Asset payments that have a fixed-asset record are depreciated there (Fixed Assets page);
  // listing them here as well showed the same purchase twice with a different depreciation.
  const { data: linkedData } = businessId
    ? await supabase.from("fixed_assets").select("source_cost_entry_id").eq("business_id", businessId).not("source_cost_entry_id", "is", null)
    : { data: [] };
  const linkedPayments = new Set(((linkedData ?? []) as { source_cost_entry_id: string | null }[]).map((r) => r.source_cost_entry_id));
  const assetEntries = ((assetEntriesData ?? []) as AssetEntry[]).filter((e) => !linkedPayments.has(e.id));

  // Liability split: current (due ≤ 1 year) vs long-term (due > 1 year)
  const oneYearLater = new Date();
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
  const oneYearStr = oneYearLater.toISOString().slice(0, 10);

  type LiabRow = { outstanding: number; settled_at: string | null; due_date: string | null };
  type LoanRow = { principal_amount: number; due_date: string | null; status: string; loan_payments: { amount: number }[] | null };

  const [{ data: liabRows }, { data: loanRows }] = businessId
    ? await Promise.all([
        supabase.from("liabilities").select("outstanding, settled_at, due_date").eq("business_id", businessId).is("deleted_at", null),
        supabase.from("loans").select("principal_amount, due_date, status, loan_payments(amount)").eq("business_id", businessId).is("deleted_at", null),
      ])
    : [{ data: [] }, { data: [] }];

  const calcLoanOutstanding = (l: LoanRow) => {
    const paid = (l.loan_payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
    return Math.max(0, Number(l.principal_amount) - paid);
  };

  const currentPrincipal =
    ((liabRows ?? []) as LiabRow[]).filter(l => !l.settled_at && (!l.due_date || l.due_date <= oneYearStr)).reduce((s, l) => s + Number(l.outstanding), 0) +
    ((loanRows ?? []) as LoanRow[]).filter(l => l.status !== "paid" && (!l.due_date || l.due_date <= oneYearStr)).reduce((s, l) => s + calcLoanOutstanding(l), 0);

  const longTermPrincipal =
    ((liabRows ?? []) as LiabRow[]).filter(l => !l.settled_at && l.due_date && l.due_date > oneYearStr).reduce((s, l) => s + Number(l.outstanding), 0) +
    ((loanRows ?? []) as LoanRow[]).filter(l => l.status !== "paid" && l.due_date && l.due_date > oneYearStr).reduce((s, l) => s + calcLoanOutstanding(l), 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">

      {/* Statement Header */}
      <StatementReportHeader
        title={siteTitle(L, "/dashboard/accounting/balance-sheet", "Balance Sheet")}
        subtitle={L("খামারের যা আছে (সম্পদ), যা দেনা (দায়) ও মালিকদের অংশ", "Statement of Financial Position · Standard Double-Entry")}
        asOfDate={asOf}
        isAuditedBalanced={tb.isBalanced}
      />

      {/* High-Level Executive Summary Pill Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.03] p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">{L("মোট সম্পদ", "Total Assets")}</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1">{fmt(bs.totalAssets)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{L("চলতি + স্থায়ী সম্পদ", "Current + Non-Current Assets")}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">{L("মোট দায়", "Total Liabilities")}</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1">{fmt(bs.totalLiabilities)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{L("স্বল্প ও দীর্ঘ মেয়াদি দেনা", "Current & Long-term obligations")}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">{L("মোট মূলধন", "Total Equity")}</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1">{fmt(bs.totalEquity)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{L("অংশীদারের টাকা + জমা লাভ/ক্ষতি", "Partner capital + Retained earnings")}</p>
        </div>
      </div>

      {/* ASSETS — current / non-current */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-card border border-border/80 shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <SectionHeader icon={Building2} badge="1100-1200">{L("চলতি সম্পদ", "Current Assets")}</SectionHeader>
            <div className="divide-y divide-border/30">
              <Row label={L("নগদ ও ব্যাংক", "Cash & Bank Balances")} value={bs.cashAndBank} indent />
              <Row label={L("খাবার ও অন্যান্য স্টক", "Feed & Consumable Inventory")} value={bs.feedInventory} indent />
            </div>
          </div>
          <Row label={L("মোট চলতি সম্পদ", "TOTAL CURRENT ASSETS")} value={bs.cashAndBank + bs.feedInventory} bold border highlight />
        </div>
        <div className="rounded-2xl bg-card border border-border/80 shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <SectionHeader icon={Scale} badge="1300-1500">{L("স্থায়ী সম্পদ", "Non-Current Assets")}</SectionHeader>
            <div className="divide-y divide-border/30">
              <Row label={L("গরু (খামারে আছে, কেনা দামে)", "Livestock (Active, at cost)")} value={bs.livestock} indent />
              <Row label={L("স্থায়ী সম্পদ (কেনা দাম)", "Fixed Assets (Gross Cost)")} value={bs.fixedAssets} indent />
              <Row label={L("বাদ: মোট অবচয়", "Less: Accumulated Depreciation")} value={-bs.accumulatedDepreciation} indent />
              <Row label={L("স্থায়ী সম্পদের বর্তমান মূল্য", "Net Fixed Assets")} value={bs.netFixedAssets} indent />
            </div>
          </div>
          <Row label={L("মোট স্থায়ী সম্পদ", "TOTAL NON-CURRENT ASSETS")} value={bs.livestock + bs.netFixedAssets} bold border highlight />
        </div>
      </div>
      <div className="rounded-2xl bg-card border border-blue-500/30 p-4 shadow-sm flex items-center justify-between">
        <span className="text-base font-bold text-foreground">{L("মোট সম্পদ", "TOTAL ASSETS")}</span>
        <span className="text-xl font-bold font-mono tabular-nums text-foreground">{fmt(bs.totalAssets)}</span>
      </div>

      {/* LIABILITIES & EQUITY SECTION */}
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Liabilities */}
          <div className="rounded-2xl bg-card border border-border/80 shadow-sm overflow-hidden flex flex-col justify-between">
            <div>
              <SectionHeader icon={Landmark} badge="2000">{L("দায়", "Liabilities")}</SectionHeader>
              <div className="divide-y divide-border/30">
                {currentPrincipal > 0 && <Row label={L("স্বল্প মেয়াদি দেনা (১ বছরের মধ্যে)", "Current Liabilities (due ≤ 1 yr)")} value={currentPrincipal} indent />}
                {longTermPrincipal > 0 && <Row label={L("দীর্ঘ মেয়াদি দেনা (১ বছর পরে)", "Long-term Obligations (due > 1 yr)")} value={longTermPrincipal} indent />}
                {bs.partnerLoans > 0.5 && <Row label={L("অংশীদারের ধার (ফেরত দিতে হবে)", "Loans from partners")} value={bs.partnerLoans} indent />}
                {bs.accruedInterestPayable > 0 && <Row label={L("জমা সুদ (দিতে হবে)", "Accrued Interest Payable")} value={bs.accruedInterestPayable} indent />}
                {currentPrincipal === 0 && longTermPrincipal === 0 && bs.accruedInterestPayable === 0 && bs.partnerLoans <= 0.5 && (
                  <div className="py-4 px-5 text-xs text-muted-foreground italic">{L("কোনো দেনা নেই।", "No outstanding liabilities.")}</div>
                )}
              </div>
            </div>
            <Row label={L("মোট দায়", "TOTAL LIABILITIES")} value={bs.totalLiabilities} bold border highlight />
          </div>

          {/* Equity */}
          <div className="rounded-2xl bg-card border border-border/80 shadow-sm overflow-hidden flex flex-col justify-between">
            <div>
              <SectionHeader icon={Wallet} badge="3000">{L("মূলধন", "Equity")}</SectionHeader>
              <div className="divide-y divide-border/30">
                <Row label={L("অংশীদারদের দেওয়া টাকা", "Partner Contributed Capital")} value={bs.partnerCapital} indent />
                <Row label={L("জমা লাভ / (ক্ষতি)", "Retained Earnings / (Losses)")} value={bs.retainedEarnings} indent />
              </div>
            </div>
            <Row label={L("মোট মূলধন", "TOTAL EQUITY")} value={bs.totalEquity} bold border highlight />
          </div>
        </div>

        {/* Total Liabilities + Equity Bar */}
        <div className="rounded-2xl bg-card border border-emerald-500/30 p-4 shadow-sm flex items-center justify-between">
          <span className="text-base font-bold text-foreground">{L("মোট দায় ও মূলধন", "TOTAL LIABILITIES & EQUITY")}</span>
          <span className="text-xl font-bold font-mono tabular-nums text-foreground">{fmt(bs.totalLiabilitiesAndEquity)}</span>
        </div>
      </div>

      {/* Audit Balance Verification */}
      {tb.isBalanced ? (
        <div className="rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/30 p-4 flex items-center gap-3.5">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-950 dark:text-emerald-200">{L("হিসাব মিলেছে: সম্পদ = দায় + মূলধন", "Accounting Equation Balanced: Assets = Liabilities + Equity")}</p>
            <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
              {L(`মোট সম্পদ (${fmt(bs.totalAssets)}) = মোট দায় + মূলধন (${fmt(bs.totalLiabilitiesAndEquity)})।`, `Total assets (${fmt(bs.totalAssets)}) equal total liabilities + equity (${fmt(bs.totalLiabilitiesAndEquity)}).`)}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-amber-500/[0.04] border border-amber-500/30 p-4 flex items-center gap-3.5">
          <div className="h-9 w-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-950 dark:text-amber-200">{L("হিসাবে গরমিল আছে", "Audit Discrepancy Detected")}</p>
            <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
              {L(`মোট ডেবিট (${fmt(tb.totalDebit)}) আর মোট ক্রেডিট (${fmt(tb.totalCredit)}) মিলছে না। পার্থক্য: ${fmt(bs.discrepancy)}।`, `Total debits (${fmt(tb.totalDebit)}) do not match total credits (${fmt(tb.totalCredit)}). Difference: ${fmt(bs.discrepancy)}.`)}
            </p>
          </div>
        </div>
      )}

      {/* Asset Depreciation Schedule */}
      <AssetDepreciationTable assets={assetEntries} />
    </div>
  );
}

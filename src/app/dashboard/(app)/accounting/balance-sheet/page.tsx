import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccountingData } from "@/lib/accounting/engine";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { ArrowLeft, CheckCircle2, AlertTriangle, ShieldCheck, Scale, Building2, Landmark, Wallet } from "lucide-react";
import { AssetDepreciationTable, type AssetEntry } from "@/components/accounting/AssetDepreciationTable";
import { StatementReportHeader, fmtBDT } from "@/components/finance/finance-ui";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PERMISSIONS } from "@/constants/roles";

export const metadata: Metadata = { title: "Balance Sheet Statement" };

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
        title="Balance Sheet"
        subtitle="Statement of Financial Position · Standard Double-Entry"
        asOfDate={asOf}
        isAuditedBalanced={tb.isBalanced}
      />

      {/* High-Level Executive Summary Pill Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.03] p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Total Assets</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1">{fmt(bs.totalAssets)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Current + Non-Current Assets</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Total Liabilities</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1">{fmt(bs.totalLiabilities)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Current &amp; Long-term obligations</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Total Equity</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1">{fmt(bs.totalEquity)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Partner capital + Retained earnings</p>
        </div>
      </div>

      {/* ASSETS — current / non-current */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-card border border-border/80 shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <SectionHeader icon={Building2} badge="1100-1200">Current Assets</SectionHeader>
            <div className="divide-y divide-border/30">
              <Row label="Cash & Bank Balances" value={bs.cashAndBank} indent />
              <Row label="Feed & Consumable Inventory" value={bs.feedInventory} indent />
            </div>
          </div>
          <Row label="TOTAL CURRENT ASSETS" value={bs.cashAndBank + bs.feedInventory} bold border highlight />
        </div>
        <div className="rounded-2xl bg-card border border-border/80 shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <SectionHeader icon={Scale} badge="1300-1500">Non-Current Assets</SectionHeader>
            <div className="divide-y divide-border/30">
              <Row label="Livestock (Active, at cost)" value={bs.livestock} indent />
              <Row label="Fixed Assets (Gross Cost)" value={bs.fixedAssets} indent />
              <Row label="Less: Accumulated Depreciation" value={-bs.accumulatedDepreciation} indent />
              <Row label="Net Fixed Assets" value={bs.netFixedAssets} indent />
            </div>
          </div>
          <Row label="TOTAL NON-CURRENT ASSETS" value={bs.livestock + bs.netFixedAssets} bold border highlight />
        </div>
      </div>
      <div className="rounded-2xl bg-card border border-blue-500/30 p-4 shadow-sm flex items-center justify-between">
        <span className="text-base font-bold text-foreground">TOTAL ASSETS</span>
        <span className="text-xl font-bold font-mono tabular-nums text-foreground">{fmt(bs.totalAssets)}</span>
      </div>

      {/* LIABILITIES & EQUITY SECTION */}
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Liabilities */}
          <div className="rounded-2xl bg-card border border-border/80 shadow-sm overflow-hidden flex flex-col justify-between">
            <div>
              <SectionHeader icon={Landmark} badge="2000">Liabilities</SectionHeader>
              <div className="divide-y divide-border/30">
                {currentPrincipal > 0 && <Row label="Current Liabilities (due ≤ 1 yr)" value={currentPrincipal} indent />}
                {longTermPrincipal > 0 && <Row label="Long-term Obligations (due > 1 yr)" value={longTermPrincipal} indent />}
                {bs.accruedInterestPayable > 0 && <Row label="Accrued Interest Payable" value={bs.accruedInterestPayable} indent />}
                {currentPrincipal === 0 && longTermPrincipal === 0 && bs.accruedInterestPayable === 0 && (
                  <div className="py-4 px-5 text-xs text-muted-foreground italic">No outstanding liabilities.</div>
                )}
              </div>
            </div>
            <Row label="TOTAL LIABILITIES" value={bs.totalLiabilities} bold border highlight />
          </div>

          {/* Equity */}
          <div className="rounded-2xl bg-card border border-border/80 shadow-sm overflow-hidden flex flex-col justify-between">
            <div>
              <SectionHeader icon={Wallet} badge="3000">Equity</SectionHeader>
              <div className="divide-y divide-border/30">
                <Row label="Partner Contributed Capital" value={bs.partnerCapital} indent />
                <Row label="Retained Earnings / (Losses)" value={bs.retainedEarnings} indent />
              </div>
            </div>
            <Row label="TOTAL EQUITY" value={bs.totalEquity} bold border highlight />
          </div>
        </div>

        {/* Total Liabilities + Equity Bar */}
        <div className="rounded-2xl bg-card border border-emerald-500/30 p-4 shadow-sm flex items-center justify-between">
          <span className="text-base font-bold text-foreground">TOTAL LIABILITIES &amp; EQUITY</span>
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
            <p className="text-sm font-bold text-emerald-950 dark:text-emerald-200">Accounting Equation Balanced: Assets = Liabilities + Equity</p>
            <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
              Verified double-entry integrity. Total Assets ({fmt(bs.totalAssets)}) equals Total Liabilities + Equity ({fmt(bs.totalLiabilitiesAndEquity)}).
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-amber-500/[0.04] border border-amber-500/30 p-4 flex items-center gap-3.5">
          <div className="h-9 w-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-950 dark:text-amber-200">Audit Discrepancy Detected</p>
            <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
              Total Debits ({fmt(tb.totalDebit)}) do not match Total Credits ({fmt(tb.totalCredit)}). Discrepancy: {fmt(bs.discrepancy)}.
            </p>
          </div>
        </div>
      )}

      {/* Asset Depreciation Schedule */}
      <AssetDepreciationTable assets={assetEntries} />
    </div>
  );
}

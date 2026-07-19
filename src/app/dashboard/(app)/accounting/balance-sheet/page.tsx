import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccountingData } from "@/lib/accounting/engine";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { buttonVariants } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, AlertCircle, AlertTriangle, Scale } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { AssetDepreciationTable, type AssetEntry } from "@/components/accounting/AssetDepreciationTable";

export const metadata: Metadata = { title: "Balance Sheet" };

function fmt(n: number) {
  const abs = Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(৳${abs})` : `৳${abs}`;
}

function Row({ label, value, indent, bold, border }: {
  label: string;
  value: number | string;
  indent?: boolean;
  bold?: boolean;
  border?: boolean;
}) {
  const formatted = typeof value === "number" ? fmt(value) : value;
  return (
    <div className={`flex items-start justify-between py-2 px-4 gap-4 ${border ? "border-t border-foreground/20" : "border-b border-border/40"} ${bold ? "font-semibold" : ""}`}>
      <span className={indent ? "pl-4 text-sm text-muted-foreground" : "text-sm"}>{label}</span>
      <span className="tabular-nums font-mono text-sm shrink-0">{formatted}</span>
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

export default async function BalanceSheetPage() {
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
  const assetEntries = (assetEntriesData ?? []) as AssetEntry[];

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
    <div className="space-y-4">
      <PageHeader
        title="Balance Sheet"
        subtitle={`As of ${new Date(asOf).toLocaleDateString("en-US", { dateStyle: "long" })}`}
        icon={Scale}
        back="/dashboard/accounting"
      />

      {/* Balance check */}
      <div className={`flex items-center gap-3 rounded-xl p-4 ring-1 text-sm font-medium ${
        bs.isBalanced
          ? "bg-emerald-50 dark:bg-emerald-950/30 ring-emerald-500/30 text-emerald-700 dark:text-emerald-400"
          : "bg-amber-50 dark:bg-amber-950/30 ring-amber-500/30 text-amber-700 dark:text-amber-400"
      }`}>
        {bs.isBalanced
          ? <CheckCircle2 className="h-5 w-5 shrink-0" />
          : <AlertCircle className="h-5 w-5 shrink-0" />}
        {bs.isBalanced
          ? "Assets = Liabilities + Equity"
          : `Off-balance by ৳${bs.discrepancy.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`}
      </div>

      {/* ASSETS — current / non-current */}
      <div className="rounded-xl bg-card border border-border/60 shadow-card overflow-hidden">
        <SectionHeader>CURRENT ASSETS</SectionHeader>
        <Row label="Cash & Bank" value={bs.cashAndBank} indent />
        <Row label="Feed & Supplies Inventory" value={bs.feedInventory} indent />
        <Row label="TOTAL CURRENT ASSETS" value={bs.cashAndBank + bs.feedInventory} bold border />
      </div>
      <div className="rounded-xl bg-card border border-border/60 shadow-card overflow-hidden">
        <SectionHeader>NON-CURRENT ASSETS</SectionHeader>
        <Row label="Livestock (Active, at cost)" value={bs.livestock} indent />
        <Row label="Fixed Assets (at cost)" value={bs.fixedAssets} indent />
        <Row label="Less: Accumulated Depreciation" value={`(${fmt(bs.accumulatedDepreciation)})`} indent />
        <Row label="Net Fixed Assets" value={bs.netFixedAssets} indent />
        <Row label="TOTAL NON-CURRENT ASSETS" value={bs.livestock + bs.netFixedAssets} bold border />
      </div>
      <div className="rounded-xl bg-card border border-border/60 shadow-card overflow-hidden">
        <Row label="TOTAL ASSETS" value={bs.totalAssets} bold />
      </div>

      {/* LIABILITIES + EQUITY — side by side on large screens */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl bg-card border border-border/60 shadow-card overflow-hidden">
          <SectionHeader>LIABILITIES</SectionHeader>
          {currentPrincipal > 0 && <Row label="Current (due ≤ 1 yr)" value={currentPrincipal} indent />}
          {longTermPrincipal > 0 && <Row label="Long-term (due > 1 yr)" value={longTermPrincipal} indent />}
          {bs.accruedInterestPayable > 0 && <Row label="Accrued Interest Payable" value={bs.accruedInterestPayable} indent />}
          <Row label="TOTAL LIABILITIES" value={bs.totalLiabilities} bold border />
        </div>
        <div className="rounded-xl bg-card border border-border/60 shadow-card overflow-hidden">
          <SectionHeader>EQUITY</SectionHeader>
          <Row label="Partner Contributed Capital" value={bs.partnerCapital} indent />
          <Row label="Retained Earnings" value={bs.retainedEarnings} indent />
          <Row label="TOTAL EQUITY" value={bs.totalEquity} bold border />
        </div>
      </div>

      {/* Check line */}
      <div className="rounded-xl bg-card border border-border/60 shadow-card overflow-hidden mb-6">
        <Row label="TOTAL LIABILITIES + EQUITY" value={bs.totalLiabilitiesAndEquity} bold />
      </div>

      {!tb.isBalanced && (
        <div className="bg-destructive/15 text-destructive border border-destructive/30 px-4 py-3 rounded-lg flex items-start gap-3 mb-6">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Audit Warning: Ledger Out of Balance</p>
            <p className="text-sm mt-1">Total Debits do not match Total Credits. This indicates a potential logic discrepancy in the accounting engine. Debits: {fmt(tb.totalDebit)}, Credits: {fmt(tb.totalCredit)}</p>
          </div>
        </div>
      )}

      {tb.isBalanced && (
        <div className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-4 py-3 rounded-lg flex items-start gap-3 mb-6">
          <div className="h-5 w-5 mt-0.5 shrink-0 bg-emerald-500/20 rounded-full flex items-center justify-center">
            <div className="h-2.5 w-2.5 bg-emerald-500 rounded-full"></div>
          </div>
          <div>
            <p className="font-semibold">System Audited & Balanced</p>
            <p className="text-sm mt-1 text-emerald-600/80 dark:text-emerald-400/80">Double-entry ledger is perfectly balanced. Data integrity is fully verified.</p>
          </div>
        </div>
      )}

      {/* Asset Depreciation Schedule — cost_entries assets */}
      <AssetDepreciationTable assets={assetEntries} />
    </div>
  );
}

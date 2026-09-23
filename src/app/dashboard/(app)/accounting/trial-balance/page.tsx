import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccountingData } from "@/lib/accounting/engine";
import { ArrowLeft, ShieldCheck, AlertTriangle } from "lucide-react";
import { StatementReportHeader } from "@/components/finance/finance-ui";

export const metadata: Metadata = { title: "Trial Balance | Tanvir Agro Accounting" };

function fmt(n: number) {
  return n > 0 ? `৳${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
}

const SECTION_METADATA: Record<string, { label: string; badge: string; color: string }> = {
  assets: { label: "1000 · Assets", badge: "Debit Normal", color: "text-blue-700 dark:text-blue-400 bg-blue-500/10" },
  liabilities: { label: "2000 · Liabilities", badge: "Credit Normal", color: "text-amber-700 dark:text-amber-400 bg-amber-500/10" },
  equity: { label: "3000 · Partner Equity", badge: "Credit Normal", color: "text-purple-700 dark:text-purple-400 bg-purple-500/10" },
  revenue: { label: "4000 · Operating Revenue", badge: "Credit Normal", color: "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10" },
  expenses: { label: "5000-6000 · Cost & Expenses", badge: "Debit Normal", color: "text-rose-700 dark:text-rose-400 bg-rose-500/10" },
};

export default async function TrialBalancePage() {
  const supabase = await createClient();
  const { trialBalance: tb, asOf } = await getAccountingData(supabase);

  const sections = ["assets", "liabilities", "equity", "revenue", "expenses"] as const;

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
        title="Trial Balance"
        subtitle="Chart of Accounts Ledger Audit · Double-Entry Integrity"
        asOfDate={asOf}
        isAuditedBalanced={tb.isBalanced}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.03] p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Total Debits</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1">
            ৳{tb.totalDebit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Assets &amp; Expense debits</p>
        </div>
        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.03] p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">Total Credits</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1">
            ৳{tb.totalCredit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Liabilities, Equity &amp; Revenue</p>
        </div>
        <div className={`rounded-2xl border p-4 shadow-sm ${
          tb.isBalanced ? "border-emerald-500/30 bg-emerald-500/[0.05]" : "border-amber-500/30 bg-amber-500/[0.05]"
        }`}>
          <p className={`text-[11px] font-bold uppercase tracking-wider ${
            tb.isBalanced ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
          }`}>Balance Variance</p>
          <p className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
            tb.isBalanced ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
          }`}>
            ৳{Math.abs(tb.totalDebit - tb.totalCredit).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tb.isBalanced ? "Zero variance (balanced)" : "Audit discrepancy"}
          </p>
        </div>
      </div>

      {/* Trial Balance Data Table */}
      <div className="rounded-2xl bg-card border border-border/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-3.5 px-5 text-left font-bold">Account Name &amp; Code</th>
                <th className="py-3.5 px-5 text-right font-bold w-44">Debit (৳)</th>
                <th className="py-3.5 px-5 text-right font-bold w-44">Credit (৳)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {sections.map((section) => {
                const sectionLines = tb.lines.filter((l) => l.section === section);
                if (sectionLines.length === 0) return null;
                const meta = SECTION_METADATA[section];

                return (
                  <FragmentWrapper key={`section-wrapper-${section}`}>
                    <tr className="bg-muted/30 border-b border-border/70">
                      <td colSpan={3} className="py-2.5 px-5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                            {meta?.label || section}
                          </span>
                          {meta?.badge && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}>
                              {meta.badge}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {sectionLines.map((line) => (
                      <tr key={line.code} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted/60 text-muted-foreground font-semibold border border-border/40">
                              {line.code}
                            </span>
                            <span className="text-sm font-medium text-foreground">{line.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-5 text-right font-mono tabular-nums text-sm font-medium text-foreground">
                          {fmt(line.debit)}
                        </td>
                        <td className="py-3 px-5 text-right font-mono tabular-nums text-sm font-medium text-foreground">
                          {fmt(line.credit)}
                        </td>
                      </tr>
                    ))}
                  </FragmentWrapper>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border/80 bg-muted/30 font-bold">
                <td className="py-4 px-5 text-sm text-foreground uppercase tracking-wider">
                  TOTAL AUDITED BALANCE
                </td>
                <td className="py-4 px-5 text-right font-mono tabular-nums text-base text-foreground font-bold">
                  ৳{tb.totalDebit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-4 px-5 text-right font-mono tabular-nums text-base text-foreground font-bold">
                  ৳{tb.totalCredit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Footnote */}
      <p className="text-xs text-muted-foreground text-center">
        * Auto-derived from cattle purchases, livestock sales, operational cost entries, inventory adjustments, partner equity movements, and straight-line fixed asset depreciation schedules.
      </p>
    </div>
  );
}

function FragmentWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

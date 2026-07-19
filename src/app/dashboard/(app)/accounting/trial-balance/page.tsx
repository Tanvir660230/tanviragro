import { PageHeader } from "@/components/shared/PageHeader";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccountingData } from "@/lib/accounting/engine";
import { buttonVariants } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";

export const metadata: Metadata = { title: "Trial Balance" };

function fmt(n: number) {
  return n > 0 ? `৳${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—";
}

const SECTION_LABELS: Record<string, string> = {
  assets: "Assets",
  liabilities: "Liabilities",
  equity: "Equity",
  revenue: "Revenue",
  expenses: "Expenses",
};

export default async function TrialBalancePage() {
   
  const supabase = await createClient();
  const { trialBalance: tb, asOf } = await getAccountingData(supabase);

  const sections = ["assets", "liabilities", "equity", "revenue", "expenses"] as const;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Trial Balance"
        subtitle={`As of ${new Date(asOf).toLocaleDateString("en-US", { dateStyle: "long" })}`}
        back="/dashboard/accounting"
      />

      {/* Status */}
      <div className={`flex items-center gap-3 rounded-xl p-4 ring-1 ${
        tb.isBalanced
          ? "bg-emerald-50 dark:bg-emerald-950/30 ring-emerald-500/30 text-emerald-700 dark:text-emerald-400"
          : "bg-amber-50 dark:bg-amber-950/30 ring-amber-500/30 text-amber-700 dark:text-amber-400"
      }`}>
        {tb.isBalanced
          ? <CheckCircle2 className="h-5 w-5 shrink-0" />
          : <AlertCircle className="h-5 w-5 shrink-0" />}
        <p className="text-sm font-medium">
          {tb.isBalanced
            ? "Books are balanced — Total Debits equal Total Credits"
            : `Discrepancy of ৳${Math.abs(tb.totalDebit - tb.totalCredit).toLocaleString("en-IN")} detected`}
        </p>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-card border border-border/60 shadow-card overflow-x-auto max-w-3xl">
        <table className="w-full text-sm min-w-[400px]">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="py-3 px-4 text-left font-semibold">Account</th>
              <th className="py-3 px-4 text-right font-semibold">Debit</th>
              <th className="py-3 px-4 text-right font-semibold">Credit</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => {
              const sectionLines = tb.lines.filter((l) => l.section === section);
              if (sectionLines.length === 0) return null;
              return (
                <>
                  <tr key={`header-${section}`} className="border-b border-border bg-muted/20">
                    <td colSpan={3} className="py-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {SECTION_LABELS[section]}
                    </td>
                  </tr>
                  {sectionLines.map((line) => (
                    <tr key={line.code} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-2.5 px-4">
                        <span className="font-mono text-xs text-muted-foreground mr-2">{line.code}</span>
                        {line.name}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{fmt(line.debit)}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{fmt(line.credit)}</td>
                    </tr>
                  ))}
                </>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-foreground/20 font-bold">
              <td className="py-3 px-4">TOTALS</td>
              <td className="py-3 px-4 text-right tabular-nums">
                ৳{tb.totalDebit.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </td>
              <td className="py-3 px-4 text-right tabular-nums">
                ৳{tb.totalCredit.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        * Entries auto-derived from cattle purchases, sales, cost entries, inventory transactions, partner capital, and fixed asset depreciation.
      </p>
    </div>
  );
}

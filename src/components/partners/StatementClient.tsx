"use client";

import { useRef } from "react";
import Link from "next/link";
import { Printer, ArrowLeft, Building2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Partner, PartnerTransaction, PartnerTransactionType } from "@/types/database";
import type { AccountSummary } from "@/app/dashboard/(app)/partners/[id]/statement/page";

// ── Helpers ───────────────────────────────────────────────────────────────────

function bdt(n: number) {
  return `৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const TXN_LABEL: Record<PartnerTransactionType, string> = {
  investment: "Capital In",
  withdrawal: "Capital Out (Withdrawal)",
  profit: "Profit Distribution",
  loss_allocation: "Loss Allocation",
};

const TYPE_LABEL: Record<string, string> = {
  capital: "Capital Partner",
  labor: "Labor Partner",
  hybrid: "Capital + Labor",
};

interface Props {
  businessName: string;
  partner: Partner;
  transactions: PartnerTransaction[];
  acc: AccountSummary;
  sharePct: number;
  statementDate: string;
  backUrl: string;
}

// ── StatementClient ───────────────────────────────────────────────────────────

export function StatementClient({
  businessName,
  partner: p,
  transactions,
  acc,
  sharePct,
  statementDate,
  backUrl,
}: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    window.print();
  }

  // Build running balance
  const withBalance = transactions.reduce(
    (arr, txn) => {
      const last = arr.length > 0 ? arr[arr.length - 1].balance : 0;
      const delta =
        txn.type === "investment" || txn.type === "profit"
          ? txn.amount
          : -txn.amount;
      arr.push({ ...txn, balance: last + delta });
      return arr;
    },
    [] as (PartnerTransaction & { balance: number })[]
  );

  const roi =
    acc.totalInvested > 0
      ? ((acc.equity - acc.totalInvested) / acc.totalInvested) * 100
      : null;

  const isEquityPositive = acc.equity >= 0;

  return (
    <>
      {/* ── Screen-only controls ──────────────────────────────────── */}
      <div className="print:hidden flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/30">
        <Link
          href={backUrl}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Profile
        </Link>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
        >
          <Printer className="h-4 w-4" />
          Print / Save PDF
        </button>
      </div>

      {/* ── Printable Statement ───────────────────────────────────── */}
      <div
        ref={printRef}
        className="max-w-3xl mx-auto px-6 py-8 print:px-0 print:py-0 print:max-w-none space-y-8"
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="text-center space-y-1 pb-6 border-b-2 border-foreground/20">
          <div className="flex justify-center mb-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 print:bg-gray-100">
              <Building2 className="h-6 w-6 text-primary print:text-gray-700" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground uppercase">
            {businessName}
          </h1>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
            Partner Statement of Account
          </p>
          <p className="text-xs text-muted-foreground">
            Statement Date: {statementDate}
          </p>
        </div>

        {/* ── Partner Details ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-b border-border/60">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Partner
            </p>
            <p className="text-sm font-bold mt-0.5">{p.name}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Type
            </p>
            <p className="text-sm font-medium mt-0.5">
              {TYPE_LABEL[p.partner_type ?? "capital"] ?? p.partner_type}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Joined
            </p>
            <p className="text-sm font-medium mt-0.5">{fmtDate(p.joined_at)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Profit Share
            </p>
            <p className="text-sm font-bold mt-0.5">{sharePct.toFixed(2)}%</p>
          </div>
        </div>

        {/* ── Account Summary ──────────────────────────────────────── */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-b border-border/60 pb-2">
            Capital Account Summary
          </h2>

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border/40">
                {p.partner_type !== "labor" && (
                  <SummaryRow
                    label="Total Capital Invested"
                    value={bdt(acc.totalInvested)}
                    positive
                  />
                )}
                {acc.laborValue > 0 && (
                  <SummaryRow
                    label={`Labor Value (${acc.months} months × ৳${(p.labor_value_monthly ?? 0).toLocaleString("en-IN")}/mo)`}
                    value={bdt(acc.laborValue)}
                    positive
                  />
                )}
                {acc.withdrawn > 0 && (
                  <SummaryRow
                    label="Total Withdrawn"
                    value={"(" + bdt(acc.withdrawn) + ")"}
                    negative
                  />
                )}
                {acc.profitReceived > 0 && (
                  <SummaryRow
                    label="Profit Distributions Received"
                    value={bdt(acc.profitReceived)}
                    positive
                  />
                )}
                {acc.lossBorne > 0 && (
                  <SummaryRow
                    label="Loss Allocations Borne"
                    value={"(" + bdt(acc.lossBorne) + ")"}
                    negative
                  />
                )}
                {acc.pendingProfit > 0 && (
                  <SummaryRow
                    label="Undistributed Profit (Pending)"
                    value={bdt(acc.pendingProfit)}
                    positive
                    pending
                  />
                )}
                {acc.pendingLoss > 0 && (
                  <SummaryRow
                    label="Unallocated Loss (Pending)"
                    value={"(" + bdt(acc.pendingLoss) + ")"}
                    negative
                    pending
                  />
                )}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40 border-t-2 border-foreground/20">
                  <td className="px-4 py-3 text-sm font-bold uppercase tracking-wide">
                    Current Equity
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right text-lg font-bold tabular-nums",
                      isEquityPositive
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-destructive"
                    )}
                  >
                    {isEquityPositive ? "" : "−"}
                    {bdt(acc.equity)}
                  </td>
                </tr>
                {roi !== null && (
                  <tr className="bg-muted/20 border-t border-border/40">
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      Return on Investment
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2 text-right text-sm font-bold tabular-nums",
                        roi >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-destructive"
                      )}
                    >
                      {roi >= 0 ? "+" : ""}
                      {roi.toFixed(2)}%
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── Transaction History ───────────────────────────────────── */}
        {withBalance.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-b border-border/60 pb-2">
              Transaction History ({withBalance.length} record{withBalance.length !== 1 ? "s" : ""})
            </h2>

            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/60">
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Date
                    </th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Description
                    </th>
                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Debit
                    </th>
                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Credit
                    </th>
                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {withBalance.map((txn, idx) => {
                    const isCredit =
                      txn.type === "investment" || txn.type === "profit";
                    return (
                      <tr
                        key={txn.id}
                        className={cn(
                          idx % 2 === 0 ? "bg-card" : "bg-muted/10"
                        )}
                      >
                        <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {fmtDate(txn.recorded_at)}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="text-sm font-medium">
                            {TXN_LABEL[txn.type]}
                          </div>
                          {txn.notes && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {txn.notes}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-sm text-muted-foreground">
                          {!isCredit
                            ? bdt(txn.amount)
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-sm font-medium text-emerald-600 dark:text-emerald-400">
                          {isCredit ? bdt(txn.amount) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold tabular-nums text-sm">
                          {txn.balance >= 0 ? "" : "−"}
                          {bdt(txn.balance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/40 border-t-2 border-foreground/20">
                    <td
                      colSpan={2}
                      className="px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground"
                    >
                      Closing Balance
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-sm text-muted-foreground font-semibold">
                      {bdt(
                        withBalance
                          .filter(
                            (t) =>
                              t.type === "withdrawal" ||
                              t.type === "loss_allocation"
                          )
                          .reduce((s, t) => s + t.amount, 0)
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
                      {bdt(
                        withBalance
                          .filter(
                            (t) =>
                              t.type === "investment" || t.type === "profit"
                          )
                          .reduce((s, t) => s + t.amount, 0)
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                      {withBalance.length > 0
                        ? (withBalance[withBalance.length - 1].balance >= 0
                            ? ""
                            : "−") +
                          bdt(withBalance[withBalance.length - 1].balance)
                        : "৳0"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ── Footer ───────────────────────────────────────────────── */}
        <div className="pt-6 border-t border-border/60 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 print:text-gray-500" />
                <p className="text-xs font-semibold text-muted-foreground">
                  This statement is computer-generated and does not require a signature.
                </p>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                Generated by {businessName} · {statementDate}
              </p>
              {p.notes && (
                <p className="text-xs text-muted-foreground pl-6 italic">
                  Note: {p.notes}
                </p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                Authorized Signature
              </p>
              <div className="mt-6 border-b border-foreground/30 w-32" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Print styles ───────────────────────────────────────────── */}
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          @page { margin: 20mm; size: A4; }
        }
      `}</style>
    </>
  );
}

// ── SummaryRow ────────────────────────────────────────────────────────────────

function SummaryRow({
  label,
  value,
  positive,
  negative,
  pending,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
  pending?: boolean;
}) {
  return (
    <tr>
      <td className="px-4 py-2.5 text-sm text-foreground">
        {label}
        {pending && (
          <span className="ml-2 text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            pending
          </span>
        )}
      </td>
      <td
        className={cn(
          "px-4 py-2.5 text-right font-semibold tabular-nums text-sm",
          positive
            ? "text-emerald-600 dark:text-emerald-400"
            : negative
            ? "text-muted-foreground"
            : ""
        )}
      >
        {value}
      </td>
    </tr>
  );
}

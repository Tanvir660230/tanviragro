"use client";

import { useRef } from "react";
import Link from "next/link";
import { Printer, ArrowLeft, Building2, CheckCircle2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Partner, PartnerTransaction, PartnerTransactionType } from "@/types/database";
import type { PartnerPosition } from "@/lib/partners/position";
import { useL } from "@/i18n/text";
import { Tr } from "@/i18n/Tr";
import { partnerTxnLabel, partnerTypeLabel } from "@/lib/partners/labels";
import { useTranslation } from "@/i18n/I18nProvider";

// ── Helpers ───────────────────────────────────────────────────────────────────

function bdt(n: number) {
  return `৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}



interface Props {
  businessName: string;
  partner: Partner;
  transactions: PartnerTransaction[];
  position: PartnerPosition;
  statementDate: string;
  backUrl: string;
}

// ── StatementClient ───────────────────────────────────────────────────────────

export function StatementClient({
  businessName,
  partner: p,
  transactions,
  position: pos,
  statementDate,
  backUrl,
}: Props) {
  const L = useL();
  const { locale } = useTranslation();
  const printRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    window.print();
  }

  function exportToCsv() {
    const metaRows = [
      ["Partner Statement", `"${p.name.replace(/"/g, '""')}"`],
      ["Statement Date", `"${statementDate}"`],
      ["Business Name", `"${businessName.replace(/"/g, '""')}"`],
      ["Partner Type", `"${partnerTypeLabel(p.partner_type, locale)}"`],
      ["Profit Share", `"${pos.profitPct.toFixed(1)}%"`],
      ["Loss Share", `"${pos.lossPct.toFixed(1)}%"`],
      ["Total Invested", pos.capitalIn],
      ["Total Withdrawn", pos.capitalOut],
      ["Share of final result", pos.realizedShare],
      ["Estimated share (animals on the farm)", pos.estimateShare],
      ["Profit Received", pos.profitReceived],
      ["Account value", pos.balance],
      [],
      ["Date", "Type", "Notes", "Debit (Out)", "Credit (In)", "Balance"],
    ];

    const txnRows = withBalance.map((t) => {
      const isCredit = t.type === "investment";
      return [
        `"${t.recorded_at}"`,
        `"${partnerTxnLabel(t.type, locale)}"`,
        `"${(t.notes ?? "").replace(/"/g, '""')}"`,
        isCredit ? "" : t.amount,
        isCredit ? t.amount : "",
        t.balance,
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [...metaRows.map((r) => r.join(",")), ...txnRows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `partner_statement_${p.name.toLowerCase().replace(/\s+/g, "_")}_${statementDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Build running balance
  const withBalance = transactions.reduce(
    (arr, txn) => {
      const last = arr.length > 0 ? arr[arr.length - 1].balance : 0;
      // capital balance: money put in less money taken out (a profit payout is not capital)
      const delta = txn.type === "investment" ? txn.amount : txn.type === "withdrawal" ? -txn.amount : 0;
      arr.push({ ...txn, balance: last + delta });
      return arr;
    },
    [] as (PartnerTransaction & { balance: number })[]
  );

  const capital = pos.netCapital + pos.laborValue;
  const roi = capital > 0 ? ((pos.balance + pos.profitReceived - capital) / capital) * 100 : null;
  const isEquityPositive = pos.balance >= 0;

  return (
    <>
      {/* ── Screen-only controls ──────────────────────────────────── */}
      <div className="print:hidden flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/30">
        <Link
          href={backUrl}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {L("প্রোফাইলে ফিরুন", "Back to Profile")}
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToCsv}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground shadow-xs hover:bg-muted transition-colors"
          >
            <Download className="h-4 w-4 text-muted-foreground" />
            {L("CSV নামান", "Export CSV")}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
          >
            <Printer className="h-4 w-4" />
            {L("প্রিন্ট / PDF", "Print / Save PDF")}
          </button>
        </div>
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
            {L("অংশীদারের হিসাব বিবরণী", "Partner Statement of Account")}
          </p>
          <p className="text-xs text-muted-foreground">
            {L("তারিখ", "Statement date")}: {statementDate}
          </p>
        </div>

        {/* ── Partner Details ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-b border-border/60">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {L("অংশীদার", "Partner")}
            </p>
            <p className="text-sm font-bold mt-0.5">{p.name}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {L("ধরন", "Type")}
            </p>
            <p className="text-sm font-medium mt-0.5">
              {partnerTypeLabel(p.partner_type ?? "capital", locale)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {L("যোগ দিয়েছেন", "Joined")}
            </p>
            <p className="text-sm font-medium mt-0.5">{fmtDate(p.joined_at)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {L("লাভের ভাগ", "Profit Share")}
            </p>
            <p className="text-sm font-bold mt-0.5">{pos.profitPct.toFixed(2)}%</p>
          </div>
        </div>

        {/* ── Account Summary ──────────────────────────────────────── */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-b border-border/60 pb-2">
            {L("মূলধনের সারসংক্ষেপ", "Capital Account Summary")}
          </h2>

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border/40">
                {pos.capitalIn > 0 && (
                  <SummaryRow label={L("মোট জমা", "Total Capital Invested")} value={bdt(pos.capitalIn)} positive />
                )}
                {pos.laborValue > 0 && (
                  <SummaryRow label={L("শ্রমের মূল্য", `Labour value (৳${(p.labor_value_monthly ?? 0).toLocaleString("en-IN")}/month)`)} value={bdt(pos.laborValue)} positive />
                )}
                {pos.capitalOut > 0 && (
                  <SummaryRow label={L("মোট তোলা", "Total Withdrawn")} value={"(" + bdt(pos.capitalOut) + ")"} negative />
                )}
                <SummaryRow label={L("পাকা লাভ/ক্ষতির ভাগ (বিক্রি হওয়া গরু)", "Share of final result (animals sold)")}
                  value={pos.realizedShare >= 0 ? bdt(pos.realizedShare) : "(" + bdt(pos.realizedShare) + ")"} positive={pos.realizedShare >= 0} negative={pos.realizedShare < 0} />
                <SummaryRow label={L("আনুমানিক ভাগ (খামারে থাকা গরু, আজকের বাজারদরে)", "Estimated share (animals on the farm, at today's price)")}
                  value={pos.estimateShare >= 0 ? bdt(pos.estimateShare) : "(" + bdt(pos.estimateShare) + ")"} positive={pos.estimateShare >= 0} negative={pos.estimateShare < 0} pending />
                {pos.profitReceived > 0 && (
                  <SummaryRow label={L("লাভ পেয়ে গেছেন", "Profit already paid out")} value={"(" + bdt(pos.profitReceived) + ")"} negative />
                )}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40 border-t-2 border-foreground/20">
                  <td className="px-4 py-3 text-sm font-bold uppercase tracking-wide">
                    {L("মোট পাওনা (আজ বিক্রি করলে)", "Account value (if sold today)")}
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
                    {bdt(pos.balance)}
                  </td>
                </tr>
                {roi !== null && (
                  <tr className="bg-muted/20 border-t border-border/40">
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {L("বিনিয়োগে লাভ %", "Return on Investment")}
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
              {L(`লেনদেন (${withBalance.length}টি)`, `Transaction history (${withBalance.length} record${withBalance.length !== 1 ? "s" : ""})`)}
            </h2>

            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/60">
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {L("তারিখ", "Date")}
                    </th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {L("বিবরণ", "Description")}
                    </th>
                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {L("ডেবিট", "Debit")}
                    </th>
                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {L("ক্রেডিট", "Credit")}
                    </th>
                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {L("ব্যালেন্স", "Balance")}
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
                            {partnerTxnLabel(txn.type, locale)}
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
                      {L("শেষ ব্যালেন্স", "Closing Balance")}
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
                  {L("এই বিবরণী কম্পিউটারে তৈরি, স্বাক্ষর লাগে না।", "This statement is computer-generated and does not require a signature.")}
                </p>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                {businessName} · {statementDate}
              </p>
              {p.notes && (
                <p className="text-xs text-muted-foreground pl-6 italic">
                  {L("নোট", "Note")}: {p.notes}
                </p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                {L("অনুমোদনকারীর স্বাক্ষর", "Authorized Signature")}
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
            <Tr bn="বাকি" en="pending" />
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

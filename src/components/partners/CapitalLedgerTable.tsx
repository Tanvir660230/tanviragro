"use client";

import { useState } from "react";
import { ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import type { CapitalTxn } from "./capital-types";
import { useL } from "@/i18n/text";
import { partnerTxnLabel } from "@/lib/partners/labels";
import { useTranslation } from "@/i18n/I18nProvider";
import { fmtDay } from "@/lib/format";
import { DataPagination } from "@/components/ui/data-pagination";

function fmt(n: number) {
  return `৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
}


export function CapitalLedgerTable({
  displayed,
}: {
  displayed: (CapitalTxn & { balance: number })[];
}) {
  const L = useL();
  const { locale } = useTranslation();
  const SHOW_LIMIT = 5;
  const [showAllTxns, setShowAllTxns] = useState(false);
  const [who, setWho] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const names = [...new Set(displayed.map((t) => t.partner_name))].sort();

  if (displayed.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground bg-card">
        {L("এখনো কোনো মূলধনের লেনদেন নেই।", "No capital transactions recorded yet.")}
      </div>
    );
  }

  // first a glance (the latest few); then every entry, by partner, a page at a time
  const chosen = who ? displayed.filter((t) => t.partner_name === who) : displayed;
  const rows = showAllTxns ? chosen.slice(page * pageSize, (page + 1) * pageSize) : displayed.slice(0, SHOW_LIMIT);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-card">
      {showAllTxns && names.length > 1 && (
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2 text-xs">
          <span className="text-muted-foreground">{L("অংশীদার", "Partner")}</span>
          <select value={who} onChange={(e) => { setWho(e.target.value); setPage(0); }} className="rounded-md border border-border bg-card px-2 py-1">
            <option value="">{L("সবাই", "Everyone")}</option>
            {names.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border/60">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {L("তারিখ", "Date")}
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {L("অংশীদার", "Partner")}
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {L("ধরন", "Type")}
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {L("টাকা", "Amount")}
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {L("ব্যালেন্স", "Running Balance")}
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">
                {L("নোট", "Notes")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((txn, i) => (
              <tr key={txn.id} className={i === 0 ? "bg-card" : "bg-card/50"}>
                <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                  {fmtDay(txn.recorded_at, locale)}
                </td>
                <td className="px-4 py-3 font-medium">{txn.partner_name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {txn.type === "investment" ? (
                      <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <ArrowDownCircle className="h-3.5 w-3.5 text-red-500" />
                    )}
                    <span
                      className={`text-xs font-medium ${
                        txn.type === "investment"
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-red-700 dark:text-red-400"
                      }`}
                    >
                      {partnerTxnLabel(txn.type, locale)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  <span
                    className={
                      txn.type === "investment"
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-red-700 dark:text-red-400"
                    }
                  >
                    {txn.type === "investment" ? "+" : "−"}
                    {fmt(txn.amount)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">
                  {txn.balance >= 0 ? "" : "−"}
                  {fmt(txn.balance)}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell max-w-[180px] truncate">
                  {txn.notes ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showAllTxns && chosen.length > 25 && (
        <DataPagination total={chosen.length} page={page} pageSize={pageSize} onPageChange={setPage}
          onPageSizeChange={(n) => { setPageSize(n); setPage(0); }} className="border-t border-border/60 px-4 py-2" />
      )}
      {!showAllTxns && displayed.length > SHOW_LIMIT && (
        <div className="border-t border-border/60 px-4 py-3 text-center">
          <button
            onClick={() => setShowAllTxns(true)}
            className="text-sm text-primary hover:underline font-medium"
          >
            {L(`আরও ${displayed.length - SHOW_LIMIT}টি লেনদেন দেখান`, `Show ${displayed.length - SHOW_LIMIT} more transaction${displayed.length - SHOW_LIMIT !== 1 ? "s" : ""}`)}
          </button>
        </div>
      )}
    </div>
  );
}

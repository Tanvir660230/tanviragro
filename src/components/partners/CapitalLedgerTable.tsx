"use client";

import { useState } from "react";
import { ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import type { CapitalTxn } from "./capital-types";

function fmt(n: number) {
  return `৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function CapitalLedgerTable({
  displayed,
}: {
  displayed: (CapitalTxn & { balance: number })[];
}) {
  const SHOW_LIMIT = 5;
  const [showAllTxns, setShowAllTxns] = useState(false);

  if (displayed.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground bg-card">
        No capital transactions recorded yet.
      </div>
    );
  }

  const rows = showAllTxns ? displayed : displayed.slice(0, SHOW_LIMIT);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border/60">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Date
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Partner
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Type
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Amount
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Running Balance
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((txn, i) => (
              <tr key={txn.id} className={i === 0 ? "bg-card" : "bg-card/50"}>
                <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                  {fmtDate(txn.recorded_at)}
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
                      {txn.type === "investment" ? "Capital In" : "Withdrawal"}
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
      {!showAllTxns && displayed.length > SHOW_LIMIT && (
        <div className="border-t border-border/60 px-4 py-3 text-center">
          <button
            onClick={() => setShowAllTxns(true)}
            className="text-sm text-primary hover:underline font-medium"
          >
            Show {displayed.length - SHOW_LIMIT} more transaction
            {displayed.length - SHOW_LIMIT !== 1 ? "s" : ""}
          </button>
        </div>
      )}
    </div>
  );
}

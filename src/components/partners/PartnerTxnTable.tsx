"use client";

import { useState } from "react";
import { DataPagination, DateRangeFilter } from "@/components/ui/data-pagination";
import type { PartnerTransaction } from "@/types/database";

function bdt(n: number) {
  return `৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
}
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    day: "numeric", month: "long", year: "numeric",
  });
}

const TYPE_LABEL: Record<string, string> = {
  investment:      "Capital Investment",
  withdrawal:      "Withdrawal",
  profit:          "Profit Distribution",
  loss_allocation: "Loss Allocation",
};

const TYPE_CLS: Record<string, string> = {
  investment:      "bg-blue-50 text-blue-700",
  withdrawal:      "bg-red-50 text-red-700",
  profit:          "bg-green-50 text-green-700",
  loss_allocation: "bg-orange-50 text-orange-700",
};

interface Props {
  txns: PartnerTransaction[];
  closingBalance: number;
}

export function PartnerTxnTable({ txns, closingBalance }: Props) {
  const [page, setPage]         = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");

  // Compute running balance for ALL txns first
  const allWithBalance = txns.reduce<(PartnerTransaction & { balance: number })[]>((acc, txn) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].balance : 0;
    const isIn  = txn.type === "investment" || txn.type === "profit";
    const isOut = txn.type === "withdrawal" || txn.type === "loss_allocation";
    const balance = prev + (isIn ? Number(txn.amount) : isOut ? -Number(txn.amount) : 0);
    return [...acc, { ...txn, balance }];
  }, []);

  // Date filter
  const filtered = allWithBalance.filter((t) => {
    const d = t.recorded_at.slice(0, 10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo   && d > dateTo)   return false;
    return true;
  });

  const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="space-y-3 no-print">
      {/* Date filter */}
      <DateRangeFilter
        from={dateFrom}
        to={dateTo}
        onFromChange={(v) => { setDateFrom(v); setPage(0); }}
        onToChange={(v)   => { setDateTo(v);   setPage(0); }}
        onClear={() => { setDateFrom(""); setDateTo(""); setPage(0); }}
        filteredCount={filtered.length}
        totalCount={txns.length}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Date</th>
              <th className="text-left py-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Type</th>
              <th className="text-left py-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden sm:table-cell">Notes</th>
              <th className="text-right py-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Amount</th>
              <th className="text-right py-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Balance</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground italic">
                  No transactions in this date range
                </td>
              </tr>
            ) : (
              visible.map((txn) => {
                const isIn  = txn.type === "investment" || txn.type === "profit";
                const isOut = txn.type === "withdrawal" || txn.type === "loss_allocation";
                return (
                  <tr key={txn.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-2 text-muted-foreground whitespace-nowrap">{fmtDate(txn.recorded_at)}</td>
                    <td className="py-2">
                      <span className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded ${TYPE_CLS[txn.type] ?? "bg-muted text-muted-foreground"}`}>
                        {TYPE_LABEL[txn.type] ?? txn.type}
                      </span>
                    </td>
                    <td className="py-2 text-muted-foreground hidden sm:table-cell max-w-[160px] truncate">
                      {txn.notes ?? "—"}
                    </td>
                    <td className={`py-2 text-right tabular-nums font-medium ${isIn ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>
                      {isIn ? "+" : "−"}{bdt(txn.amount)}
                    </td>
                    <td className="py-2 text-right tabular-nums font-semibold">
                      {txn.balance >= 0 ? "" : "−"}{bdt(txn.balance)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {!dateFrom && !dateTo && (
            <tfoot>
              <tr className="border-t-2 border-black font-bold">
                <td colSpan={3} className="py-2 hidden sm:table-cell">Closing Balance</td>
                <td colSpan={1} className="py-2 sm:hidden">Closing Balance</td>
                <td></td>
                <td className={`py-2 text-right tabular-nums ${closingBalance >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {closingBalance >= 0 ? "" : "−"}{bdt(closingBalance)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <DataPagination
        total={filtered.length}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
      />
    </div>
  );
}

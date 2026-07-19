"use client";

import { useState, useTransition, useEffect } from "react";
import { Printer, Loader2 } from "lucide-react";
import { getStatementData } from "@/app/dashboard/(app)/finance/statement-action";
import type { TxnRow, StatementResult } from "@/app/dashboard/(app)/finance/statement-action";
import { DataPagination } from "@/components/ui/data-pagination";

const BADGE: Record<TxnRow["category"], string> = {
  "Capital In":      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "Capital Out":     "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  "Cattle Sale":     "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  "Cattle Purchase": "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  "Inventory":       "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "Operating Cost":  "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400",
  "Asset Purchase":  "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
};

function fmt(n: number) {
  return "৳" + Math.abs(Math.round(n)).toLocaleString("en-IN");
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function TransactionStatement() {
  const [dateRange, setDateRange] = useState({
    from: firstOfMonthStr(),
    to: todayStr(),
  });
  const [result, setResult]         = useState<StatementResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [page, setPage]             = useState(0);
  const [pageSize, setPageSize]     = useState(50);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(0);
    startTransition(async () => {
      const data = await getStatementData(
        dateRange.from || undefined,
        dateRange.to || undefined
      );
      setResult(data);
    });
  }, [dateRange]);

  // Compute running balance
  const initialBalance = result?.openingBalance ?? 0;
  const rows = (result?.transactions ?? []).reduce<(TxnRow & { balance: number })[]>((acc, txn) => {
    const prevBalance = acc.length > 0 ? acc[acc.length - 1].balance : initialBalance;
    const currentBalance = prevBalance + (txn.direction === "in" ? txn.amount : -txn.amount);
    acc.push({ ...txn, balance: currentBalance });
    return acc;
  }, []);

  const totalIn = rows.filter((r) => r.direction === "in").reduce((s, r) => s + r.amount, 0);
  const totalOut = rows.filter((r) => r.direction === "out").reduce((s, r) => s + r.amount, 0);
  const closing = (result?.openingBalance ?? 0) + totalIn - totalOut;

  return (
    <div className="stmt-print-root space-y-4">
        {/* Print-only header */}
        <div className="hidden print:block mb-6 border-b pb-4">
          <h1 className="text-2xl font-bold">{result?.businessName}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cash Flow Statement
            {dateRange.from && ` · ${fmtDate(dateRange.from)}`}
            {dateRange.to ? ` – ${fmtDate(dateRange.to)}` : " – All time"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Generated {fmtDate(todayStr())}</p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-end gap-3 stmt-print-hide">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">From</label>
            <input
              type="date"
              value={dateRange.from}
              max={dateRange.to || undefined}
              onChange={(e) => setDateRange((p) => ({ ...p, from: e.target.value }))}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">To</label>
            <input
              type="date"
              value={dateRange.to}
              min={dateRange.from || undefined}
              onChange={(e) => setDateRange((p) => ({ ...p, to: e.target.value }))}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <button
            onClick={() => setDateRange({ from: "", to: "" })}
            className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-1.5 transition-colors"
          >
            All time
          </button>
          {isPending && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground self-center" />
          )}
          <div className="ml-auto">
            <button
              onClick={() => {
                document.body.classList.add("stmt-printing");
                window.print();
                window.addEventListener("afterprint", () => document.body.classList.remove("stmt-printing"), { once: true });
              }}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
          </div>
        </div>

        {/* Summary cards */}
        {result && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(
              [
                { label: "Opening Balance", amount: result.openingBalance, cls: "", ring: "ring-black/5",       wash: "from-foreground/[0.03]" },
                { label: "Total In",        amount: totalIn,              cls: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/10", wash: "from-emerald-500/[0.06]" },
                { label: "Total Out",       amount: totalOut,             cls: "text-destructive", ring: "ring-red-500/10", wash: "from-red-500/[0.06]" },
                { label: "Closing Balance", amount: closing,              cls: closing < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400", ring: closing < 0 ? "ring-red-500/10" : "ring-emerald-500/10", wash: closing < 0 ? "from-red-500/[0.06]" : "from-emerald-500/[0.06]" },
              ] as const
            ).map(({ label, amount, cls, ring, wash }) => (
              <div key={label} className={`relative overflow-hidden rounded-xl bg-card px-4 py-3.5 shadow-card ring-1 ${ring}`}>
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${wash} to-transparent`} />
                <p className="relative text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
                <p className={`relative text-xl font-bold tracking-tight tabular-nums mt-1 ${cls}`}>
                  {amount < 0 ? "−" : ""}৳{Math.abs(Math.round(amount)).toLocaleString("en-IN")}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Initial loading */}
        {!result && isPending && (
          <div className="rounded-xl bg-card shadow-card ring-1 ring-black/5 h-64 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Statement table */}
        {result && (
          <div className="rounded-xl bg-card overflow-x-auto shadow-card ring-1 ring-black/5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left py-2.5 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    Date
                  </th>
                  <th className="text-left py-2.5 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wide">
                    Description
                  </th>
                  <th className="text-left py-2.5 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                    Category
                  </th>
                  <th className="text-right py-2.5 px-4 font-semibold text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                    In
                  </th>
                  <th className="text-right py-2.5 px-4 font-semibold text-xs text-destructive uppercase tracking-wide">
                    Out
                  </th>
                  <th className="text-right py-2.5 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Opening balance row */}
                <tr className="border-b border-border/50 bg-muted/20">
                  <td className="py-2 px-4 text-xs text-muted-foreground whitespace-nowrap">
                    {dateRange.from ? fmtDate(dateRange.from) : "All time"}
                  </td>
                  <td className="py-2 px-4 text-xs text-muted-foreground italic font-medium">
                    Opening Balance
                  </td>
                  <td className="hidden md:table-cell" />
                  <td />
                  <td />
                  <td className="py-2 px-4 text-right font-semibold tabular-nums">
                    {result.openingBalance < 0 ? "−" : ""}৳
                    {Math.abs(Math.round(result.openingBalance)).toLocaleString("en-IN")}
                  </td>
                </tr>

                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                      No transactions in this period
                    </td>
                  </tr>
                ) : (
                  rows.slice(page * pageSize, (page + 1) * pageSize).map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border/40 hover:bg-muted/20 transition-colors print:table-row"
                    >
                      <td className="py-2.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDate(row.date)}
                      </td>
                      <td className="py-2.5 px-4 font-medium">{row.description}</td>
                      <td className="py-2.5 px-4 hidden md:table-cell">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[row.category]}`}
                        >
                          {row.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                        {row.direction === "in" ? fmt(row.amount) : ""}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums font-medium text-destructive">
                        {row.direction === "out" ? fmt(row.amount) : ""}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right tabular-nums font-semibold ${
                          row.balance < 0 ? "text-destructive" : ""
                        }`}
                      >
                        {row.balance < 0 ? "−" : ""}৳
                        {Math.abs(Math.round(row.balance)).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))
                )}

                {/* Pagination row */}
                {rows.length > pageSize && (
                  <tr className="stmt-print-hide">
                    <td colSpan={6} className="px-4 py-3">
                      <DataPagination
                        total={rows.length}
                        page={page}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
                      />
                    </td>
                  </tr>
                )}

                {/* Closing balance row */}
                {rows.length > 0 && (
                  <tr className="bg-muted/30 border-t-2 border-border">
                    <td className="py-2.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                      {dateRange.to ? fmtDate(dateRange.to) : fmtDate(todayStr())}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-sm">Closing Balance</td>
                    <td className="hidden md:table-cell" />
                    <td className="py-2.5 px-4 text-right tabular-nums text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      {fmt(totalIn)}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-xs text-destructive font-medium">
                      {fmt(totalOut)}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-bold text-base tabular-nums ${
                        closing < 0
                          ? "text-destructive"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {closing < 0 ? "−" : ""}৳
                      {Math.abs(Math.round(closing)).toLocaleString("en-IN")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
  );
}

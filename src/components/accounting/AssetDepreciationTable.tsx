"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export type AssetEntry = {
  id: string;
  description: string | null;
  category: string;
  amount: number;
  recorded_at: string;
};

// Default useful life by asset category (years) — straight-line
const USEFUL_LIFE: Record<string, number> = {
  Infrastructure: 20,
  Equipment:      5,
  Vehicle:        5,
  Land:           0, // Land doesn't depreciate
  Other:          7,
};

function monthsBetween(from: Date, to: Date) {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months--;
  return Math.max(0, months);
}

function computeStraightLine(cost: number, usefulYears: number, purchaseDate: string) {
  if (usefulYears === 0) return { annualDep: 0, accumulated: 0, bookValue: cost, fullyDepreciated: false };
  const from     = new Date(purchaseDate + "T00:00:00");
  const months   = monthsBetween(from, new Date());
  const annualDep = cost / usefulYears;
  const maxDep    = cost;
  const accumulated = Math.min((annualDep / 12) * months, maxDep);
  return {
    annualDep:       Math.round(annualDep),
    accumulated:     Math.round(accumulated),
    bookValue:       Math.round(cost - accumulated),
    fullyDepreciated: accumulated >= maxDep,
  };
}

function bdt(n: number) {
  return "৳" + n.toLocaleString("en-IN");
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export function AssetDepreciationTable({ assets }: { assets: AssetEntry[] }) {
  const [open, setOpen] = useState(true);

  if (assets.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold text-sm mb-2">সম্পদ অবচয় সূচি (Cost Entries)</h3>
        <p className="text-sm text-muted-foreground">কোনো মূলধনী সম্পদ এখনো যোগ করা হয়নি।</p>
      </div>
    );
  }

  const totals = assets.reduce((s, a) => {
    const life = USEFUL_LIFE[a.category] ?? 7;
    const dep  = computeStraightLine(Number(a.amount), life, a.recorded_at.slice(0, 10));
    return {
      cost:        s.cost + Number(a.amount),
      accumulated: s.accumulated + dep.accumulated,
      bookValue:   s.bookValue + dep.bookValue,
      annualDep:   s.annualDep + dep.annualDep,
    };
  }, { cost: 0, accumulated: 0, bookValue: 0, annualDep: 0 });

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors"
      >
        <div>
          <h3 className="font-semibold text-sm text-left">সম্পদ অবচয় সূচি (Depreciation Schedule)</h3>
          <p className="text-xs text-muted-foreground text-left mt-0.5">
            {assets.length}টি সম্পদ · বার্ষিক অবচয় {bdt(totals.annualDep)} · বর্তমান মূল্য {bdt(totals.bookValue)}
          </p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">সম্পদ</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">ক্রয়</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">মূল্য</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">মেয়াদ</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">বার্ষিক অবচয়</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">মোট অবচয়</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">বর্তমান মূল্য</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => {
                const life = USEFUL_LIFE[a.category] ?? 7;
                const dep  = computeStraightLine(Number(a.amount), life, a.recorded_at.slice(0, 10));
                return (
                  <tr key={a.id} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <p className="font-medium">{a.description ?? a.category}</p>
                      <p className="text-xs text-muted-foreground">{a.category}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                      {fmtDate(a.recorded_at.slice(0, 10))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{bdt(Math.round(Number(a.amount)))}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden md:table-cell">
                      {life === 0 ? "অবচয় নেই" : `${life} বছর`}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400">
                      {life === 0 ? "—" : bdt(dep.annualDep)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-destructive">
                      {life === 0 ? "—" : bdt(dep.accumulated)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {dep.fullyDepreciated ? (
                        <span className="text-muted-foreground">সম্পূর্ণ অবচয়</span>
                      ) : bdt(dep.bookValue)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30 border-t-2 border-border font-semibold">
                <td className="px-4 py-3" colSpan={2}>মোট</td>
                <td className="px-4 py-3 text-right tabular-nums">{bdt(totals.cost)}</td>
                <td className="hidden md:table-cell" />
                <td className="px-4 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400">{bdt(totals.annualDep)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-destructive">{bdt(totals.accumulated)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{bdt(totals.bookValue)}</td>
              </tr>
            </tfoot>
          </table>

          <div className="px-4 py-3 text-xs text-muted-foreground border-t border-border/40 space-y-0.5">
            <p>ডিফল্ট মেয়াদ: অবকাঠামো ২০ বছর · যন্ত্রপাতি ৫ বছর · যানবাহন ৫ বছর · অন্যান্য ৭ বছর · জমি: অবচয় নেই</p>
            <p>পদ্ধতি: সরল-রৈখিক (Straight-Line)</p>
          </div>
        </div>
      )}
    </div>
  );
}

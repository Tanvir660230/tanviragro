"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useL } from "@/i18n/text";
import { useTranslation } from "@/i18n/I18nProvider";
import { fmtDay } from "@/lib/format";
import { DataPagination } from "@/components/ui/data-pagination";
import type { AnimalResult } from "@/lib/partners/position";

const taka = (n: number) => `৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
const signed = (n: number) => (Math.round(n) === 0 ? "৳0" : `${n > 0 ? "+" : "−"}${taka(n)}`);
const tone = (n: number) => (Math.round(n) > 0 ? "text-emerald-600 dark:text-emerald-400" : Math.round(n) < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground");

type Tab = "active" | "sold" | "dead" | "all";
type Sort = "result" | "days" | "tag";

/** Every animal's full cost and result — filtered, sorted and paged so hundreds stay readable. */
export function AnimalResultsTable({ animals }: { animals: AnimalResult[] }) {
  const L = useL();
  const { locale } = useTranslation();
  const counts = { active: 0, sold: 0, dead: 0, all: animals.length };
  for (const a of animals) counts[a.status]++;
  const [tab, setTab] = useState<Tab>(counts.active ? "active" : "all");
  const [sort, setSort] = useState<Sort>("result");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const rows = useMemo(() => {
    const list = animals.filter((a) => tab === "all" || a.status === tab);
    return [...list].sort((a, b) => sort === "result" ? a.result - b.result : sort === "days" ? b.days - a.days : a.tag.localeCompare(b.tag, undefined, { numeric: true }));
  }, [animals, tab, sort]);
  const visible = rows.slice(page * pageSize, (page + 1) * pageSize);
  const total = rows.reduce((s, a) => s + a.result, 0);

  const tabs: { v: Tab; label: string }[] = [
    { v: "active", label: L("খামারে", "On the farm") }, { v: "sold", label: L("বিক্রি", "Sold") },
    { v: "dead", label: L("মারা গেছে", "Died") }, { v: "all", label: L("সব", "All") },
  ];

  return (
    <div className="border-t border-border/60">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex gap-1 rounded-lg bg-muted/60 p-1">
          {tabs.filter((x) => x.v === "all" || counts[x.v] > 0).map((x) => (
            <button key={x.v} type="button" onClick={() => { setTab(x.v); setPage(0); }}
              className={cn("rounded-md px-2.5 py-1 text-xs font-medium", tab === x.v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {x.label} <span className="tabular-nums opacity-70">{counts[x.v]}</span>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ArrowDownUp className="h-3.5 w-3.5" aria-hidden />
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-md border border-border bg-card px-2 py-1 text-xs">
            <option value="result">{L("লোকসান আগে", "Losses first")}</option>
            <option value="days">{L("বেশি দিন আগে", "Longest on farm")}</option>
            <option value="tag">{L("ট্যাগ অনুযায়ী", "By tag")}</option>
          </select>
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">{L("গরু", "Animal")}</th>
              <th className="px-4 py-2 text-right font-medium">{L("দিন", "Days")}</th>
              <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">{L("কেনা", "Bought")}</th>
              <th className="hidden px-4 py-2 text-right font-medium md:table-cell">{L("নিজের খরচ", "Own costs")}</th>
              <th className="hidden px-4 py-2 text-right font-medium md:table-cell">{L("চলতি খরচের ভাগ", "Running share")}</th>
              <th className="px-4 py-2 text-right font-medium">{L("দাম", "Value")}</th>
              <th className="px-4 py-2 text-right font-medium">{L("ফল", "Result")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {visible.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2">
                  <Link href={`/dashboard/cattle/${a.id}`} className="font-medium hover:underline">{a.tag}</Link>
                  <span className="ml-1.5 text-[11px] text-muted-foreground">
                    {a.status === "active" ? L("খামারে", "on farm") : a.status === "sold" ? L(`বিক্রি ${fmtDay(a.endDate, locale)}`, `sold ${fmtDay(a.endDate, locale)}`) : L(`মারা গেছে ${fmtDay(a.endDate, locale)}`, `died ${fmtDay(a.endDate, locale)}`)}
                  </span>
                  {a.status === "active" && a.result < 0 && a.valueToday != null && (
                    <span className="block text-[11px] text-amber-700 dark:text-amber-400">{L("লোকসানে — ওজন আবার মেপে দেখুন", "at a loss — weigh again to check")}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{a.days}</td>
                <td className="hidden px-4 py-2 text-right tabular-nums sm:table-cell">{taka(a.purchasePrice)}</td>
                <td className="hidden px-4 py-2 text-right tabular-nums md:table-cell">{taka(a.ownCost)}</td>
                <td className="hidden px-4 py-2 text-right tabular-nums md:table-cell">{taka(a.runningShare)}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {a.status === "active" ? (a.valueToday != null ? taka(a.valueToday) : "—") : taka(a.salePrice ?? 0)}
                  {a.status === "active" && a.valueToday != null && <span className="ml-1 text-[10px] text-muted-foreground">{L("আনু.", "est.")}</span>}
                </td>
                <td className={cn("px-4 py-2 text-right font-semibold tabular-nums", tone(a.result))}>{signed(a.result)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border/60 bg-muted/20 text-xs">
              <td className="px-4 py-2 font-medium" colSpan={2}>{L(`মোট (${rows.length}টি)`, `Total (${rows.length})`)}</td>
              <td className="hidden sm:table-cell" /><td className="hidden md:table-cell" /><td className="hidden md:table-cell" /><td />
              <td className={cn("px-4 py-2 text-right font-bold tabular-nums", tone(total))}>{signed(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {rows.length > 25 && (
        <DataPagination total={rows.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(n) => { setPageSize(n); setPage(0); }} className="px-4 py-2" />
      )}
    </div>
  );
}

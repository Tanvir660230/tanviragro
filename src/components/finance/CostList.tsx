"use client";

import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ExportCostCSV } from "./ExportCostCSV";
import { CostEntryActions } from "./CostEntryActions";
import { Receipt, Tag, Building2, Package, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { DataPagination, DateRangeFilter } from "@/components/ui/data-pagination";

export interface CostEntry {
  id: string;
  type: "fixed" | "variable";
  entry_class: "expense" | "asset";
  category: string;
  amount: number;
  recorded_at: string;
  description: string | null;
  cattle_id?: string | null;
}

export interface InventoryPurchaseEntry {
  id: string;
  item_name: string;
  item_category: string;
  qty: number;
  unit: string;
  unit_cost: number;
  amount: number;
  recorded_at: string;
  notes: string | null;
}

const INV_CATEGORY_STYLE: Record<string, string> = {
  feed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  medicine: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  equipment: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
  roughage: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  other: "bg-muted text-muted-foreground",
};

type Filter = "all" | "fixed" | "variable";

const CATEGORY_COLORS: string[] = [
  "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400",
  "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-400",
  "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400",
  "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400",
  "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-400",
  "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400",
  "bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-400",
];

const CATEGORY_BORDERS: string[] = [
  "border-l-sky-400", "border-l-violet-400", "border-l-rose-400", "border-l-amber-400",
  "border-l-teal-400", "border-l-orange-400", "border-l-indigo-400", "border-l-pink-400",
];

function ExpandableText({ text, maxChars = 80 }: { text: string; maxChars?: number }) {
  const [expanded, setExpanded] = useState(false);
  if (text.length <= maxChars) return <span>{text}</span>;
  return (
    <span>
      {expanded ? text : text.slice(0, maxChars) + "…"}
      {" "}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
        className="text-primary hover:underline text-xs font-medium whitespace-nowrap"
      >
        {expanded ? "see less" : "see more"}
      </button>
    </span>
  );
}

function hashIndex(str: string, len: number): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % len;
}

function getCategoryStyle(cat: string) {
  const idx = hashIndex(cat.toLowerCase(), CATEGORY_COLORS.length);
  return { badge: CATEGORY_COLORS[idx], border: CATEGORY_BORDERS[idx] };
}

function extractPersonTag(desc: string | null): string | null {
  if (!desc) return null;
  const atMatch = desc.match(/^@(\w+)/);
  if (atMatch) return atMatch[1];
  const colonMatch = desc.match(/^([A-Z][a-zA-Z]{1,20}):/);
  if (colonMatch) return colonMatch[1];
  const bracketMatch = desc.match(/^\[([^\]]{1,20})\]/);
  if (bracketMatch) return bracketMatch[1];
  return null;
}

const TYPE_STYLE = {
  fixed:    "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  variable: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
};

const TABS: { value: Filter; label: string }[] = [
  { value: "all",      label: "All" },
  { value: "fixed",    label: "Fixed" },
  { value: "variable", label: "Variable" },
];

function fmt(n: number) {
  return `৳${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function InventoryPurchasesSection({ purchases }: { purchases: InventoryPurchaseEntry[] }) {
  const [showAll, setShowAll] = useState(false);
  const VISIBLE = 5;

  const total = purchases.reduce((s, p) => s + p.amount, 0);
  if (purchases.length === 0) return null;

  const visible = showAll ? purchases : purchases.slice(0, VISIBLE);

  return (
    <div className="rounded-xl shadow-card border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.06] to-transparent overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
            <Package className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            Feed &amp; Inventory Purchases
          </span>
          <span className="text-xs text-emerald-700/80 dark:text-emerald-400/80 hidden sm:inline">
            — counted as cost only when consumed
          </span>
        </div>
        <span className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
          {fmt(total)}
        </span>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-emerald-200 dark:border-emerald-800/60 bg-emerald-100/50 dark:bg-emerald-950/30">
              <th className="px-4 py-2.5 text-left font-medium text-emerald-700 dark:text-emerald-400">Date</th>
              <th className="px-4 py-2.5 text-left font-medium text-emerald-700 dark:text-emerald-400">Item</th>
              <th className="px-4 py-2.5 text-left font-medium text-emerald-700 dark:text-emerald-400">Category</th>
              <th className="px-4 py-2.5 text-right font-medium text-emerald-700 dark:text-emerald-400">Qty</th>
              <th className="px-4 py-2.5 text-right font-medium text-emerald-700 dark:text-emerald-400">Unit Cost</th>
              <th className="px-4 py-2.5 text-right font-medium text-emerald-700 dark:text-emerald-400">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/40">
            {visible.map((p) => (
              <tr key={p.id} className="hover:bg-emerald-100/40 dark:hover:bg-emerald-950/30 transition-colors">
                <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{formatDate(p.recorded_at)}</td>
                <td className="px-4 py-2.5 font-medium">{p.item_name}</td>
                <td className="px-4 py-2.5">
                  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize", INV_CATEGORY_STYLE[p.item_category] ?? INV_CATEGORY_STYLE.other)}>
                    {p.item_category}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{p.qty} {p.unit}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{fmt(p.unit_cost)}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{fmt(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col divide-y divide-emerald-100 dark:divide-emerald-900/40 md:hidden">
        {visible.map((p) => (
          <div key={p.id} className="px-4 py-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-medium text-sm">{p.item_name}</span>
                <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize", INV_CATEGORY_STYLE[p.item_category] ?? INV_CATEGORY_STYLE.other)}>
                  {p.item_category}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{formatDate(p.recorded_at)} · {p.qty} {p.unit} @ {fmt(p.unit_cost)}</p>
            </div>
            <span className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300 shrink-0">{fmt(p.amount)}</span>
          </div>
        ))}
      </div>

      {purchases.length > VISIBLE && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-emerald-200 dark:border-emerald-800/60 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/40 dark:hover:bg-emerald-950/30 transition-colors"
        >
          {showAll ? <><ChevronUp className="h-3.5 w-3.5" /> Show less</> : <><ChevronDown className="h-3.5 w-3.5" /> Show all {purchases.length} purchases</>}
        </button>
      )}

      <div className="border-t border-emerald-200 dark:border-emerald-800/60 px-4 py-2 text-center">
        <Link href="/dashboard/inventory" className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline">
          Manage stock in Inventory →
        </Link>
      </div>
    </div>
  );
}

interface Props { entries: CostEntry[]; inventoryPurchases?: InventoryPurchaseEntry[]; }

// ── Asset Register section ─────────────────────────────────────────

export function AssetRegister({ assets, showEmpty = false }: { assets: CostEntry[]; showEmpty?: boolean }) {
  const total = assets.reduce((s, a) => s + a.amount, 0);
  if (assets.length === 0) {
    if (!showEmpty) return null;
    return (
      <div className="rounded-xl border border-border/60 p-10 text-center">
        <Building2 className="h-9 w-9 text-muted-foreground mx-auto mb-3" />
        <p className="font-medium">কোনো মূলধনী সম্পদ নেই</p>
        <p className="text-sm text-muted-foreground mt-1">
          &ldquo;Add Cost / Asset&rdquo; বাটনে ক্লিক করুন এবং <strong>Asset</strong> মোড বেছে নিন।
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl shadow-card border border-amber-500/15 bg-gradient-to-br from-amber-500/[0.06] to-transparent overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
            <Building2 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            Capital Assets
          </span>
          <span className="text-xs text-amber-700/80 dark:text-amber-400/80 hidden sm:inline">
            — not deducted from P&amp;L
          </span>
        </div>
        <span className="text-sm font-bold tabular-nums text-amber-700 dark:text-amber-300">
          {fmt(total)}
        </span>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-amber-200 dark:border-amber-800/60 bg-amber-100/50 dark:bg-amber-950/30">
              <th className="px-4 py-2.5 text-left font-medium text-amber-700 dark:text-amber-400">Date</th>
              <th className="px-4 py-2.5 text-left font-medium text-amber-700 dark:text-amber-400">Category</th>
              <th className="px-4 py-2.5 text-left font-medium text-amber-700 dark:text-amber-400">Description</th>
              <th className="px-4 py-2.5 text-right font-medium text-amber-700 dark:text-amber-400">Value</th>
              <th className="px-4 py-2.5 w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100 dark:divide-amber-900/40">
            {assets.map((a) => {
              const catStyle = getCategoryStyle(a.category);
              return (
                <tr key={a.id} className="hover:bg-amber-100/40 dark:hover:bg-amber-950/30 transition-colors">
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{formatDate(a.recorded_at)}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize", catStyle.badge)}>
                      {a.category}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {a.description ? <ExpandableText text={a.description} /> : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                    {fmt(a.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <CostEntryActions entry={a} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col divide-y divide-amber-100 dark:divide-amber-900/40 md:hidden">
        {assets.map((a) => {
          const catStyle = getCategoryStyle(a.category);
          return (
            <div key={a.id} className="px-4 py-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize", catStyle.badge)}>
                    {a.category}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(a.recorded_at)}</p>
                {a.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <ExpandableText text={a.description} maxChars={60} />
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-sm font-bold tabular-nums text-amber-700 dark:text-amber-300">{fmt(a.amount)}</span>
                <CostEntryActions entry={a} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main CostList ──────────────────────────────────────────────────

export function CostList({ entries, inventoryPurchases = [] }: Props) {
  const expenses = useMemo(() => entries.filter((e) => (e.entry_class ?? "expense") === "expense"), [entries]);
  const assets   = useMemo(() => entries.filter((e) => e.entry_class === "asset"), [entries]);

  const [filter, setFilter]             = useState<Filter>("all");
  const [personFilter, setPersonFilter] = useState<string | null>(null);
  const [page, setPage]                 = useState(0);
  const [pageSize, setPageSize]         = useState(25);
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo, setDateTo]             = useState("");

  const allPersonTags = useMemo(() => {
    const tags = new Set<string>();
    for (const e of expenses) {
      const tag = extractPersonTag(e.description);
      if (tag) tags.add(tag);
    }
    return [...tags].sort();
  }, [expenses]);

  const filtered = useMemo(() => {
    let list = filter === "all" ? expenses : expenses.filter((e) => e.type === filter);
    if (personFilter) list = list.filter((e) => extractPersonTag(e.description) === personFilter);
    if (dateFrom)     list = list.filter((e) => e.recorded_at.slice(0, 10) >= dateFrom);
    if (dateTo)       list = list.filter((e) => e.recorded_at.slice(0, 10) <= dateTo);
    return list;
  }, [expenses, filter, personFilter, dateFrom, dateTo]);

  const filteredInventoryPurchases = useMemo(() => {
    let list = inventoryPurchases;
    if (dateFrom) list = list.filter((p) => p.recorded_at.slice(0, 10) >= dateFrom);
    if (dateTo)   list = list.filter((p) => p.recorded_at.slice(0, 10) <= dateTo);
    return list;
  }, [inventoryPurchases, dateFrom, dateTo]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(0); }, [filter, personFilter, dateFrom, dateTo]);

  const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const totalFixed    = expenses.filter((e) => e.type === "fixed").reduce((s, e) => s + e.amount, 0);
  const totalVariable = expenses.filter((e) => e.type === "variable").reduce((s, e) => s + e.amount, 0);
  const totalAssets   = assets.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-5">
      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: "Fixed Costs",    value: totalFixed,    ring: "ring-blue-500/10",    wash: "from-blue-500/[0.06]",    text: "text-blue-700 dark:text-blue-400" },
          { label: "Variable Costs", value: totalVariable, ring: "ring-purple-500/10",  wash: "from-purple-500/[0.06]",  text: "text-purple-700 dark:text-purple-400" },
          { label: "Total Expenses", value: totalFixed + totalVariable, ring: "ring-black/5", wash: "from-foreground/[0.03]", text: "text-foreground" },
          ...(totalAssets > 0 ? [{ label: "Capital Assets", value: totalAssets, ring: "ring-amber-500/10", wash: "from-amber-500/[0.06]", text: "text-amber-700 dark:text-amber-400" }] : []),
        ].map(({ label, value, ring, wash, text }) => (
          <div key={label} className={cn("relative overflow-hidden rounded-xl bg-card px-4 py-3 sm:px-5 sm:py-3.5 min-w-0 shadow-card ring-1 flex-1 basis-[140px]", ring)}>
            <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent", wash)} />
            <p className="relative text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">{label}</p>
            <p className={cn("relative mt-1 text-lg sm:text-xl font-bold tracking-tight tabular-nums", text)}>{fmt(value)}</p>
          </div>
        ))}
      </div>

      {/* Asset register */}
      <AssetRegister assets={assets} />

      {/* Feed & inventory purchases */}
      <InventoryPurchasesSection purchases={filteredInventoryPurchases} />

      {/* Date range filter */}
      <DateRangeFilter
        from={dateFrom}
        to={dateTo}
        onFromChange={(v) => { setDateFrom(v); setPage(0); }}
        onToChange={(v)   => { setDateTo(v);   setPage(0); }}
        onClear={() => { setDateFrom(""); setDateTo(""); setPage(0); }}
        filteredCount={filtered.length}
        totalCount={expenses.length}
      />

      {/* Type tabs + person filter + export */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1.5 ring-1 ring-black/5">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setFilter(t.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
                filter === t.value
                  ? "bg-card text-foreground shadow-card ring-1 ring-black/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/60"
              )}
            >
              {t.label}
              {t.value !== "all" && (
                <span className="ml-1.5 tabular-nums opacity-60">
                  ({expenses.filter((e) => e.type === t.value).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {allPersonTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {allPersonTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setPersonFilter(personFilter === tag ? null : tag)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  personFilter === tag
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                {tag}
              </button>
            ))}
            {personFilter && (
              <button
                onClick={() => setPersonFilter(null)}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Clear
              </button>
            )}
          </div>
        )}

        <div className="ml-auto">
          <ExportCostCSV entries={expenses} />
        </div>
      </div>

      {allPersonTags.length === 0 && expenses.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Tip: Start a description with <code className="rounded bg-muted px-1">@Name</code> or{" "}
          <code className="rounded bg-muted px-1">Name:</code> to tag payments to a specific person.
        </p>
      )}

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <Receipt className="h-5 w-5 text-muted-foreground/60" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            No {filter === "all" ? "" : filter + " "}expense entries
            {personFilter ? ` for @${personFilter}` : ""} yet
          </p>
        </div>
      )}

      {/* Desktop table */}
      {visible.length > 0 && (
        <>
          <div className="hidden md:block overflow-x-auto rounded-xl bg-card shadow-card ring-1 ring-black/5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {visible.map((e) => {
                  const catStyle  = getCategoryStyle(e.category);
                  const personTag = extractPersonTag(e.description);
                  return (
                    <tr key={e.id} className={cn("border-l-2 hover:bg-muted/20 transition-colors", catStyle.border)}>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(e.recorded_at)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize", TYPE_STYLE[e.type])}>
                          {e.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize", catStyle.badge)}>
                          {e.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-start gap-1.5 flex-wrap">
                          {personTag && (
                            <span className="shrink-0 rounded bg-foreground/10 px-1.5 py-0.5 text-xs font-semibold text-foreground">
                              @{personTag}
                            </span>
                          )}
                          <span className="text-muted-foreground text-sm">
                            {e.description ? <ExpandableText text={e.description} /> : "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmt(e.amount)}</td>
                      <td className="px-4 py-3 text-right">
                        <CostEntryActions entry={e} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {visible.map((e) => {
              const catStyle  = getCategoryStyle(e.category);
              const personTag = extractPersonTag(e.description);
              return (
                <div key={e.id} className={cn("rounded-xl bg-card p-4 shadow-card ring-1 ring-black/5 border-l-2", catStyle.border)}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize", TYPE_STYLE[e.type])}>
                        {e.type}
                      </span>
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize", catStyle.badge)}>
                        {e.category}
                      </span>
                      {personTag && (
                        <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-xs font-semibold text-foreground">
                          @{personTag}
                        </span>
                      )}
                    </div>
                    <CostEntryActions entry={e} />
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">{formatDate(e.recorded_at)}</p>
                      {e.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          <ExpandableText text={e.description} maxChars={60} />
                        </p>
                      )}
                    </div>
                    <p className="text-lg font-bold tabular-nums shrink-0">{fmt(e.amount)}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <DataPagination
            total={filtered.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
          />
        </>
      )}
    </div>
  );
}

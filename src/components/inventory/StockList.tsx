"use client";

import { ChevronDown, MoreHorizontal, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { ItemActions, type CattleOption } from "./ItemActions";
import { EditItemDialog } from "./EditItemDialog";
import { ArchiveItemButton } from "./ArchiveItemButton";
import type { InventoryRow } from "./InventoryTable";

export type StockStatus = { role: "mix" | "ingredient" | "direct"; inUse: boolean; daysLeft: number | null };

const T = {
  en: {
    fed: "Fed to the cattle", fed_sub: "The mix and feeds given as they are — these are what get deducted every day.",
    ingredients: "Mix ingredients", ingredients_sub: "Bought to be mixed; they leave stock when a mix is made.",
    other: "Other items", finished: "Finished", discontinued: "Discontinued",
    in_use: "In use", not_started: "Not started", ingredient: "Ingredient",
    days_left: "≈ {days} days left", value: "value", per: "per", actions: "Actions", empty: "No items.",
  },
  bn: {
    fed: "গরুকে যা খাওয়ানো হয়", fed_sub: "মিক্স আর সরাসরি দেওয়া খাবার — এগুলোই প্রতিদিন কাটা হয়।",
    ingredients: "মিক্সের উপকরণ", ingredients_sub: "মেশানোর জন্য কেনা; মিক্স তৈরি করলে স্টক থেকে বের হয়।",
    other: "অন্যান্য", finished: "স্টক শেষ", discontinued: "বন্ধ করা আইটেম",
    in_use: "চালু", not_started: "চালু নেই", ingredient: "উপকরণ",
    days_left: "আর ≈ {days} দিন", value: "মূল্য", per: "প্রতি", actions: "কাজ", empty: "কোনো আইটেম নেই।",
  },
} as const;
type Lang = keyof typeof T;
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const num = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const taka = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`;

export function StockList({ items, discontinued, cattle, status, lang }: {
  items: InventoryRow[];
  discontinued: InventoryRow[];
  cattle: CattleOption[];
  status: Record<string, StockStatus>;
  lang: Lang;
}) {
  const t = T[lang];
  const isFeed = (i: InventoryRow) => i.category === "feed" || i.category === "roughage";
  const fed = items.filter((i) => isFeed(i) && status[i.id]?.role !== "ingredient");
  const ingredients = items.filter((i) => isFeed(i) && status[i.id]?.role === "ingredient");
  const other = items.filter((i) => !isFeed(i));
  const withStock = (list: InventoryRow[]) => list.filter((i) => i.stock > 0.0001 || status[i.id]?.inUse);
  const empty = (list: InventoryRow[]) => list.filter((i) => !(i.stock > 0.0001 || status[i.id]?.inUse));

  const group = (title: string, sub: string | null, list: InventoryRow[]) => {
    if (!list.length) return null;
    const shown = withStock(list);
    const done = empty(list);
    return (
      <section className="rounded-xl border border-border bg-card shadow-card">
        <header className="border-b border-border px-4 py-2.5">
          <h3 className="text-sm font-semibold">{title}</h3>
          {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
        </header>
        {shown.length > 0 && <ul className="divide-y divide-border/60">{shown.map((i) => <Row key={i.id} i={i} s={status[i.id]} cattle={cattle} t={t} />)}</ul>}
        {done.length > 0 && (
          <details className="group border-t border-border/60">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-2.5 text-xs text-muted-foreground">
              <span className="min-w-0 truncate"><span className="font-semibold text-foreground">{t.finished} ({done.length}):</span> {done.map((i) => i.name).join(", ")}</span>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <ul className="divide-y divide-border/60 border-t border-border/60">{done.map((i) => <Row key={i.id} i={i} s={status[i.id]} cattle={cattle} t={t} />)}</ul>
          </details>
        )}
      </section>
    );
  };

  if (!items.length && !discontinued.length) return <p className="text-sm text-muted-foreground">{t.empty}</p>;
  return (
    <div className="space-y-3">
      {group(t.fed, t.fed_sub, fed)}
      {group(t.ingredients, t.ingredients_sub, ingredients)}
      {group(t.other, null, other)}
      {discontinued.length > 0 && (
        <details className="group rounded-xl border border-dashed border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-xs font-semibold text-muted-foreground">
            {t.discontinued} ({discontinued.length})<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="divide-y divide-border/60 border-t border-border/60">{discontinued.map((i) => <Row key={i.id} i={i} s={status[i.id]} cattle={cattle} t={t} />)}</ul>
        </details>
      )}
    </div>
  );
}

function Row({ i, s, cattle, t }: { i: InventoryRow; s?: StockStatus; cattle: CattleOption[]; t: (typeof T)[Lang] }) {
  const out = i.stock <= 0.0001;
  const low = !out && i.low_stock_threshold != null && i.stock <= i.low_stock_threshold;
  const isFeed = i.category === "feed" || i.category === "roughage";
  const chip = !isFeed ? null : s?.role === "ingredient" ? { text: t.ingredient, cls: "bg-sky-500/10 text-sky-700 dark:text-sky-300" }
    : s?.inUse ? { text: t.in_use, cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" }
    : { text: t.not_started, cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" };
  return (
    <li className="px-4 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5">
            <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate text-sm font-semibold">{i.name}</span>
            {chip && <span className={cn("rounded-full px-1.5 py-px text-[10px] font-semibold", chip.cls)}>{chip.text}</span>}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {i.currentCost != null ? `৳${num(i.currentCost)} ${t.per} ${i.unit}` : "—"}
            {i.currentCost != null && i.stock > 0 ? ` · ${t.value} ${taka(i.stock * i.currentCost)}` : ""}
            {s?.inUse && s.daysLeft != null ? ` · ${fill(t.days_left, { days: Math.floor(s.daysLeft) })}` : ""}
          </p>
        </div>
        <p className={cn("shrink-0 text-right text-base font-bold tabular-nums", out ? "text-muted-foreground" : low ? "text-amber-700 dark:text-amber-400" : "")}>
          {num(i.stock)} <span className="text-xs font-medium text-muted-foreground">{i.unit}</span>
        </p>
      </div>
      <details className="group mt-1">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/5">
          <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />{t.actions}
        </summary>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/30 p-2">
          <div className="flex flex-wrap items-center gap-1.5"><ItemActions item={i} cattle={cattle} /></div>
          <div className="flex items-center gap-1">
            <EditItemDialog item={i} />
            <ArchiveItemButton id={i.id} name={i.name} isDiscontinued={i.is_discontinued ?? false} />
          </div>
        </div>
      </details>
    </li>
  );
}

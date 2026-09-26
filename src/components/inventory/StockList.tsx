"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckSquare, ChevronDown, CircleStop, Loader2, MoreHorizontal, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { finishItems, type FinishChoice } from "@/app/dashboard/(app)/inventory/usage/actions";
import { ItemActions, type CattleOption } from "./ItemActions";
import { EditItemDialog } from "./EditItemDialog";
import { ArchiveItemButton } from "./ArchiveItemButton";
import type { InventoryRow } from "./InventoryTable";

export type StockStatus = {
  role: "mix" | "ingredient" | "direct";
  inUse: boolean;
  daysLeft: number | null;
  /** not in use: the day it most likely started being fed (bought / mixed) */
  suggestedStart?: string | null;
};

const T = {
  en: {
    fed: "Fed to the cattle", fed_sub: "The mix and feeds given as they are — deducted every day while in use.",
    ingredients: "Mix ingredients", ingredients_sub: "Bought to be mixed; they leave stock when a mix is made.",
    other: "Medicine & other", discontinued: "Retired items",
    in_use: "In use", not_started: "Not started", ingredient: "Ingredient", mix: "Mix",
    days_left: "≈ {days} days left", value: "worth", per: "/", actions: "More", empty: "No items.",
    f_stock: "In stock", f_done: "Finished", f_all: "All", nothing: "Nothing here.",
    selected: "{n} selected", finish: "Finished", clear: "Clear", select_all: "Select all",
    d_title: "Mark as finished", d_date: "Finished on", d_sub: "What happened to each item?",
    d_inuse: "In use — its feeding ends here with 0 left.",
    d_fed: "Fed to the cattle", d_since: "since", d_lost: "Lost / spoiled", d_used: "Used up",
    d_used_note: "Counted as used (e.g. medicine cost) on the finish date.",
    d_fed_note: "What was left is spread over those days as feed eaten.",
    d_lost_note: "Written off as a loss, not feed eaten.",
    d_go: "Mark finished", cancel: "Cancel", ok: "{n} marked finished", some_failed: "{n} could not be finished",
  },
  bn: {
    fed: "গরুকে যা খাওয়ানো হয়", fed_sub: "মিক্স আর সরাসরি দেওয়া খাবার — চালু থাকলে প্রতিদিন কাটা হয়।",
    ingredients: "মিক্সের উপকরণ", ingredients_sub: "মেশানোর জন্য কেনা; মিক্স তৈরি করলে স্টক থেকে বের হয়।",
    other: "ওষুধ ও অন্যান্য", discontinued: "বন্ধ করা আইটেম",
    in_use: "চালু", not_started: "চালু নেই", ingredient: "উপকরণ", mix: "মিক্স",
    days_left: "আর ≈ {days} দিন", value: "মূল্য", per: "/", actions: "আরও", empty: "কোনো আইটেম নেই।",
    f_stock: "স্টকে আছে", f_done: "শেষ", f_all: "সব", nothing: "এখানে কিছু নেই।",
    selected: "{n}টি বাছাই", finish: "শেষ হয়ে গেছে", clear: "বাতিল", select_all: "সব বাছাই",
    d_title: "শেষ হয়ে গেছে", d_date: "কবে শেষ হলো", d_sub: "প্রতিটি জিনিসের কী হয়েছে?",
    d_inuse: "চালু আছে — খাওয়ানো এখানে শেষ, বাকি ০।",
    d_fed: "গরুকে খাওয়ানো হয়েছে", d_since: "কবে থেকে", d_lost: "নষ্ট / হারিয়েছে", d_used: "ব্যবহার হয়ে গেছে",
    d_used_note: "শেষের তারিখে ব্যবহার হিসেবে ধরা হবে (যেমন ওষুধের খরচ)।",
    d_fed_note: "যা ছিল তা ঐ দিনগুলোতে খাওয়ানো হিসেবে ধরা হবে।",
    d_lost_note: "ক্ষতি হিসেবে বাদ যাবে, খাওয়ানো নয়।",
    d_go: "শেষ করুন", cancel: "বাতিল", ok: "{n}টি শেষ করা হলো", some_failed: "{n}টি শেষ করা যায়নি",
  },
} as const;
type Lang = keyof typeof T;
type Txt = (typeof T)[Lang];
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const num = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const taka = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`;
const hasStock = (i: InventoryRow, s?: StockStatus) => i.stock > 0.0001 || !!s?.inUse;

/**
 * Every item, grouped (fed / mix ingredients / other), filtered by in stock / finished, and
 * selectable: several can be marked finished at once — each as fed (since a date) or lost.
 */
export function StockList({ items, discontinued, cattle, status, lang, canEdit = false, asOf }: {
  items: InventoryRow[];
  discontinued: InventoryRow[];
  cattle: CattleOption[];
  status: Record<string, StockStatus>;
  lang: Lang;
  canEdit?: boolean;
  asOf: string;
}) {
  const t = T[lang];
  const [filter, setFilter] = useState<"stock" | "done" | "all">("stock");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [finishing, setFinishing] = useState(false);

  const isFeed = (i: InventoryRow) => i.category === "feed" || i.category === "roughage";
  const inStock = items.filter((i) => hasStock(i, status[i.id]));
  const finished = items.filter((i) => !hasStock(i, status[i.id]));
  const shown = filter === "stock" ? inStock : filter === "done" ? finished : items;
  const groups = [
    { key: "fed", title: t.fed, sub: t.fed_sub, list: shown.filter((i) => isFeed(i) && status[i.id]?.role !== "ingredient") },
    { key: "ing", title: t.ingredients, sub: t.ingredients_sub, list: shown.filter((i) => isFeed(i) && status[i.id]?.role === "ingredient") },
    { key: "other", title: t.other, sub: null, list: shown.filter((i) => !isFeed(i)) },
  ].filter((g) => g.list.length > 0);

  const selectable = (i: InventoryRow) => canEdit && hasStock(i, status[i.id]);
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const pickedItems = items.filter((i) => picked.has(i.id));

  if (!items.length && !discontinued.length) return <p className="text-sm text-muted-foreground">{t.empty}</p>;
  return (
    <div className="space-y-3">
      {/* filter */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg bg-muted/70 p-1 text-sm" role="tablist">
          {([["stock", t.f_stock, inStock.length], ["done", t.f_done, finished.length], ["all", t.f_all, items.length]] as const).map(([k, label, n]) => (
            <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
              className={cn("rounded-md px-3 py-1.5 font-medium transition-colors", filter === k ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}>
              {label} <span className="tabular-nums opacity-60">{n}</span>
            </button>
          ))}
        </div>
        {canEdit && filter !== "done" && inStock.length > 0 && (
          <button type="button" onClick={() => setPicked(picked.size === inStock.length ? new Set() : new Set(inStock.map((i) => i.id)))}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
            {picked.size === inStock.length ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}{t.select_all}
          </button>
        )}
      </div>

      {groups.length === 0 && <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">{t.nothing}</p>}

      {groups.map((g) => (
        <section key={g.key} className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <header className="border-b border-border bg-muted/30 px-4 py-2.5">
            <h3 className="text-sm font-semibold">{g.title} <span className="font-normal text-muted-foreground">· {g.list.length}</span></h3>
            {g.sub && <p className="text-[11px] text-muted-foreground">{g.sub}</p>}
          </header>
          <ul className="divide-y divide-border/60">
            {g.list.map((i) => (
              <Row key={i.id} i={i} s={status[i.id]} cattle={cattle} t={t}
                selectable={selectable(i)} picked={picked.has(i.id)} onToggle={() => toggle(i.id)} />
            ))}
          </ul>
        </section>
      ))}

      {discontinued.length > 0 && filter !== "stock" && (
        <details className="group rounded-xl border border-dashed border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-xs font-semibold text-muted-foreground">
            {t.discontinued} ({discontinued.length})<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="divide-y divide-border/60 border-t border-border/60">
            {discontinued.map((i) => <Row key={i.id} i={i} s={status[i.id]} cattle={cattle} t={t} selectable={false} picked={false} onToggle={() => {}} />)}
          </ul>
        </details>
      )}

      {/* what to do with the selection */}
      {picked.size > 0 && (
        <div className="sticky bottom-20 z-30 md:bottom-4">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-floating backdrop-blur">
            <span className="text-sm font-semibold">{fill(t.selected, { n: picked.size })}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPicked(new Set())} className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />{t.clear}
              </button>
              <button type="button" onClick={() => setFinishing(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                <CircleStop className="h-4 w-4" />{t.finish}
              </button>
            </div>
          </div>
        </div>
      )}

      {finishing && (
        <FinishDialog items={pickedItems} status={status} t={t} asOf={asOf}
          onClose={() => setFinishing(false)} onDone={() => { setFinishing(false); setPicked(new Set()); }} />
      )}
    </div>
  );
}

function Row({ i, s, cattle, t, selectable, picked, onToggle }: {
  i: InventoryRow; s?: StockStatus; cattle: CattleOption[]; t: Txt; selectable: boolean; picked: boolean; onToggle: () => void;
}) {
  const out = i.stock <= 0.0001;
  const low = !out && i.low_stock_threshold != null && i.stock <= i.low_stock_threshold;
  const isFeed = i.category === "feed" || i.category === "roughage";
  const chip = !isFeed ? null
    : s?.inUse ? { text: t.in_use, cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" }
    : s?.role === "ingredient" ? { text: t.ingredient, cls: "bg-sky-500/10 text-sky-700 dark:text-sky-300" }
    : out ? null
    : { text: t.not_started, cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" };
  return (
    <li className={cn("px-3 py-3 sm:px-4", picked && "bg-primary/5")}>
      <div className="flex items-start gap-3">
        {selectable ? (
          <input type="checkbox" checked={picked} onChange={onToggle} aria-label={i.name}
            className="mt-1 h-[18px] w-[18px] shrink-0 cursor-pointer rounded accent-primary" />
        ) : <span className="w-[18px] shrink-0" aria-hidden />}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[0.95rem] font-semibold">{i.name}</span>
            {s?.role === "mix" && <span className="rounded-full bg-violet-500/10 px-1.5 py-px text-[10px] font-semibold text-violet-700 dark:text-violet-300">{t.mix}</span>}
            {chip && <span className={cn("rounded-full px-1.5 py-px text-[10px] font-semibold", chip.cls)}>{chip.text}</span>}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {i.currentCost != null ? `৳${num(i.currentCost)}${t.per}${i.unit}` : "—"}
            {i.currentCost != null && i.stock > 0 ? ` · ${t.value} ${taka(i.stock * i.currentCost)}` : ""}
            {s?.inUse && s.daysLeft != null ? ` · ${fill(t.days_left, { days: Math.floor(s.daysLeft) })}` : ""}
          </p>
        </div>
        <p className={cn("shrink-0 text-right text-lg font-bold tabular-nums leading-tight", out ? "text-muted-foreground/70" : low ? "text-amber-700 dark:text-amber-400" : "")}>
          {num(i.stock)} <span className="text-xs font-medium text-muted-foreground">{i.unit}</span>
        </p>
      </div>
      <details className="group ml-[30px] mt-1">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/5">
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

function FinishDialog({ items, status, t, asOf, onClose, onDone }: {
  items: InventoryRow[]; status: Record<string, StockStatus>; t: Txt; asOf: string; onClose: () => void; onDone: () => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState(asOf);
  const [pending, start] = useTransition();
  const [choice, setChoice] = useState<Record<string, FinishChoice>>(() => Object.fromEntries(items.map((i) => [i.id, {
    itemId: i.id, how: (i.category === "feed" || i.category === "roughage" ? "fed" : "used") as FinishChoice["how"], fedFrom: status[i.id]?.suggestedStart ?? asOf,
  }])));
  const set = (id: string, patch: Partial<FinishChoice>) => setChoice((c) => ({ ...c, [id]: { ...c[id], ...patch } }));
  const names = useMemo(() => new Map(items.map((i) => [i.id, i.name])), [items]);

  const submit = () => start(async () => {
    const res = await finishItems({ date, items: items.map((i) => choice[i.id]) });
    if (res.done > 0) toast.success(fill(t.ok, { n: res.done }));
    if (res.failed.length) {
      toast.error(fill(t.some_failed, { n: res.failed.length }), { description: res.failed.map((f) => `${names.get(f.itemId) ?? ""}: ${f.error}`).join("\n") });
    }
    router.refresh();
    if (!res.failed.length) onDone();
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{t.d_title}</DialogTitle></DialogHeader>
        <label className="grid gap-1 text-sm font-medium">{t.d_date}
          <input type="date" value={date} max={asOf} onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
        </label>
        <p className="text-xs text-muted-foreground">{t.d_sub}</p>
        <ul className="space-y-2">
          {items.map((i) => {
            const s = status[i.id];
            const c = choice[i.id];
            const feed = i.category === "feed" || i.category === "roughage";
            const useKey = feed ? "fed" : "used";
            return (
              <li key={i.id} className="rounded-xl border border-border p-3">
                <p className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-semibold">{i.name}</span>
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{num(i.stock)} {i.unit}</span>
                </p>
                {s?.inUse ? (
                  <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">{t.d_inuse}</p>
                ) : (
                  <div className="mt-2 space-y-1.5 text-sm">
                    <label className="flex flex-wrap items-center gap-2">
                      <input type="radio" name={`how-${i.id}`} checked={c.how === useKey} onChange={() => set(i.id, { how: useKey })} className="accent-primary" />
                      {feed ? t.d_fed : t.d_used}
                      {feed && c.how === "fed" && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">{t.d_since}
                          <input type="date" value={c.fedFrom ?? date} max={date} onChange={(e) => set(i.id, { fedFrom: e.target.value })}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground" />
                        </span>
                      )}
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name={`how-${i.id}`} checked={c.how === "lost"} onChange={() => set(i.id, { how: "lost" })} className="accent-primary" />
                      {t.d_lost}
                    </label>
                    <p className="text-[11px] text-muted-foreground">{c.how === "fed" ? t.d_fed_note : c.how === "used" ? t.d_used_note : t.d_lost_note}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t.cancel}</Button>
          <Button type="button" onClick={submit} disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t.d_go}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

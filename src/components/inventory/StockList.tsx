"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckSquare, ChevronDown, CircleStop, ClipboardCheck, History, ListChecks, Loader2, Minus, MoreHorizontal, Package,
  Pencil, PlayCircle, Receipt, RotateCcw, Search, Sprout, Square, Trash2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDay } from "@/lib/format";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { finishItems, type FinishChoice } from "@/app/dashboard/(app)/inventory/usage/actions";
import type { InventoryRow } from "./InventoryTable";
import { VIEW_TEXT, fillText, type ViewLang, type ViewText } from "./inventory-view-text";
import {
  hasQty, isEmptyQty, isFeedCategory, isNegativeQty, stockGroup, type LastMix, type StockGroup,
} from "@/lib/inventory/stock-view";

/** what the viewer may do (each button is shown only when allowed; the server checks again) */
export type StockPerms = { edit: boolean; create?: boolean; purchase: boolean; consume: boolean; mix?: boolean };

export type StockStatus = {
  role: "mix" | "ingredient" | "direct";
  inUse: boolean;
  daysLeft: number | null;
  /** not in use: the day it most likely started being fed (bought / mixed) */
  suggestedStart?: string | null;
};

/** one row's actions, handled by the page (the dialogs live there, outside the menu) */
export type StockAction = "own" | "use" | "count" | "start" | "finish" | "edit" | "delete" | "restore";

const num = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const taka = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`;
/** has stock to act on (or is being fed) */
const live = (i: InventoryRow, s?: StockStatus) => hasQty(i.stock) || isNegativeQty(i.stock) || !!s?.inUse;

const TABS: { key: StockGroup; label: "tab_feed" | "tab_ingredient" | "tab_other"; sub: "tab_feed_sub" | "tab_ingredient_sub" | "tab_other_sub" }[] = [
  { key: "feed", label: "tab_feed", sub: "tab_feed_sub" },
  { key: "ingredient", label: "tab_ingredient", sub: "tab_ingredient_sub" },
  { key: "other", label: "tab_other", sub: "tab_other_sub" },
];

/**
 * Every item in three tabs (feed · mix ingredients · medicine & other). Items with stock show
 * first; finished ones fold away. Each row has one "⋯" menu with every action the viewer may
 * take; "Select" turns on checkboxes to finish several items at once.
 */
export function StockList({ items, discontinued, status, lang, perms, asOf, lowIds = [], lastMix = {}, onAction }: {
  items: InventoryRow[];
  discontinued: InventoryRow[];
  status: Record<string, StockStatus>;
  lang: ViewLang;
  perms: StockPerms;
  asOf: string;
  /** running out (the same items as the summary card and the to-do card) */
  lowIds?: string[];
  /** ingredients: their latest mix */
  lastMix?: Record<string, LastMix>;
  onAction: (action: StockAction, item: InventoryRow) => void;
}) {
  const t = VIEW_TEXT[lang];
  const low = useMemo(() => new Set(lowIds), [lowIds]);
  const groupOf = (i: InventoryRow) => stockGroup(i.category, status[i.id]?.role);

  const counts: Record<StockGroup, { live: number; all: number }> = { feed: { live: 0, all: 0 }, ingredient: { live: 0, all: 0 }, other: { live: 0, all: 0 } };
  for (const i of items) { const g = groupOf(i); counts[g].all++; if (live(i, status[i.id])) counts[g].live++; }
  for (const i of discontinued) counts[groupOf(i)].all++;
  const tabs = TABS.filter((tb) => counts[tb.key].all > 0 || tb.key === "feed");
  const [tabState, setTab] = useState<StockGroup>(() => tabs.find((tb) => counts[tb.key].live > 0)?.key ?? tabs[0].key);
  const tab = tabs.some((tb) => tb.key === tabState) ? tabState : tabs[0].key;
  const [showDone, setShowDone] = useState(false);
  const [q, setQ] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [finishing, setFinishing] = useState(false);

  const query = q.trim().toLowerCase();
  const searching = query.length > 0;
  const inTab = items.filter((i) => (searching ? i.name.toLowerCase().includes(query) : groupOf(i) === tab));
  // live first: below zero, running out, in use, then the rest (the server already sorted by name)
  const rank = (i: InventoryRow) => (isNegativeQty(i.stock) ? 0 : low.has(i.id) ? 1 : status[i.id]?.inUse ? 2 : 3);
  const liveRows = inTab.filter((i) => live(i, status[i.id])).sort((a, b) => rank(a) - rank(b));
  const doneRows = inTab.filter((i) => !live(i, status[i.id]));
  const retiredRows = searching ? discontinued.filter((i) => i.name.toLowerCase().includes(query)) : discontinued.filter((i) => groupOf(i) === tab);
  const hiddenCount = doneRows.length + retiredRows.length;

  const selectable = (i: InventoryRow) => perms.edit && (hasQty(i.stock) || !!status[i.id]?.inUse);
  const selectableIds = liveRows.filter(selectable).map((i) => i.id);
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const pickedItems = items.filter((i) => picked.has(i.id));
  const allPicked = selectableIds.length > 0 && selectableIds.every((id) => picked.has(id));
  const stopSelecting = () => { setSelecting(false); setPicked(new Set()); };

  const tabMeta = TABS.find((tb) => tb.key === tab)!;
  const showSearch = items.length + discontinued.length > 8;
  const openDone = showDone || searching;

  const row = (i: InventoryRow, opts: { retired?: boolean } = {}) => (
    <Row key={i.id} i={i} s={status[i.id]} t={t} lang={lang} perms={perms} low={low.has(i.id)} lastMix={lastMix[i.id]} retired={!!opts.retired}
      selecting={selecting && !opts.retired} selectable={selectable(i)} picked={picked.has(i.id)} onToggle={() => toggle(i.id)}
      onAction={(a) => onAction(a, i)} />
  );

  return (
    <section id="stock" aria-labelledby="stock-title" className="scroll-mt-20 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="stock-title" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Package className="h-5 w-5 text-primary" aria-hidden />{t.stock_title}
        </h2>
        <div className="flex flex-1 items-center justify-end gap-2">
          {showSearch && (
            <label className="relative w-full max-w-[16rem]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} aria-label={t.search}
                className="h-10 w-full rounded-lg border border-input bg-background pl-8 pr-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
          )}
          {perms.edit && (
            <button type="button" onClick={() => (selecting ? stopSelecting() : setSelecting(true))} aria-pressed={selecting}
              className={cn("inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium",
                selecting ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <ListChecks className="h-4 w-4" aria-hidden />{selecting ? t.select_done : t.select}
            </button>
          )}
        </div>
      </div>

      {!searching && (
        <div className="grid gap-1 rounded-xl bg-muted/70 p-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }} role="tablist" aria-label={t.stock_title}>
          {tabs.map((tb) => (
            <button key={tb.key} type="button" role="tab" aria-selected={tab === tb.key} onClick={() => { setTab(tb.key); setShowDone(false); }}
              className={cn("flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-1.5 py-1 text-center text-sm font-medium leading-tight transition-colors sm:px-3",
                tab === tb.key ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}>
              {t[tb.label]}
              <span className={cn("rounded-full px-1.5 text-xs tabular-nums", tab === tb.key ? "bg-primary/10 text-primary" : "bg-background/60")}>{counts[tb.key].live}</span>
            </button>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        {!searching && <p className="border-b border-border/60 bg-muted/30 px-4 py-2 text-xs text-muted-foreground">{t[tabMeta.sub]}</p>}
        {/* column heads (computer) */}
        <div className="hidden border-b border-border/60 px-4 py-2 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[minmax(0,1fr)_8.5rem_7.5rem_2.5rem] md:gap-x-3">
          <span className={cn(selecting && "pl-8")}>{t.col_item}</span>
          <span className="text-right">{t.col_stock}</span>
          <span className="text-right">{t.col_value}</span>
          <span />
        </div>

        {selecting && selectableIds.length > 0 && (
          <button type="button" onClick={() => setPicked(allPicked ? new Set() : new Set(selectableIds))}
            className="flex min-h-10 w-full items-center gap-2 border-b border-border/60 px-4 text-sm font-medium text-muted-foreground hover:bg-muted/40">
            {allPicked ? <CheckSquare className="h-5 w-5 text-primary" aria-hidden /> : <Square className="h-5 w-5" aria-hidden />}{t.select_all}
          </button>
        )}

        {liveRows.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">{searching ? fillText(t.no_match, { q: q.trim() }) : t.none_in_tab}</p>
        )}
        <ul className="divide-y divide-border/60">{liveRows.map((i) => row(i))}</ul>

        {hiddenCount > 0 && !searching && (
          <button type="button" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}
            className="flex min-h-10 w-full items-center justify-center gap-1.5 border-t border-border/60 bg-muted/20 px-4 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground">
            {showDone ? t.hide_finished : fillText(t.show_finished, { n: hiddenCount })}
            <ChevronDown className={cn("h-4 w-4 transition-transform", showDone && "rotate-180")} aria-hidden />
          </button>
        )}
        {openDone && doneRows.length > 0 && <ul className="divide-y divide-border/60 border-t border-border/60 bg-muted/10">{doneRows.map((i) => row(i))}</ul>}
        {openDone && retiredRows.length > 0 && (
          <div className="border-t border-dashed border-border">
            <p className="px-4 pt-2.5 text-xs font-semibold text-muted-foreground">{fillText(t.retired, { n: retiredRows.length })}</p>
            <ul className="divide-y divide-border/60">{retiredRows.map((i) => row(i, { retired: true }))}</ul>
          </div>
        )}
      </div>

      {/* what to do with the selection */}
      {selecting && picked.size > 0 && (
        <div className="sticky bottom-20 z-30 md:bottom-4">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-floating backdrop-blur">
            <span className="text-sm font-semibold">{fillText(t.selected, { n: picked.size })}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPicked(new Set())} className="inline-flex h-10 items-center gap-1 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" aria-hidden />{t.clear}
              </button>
              <button type="button" onClick={() => setFinishing(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                <CircleStop className="h-4 w-4" aria-hidden />{t.finish}
              </button>
            </div>
          </div>
        </div>
      )}

      {finishing && (
        <FinishDialog items={pickedItems} status={status} lang={lang} asOf={asOf}
          onClose={() => setFinishing(false)} onDone={() => { setFinishing(false); stopSelecting(); }} />
      )}
    </section>
  );
}

function Row({ i, s, t, lang, perms, low, lastMix, retired, selecting, selectable, picked, onToggle, onAction }: {
  i: InventoryRow; s?: StockStatus; t: ViewText; lang: ViewLang; perms: StockPerms; low: boolean; lastMix?: LastMix; retired: boolean;
  selecting: boolean; selectable: boolean; picked: boolean; onToggle: () => void; onAction: (a: StockAction) => void;
}) {
  const feed = isFeedCategory(i.category);
  const empty = isEmptyQty(i.stock);
  const negative = isNegativeQty(i.stock);
  const inUse = !!s?.inUse;
  const ingredient = s?.role === "ingredient";
  const dim = (empty && !inUse) || retired;

  // one status chip: the most important thing about the item
  const chip =
    retired ? { text: t.chip_retired, cls: "bg-muted text-muted-foreground" }
    : negative ? { text: t.chip_negative, cls: "bg-red-500/10 text-red-700 dark:text-red-300" }
    : inUse ? { text: t.chip_in_use, cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" }
    : low ? { text: t.chip_low, cls: "bg-red-500/10 text-red-700 dark:text-red-300" }
    : ingredient && !empty ? { text: t.chip_waiting, cls: "bg-sky-500/10 text-sky-700 dark:text-sky-300" }
    : ingredient && lastMix ? { text: t.chip_mixed, cls: "bg-muted text-muted-foreground" }
    : feed && !empty ? { text: t.chip_not_started, cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" }
    : empty ? { text: t.chip_finished, cls: "bg-muted text-muted-foreground" }
    : null;

  // the second line: price, days left, or where an ingredient went
  const info: string[] = [];
  if (i.currentCost != null) info.push(`৳${num(i.currentCost)}${t.per}${i.unit}`);
  if (inUse && s?.daysLeft != null) info.push(fillText(t.days_left, { days: Math.floor(s.daysLeft) }));
  if (ingredient && empty && lastMix) {
    info.push(lastMix.mixName ? fillText(t.mixed_into, { mix: lastMix.mixName, date: fmtDay(lastMix.date, lang) }) : fillText(t.mixed_on, { date: fmtDay(lastMix.date, lang) }));
  }
  const value = i.currentCost != null && hasQty(i.stock) ? taka(i.stockValue ?? i.stock * i.currentCost) : null;

  return (
    <li className={cn("px-3 py-3 sm:px-4", picked && "bg-primary/5")}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_2.5rem] items-center gap-x-2 sm:gap-x-3 md:grid-cols-[minmax(0,1fr)_8.5rem_7.5rem_2.5rem]">
        {/* item */}
        <div className="flex min-w-0 items-start gap-3">
          {selecting && (
            selectable ? (
              <input type="checkbox" checked={picked} onChange={onToggle} aria-label={i.name}
                className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-primary" />
            ) : <span className="w-5 shrink-0" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <Link href={`/dashboard/inventory/products/${i.id}`}
                className={cn("truncate text-[0.95rem] font-semibold hover:text-primary hover:underline", dim ? "text-muted-foreground" : "text-foreground")}>{i.name}</Link>
              {s?.role === "mix" && <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-300">{t.chip_mix}</span>}
              {chip && <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", chip.cls)}>{chip.text}</span>}
            </p>
            {info.length > 0 && (
              <p className={cn("mt-0.5 text-xs", inUse && low ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground")}>{info.join(" · ")}</p>
            )}
            {/* phone: the value under the name */}
            {value && <p className="mt-0.5 text-xs text-muted-foreground md:hidden">{t.col_value}: {value}</p>}
          </div>
        </div>

        {/* stock */}
        <p className={cn("whitespace-nowrap text-right text-lg font-bold tabular-nums leading-tight",
          negative ? "text-red-600 dark:text-red-400" : dim ? "text-muted-foreground/70" : low ? "text-amber-700 dark:text-amber-400" : "text-foreground")}>
          {empty ? "0" : num(i.stock)} <span className="text-xs font-medium text-muted-foreground">{i.unit}</span>
        </p>

        {/* value (computer) */}
        <p className="hidden text-right text-sm tabular-nums text-muted-foreground md:block">{value ?? "—"}</p>

        {/* actions */}
        <RowMenu i={i} s={s} t={t} perms={perms} retired={retired} onAction={onAction} />
      </div>
    </li>
  );
}

type Entry = { key: string; label: string; icon: typeof Receipt; run?: () => void; href?: string; disabled?: boolean; danger?: boolean };

function RowMenu({ i, s, t, perms, retired, onAction }: {
  i: InventoryRow; s?: StockStatus; t: ViewText; perms: StockPerms; retired: boolean; onAction: (a: StockAction) => void;
}) {
  const router = useRouter();
  const feed = isFeedCategory(i.category);
  const inUse = !!s?.inUse;
  const stocked = hasQty(i.stock);
  const canDelete = isEmptyQty(i.stock) && !inUse;

  const main: Entry[] = [];
  if (!retired && perms.purchase) main.push({ key: "buy", label: t.m_buy, icon: Receipt, href: `/dashboard/inventory/purchase?item=${i.id}` });
  if (!retired && perms.purchase && feed) main.push({ key: "own", label: t.m_own, icon: Sprout, run: () => onAction("own") });
  if (!retired && perms.consume && stocked) main.push({ key: "use", label: t.m_use, icon: Minus, run: () => onAction("use") });
  if (!retired && perms.edit && feed && s?.role !== "ingredient" && !inUse && stocked) main.push({ key: "start", label: t.m_start, icon: PlayCircle, run: () => onAction("start") });
  if (!retired && perms.edit && (inUse || !isEmptyQty(i.stock))) main.push({ key: "count", label: t.m_count, icon: ClipboardCheck, run: () => onAction("count") });
  if (!retired && perms.edit && (stocked || inUse)) main.push({ key: "finish", label: t.m_finish, icon: CircleStop, run: () => onAction("finish") });

  const rest: Entry[] = [{ key: "history", label: t.m_history, icon: History, href: `/dashboard/inventory/products/${i.id}` }];
  if (perms.edit) rest.push({ key: "edit", label: t.m_edit, icon: Pencil, run: () => onAction("edit") });
  if (perms.edit && retired) rest.push({ key: "restore", label: t.m_restore, icon: RotateCcw, run: () => onAction("restore") });
  if (perms.edit && !retired) rest.push(canDelete
    ? { key: "delete", label: t.m_delete, icon: Trash2, run: () => onAction("delete"), danger: true }
    : { key: "delete", label: t.m_delete_blocked, icon: Trash2, disabled: true });

  const entry = (e: Entry) => (
    <DropdownMenuItem key={e.key} disabled={e.disabled} variant={e.danger ? "destructive" : "default"} className="min-h-10 gap-2.5"
      onClick={() => (e.href ? router.push(e.href) : e.run?.())}>
      <e.icon className="h-4 w-4" aria-hidden />{e.label}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={fillText(t.actions_for, { name: i.name })}
        className="flex h-10 w-10 items-center justify-center justify-self-end rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-muted">
        <MoreHorizontal className="h-5 w-5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {main.map(entry)}
        {main.length > 0 && <DropdownMenuSeparator />}
        {rest.map(entry)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const FT = {
  en: {
    d_title: "Mark as finished", d_date: "Finished on", d_sub: "What happened to each item?",
    d_inuse: "In use — its feeding ends here with 0 left.",
    d_fed: "Fed to the cattle", d_since: "since", d_lost: "Lost / spoiled", d_used: "Used up",
    d_used_note: "Counted as used (e.g. medicine cost) on the finish date.",
    d_fed_note: "What was left is spread over those days as feed eaten.",
    d_lost_note: "Written off as a loss, not feed eaten.",
    d_go: "Mark finished", cancel: "Cancel", ok: "{n} marked finished", some_failed: "{n} could not be finished",
  },
  bn: {
    d_title: "শেষ হয়ে গেছে", d_date: "কবে শেষ হলো", d_sub: "প্রতিটি জিনিসের কী হয়েছে?",
    d_inuse: "চালু আছে — খাওয়ানো এখানে শেষ, বাকি ০।",
    d_fed: "গরুকে খাওয়ানো হয়েছে", d_since: "কবে থেকে", d_lost: "নষ্ট / হারিয়েছে", d_used: "ব্যবহার হয়ে গেছে",
    d_used_note: "শেষের তারিখে ব্যবহার হিসেবে ধরা হবে (যেমন ওষুধের খরচ)।",
    d_fed_note: "যা ছিল তা ঐ দিনগুলোতে খাওয়ানো হিসেবে ধরা হবে।",
    d_lost_note: "ক্ষতি হিসেবে বাদ যাবে, খাওয়ানো নয়।",
    d_go: "শেষ করুন", cancel: "বাতিল", ok: "{n}টি শেষ করা হলো", some_failed: "{n}টি শেষ করা যায়নি",
  },
} as const;

/** The one way to finish items (one or several): fed since a date · used up · lost. */
export function FinishDialog({ items, status, lang, asOf, onClose, onDone }: {
  items: InventoryRow[]; status: Record<string, StockStatus>; lang: ViewLang; asOf: string; onClose: () => void; onDone: () => void;
}) {
  const t = FT[lang];
  const router = useRouter();
  const [date, setDate] = useState(asOf);
  const [pending, start] = useTransition();
  const [choice, setChoice] = useState<Record<string, FinishChoice>>(() => Object.fromEntries(items.map((i) => [i.id, {
    itemId: i.id, how: (isFeedCategory(i.category) ? "fed" : "used") as FinishChoice["how"], fedFrom: status[i.id]?.suggestedStart ?? asOf,
  }])));
  const set = (id: string, patch: Partial<FinishChoice>) => setChoice((c) => ({ ...c, [id]: { ...c[id], ...patch } }));
  const names = useMemo(() => new Map(items.map((i) => [i.id, i.name])), [items]);

  const submit = () => start(async () => {
    const res = await finishItems({ date, items: items.map((i) => choice[i.id]) });
    if (res.done > 0) toast.success(fillText(t.ok, { n: res.done }));
    if (res.failed.length) {
      toast.error(fillText(t.some_failed, { n: res.failed.length }), { description: res.failed.map((f) => `${names.get(f.itemId) ?? ""}: ${f.error}`).join("\n") });
    }
    router.refresh();
    if (!res.failed.length) onDone();
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{t.d_title}{items.length === 1 ? ` · ${items[0].name}` : ""}</DialogTitle></DialogHeader>
        <label className="grid gap-1 text-sm font-medium">{t.d_date}
          <input type="date" value={date} max={asOf} onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
        </label>
        <p className="text-sm text-muted-foreground">{t.d_sub}</p>
        <ul className="space-y-2">
          {items.map((i) => {
            const s = status[i.id];
            const c = choice[i.id];
            const feed = isFeedCategory(i.category);
            const useKey = feed ? "fed" : "used";
            return (
              <li key={i.id} className="rounded-xl border border-border p-3">
                <p className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-semibold">{i.name}</span>
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{num(i.stock)} {i.unit}</span>
                </p>
                {s?.inUse ? (
                  <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">{t.d_inuse}</p>
                ) : (
                  <div className="mt-2 space-y-2 text-sm">
                    <label className="flex min-h-9 flex-wrap items-center gap-2">
                      <input type="radio" name={`how-${i.id}`} checked={c.how === useKey} onChange={() => set(i.id, { how: useKey })} className="h-4 w-4 accent-primary" />
                      {feed ? t.d_fed : t.d_used}
                      {feed && c.how === "fed" && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">{t.d_since}
                          <input type="date" value={c.fedFrom ?? date} max={date} onChange={(e) => set(i.id, { fedFrom: e.target.value })}
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" />
                        </span>
                      )}
                    </label>
                    <label className="flex min-h-9 items-center gap-2">
                      <input type="radio" name={`how-${i.id}`} checked={c.how === "lost"} onChange={() => set(i.id, { how: "lost" })} className="h-4 w-4 accent-primary" />
                      {t.d_lost}
                    </label>
                    <p className="text-xs text-muted-foreground">{c.how === "fed" ? t.d_fed_note : c.how === "used" ? t.d_used_note : t.d_lost_note}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t.cancel}</Button>
          <Button type="button" onClick={submit} disabled={pending || !date}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t.d_go}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

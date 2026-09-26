"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle, Banknote, Check, CreditCard, History, Loader2, PackagePlus, Plus, Receipt, Search, Store, Trash2, Truck, Wallet, X, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { submitBulkPurchase } from "@/app/dashboard/(app)/inventory/purchase/actions";
import { findSameMemo, type PurchaseContext } from "@/lib/inventory/purchase-memo";
import { PURCHASE_TEXT, type PurchaseLang } from "@/components/inventory/purchase-text";

export type PurchaseItemOption = { id: string; name: string; category: string; unit: string; kgPerUnit: number | null };

type Row = {
  key: string;
  itemId: string;
  isNew: boolean;
  newName: string;
  newCategory: string;
  newUnit: string;
  newKgPerUnit: string;
  qty: string;
  useBags: boolean;
  bags: string;
  kgPerBag: string;
  priceMode: "total" | "unit";
  price: string;
  search: string;
  open: boolean;
};

const CATEGORIES = ["feed", "roughage", "medicine", "equipment", "other"] as const;
const UNITS = ["kg", "piece", "bundle", "L", "ml"] as const;
const BIG_CHANGE = 0.25;   // price differs from last time by more than 25 %

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const blankRow = (over: Partial<Row> = {}): Row => ({
  key: newKey(), itemId: "", isNew: false, newName: "", newCategory: "feed", newUnit: "kg", newKgPerUnit: "",
  qty: "", useBags: false, bags: "", kgPerBag: "", priceMode: "total", price: "", search: "", open: false, ...over,
});
const num = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? n : 0; };
const taka = (n: number) => `৳${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const norm = (s: string) => s.trim().toLowerCase();

export function BulkPurchaseClient({ items, context, today, lang }: {
  items: PurchaseItemOption[];
  context: PurchaseContext;
  today: string;
  lang: PurchaseLang;
}) {
  const t = PURCHASE_TEXT[lang];
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [memoKey, setMemoKey] = useState(newKey);
  const [date, setDate] = useState(today);
  const [supplier, setSupplier] = useState(context.suppliers[0]?.name ?? "");
  const [transport, setTransport] = useState("");
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState<"cash" | "partial" | "due">("cash");
  const [paid, setPaid] = useState("");
  const [rows, setRows] = useState<Row[]>([blankRow()]);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const unitOf = (r: Row) => (r.isNew ? r.newUnit : itemById.get(r.itemId)?.unit ?? "");
  const qtyOf = (r: Row) => (r.useBags ? num(r.bags) * num(r.kgPerBag) : num(r.qty));
  const totalOf = (r: Row) => (r.priceMode === "total" ? num(r.price) : num(r.price) * qtyOf(r));
  const filled = rows.filter((r) => r.itemId || r.isNew);

  const itemsTotal = rows.reduce((s, r) => s + totalOf(r), 0);
  const transportCost = num(transport);
  const bill = itemsTotal + transportCost;
  const paidNow = payment === "cash" ? bill : payment === "due" ? 0 : num(paid);
  const due = Math.max(0, bill - paidNow);

  const supplierInfo = context.suppliers.find((s) => norm(s.name) === norm(supplier)) ?? null;
  const lastMemo = supplier ? context.lastMemoBySupplier[norm(supplier)] : undefined;
  const sameMemo = findSameMemo(context.recentMemos, date, supplier);
  const quick = context.frequentItemIds.map((id) => itemById.get(id)).filter((i): i is PurchaseItemOption => !!i && !rows.some((r) => r.itemId === i.id));

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addItem = (id: string) => setRows((rs) => {
    const empty = rs.find((r) => !r.itemId && !r.isNew);
    const patch = { itemId: id, search: "", open: false };
    return empty ? rs.map((r) => (r.key === empty.key ? { ...r, ...patch } : r)) : [...rs, blankRow(patch)];
  });
  const fillFromLast = () => {
    if (!lastMemo) return;
    const known = lastMemo.lines.filter((l) => itemById.has(l.itemId));
    const kept = rows.filter((r) => r.itemId || r.isNew);
    const add = known.filter((l) => !kept.some((r) => r.itemId === l.itemId))
      .map((l) => blankRow({ itemId: l.itemId, qty: String(l.qty), priceMode: "unit", price: "" }));
    setRows([...kept, ...add].length ? [...kept, ...add] : [blankRow()]);
    toast.info(t.fill_last_note);
  };
  const reset = () => {
    setRows([blankRow()]); setTransport(""); setNotes(""); setPaid(""); setPayment("cash"); setMemoKey(newKey());
  };

  // price check against the last purchase, both with transport included (landed per unit)
  const landedPerUnit = (r: Row) => {
    const q = qtyOf(r); const tot = totalOf(r);
    if (q <= 0) return null;
    const share = itemsTotal > 0 ? transportCost * (tot / itemsTotal) : 0;
    return (tot + share) / q;
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!filled.length || rows.some((r) => !r.itemId && !r.isNew && (r.qty || r.price))) { toast.error(t.err_item); return; }
    if (filled.some((r) => r.isNew && !r.newName.trim())) { toast.error(t.err_new); return; }
    if (filled.some((r) => qtyOf(r) <= 0)) { toast.error(t.err_qty); return; }
    if (payment === "partial" && paidNow > bill) { toast.error(t.err_paid); return; }
    if (filled.some((r) => totalOf(r) <= 0) && !confirm(t.confirm_zero)) return;

    const fd = new FormData();
    fd.set("date", date);
    fd.set("supplierName", supplier.trim());
    fd.set("transportCost", String(transportCost));
    fd.set("paymentMethod", payment);
    fd.set("paidAmount", String(payment === "partial" ? paidNow : ""));
    fd.set("notes", notes);
    fd.set("memoKey", memoKey);
    const payload = filled.map((r) => ({
      isNew: r.isNew,
      itemId: r.itemId,
      newItemName: r.newName.trim(),
      newItemCategory: r.newCategory,
      newItemUnit: r.newUnit,
      newItemKgPerUnit: r.isNew && r.newUnit !== "kg" && num(r.newKgPerUnit) > 0 ? num(r.newKgPerUnit) : null,
      qty: Math.round(qtyOf(r) * 10000) / 10000,
      itemTotalCost: Math.round(totalOf(r) * 100) / 100,
      mode: r.useBags ? "bags" : "loose",
      bags: r.useBags ? r.bags : "",
      kgPerBag: r.useBags ? r.kgPerBag : "",
    }));
    startTransition(async () => {
      const res = await submitBulkPurchase(fd, payload);
      if (res.error) { toast.error(res.error); return; }
      toast.success("duplicate" in res && res.duplicate ? t.saved_before : t.saved, {
        action: { label: t.view_stock, onClick: () => router.push("/dashboard/inventory") },
      });
      reset();
      window.scrollTo({ top: 0, behavior: "smooth" });
      router.refresh();
    });
  }

  const payOptions = [
    { v: "cash" as const, label: t.cash, icon: Banknote },
    { v: "partial" as const, label: t.partial, icon: Wallet },
    { v: "due" as const, label: t.due, icon: CreditCard },
  ];

  const summary = (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between text-muted-foreground"><span>{t.items_total} ({filled.length})</span><span className="tabular-nums">{taka(itemsTotal)}</span></div>
      {transportCost > 0 && <div className="flex justify-between text-muted-foreground"><span>{t.transport_short}</span><span className="tabular-nums">+ {taka(transportCost)}</span></div>}
      <div className="flex justify-between border-t border-border/60 pt-2 text-base font-bold"><span>{t.total}</span><span className="tabular-nums">{taka(bill)}</span></div>
      {payment !== "cash" && (
        <>
          <div className="flex justify-between text-muted-foreground"><span>{t.paid}</span><span className="tabular-nums">{taka(paidNow)}</span></div>
          <div className="flex justify-between font-semibold text-amber-700 dark:text-amber-400"><span>{t.due_amount}</span><span className="tabular-nums">{taka(due)}</span></div>
        </>
      )}
    </div>
  );
  const saveButton = (cls = "") => (
    <Button type="submit" size="lg" className={cn("w-full", cls)} disabled={pending || !supplier.trim() || !filled.length}>
      {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t.saving}</> : <><Check className="mr-2 h-4 w-4" />{t.save}</>}
    </Button>
  );

  return (
    <form onSubmit={submit} className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
        {/* 1. memo: date + shop */}
        <section className="rounded-xl border border-border bg-card p-4 shadow-card sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Receipt className="h-4 w-4 text-primary" aria-hidden />{t.memo}</h2>
          <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
            <div className="space-y-1.5">
              <Label htmlFor="pm_date">{t.date}</Label>
              <Input id="pm_date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
              <p className="text-[11px] text-muted-foreground">{t.date_note}</p>
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="pm_shop">{t.shop}</Label>
              <div className="relative">
                <Store className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input id="pm_shop" list="pm_shops" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder={t.shop_ph} className="pl-9 font-medium" required autoComplete="off" />
                <datalist id="pm_shops">{context.suppliers.map((s) => <option key={s.name} value={s.name} />)}</datalist>
              </div>
              {context.suppliers.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {context.suppliers.slice(0, 4).map((s) => (
                    <button key={s.name} type="button" onClick={() => setSupplier(s.name)}
                      className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                        norm(s.name) === norm(supplier) ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
              {supplierInfo && (
                <p className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                  {supplierInfo.lastDate && <span>{fill(t.shop_last, { date: supplierInfo.lastDate })}</span>}
                  {supplierInfo.due > 0 && <span className="font-medium text-amber-700 dark:text-amber-400">{fill(t.shop_due, { amount: taka(supplierInfo.due) })}</span>}
                </p>
              )}
            </div>
          </div>
          {sameMemo && (
            <div className="mt-3 flex flex-wrap items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p className="min-w-0 flex-1">{fill(t.same_memo, { shop: sameMemo.supplier, date: sameMemo.date, count: sameMemo.itemCount, amount: taka(sameMemo.total) })}</p>
              <Link href={`/dashboard/inventory/purchase/history/${sameMemo.date}/${encodeURIComponent(sameMemo.supplier)}`} className="font-semibold underline underline-offset-2">{t.see_it}</Link>
            </div>
          )}
          {lastMemo && (
            <button type="button" onClick={fillFromLast}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10">
              <Zap className="h-3.5 w-3.5" aria-hidden />{fill(t.fill_last, { date: lastMemo.date, count: lastMemo.lines.length })}
            </button>
          )}
        </section>

        {/* 2. items */}
        <section className="rounded-xl border border-border bg-card shadow-card">
          <header className="border-b border-border px-4 py-3 sm:px-5">
            <h2 className="text-sm font-semibold">{t.items}</h2>
            {quick.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">{t.quick_add}:</span>
                {quick.map((i) => (
                  <button key={i.id} type="button" onClick={() => addItem(i.id)}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium hover:border-primary/40 hover:bg-primary/5">
                    <Plus className="h-3 w-3 text-primary" aria-hidden />{i.name}
                  </button>
                ))}
              </div>
            )}
          </header>
          <ol className="divide-y divide-border/70">
            {rows.map((r, idx) => (
              <ItemRow key={r.key} r={r} idx={idx} t={t} items={items} rows={rows} unit={unitOf(r)}
                qty={qtyOf(r)} total={totalOf(r)} landed={landedPerUnit(r)} transport={transportCost > 0}
                last={r.itemId ? context.lastBuy[r.itemId] : undefined}
                onChange={(p) => update(r.key, p)} onRemove={rows.length > 1 ? () => setRows((rs) => rs.filter((x) => x.key !== r.key)) : undefined} />
            ))}
          </ol>
          <div className="border-t border-border px-4 py-3 sm:px-5">
            <button type="button" onClick={() => setRows((rs) => [...rs, blankRow()])}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <PackagePlus className="h-4 w-4" aria-hidden />{t.add_item}
            </button>
          </div>
        </section>

        {/* 3. transport, note, payment */}
        <section className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-card sm:grid-cols-2 sm:p-5">
          <div className="space-y-1.5">
            <Label htmlFor="pm_tr">{t.transport}</Label>
            <div className="relative">
              <Truck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input id="pm_tr" type="number" inputMode="decimal" min="0" step="any" value={transport} onChange={(e) => setTransport(e.target.value)} placeholder="0" className="pl-9" />
            </div>
            <p className="text-[11px] text-muted-foreground">{t.transport_note}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pm_notes">{t.notes}</Label>
            <Input id="pm_notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.notes_ph} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{t.payment}</Label>
            <div role="radiogroup" aria-label={t.payment} className="grid grid-cols-3 gap-2">
              {payOptions.map(({ v, label, icon: Icon }) => (
                <button key={v} type="button" role="radio" aria-checked={payment === v} onClick={() => setPayment(v)}
                  className={cn("flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-2 text-xs font-semibold transition-colors sm:flex-row sm:gap-1.5",
                    payment === v
                      ? v === "cash" ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      : "border-border text-muted-foreground hover:bg-muted")}>
                  <Icon className="h-4 w-4" aria-hidden />{label}
                </button>
              ))}
            </div>
            {payment === "partial" && (
              <div className="space-y-1.5">
                <Label htmlFor="pm_paid">{t.paid_now}</Label>
                <Input id="pm_paid" type="number" inputMode="decimal" min="0" max={bill || undefined} step="any" value={paid} onChange={(e) => setPaid(e.target.value)} required className="text-lg font-semibold" />
              </div>
            )}
            {payment !== "cash" && due > 0 && (
              <p className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />{fill(t.due_note, { amount: taka(due), shop: supplier || "—" })}
              </p>
            )}
          </div>
        </section>

        {/* mobile: total + save stay in reach */}
        <div className="sticky bottom-[72px] z-20 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur md:bottom-4 lg:hidden">
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">{t.total}{payment !== "cash" && due > 0 ? ` · ${t.due_amount} ${taka(due)}` : ""}</span>
            <span className="text-lg font-bold tabular-nums">{taka(bill)}</span>
          </div>
          {saveButton()}
        </div>

        <RecentMemos context={context} t={t} />
      </div>

      {/* desktop: summary on the side */}
      <aside className="hidden lg:block">
        <div className="sticky top-20 space-y-3 rounded-xl border border-border bg-card p-5 shadow-card">
          <h2 className="text-sm font-semibold">{t.summary}</h2>
          {summary}
          {saveButton("mt-2")}
        </div>
      </aside>
    </form>
  );
}

// ── one item row ──────────────────────────────────────────────────────────────
function ItemRow({ r, idx, t, items, rows, unit, qty, total, landed, transport, last, onChange, onRemove }: {
  r: Row; idx: number; t: (typeof PURCHASE_TEXT)[PurchaseLang]; items: PurchaseItemOption[]; rows: Row[]; unit: string;
  qty: number; total: number; landed: number | null; transport: boolean;
  last?: { unitCost: number; date: string };
  onChange: (p: Partial<Row>) => void; onRemove?: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!r.open) return;
    const close = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) onChange({ open: false }); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [r.open, onChange]);

  const selected = items.find((i) => i.id === r.itemId);
  const taken = new Set(rows.filter((x) => x.key !== r.key).map((x) => x.itemId).filter(Boolean));
  const q = norm(r.search);
  const matches = items.filter((i) => !taken.has(i.id) && (!q || norm(i.name).includes(q)));
  const exact = q && items.some((i) => norm(i.name) === q);
  const kgItem = unit === "kg";
  const change = last && landed != null && total > 0 ? (landed - last.unitCost) / last.unitCost : null;

  return (
    <li className="space-y-3 px-4 py-4 sm:px-5">
      <div className="flex items-start gap-2">
        <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">{idx + 1}</span>
        {/* item */}
        <div className="min-w-0 flex-1" ref={boxRef}>
          {selected ? (
            <div className="flex h-10 items-center gap-2 rounded-lg border border-input bg-muted/40 px-3">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{selected.name}</span>
              <span className="text-xs text-muted-foreground">{selected.unit}</span>
              <button type="button" aria-label={t.item} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => onChange({ itemId: "", search: "", open: true })}><X className="h-3.5 w-3.5" /></button>
            </div>
          ) : r.isNew ? (
            <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase text-primary">{t.new_item}</span>
                <button type="button" aria-label={t.remove} className="ml-auto rounded p-1 text-muted-foreground hover:text-destructive"
                  onClick={() => onChange({ isNew: false, newName: "" })}><X className="h-3.5 w-3.5" /></button>
              </div>
              <Input value={r.newName} onChange={(e) => onChange({ newName: e.target.value })} required className="h-9 font-semibold" />
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-[11px] text-muted-foreground">{t.category}
                  <select value={r.newCategory} onChange={(e) => onChange({ newCategory: e.target.value })}
                    className="block h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{t.cats[c]}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-[11px] text-muted-foreground">{t.unit}
                  <select value={r.newUnit} onChange={(e) => onChange({ newUnit: e.target.value, useBags: e.target.value === "kg" ? r.useBags : false })}
                    className="block h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground">
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </label>
              </div>
              {r.newUnit !== "kg" && (
                <label className="block space-y-1 text-[11px] text-muted-foreground">{fill(t.kg_per_unit, { unit: r.newUnit })}
                  <Input type="number" inputMode="decimal" min="0" step="any" value={r.newKgPerUnit} onChange={(e) => onChange({ newKgPerUnit: e.target.value })} className="h-9" />
                </label>
              )}
            </div>
          ) : (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={r.search} placeholder={t.search} className="h-10 pl-9" aria-label={t.item}
                onFocus={() => onChange({ open: true })} onChange={(e) => onChange({ search: e.target.value, open: true })} />
              {r.open && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
                  {matches.map((i) => (
                    <button key={i.id} type="button" onClick={() => onChange({ itemId: i.id, search: "", open: false, useBags: false })}
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted">
                      <span className="truncate">{i.name}</span><span className="text-xs text-muted-foreground">{i.unit}</span>
                    </button>
                  ))}
                  {!matches.length && !q && <p className="px-3 py-2 text-xs text-muted-foreground">{t.no_items}</p>}
                  {q && !exact && (
                    <button type="button" onClick={() => onChange({ isNew: true, newName: r.search.trim(), open: false, search: "" })}
                      className="mt-1 flex w-full items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-left text-sm font-medium text-primary hover:bg-primary/15">
                      <Plus className="h-4 w-4" aria-hidden />{fill(t.create, { name: r.search.trim() })}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        {onRemove && (
          <button type="button" onClick={onRemove} aria-label={t.remove}
            className="mt-1 rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
        )}
      </div>

      {/* quantity + price */}
      <div className="grid gap-3 pl-8 sm:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">{t.qty}</Label>
            {kgItem && (
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <input type="checkbox" checked={r.useBags} onChange={(e) => onChange({ useBags: e.target.checked })} className="h-3.5 w-3.5 accent-primary" />{t.bags}
              </label>
            )}
          </div>
          {r.useBags && kgItem ? (
            <div className="flex items-center gap-1.5">
              <Input type="number" inputMode="decimal" min="0" step="any" value={r.bags} onChange={(e) => onChange({ bags: e.target.value })} placeholder={t.bags_n} aria-label={t.bags_n} className="h-10" />
              <span className="text-xs text-muted-foreground">×</span>
              <Input type="number" inputMode="decimal" min="0" step="any" value={r.kgPerBag} onChange={(e) => onChange({ kgPerBag: e.target.value })} placeholder={t.kg_per_bag} aria-label={t.kg_per_bag} className="h-10" />
              <span className="whitespace-nowrap text-xs font-medium tabular-nums">= {qty.toLocaleString("en-IN")} kg</span>
            </div>
          ) : (
            <div className="relative">
              <Input type="number" inputMode="decimal" min="0" step="any" value={r.qty} onChange={(e) => onChange({ qty: e.target.value })} placeholder="0" className="h-10 pr-14 text-base font-semibold" aria-label={t.qty} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{unit || "—"}</span>
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">{t.price}</Label>
            <div className="flex rounded-md bg-muted p-0.5 text-[11px] font-medium">
              {(["total", "unit"] as const).map((m) => (
                <button key={m} type="button" onClick={() => onChange({ priceMode: m, price: "" })}
                  className={cn("rounded px-2 py-0.5", r.priceMode === m ? "bg-background shadow-xs" : "text-muted-foreground")}>
                  {m === "total" ? t.price_total : fill(t.price_unit, { unit: unit || "…" })}
                </button>
              ))}
            </div>
          </div>
          <Input type="number" inputMode="decimal" min="0" step="any" value={r.price} onChange={(e) => onChange({ price: e.target.value })}
            placeholder="0" className="h-10 text-base font-semibold" aria-label={t.price} />
          {/* the last price is offered, never shown inside the box as if it were typed */}
          {last && r.price === "" && (r.priceMode === "unit" || qty > 0) && (
            <button type="button"
              onClick={() => onChange({ price: String(Math.round((r.priceMode === "unit" ? last.unitCost : last.unitCost * qty) * 100) / 100) })}
              className="inline-flex items-center rounded-full border border-dashed border-primary/40 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/5">
              {fill(t.use_last, { amount: r.priceMode === "unit" ? `${taka(last.unitCost)}/${unit}` : taka(last.unitCost * qty) })}
            </button>
          )}
        </div>
      </div>

      {/* what it comes to, compared with last time */}
      {(total > 0 || last || (r.price !== "" && total === 0)) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-8 text-[11px] text-muted-foreground">
          {total > 0 && <span className="font-semibold text-foreground">{fill(t.line_total, { amount: taka(total) })}</span>}
          {total > 0 && qty > 0 && <span>{fill(t.per_unit, { amount: taka(total / qty), unit })}</span>}
          {transport && landed != null && total > 0 && <span>{fill(t.landed, { amount: taka(landed), unit })}</span>}
          {last && <span>{fill(t.last, { amount: taka(last.unitCost), unit, date: last.date })}</span>}
          {change != null && Math.abs(change) >= 0.005 && (
            <span className={cn("rounded px-1.5 py-px font-semibold", change > 0 ? "bg-rose-500/10 text-rose-700 dark:text-rose-400" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400")}>
              {fill(change > 0 ? t.up : t.down, { pct: Math.abs(change * 100).toFixed(0) })}
            </span>
          )}
          {r.price !== "" && total === 0 && <span className="flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400"><AlertTriangle className="h-3 w-3" aria-hidden />{t.zero_price}</span>}
          {change != null && Math.abs(change) > BIG_CHANGE && <span className="flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400"><AlertTriangle className="h-3 w-3" aria-hidden />{t.big_change}</span>}
        </div>
      )}
    </li>
  );
}

function RecentMemos({ context, t }: { context: PurchaseContext; t: (typeof PURCHASE_TEXT)[PurchaseLang] }) {
  const recent = context.recentMemos.slice(0, 6);
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-card sm:p-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><History className="h-4 w-4 text-muted-foreground" aria-hidden />{t.recent}</h2>
        <Link href="/dashboard/inventory/purchase/history" className="text-xs font-medium text-primary hover:underline">{t.recent_all}</Link>
      </div>
      {recent.length === 0 ? <p className="py-3 text-sm text-muted-foreground">{t.empty_recent}</p> : (
        <ul className="divide-y divide-border/60">
          {recent.map((m) => (
            <li key={m.key}>
              <Link href={`/dashboard/inventory/purchase/history/${m.date}/${encodeURIComponent(m.supplier)}`}
                className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/50">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{m.supplier}</span>
                  <span className="block text-[11px] text-muted-foreground">{m.date} · {fill(t.items_n, { count: m.itemCount })} · {fill(t.entered, { date: m.enteredOn })}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{taka(m.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

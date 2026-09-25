"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Blend, Check, ChevronDown, History, Loader2, Plus, Receipt, Scale, Trash2, Undo2, Warehouse, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { recordFeedMix, undoFeedMix } from "@/app/dashboard/(app)/inventory/mix/actions";
import { kgOf, type MixEntry } from "@/lib/inventory/mix-history";
import { MIX_TEXT, type MixLang } from "@/components/inventory/mix-text";

export type MixItem = {
  id: string; name: string; unit: string; kgPerUnit: number | null; category: string;
  role: "mix" | "ingredient" | "direct"; discontinued: boolean; stockQty: number; wac: number | null; daysLeft: number | null; inUse: boolean;
};
export type MixPageData = {
  asOf: string;
  canEdit: boolean;
  items: MixItem[];
  history: MixEntry[];
  memos: { key: string; date: string; supplier: string; lines: { itemId: string; qty: number }[] }[];
  oldRecipes: { id: string; name: string; from: string; until: string | null; deleted: boolean; lines: { name: string; qty: number; pct: number }[] }[];
};

type Row = { key: string; itemId: string; qty: string };
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const num = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? n : 0; };
const fmt = (n: number, d = 2) => n.toLocaleString("en-IN", { maximumFractionDigits: d });
const taka = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`;
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
// one steady colour per ingredient position (composition bar and chips)
const COLORS = ["bg-amber-500", "bg-emerald-500", "bg-sky-500", "bg-rose-500", "bg-violet-500", "bg-lime-500", "bg-orange-500", "bg-teal-500", "bg-fuchsia-500"];

export function MixClient({ data, lang }: { data: MixPageData; lang: MixLang }) {
  const t = MIX_TEXT[lang];
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const itemById = useMemo(() => new Map(data.items.map((i) => [i.id, i])), [data.items]);
  const mixItems = data.items.filter((i) => i.role === "mix" && !i.discontinued && i.unit.trim().toLowerCase() === "kg");
  const lastMix = data.history.find((h) => !h.undone) ?? null;
  const [outputId, setOutputId] = useState<string>(mixItems.find((m) => m.id === lastMix?.outputItemId)?.id ?? mixItems[0]?.id ?? "");
  const [date, setDate] = useState(data.asOf);
  const [note, setNote] = useState("");
  const [batchId, setBatchId] = useState(newKey);
  const [rows, setRows] = useState<Row[]>([{ key: newKey(), itemId: "", qty: "" }]);

  // ingredients first, then any other feed that can be weighed in kg (never a mix item)
  const choices = data.items
    .filter((i) => i.role !== "mix" && !i.discontinued && (i.unit.trim().toLowerCase() === "kg" || (i.kgPerUnit ?? 0) > 0))
    .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "ingredient" ? -1 : 1));
  const waiting = data.items.filter((i) => i.role === "ingredient" && i.stockQty > 0.0001);

  const lines = rows.filter((r) => r.itemId && num(r.qty) > 0).map((r) => {
    const it = itemById.get(r.itemId);
    const qty = num(r.qty);
    return { ...r, it, qtyN: qty, kg: kgOf(qty, it), cost: it?.wac != null ? qty * it.wac : null };
  });
  const totalKg = lines.reduce((s, l) => s + l.kg, 0);
  const costKnown = lines.every((l) => l.cost != null);
  const totalCost = lines.reduce((s, l) => s + (l.cost ?? 0), 0);
  const over = lines.filter((l) => l.it && l.qtyN > l.it.stockQty + 0.0001);
  const colorOf = (itemId: string) => COLORS[Math.max(0, choices.findIndex((c) => c.id === itemId)) % COLORS.length];

  const setFrom = (list: { itemId: string; qty: number }[]) => {
    const next = list.filter((l) => itemById.has(l.itemId) && itemById.get(l.itemId)!.role !== "mix")
      .map((l) => ({ key: newKey(), itemId: l.itemId, qty: String(Math.round(l.qty * 100) / 100) }));
    setRows(next.length ? next : [{ key: newKey(), itemId: "", qty: "" }]);
  };
  const reset = () => { setRows([{ key: newKey(), itemId: "", qty: "" }]); setNote(""); setBatchId(newKey()); };

  function save() {
    if (!lines.length) { toast.error(t.err_lines); return; }
    if (over.length) { toast.error(t.err_over); return; }
    startTransition(async () => {
      const res = await recordFeedMix({ batchId, date, outputItemId: outputId || null, lines: lines.map((l) => ({ itemId: l.itemId, qty: l.qtyN })), note });
      if (res.error) { toast.error(res.error); return; }
      toast.success(res.duplicate ? t.saved_before : fill(t.saved, { qty: fmt(res.outputQty ?? totalKg) }));
      reset();
      router.refresh();
    });
  }
  function undo(id: string) {
    const reason = prompt(t.undo_prompt);
    if (!reason?.trim()) return;
    startTransition(async () => {
      const res = await undoFeedMix(id, reason);
      if (res.error) toast.error(res.error); else { toast.success(t.undone_ok); router.refresh(); }
    });
  }

  const mixStock = mixItems.map((m) => m).filter((m) => m.stockQty > 0 || m.id === outputId);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
        {/* new mix */}
        {data.canEdit && (
          <section className="rounded-xl border border-border bg-card shadow-card">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
              <h2 className="flex items-center gap-2 text-base font-bold"><Blend className="h-4 w-4 text-primary" aria-hidden />{t.new_mix}</h2>
            </header>
            <div className="space-y-4 p-4 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                <div className="space-y-1.5">
                  <Label htmlFor="mx_date">{t.date}</Label>
                  <Input id="mx_date" type="date" value={date} max={data.asOf} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="mx_out">{t.mix_item}</Label>
                  {mixItems.length > 0 ? (
                    <select id="mx_out" value={outputId} onChange={(e) => setOutputId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                      {mixItems.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  ) : (
                    <p className="flex h-9 items-center rounded-md border border-dashed border-border px-3 text-sm text-muted-foreground">{fill(t.no_mix_item, { name: "দানাদার মিক্স" })}</p>
                  )}
                </div>
              </div>

              {/* one-tap fill */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t.fill}</p>
                <div className="flex flex-wrap gap-2">
                  {lastMix && (
                    <FillButton icon={History} label={fill(t.fill_last, { date: lastMix.date })}
                      onClick={() => setFrom(lastMix.lines.map((l) => ({ itemId: l.itemId, qty: l.qty })))} />
                  )}
                  {data.memos.map((m) => (
                    <FillButton key={m.key} icon={Receipt} label={fill(t.fill_memo, { date: m.date, shop: m.supplier })}
                      onClick={() => setFrom(m.lines.filter((l) => itemById.get(l.itemId)?.role !== "direct"))} />
                  ))}
                  {waiting.length > 0 && (
                    <FillButton icon={Warehouse} label={t.fill_stock} onClick={() => setFrom(waiting.map((w) => ({ itemId: w.id, qty: w.stockQty })))} />
                  )}
                </div>
              </div>

              {/* ingredients */}
              <ol className="space-y-2">
                {rows.map((r) => {
                  const it = itemById.get(r.itemId);
                  const q = num(r.qty);
                  const kg = kgOf(q, it);
                  const isOver = it && q > it.stockQty + 0.0001;
                  const pct = totalKg > 0 && q > 0 ? (kg / totalKg) * 100 : 0;
                  const ch = lastMix && it ? pct - (lastMix.lines.find((l) => l.itemId === it.id)?.pct ?? 0) : null;
                  return (
                    <li key={r.key} className="rounded-lg border border-border/70 bg-background/40 p-2.5">
                      <div className="grid grid-cols-[minmax(0,1fr)_110px_auto] items-center gap-2">
                        <select aria-label={t.ingredient} value={r.itemId}
                          onChange={(e) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, itemId: e.target.value } : x)))}
                          className="h-10 min-w-0 rounded-md border border-input bg-background px-2 text-sm font-medium">
                          <option value="">{t.choose}</option>
                          {choices.filter((c) => c.id === r.itemId || !rows.some((x) => x.itemId === c.id)).map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <div className="relative">
                          <Input aria-label={t.qty} type="number" inputMode="decimal" min="0" step="any" value={r.qty} placeholder="0"
                            onChange={(e) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, qty: e.target.value } : x)))}
                            className={cn("h-10 pr-10 text-right text-base font-semibold tabular-nums", isOver && "border-red-500")} />
                          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{it?.unit ?? "kg"}</span>
                        </div>
                        <button type="button" aria-label="remove" disabled={rows.length === 1}
                          onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                          className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
                      </div>
                      {it && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 px-0.5 text-[11px] text-muted-foreground">
                          <span className={cn(isOver && "font-semibold text-red-600 dark:text-red-400")}>
                            {isOver ? fill(t.over, { qty: `${fmt(it.stockQty)} ${it.unit}` }) : fill(t.in_stock, { qty: `${fmt(it.stockQty)} ${it.unit}` })}
                          </span>
                          {it.unit.trim().toLowerCase() !== "kg" && q > 0 && <span>{fill(t.pcs_kg, { kg: fmt(kg) })}</span>}
                          {pct > 0 && (
                            <span className="inline-flex items-center gap-1 font-medium text-foreground">
                              <span className={cn("h-2 w-2 rounded-full", colorOf(it.id))} aria-hidden />{fill(t.share, { pct: fmt(pct, 1) })}
                            </span>
                          )}
                          {ch != null && pct > 0 && Math.abs(ch) >= 0.5 && (
                            <span className={ch > 0 ? "text-amber-700 dark:text-amber-400" : "text-sky-700 dark:text-sky-400"}>{ch > 0 ? "▲" : "▼"} {fmt(Math.abs(ch), 1)}%</span>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
              <button type="button" onClick={() => setRows((rs) => [...rs, { key: newKey(), itemId: "", qty: "" }])}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                <Plus className="h-4 w-4" aria-hidden />{t.add}
              </button>

              {/* result */}
              {totalKg > 0 && (
                <div className="space-y-2 rounded-lg bg-muted/40 p-3">
                  <div className="flex h-3 overflow-hidden rounded-full" aria-hidden>
                    {lines.map((l) => <div key={l.key} className={colorOf(l.itemId)} style={{ width: `${(l.kg / totalKg) * 100}%` }} />)}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Stat label={t.total} value={`${fmt(totalKg)} kg`} />
                    <Stat label={t.cost} value={costKnown ? taka(totalCost) : "—"} />
                    <Stat label={t.per_kg} value={costKnown ? `৳${fmt(totalCost / totalKg)}` : "—"} />
                  </div>
                  {!costKnown && <p className="text-center text-[11px] text-muted-foreground">{t.unknown_cost}</p>}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="mx_note">{t.note}</Label>
                <Input id="mx_note" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <Button type="button" size="lg" className="w-full" onClick={save} disabled={pending || !lines.length}>
                {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t.saving}</> : <><Check className="mr-2 h-4 w-4" />{t.save}</>}
              </Button>
            </div>
          </section>
        )}

        {/* history = recipe by date */}
        <section className="rounded-xl border border-border bg-card shadow-card">
          <header className="border-b border-border px-4 py-3 sm:px-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><History className="h-4 w-4 text-muted-foreground" aria-hidden />{t.history}</h2>
            <p className="text-[11px] text-muted-foreground">{t.history_sub}</p>
          </header>
          {data.history.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted-foreground sm:px-5">{t.empty_history}</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {data.history.map((h) => (
                <li key={h.id} className={cn("space-y-2 px-4 py-3 sm:px-5", h.undone && "opacity-60")}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-bold">
                      {h.date} <span className="ml-1 font-semibold text-muted-foreground">· {fill(t.kg_mix, { qty: fmt(h.outputQty) })}</span>
                      {h.perKg != null && <span className="ml-1 text-xs font-medium text-muted-foreground">· {fill(t.per_kg_short, { v: fmt(h.perKg) })}</span>}
                    </p>
                    <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {fill(t.entered, { date: h.enteredOn })}
                      {h.undone ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">{t.undone}</span>
                      ) : data.canEdit && (
                        <button type="button" onClick={() => undo(h.id)} disabled={pending}
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-destructive/10 hover:text-destructive">
                          <Undo2 className="h-3 w-3" aria-hidden />{t.undo}
                        </button>
                      )}
                    </span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full" aria-hidden>
                    {h.lines.map((l) => <div key={l.itemId} className={colorOf(l.itemId)} style={{ width: `${l.pct}%` }} />)}
                  </div>
                  <ul className="flex flex-wrap gap-1.5">
                    {h.lines.map((l) => {
                      const ch = h.change[l.itemId];
                      return (
                        <li key={l.itemId} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px]">
                          <span className={cn("h-2 w-2 rounded-full", colorOf(l.itemId))} aria-hidden />
                          <span className="font-medium">{l.name}</span>
                          <span className="tabular-nums text-muted-foreground">{fmt(l.qty)} {l.unit} · {fmt(l.pct, 1)}%</span>
                          {ch != null && <span className={ch > 0 ? "text-amber-700 dark:text-amber-400" : "text-sky-700 dark:text-sky-400"}>{ch > 0 ? "▲" : "▼"}{fmt(Math.abs(ch), 1)}</span>}
                        </li>
                      );
                    })}
                  </ul>
                  {(h.note || h.undoReason) && <p className="text-[11px] text-muted-foreground">{h.undoReason ?? h.note}</p>}
                </li>
              ))}
            </ul>
          )}
          {data.oldRecipes.length > 0 && (
            <details className="group border-t border-border px-4 py-3 sm:px-5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-muted-foreground">
                {t.old_recipes} ({data.oldRecipes.length})<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <ul className="mt-2 space-y-2">
                {data.oldRecipes.map((r) => (
                  <li key={r.id} className="rounded-lg bg-muted/30 p-2.5 text-[11px]">
                    <p className="font-semibold text-foreground">{r.name} <span className="font-normal text-muted-foreground">· {fill(t.old_active, { from: r.from, until: r.until ?? "…" })}{r.deleted ? ` · ${t.old_deleted}` : ""}</span></p>
                    <p className="text-muted-foreground">{r.lines.map((l) => `${l.name} ${fmt(l.qty)} (${fmt(l.pct, 1)}%)`).join(" · ")}</p>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>

      {/* side: mix in stock, waiting ingredients */}
      <aside className="space-y-4">
        <section className="rounded-xl border border-border bg-card p-4 shadow-card">
          <h2 className="mb-2 text-sm font-semibold">{t.stock_title}</h2>
          {mixStock.length === 0 ? <p className="text-xs text-muted-foreground">{fill(t.no_mix_item, { name: "দানাদার মিক্স" })}</p> : (
            <ul className="space-y-2">
              {mixStock.map((m) => (
                <li key={m.id}>
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{m.name}</span>
                    <span className="text-lg font-bold tabular-nums">{fmt(m.stockQty)} kg</span>
                  </p>
                  <p className={cn("text-[11px]", m.inUse ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
                    {m.inUse ? fill(t.in_use, { days: m.daysLeft != null ? Math.floor(m.daysLeft) : "—" }) : t.not_in_use}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Link href="/dashboard/inventory/feeding-chart" className="inline-flex items-center gap-1 font-medium text-primary hover:underline"><Scale className="h-3.5 w-3.5" aria-hidden />{t.chart}</Link>
            <Link href="/dashboard/inventory/usage" className="font-medium text-primary hover:underline">{t.usage}</Link>
          </div>
        </section>
        <section className="rounded-xl border border-border bg-card p-4 shadow-card">
          <h2 className="mb-2 text-sm font-semibold">{t.waiting}</h2>
          {waiting.length === 0 ? <p className="text-xs text-muted-foreground">{t.waiting_none}</p> : (
            <ul className="divide-y divide-border/60">
              {waiting.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                  <span className="flex min-w-0 items-center gap-1.5"><span className={cn("h-2 w-2 shrink-0 rounded-full", colorOf(w.id))} aria-hidden /><span className="truncate">{w.name}</span></span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{fmt(w.stockQty)} {w.unit}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}

function FillButton({ icon: Icon, label, onClick }: { icon: typeof Zap; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10">
      <Icon className="h-3.5 w-3.5" aria-hidden />{label}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-base font-bold tabular-nums">{value}</p>
    </div>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Minus, Plus, CheckCircle2, AlertTriangle, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { todayDhaka } from "@/lib/dates";
import { splitTotal, type SplitMethod } from "@/lib/cattle/cost-split";
import { createPurchaseGroup } from "@/app/dashboard/(app)/cattle/group-actions";
import { GROUP_TEXT, fillG, takaG, nextTags, type GroupLang } from "./group-text";

type Row = { tag: string; gender: "male" | "female"; weight: string; weightType: "measured" | "estimated"; price: string };

const field = "h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const num = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? n : null; };

/** The shared "how is the price split" picker with its explanation and sum check. */
export function SplitPicker({ lang, method, setMethod, canWeight, sale, estimated }: {
  lang: GroupLang; method: SplitMethod; setMethod: (m: SplitMethod) => void; canWeight: boolean; sale?: boolean; estimated?: boolean;
}) {
  const g = GROUP_TEXT[lang];
  const hint = method === "weight" ? (canWeight ? (sale ? g.h_weight_sell : g.h_weight) : g.h_weight_missing)
    : method === "equal" ? (sale ? g.h_equal_sell : g.h_equal_buy) : g.h_manual;
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{g.how}</legend>
      <div role="radiogroup" className="grid grid-cols-3 gap-1.5 rounded-xl bg-muted/60 p-1">
        {(["weight", "equal", "manual"] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)}
            className={cn("min-h-10 rounded-lg px-1.5 text-xs font-semibold leading-tight sm:text-sm",
              method === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {m === "weight" ? g.m_weight : m === "equal" ? g.m_equal : g.m_manual}
          </button>
        ))}
      </div>
      <p className={cn("text-xs", method === "weight" && !canWeight ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>{hint}</p>
      {method === "weight" && canWeight && estimated && <p className="text-xs text-amber-700 dark:text-amber-400">{g.h_estimated}</p>}
    </fieldset>
  );
}

/** Shows whether the shares add up to the total. */
export function SumCheck({ lang, total, sum }: { lang: GroupLang; total: number; sum: number }) {
  const g = GROUP_TEXT[lang];
  if (!(total > 0)) return null;
  const diff = Math.round((total - sum) * 100) / 100;
  const ok = Math.abs(diff) < 0.005 && total > 0;
  return (
    <p className={cn("flex items-center gap-1.5 text-sm font-medium", ok ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")} role="status">
      {ok ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> : <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />}
      <span className="min-w-0">{ok ? g.sum_ok : diff > 0 ? fillG(g.sum_left, { n: Math.abs(diff).toLocaleString("en-IN") }) : fillG(g.sum_over, { n: Math.abs(diff).toLocaleString("en-IN") })}</span>
    </p>
  );
}

/**
 * Several animals bought in one deal at one price. Each gets its share of the price
 * (lib/cattle/cost-split.ts), shown live; the server recomputes and saves it all at once.
 */
export function GroupPurchaseDialog({ open, onOpenChange, existingTagIds, breeds, lang }: {
  open: boolean; onOpenChange: (o: boolean) => void; existingTagIds: string[]; breeds: string[]; lang: GroupLang;
}) {
  const g = GROUP_TEXT[lang];
  const router = useRouter();
  const today = todayDhaka();
  const blank = (tag: string): Row => ({ tag, gender: "male", weight: "", weightType: "measured", price: "" });
  const [date, setDate] = useState(today);
  const [total, setTotal] = useState("");
  const [seller, setSeller] = useState("");
  const [breed, setBreed] = useState("");
  const [rows, setRows] = useState<Row[]>(() => nextTags(existingTagIds, 2).map(blank));
  const [method, setMethod] = useState<SplitMethod>("equal");
  const [touchedMethod, setTouchedMethod] = useState(false);
  const [transport, setTransport] = useState("");
  const [haat, setHaat] = useState("");
  const [pending, start] = useTransition();

  const totalN = num(total) ?? 0;
  const allWeights = rows.every((r) => (num(r.weight) ?? 0) > 0);
  // the split follows the evidence until the owner picks one: all weights → by weight
  const eff: SplitMethod = touchedMethod ? method : allWeights ? "weight" : "equal";
  const estimated = rows.some((r) => r.weightType === "estimated" && (num(r.weight) ?? 0) > 0);

  const split = useMemo(() => splitTotal(totalN, rows.map((r, i) => ({ id: String(i), weightKg: num(r.weight), amount: num(r.price) })), eff), [totalN, rows, eff]);
  const shareOf = (i: number) => (split.ok && totalN > 0 ? split.amounts[String(i)] : null);
  const sum = eff === "manual" ? rows.reduce((s, r) => s + (num(r.price) ?? 0), 0) : split.ok ? totalN : 0;

  const setCount = (n: number) => setRows((prev) => {
    const k = Math.max(1, Math.min(50, n));
    if (k <= prev.length) return prev.slice(0, k);
    const extra = nextTags([...existingTagIds, ...prev.map((r) => r.tag)], k - prev.length);
    return [...prev, ...extra.map(blank)];
  });
  const upd = (i: number, patch: Partial<Row>) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const reset = () => {
    setDate(today); setTotal(""); setSeller(""); setBreed(""); setTransport(""); setHaat("");
    setRows(nextTags(existingTagIds, 2).map(blank)); setMethod("equal"); setTouchedMethod(false);
  };

  const submit = () => {
    if (!(totalN > 0)) { toast.error(g.need_total); return; }
    if (rows.some((r) => !r.tag.trim())) { toast.error(g.need_tags); return; }
    const seen = new Set<string>();
    for (const r of rows) {
      const k = r.tag.trim().toLowerCase();
      if (seen.has(k)) { toast.error(fillG(g.tag_dup, { tag: r.tag })); return; }
      seen.add(k);
      if (existingTagIds.some((t) => t.toLowerCase() === k)) { toast.error(fillG(g.tag_taken, { tag: r.tag })); return; }
    }
    start(async () => {
      const res = await createPurchaseGroup({
        date, total: totalN, seller, method: eff,
        extraCosts: { transport: num(transport) ?? 0, haat: num(haat) ?? 0 },
        animals: rows.map((r) => ({
          tagId: r.tag, gender: r.gender, breed: breed || undefined,
          weightKg: num(r.weight), weightType: r.weightType, price: eff === "manual" ? num(r.price) : null,
        })),
      }).catch(() => ({ ok: false as const, error: g.failed }));
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(fillG(g.ok_buy, { n: rows.length, total: totalN.toLocaleString("en-IN") }));
      if (res.warning) toast.warning(res.warning);
      reset();
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!pending) onOpenChange(o); }}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-4 py-4 sm:px-6">
          <DialogTitle className="pr-8">{g.p_title}</DialogTitle>
          <DialogDescription>{g.p_sub}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
          {/* the deal */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="grid min-w-0 gap-1 text-sm font-medium">{g.date} *
              <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={field} />
            </label>
            <label className="grid min-w-0 gap-1 text-sm font-medium">{g.total} *
              <input inputMode="decimal" type="number" min={0} value={total} onChange={(e) => setTotal(e.target.value)} placeholder="171000" className={cn(field, "tabular-nums")} />
            </label>
            <label className="grid min-w-0 gap-1 text-sm font-medium">{g.seller}
              <input value={seller} onChange={(e) => setSeller(e.target.value)} maxLength={120} className={field} />
            </label>
          </div>

          {/* how many + breed */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1 text-sm font-medium">
              <span>{g.count}</span>
              <div className="flex h-10 items-center rounded-lg border border-input">
                <button type="button" aria-label="−" onClick={() => setCount(rows.length - 1)} className="flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground"><Minus className="h-4 w-4" /></button>
                <span className="w-8 text-center tabular-nums">{rows.length}</span>
                <button type="button" aria-label="+" onClick={() => setCount(rows.length + 1)} className="flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground"><Plus className="h-4 w-4" /></button>
              </div>
            </div>
            <label className="grid min-w-0 flex-1 basis-40 gap-1 text-sm font-medium">{g.breed_all}
              <input list="group-breeds" value={breed} onChange={(e) => setBreed(e.target.value)} maxLength={60} className={field} />
              <datalist id="group-breeds">{breeds.map((b) => <option key={b} value={b} />)}</datalist>
            </label>
          </div>

          <SplitPicker lang={lang} method={eff} setMethod={(m) => { setMethod(m); setTouchedMethod(true); }} canWeight={allWeights} estimated={estimated} />

          {/* the animals: a card each on a phone, a row each on a computer */}
          <ol className="space-y-2">
            {rows.map((r, i) => (
              <li key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,1fr)] sm:items-end">
                <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">{g.tag}
                  <input value={r.tag} onChange={(e) => upd(i, { tag: e.target.value.toUpperCase() })} maxLength={30} className={cn(field, "font-semibold text-foreground")} />
                </label>
                <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">{g.gender}
                  <select value={r.gender} onChange={(e) => upd(i, { gender: e.target.value as Row["gender"] })} className={cn(field, "text-foreground")}>
                    <option value="male">{g.male}</option><option value="female">{g.female}</option>
                  </select>
                </label>
                <div className="col-span-2 grid min-w-0 gap-1 text-xs font-medium text-muted-foreground sm:col-span-1">
                  <span>{g.weight} <span className="font-normal">· {g.weight_opt}</span></span>
                  <div className="flex min-w-0 gap-1.5">
                    <input inputMode="decimal" type="number" min={0} value={r.weight} onChange={(e) => upd(i, { weight: e.target.value })}
                      aria-label={`${g.weight} ${r.tag}`} className={cn(field, "text-foreground tabular-nums")} />
                    <select value={r.weightType} onChange={(e) => upd(i, { weightType: e.target.value as Row["weightType"] })} aria-label={`${g.measured} / ${g.estimated}`}
                      className="h-10 w-24 shrink-0 rounded-lg border border-input bg-background px-1.5 text-xs text-foreground">
                      <option value="measured">{g.measured}</option><option value="estimated">{g.estimated}</option>
                    </select>
                  </div>
                </div>
                <div className="col-span-2 grid min-w-0 gap-1 text-xs font-medium text-muted-foreground sm:col-span-1">
                  <span>{eff === "manual" ? g.price : g.share}</span>
                  {eff === "manual"
                    ? <input inputMode="decimal" type="number" min={0} value={r.price} onChange={(e) => upd(i, { price: e.target.value })} aria-label={`${g.price} ${r.tag}`} className={cn(field, "text-foreground tabular-nums")} />
                    : <span className="flex h-10 items-center rounded-lg bg-muted/60 px-3 text-sm font-semibold tabular-nums text-foreground">{takaG(shareOf(i))}</span>}
                </div>
              </li>
            ))}
          </ol>

          <SumCheck lang={lang} total={totalN} sum={sum} />

          <details className="group rounded-xl border border-border">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-medium">
              <span className="min-w-0">{g.extra}</span><ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="grid grid-cols-1 gap-3 border-t px-3 py-3 sm:grid-cols-2">
              <label className="grid min-w-0 gap-1 text-sm font-medium">{g.transport}
                <input inputMode="decimal" type="number" min={0} value={transport} onChange={(e) => setTransport(e.target.value)} className={field} />
              </label>
              <label className="grid min-w-0 gap-1 text-sm font-medium">{g.haat}
                <input inputMode="decimal" type="number" min={0} value={haat} onChange={(e) => setHaat(e.target.value)} className={field} />
              </label>
            </div>
          </details>
        </div>

        <DialogFooter className="gap-2 border-t px-4 py-3 sm:px-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>{g.cancel}</Button>
          <Button type="button" onClick={submit} disabled={pending || !split.ok || !(totalN > 0)}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{fillG(g.save_buy, { n: rows.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

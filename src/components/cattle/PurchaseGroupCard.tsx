"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Layers, Loader2, AlertTriangle, Sparkles, Undo2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmtDay as fmtDate } from "@/lib/format";
import { splitOnBasis, splitTotal, type Basis } from "@/lib/cattle/cost-split";
import { resplitPurchaseGroup, revertSaleGroup, type ResplitChoice } from "@/app/dashboard/(app)/cattle/group-actions";
import type { PurchaseGroupView, SaleGroupView } from "@/lib/cattle/groups";
import { GROUP_TEXT, basisLabel, fillG, takaG, type GroupLang } from "./group-text";
import { SumCheck } from "./GroupPurchaseDialog";

const field = "h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** The purchase group this animal belongs to: who else, each share, what it rests on. */
export function PurchaseGroupCard({ group, cattleId, lang, canEdit }: {
  group: PurchaseGroupView; cattleId: string; lang: GroupLang; canEdit: boolean;
}) {
  const g = GROUP_TEXT[lang];
  const fmtDay = (d: string) => fmtDate(d, lang);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const n = group.members.length;
  const bestDate = group.best.kind === "weigh_in" ? group.best.date : null;

  const quick = () => start(async () => {
    if (!group.id) return;
    const res = await resplitPurchaseGroup(group.id, { kind: "best" }).catch(() => ({ ok: false as const, error: g.failed }));
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(g.ok_resplit);
    router.refresh();
  });

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Layers className="h-4 w-4 text-primary" aria-hidden />{g.g_title}</h3>
          <p className="text-xs text-muted-foreground">
            {fillG(g.g_sub, { n, total: group.total.toLocaleString("en-IN"), date: fmtDay(group.purchasedOn) })}
            {group.seller ? ` · ${fillG(g.g_seller, { seller: group.seller })}` : ""}
          </p>
        </div>
        {canEdit && group.id && (
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} disabled={pending}>{g.g_change}</Button>
        )}
      </header>

      <p className="mt-2 text-xs text-muted-foreground">{g.g_basis}: <span className="font-medium text-foreground">{basisLabel(group.basis, g, fmtDay)}</span></p>

      {group.better && canEdit && (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm sm:flex-row sm:items-center">
          <span className="flex min-w-0 flex-1 gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0">{bestDate ? fillG(g.g_better, { n, date: fmtDay(bestDate) }) : basisLabel(group.best.kind === "purchase_weight" ? (group.best.estimated ? "purchase_weight_estimated" : "purchase_weight") : "equal", g, fmtDay)}</span>
          </span>
          <Button type="button" size="sm" className="w-full sm:w-auto" onClick={quick} disabled={pending}>{pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{g.g_better_go}</Button>
        </div>
      )}
      {group.provisional && !group.better && (
        <p className="mt-3 flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span className="min-w-0">{fillG(g.g_provisional, { n })}</span>
        </p>
      )}

      <ul className="mt-3 divide-y divide-border/70 rounded-lg border border-border/70">
        {group.members.map((m) => (
          <li key={m.id} className={cn("flex items-center justify-between gap-3 px-3 py-2 text-sm", m.id === cattleId && "bg-primary/5")}>
            <span className="min-w-0">
              {m.id === cattleId
                ? <span className="font-semibold">{m.tag} <span className="text-xs font-normal text-muted-foreground">· {g.g_this}</span></span>
                : <Link href={`/dashboard/cattle/${m.id}`} className="font-semibold text-primary hover:underline">{m.tag}</Link>}
              <span className="block text-xs text-muted-foreground">
                {m.sale ? `${g.g_sold} ${fmtDay(m.sale.date)} · ${takaG(m.sale.price)}` : m.status === "active" ? g.g_on_farm : g.g_left}
                {m.initialWeightKg ? ` · ${Math.round(m.initialWeightKg)} kg${m.initialWeightType === "estimated" ? "?" : ""}` : ""}
              </span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{takaG(m.share)}</span>
          </li>
        ))}
      </ul>

      {open && group.id && <ResplitDialog group={group} lang={lang} fmtDay={fmtDay} onClose={() => setOpen(false)} />}
    </section>
  );
}

type Choice = "best" | "equal" | "purchase_weight" | `weigh_in:${string}` | "manual";

function ResplitDialog({ group, lang, fmtDay, onClose }: { group: PurchaseGroupView; lang: GroupLang; fmtDay: (d: string) => string; onClose: () => void }) {
  const g = GROUP_TEXT[lang];
  const router = useRouter();
  const [choice, setChoice] = useState<Choice>(group.weighIns[0] ? `weigh_in:${group.weighIns[0]}` : group.hasPurchaseWeights ? "purchase_weight" : "equal");
  const [prices, setPrices] = useState<Record<string, string>>(() => Object.fromEntries(group.members.map((m) => [m.id, String(m.share)])));
  const [pending, start] = useTransition();
  const ids = group.members.map((m) => m.id);

  // the same split the server will make, shown before saving
  const preview = useMemo(() => {
    if (choice === "manual") return splitTotal(group.total, ids.map((id) => ({ id, amount: Number(prices[id]) })), "manual");
    let basis: Basis | null = null;
    if (choice === "equal") basis = { kind: "equal", method: "equal", provisional: true };
    else if (choice === "best") basis = group.best;
    else if (choice === "purchase_weight") {
      const w = Object.fromEntries(group.evidence.map((e) => [e.id, Number(e.initialWeightKg)]));
      basis = { kind: "purchase_weight", method: "weight", estimated: group.evidence.some((e) => e.initialWeightType === "estimated"), weights: w };
    } else {
      const day = choice.slice(9);
      const w: Record<string, number> = {};
      for (const e of group.evidence) {
        const l = [...e.logs].reverse().find((x) => x.date === day && x.type === "measured");
        if (l) w[e.id] = l.kg;
      }
      basis = { kind: "weigh_in", method: "weight", date: day, weights: w };
    }
    return splitOnBasis(group.total, ids, basis);
  }, [choice, prices, group, ids]);

  const save = () => start(async () => {
    const c: ResplitChoice = choice === "manual" ? { kind: "manual", amounts: Object.fromEntries(ids.map((id) => [id, Number(prices[id])])) }
      : choice.startsWith("weigh_in:") ? { kind: "weigh_in", date: choice.slice(9) }
      : { kind: choice as "best" | "equal" | "purchase_weight" };
    const res = await resplitPurchaseGroup(group.id!, c).catch(() => ({ ok: false as const, error: g.failed }));
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(g.ok_resplit);
    router.refresh();
    onClose();
  });

  const options: { id: Choice; label: string }[] = [
    ...group.weighIns.map((d) => ({ id: `weigh_in:${d}` as Choice, label: fillG(g.r_weigh_in, { date: fmtDay(d) }) })),
    ...(group.hasPurchaseWeights ? [{ id: "purchase_weight" as Choice, label: g.r_purchase }] : []),
    { id: "equal", label: g.m_equal },
    { id: "manual", label: g.m_manual },
  ];
  const anySold = group.members.some((m) => m.sale);

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !pending) onClose(); }}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-4 py-4 sm:px-6">
          <DialogTitle className="pr-8">{fillG(g.r_title, { total: group.total.toLocaleString("en-IN") })}</DialogTitle>
          {anySold && <DialogDescription>{g.r_locked_note}</DialogDescription>}
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">{g.r_choose}</legend>
            <div role="radiogroup" className="grid gap-1.5">
              {options.map((o) => (
                <button key={o.id} type="button" role="radio" aria-checked={choice === o.id} onClick={() => setChoice(o.id)}
                  className={cn("flex min-h-11 items-center rounded-lg border px-3 text-left text-sm font-medium",
                    choice === o.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>
                  {o.label}
                </button>
              ))}
            </div>
            {!group.weighIns.length && <p className="text-xs text-muted-foreground">{g.r_none_weights}</p>}
          </fieldset>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {group.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{m.tag}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{g.l_now}: {takaG(m.share)}</span>
                </span>
                {choice === "manual"
                  ? <input inputMode="decimal" type="number" min={0} value={prices[m.id] ?? ""} aria-label={`${g.price} ${m.tag}`}
                      onChange={(e) => setPrices((p) => ({ ...p, [m.id]: e.target.value }))} className={cn(field, "w-32 shrink-0 tabular-nums")} />
                  : <span className="shrink-0 text-sm font-semibold tabular-nums">{preview.ok ? takaG(preview.amounts[m.id]) : "—"}</span>}
              </li>
            ))}
          </ul>
          {choice === "manual" && <SumCheck lang={lang} total={group.total} sum={ids.reduce((s, id) => s + (Number(prices[id]) || 0), 0)} />}
        </div>
        <DialogFooter className="gap-2 border-t px-4 py-3 sm:px-6">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>{g.cancel}</Button>
          <Button type="button" onClick={save} disabled={pending || !preview.ok}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{g.save_resplit}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A sale of several at one price, on one of its animals' page, with undo for all of them. */
export function SaleGroupCard({ sale, cattleId, lang, canUndo }: {
  sale: SaleGroupView; cattleId: string; lang: GroupLang; canUndo: boolean;
}) {
  const g = GROUP_TEXT[lang];
  const fmtDay = (d: string) => fmtDate(d, lang);
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [pending, start] = useTransition();
  const n = sale.lines.length;
  const undo = () => start(async () => {
    const res = await revertSaleGroup(sale.id).catch(() => ({ ok: false as const, error: g.failed }));
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(fillG(g.ok_undo, { n }));
    setAsk(false);
    router.refresh();
  });
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Layers className="h-4 w-4 text-primary" aria-hidden />{g.sg_title}</h3>
          <p className="text-xs text-muted-foreground">{fillG(g.sg_sub, { n, total: sale.total.toLocaleString("en-IN"), date: fmtDay(sale.soldOn) })}{sale.buyer ? ` · ${sale.buyer}` : ""}</p>
        </div>
        {canUndo && <Button type="button" variant="outline" size="sm" onClick={() => setAsk(true)}><Undo2 className="mr-1.5 h-4 w-4" aria-hidden />{g.undo_group}</Button>}
      </header>
      <ul className="mt-3 divide-y divide-border/70 rounded-lg border border-border/70">
        {sale.lines.map((l) => (
          <li key={l.cattleId} className={cn("flex items-center justify-between gap-3 px-3 py-2 text-sm", l.cattleId === cattleId && "bg-primary/5")}>
            <span className="min-w-0">
              {l.cattleId === cattleId ? <span className="font-semibold">{l.tag} <span className="text-xs font-normal text-muted-foreground">· {g.g_this}</span></span>
                : <Link href={`/dashboard/cattle/${l.cattleId}`} className="font-semibold text-primary hover:underline">{l.tag}</Link>}
              {l.weightKg ? <span className="block text-xs text-muted-foreground">{Math.round(l.weightKg)} kg</span> : null}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{takaG(l.price)}</span>
          </li>
        ))}
      </ul>
      {ask && (
        <Dialog open onOpenChange={(o) => { if (!o && !pending) setAsk(false); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 pr-6"><AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />{fillG(g.undo_group_q, { n })}</DialogTitle>
              <DialogDescription>{g.undo_group_note} ({sale.lines.map((l) => l.tag).join(", ")})</DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setAsk(false)} disabled={pending}>{g.cancel}</Button>
              <Button variant="destructive" onClick={undo} disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{g.undo_group}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}

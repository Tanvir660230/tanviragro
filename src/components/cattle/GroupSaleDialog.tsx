"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { todayDhaka } from "@/lib/dates";
import { splitTotal, type SplitMethod } from "@/lib/cattle/cost-split";
import { sellCattleGroup } from "@/app/dashboard/(app)/cattle/group-actions";
import { GROUP_TEXT, fillG, takaG, type GroupLang } from "./group-text";
import { SplitPicker, SumCheck } from "./GroupPurchaseDialog";

export type SaleAnimal = { id: string; tag: string; lastKg: number | null; costSoFar: number };

const field = "h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const num = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? n : null; };

/**
 * One animal or several sold at one price. The price is shared by the weight at the sale
 * (how cattle are priced), equally, or as typed; each share is that animal's sale price, so
 * each shows its own profit against its own cost.
 */
export function GroupSaleDialog({ animals, lang, onClose, onDone }: {
  animals: SaleAnimal[]; lang: GroupLang; onClose: () => void; onDone?: () => void;
}) {
  const g = GROUP_TEXT[lang];
  const router = useRouter();
  const today = todayDhaka();
  const one = animals.length === 1;
  const [date, setDate] = useState(today);
  const [buyer, setBuyer] = useState("");
  const [total, setTotal] = useState("");
  const [method, setMethod] = useState<SplitMethod>(one ? "equal" : "weight");
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const totalN = num(total) ?? 0;
  const allWeights = animals.every((a) => (num(weights[a.id] ?? "") ?? 0) > 0);
  const split = useMemo(() => splitTotal(totalN, animals.map((a) => ({ id: a.id, weightKg: num(weights[a.id] ?? ""), amount: num(prices[a.id] ?? "") })), method),
    [totalN, animals, weights, prices, method]);
  const share = (id: string) => (totalN <= 0 && method !== "manual" ? null : split.ok ? split.amounts[id] : method === "manual" ? num(prices[id] ?? "") : null);
  const sum = method === "manual" ? animals.reduce((s, a) => s + (num(prices[a.id] ?? "") ?? 0), 0) : split.ok ? totalN : 0;
  const totalCost = animals.reduce((s, a) => s + a.costSoFar, 0);

  const submit = () => start(async () => {
    const res = await sellCattleGroup({
      date, total: totalN, buyer, method,
      lines: animals.map((a) => ({ cattleId: a.id, weightKg: num(weights[a.id] ?? ""), price: method === "manual" ? num(prices[a.id] ?? "") : null })),
    }).catch(() => ({ ok: false as const, error: g.failed }));
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(fillG(g.ok_sell, { n: animals.length, total: totalN.toLocaleString("en-IN") }));
    router.refresh();
    onDone?.();
    onClose();
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !pending) onClose(); }}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-4 py-4 sm:px-6">
          <DialogTitle className="break-words pr-8">{one ? fillG(g.s_title_one, { tag: animals[0].tag }) : fillG(g.s_title, { n: animals.length })}</DialogTitle>
          {!one && <DialogDescription>{g.s_sub}</DialogDescription>}
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="grid min-w-0 gap-1 text-sm font-medium">{g.date} *
              <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={field} />
            </label>
            <label className="grid min-w-0 gap-1 text-sm font-medium">{g.total} *
              <input inputMode="decimal" type="number" min={0} value={total} onChange={(e) => setTotal(e.target.value)} className={cn(field, "tabular-nums")} />
            </label>
            <label className="grid min-w-0 gap-1 text-sm font-medium">{g.buyer}
              <input value={buyer} onChange={(e) => setBuyer(e.target.value)} maxLength={120} className={field} />
            </label>
          </div>

          {!one && <SplitPicker lang={lang} method={method} setMethod={setMethod} canWeight={allWeights} sale />}

          <ol className="space-y-2">
            {animals.map((a) => {
              const sh = share(a.id);
              const profit = sh == null ? null : sh - a.costSoFar;
              return (
                <li key={a.id} className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.3fr)] sm:items-end">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{a.tag}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{g.cost}: {takaG(a.costSoFar)}</p>
                  </div>
                  <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
                    <span className="leading-tight">{g.sale_weight}</span>
                    <input inputMode="decimal" type="number" min={0} value={weights[a.id] ?? ""} onChange={(e) => setWeights((w) => ({ ...w, [a.id]: e.target.value }))}
                      placeholder={a.lastKg ? fillG(g.last, { kg: Math.round(a.lastKg) }) : undefined}
                      aria-label={`${g.sale_weight} ${a.tag}`} className={cn(field, "text-foreground tabular-nums")} />
                  </label>
                  <div className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
                    <span>{method === "manual" ? g.price : g.share}</span>
                    {method === "manual" && !one
                      ? <input inputMode="decimal" type="number" min={0} value={prices[a.id] ?? ""} onChange={(e) => setPrices((p) => ({ ...p, [a.id]: e.target.value }))}
                          aria-label={`${g.price} ${a.tag}`} className={cn(field, "text-foreground tabular-nums")} />
                      : <span className="flex h-10 items-center rounded-lg bg-muted/60 px-3 text-sm font-semibold tabular-nums text-foreground">{takaG(sh)}</span>}
                  </div>
                  <div className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
                    <span>{g.profit}</span>
                    <span className={cn("flex h-10 items-center text-sm font-semibold tabular-nums", profit == null ? "text-muted-foreground" : profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>{takaG(profit)}</span>
                  </div>
                </li>
              );
            })}
          </ol>

          {!one && <SumCheck lang={lang} total={totalN} sum={sum} />}
          <dl className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3 text-sm">
            <div><dt className="text-xs text-muted-foreground">{g.total_cost}</dt><dd className="font-semibold tabular-nums">{takaG(totalCost)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{g.total_profit}</dt>
              <dd className={cn("font-semibold tabular-nums", totalN - totalCost >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>{totalN > 0 ? takaG(totalN - totalCost) : "—"}</dd></div>
          </dl>
        </div>

        <DialogFooter className="gap-2 border-t px-4 py-3 sm:px-6">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>{g.cancel}</Button>
          <Button type="button" onClick={submit} disabled={pending || !split.ok || !(totalN > 0)}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{g.save_sell}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

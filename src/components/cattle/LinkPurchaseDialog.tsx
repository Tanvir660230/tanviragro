"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { linkPurchaseGroup, type ResplitChoice } from "@/app/dashboard/(app)/cattle/group-actions";
import { GROUP_TEXT, fillG, takaG, type GroupLang } from "./group-text";
import { SumCheck } from "./GroupPurchaseDialog";

export type LinkAnimal = { id: string; tag: string; purchaseDate: string; purchasePrice: number };

const field = "h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const num = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? n : null; };

/**
 * Animals already on record that were bought in one deal: enter what was paid for all of
 * them, and choose how it is shared (the best evidence the farm has, equal, or typed).
 */
export function LinkPurchaseDialog({ animals, lang, fmtDay, onClose, onDone }: {
  animals: LinkAnimal[]; lang: GroupLang; fmtDay: (d: string) => string; onClose: () => void; onDone?: () => void;
}) {
  const g = GROUP_TEXT[lang];
  const router = useRouter();
  const current = animals.reduce((s, a) => s + a.purchasePrice, 0);
  const [total, setTotal] = useState(String(Math.round(current * 100) / 100));
  const [seller, setSeller] = useState("");
  const [kind, setKind] = useState<"best" | "equal" | "manual">("best");
  const [prices, setPrices] = useState<Record<string, string>>(() => Object.fromEntries(animals.map((a) => [a.id, String(a.purchasePrice)])));
  const [pending, start] = useTransition();
  const dates = [...new Set(animals.map((a) => a.purchaseDate.slice(0, 10)))];
  const sameDay = dates.length === 1;
  const totalN = num(total) ?? 0;
  const sum = animals.reduce((s, a) => s + (num(prices[a.id] ?? "") ?? 0), 0);

  const submit = () => start(async () => {
    const choice: ResplitChoice = kind === "manual"
      ? { kind: "manual", amounts: Object.fromEntries(animals.map((a) => [a.id, num(prices[a.id] ?? "") ?? -1])) }
      : { kind };
    const res = await linkPurchaseGroup({ cattleIds: animals.map((a) => a.id), total: totalN, seller, choice })
      .catch(() => ({ ok: false as const, error: g.failed }));
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(fillG(g.ok_link, { total: totalN.toLocaleString("en-IN"), n: animals.length }));
    router.refresh();
    onDone?.();
    onClose();
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !pending) onClose(); }}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-4 py-4 sm:px-6">
          <DialogTitle className="pr-8">{g.l_title} · {animals.length}</DialogTitle>
          <DialogDescription>{g.l_sub}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          {!sameDay ? (
            <p className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 break-words">{fillG(g.l_same_date, { dates: animals.map((a) => `${a.tag}: ${fmtDay(a.purchaseDate)}`).join(", ") })}</span>
            </p>
          ) : (<>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="grid min-w-0 gap-1 text-sm font-medium">{g.total} *
                <input inputMode="decimal" type="number" min={0} value={total} onChange={(e) => setTotal(e.target.value)} className={cn(field, "tabular-nums")} />
              </label>
              <label className="grid min-w-0 gap-1 text-sm font-medium">{g.seller}
                <input value={seller} onChange={(e) => setSeller(e.target.value)} maxLength={120} className={field} />
              </label>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">{g.how}</legend>
              <div role="radiogroup" className="grid grid-cols-3 gap-1.5 rounded-xl bg-muted/60 p-1">
                {([["best", g.l_auto], ["equal", g.m_equal], ["manual", g.m_manual]] as const).map(([k, label]) => (
                  <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                    className={cn("min-h-10 rounded-lg px-1.5 text-xs font-semibold leading-tight sm:text-sm", kind === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{kind === "best" ? g.h_auto : kind === "equal" ? g.h_equal_buy : g.h_manual}</p>
            </fieldset>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {animals.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{a.tag}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{g.l_now}: {takaG(a.purchasePrice)}</span>
                  </span>
                  {kind === "manual" && (
                    <input inputMode="decimal" type="number" min={0} value={prices[a.id] ?? ""} aria-label={`${g.price} ${a.tag}`}
                      onChange={(e) => setPrices((p) => ({ ...p, [a.id]: e.target.value }))} className={cn(field, "w-32 shrink-0 tabular-nums")} />
                  )}
                </li>
              ))}
            </ul>
            {kind === "manual" && <SumCheck lang={lang} total={totalN} sum={sum} />}
          </>)}
        </div>
        <DialogFooter className="gap-2 border-t px-4 py-3 sm:px-6">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>{g.cancel}</Button>
          <Button type="button" onClick={submit} disabled={pending || !sameDay || !(totalN > 0)}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{g.save_link}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { declareDistribution } from "@/app/dashboard/(app)/partners/actions";
import type { Dictionary } from "@/i18n/getDictionary";
import { bdt } from "@/lib/partners/calculations";
import { useL } from "@/i18n/text";

/** A partner's realized profit share not yet paid (lib/partners/position.ts). */
export type DistributionEntry = { id: string; name: string; distributable: number };

interface Props {
  entries: DistributionEntry[];
  today: string;
  t: Dictionary;
  onClose: () => void;
}

/** Pay out realized profit. Estimates and losses are never "distributed": they are live shares. */
export function DeclareDistributionModal({ entries, today, t, onClose }: Props) {
  const L = useL();
  const [amounts, setAmounts] = useState<Record<string, string>>(Object.fromEntries(entries.map((e) => [e.id, String(Math.floor(e.distributable))])));
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const rows = entries.map((e) => ({ ...e, amount: parseFloat(amounts[e.id] ?? "0") || 0 }));
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const over = rows.find((r) => r.amount > r.distributable + 0.5);

  function confirm() {
    setError(null);
    if (!date) return setError(L("তারিখ দিন", "Enter a date"));
    if (over) return setError(L(`${over.name}-এর পাওনা ${bdt(over.distributable)}-এর বেশি দেওয়া যাবে না`, `${over.name} can receive at most ${bdt(over.distributable)}`));
    const paid = rows.filter((r) => r.amount > 0).map((r) => ({ partnerId: r.id, amount: r.amount }));
    if (!paid.length) return setError(L("কোনো পরিমাণ নেই", "Nothing to pay"));
    startTransition(async () => {
      const res = await declareDistribution({ totalAmount: total, date, isLoss: false, entries: paid });
      if (res.error) setError(res.error);
      else onClose();
    });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Banknote className="h-4 w-4 text-emerald-600" />{L("পাকা লাভ বণ্টন", "Pay out realized profit")}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {L("বিক্রি হওয়া গরুর লাভ থেকে যার যা পাওনা। টাকা খামারের নগদ থেকে যাবে।", "Each partner's share of profit from animals sold. The money leaves the farm's cash.")}
        </p>
        <div className="space-y-1.5">
          <Label>{t.partners.date}</Label>
          <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </div>
        <div className="divide-y rounded-lg border">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">{L("পাওনা", "Due")} {bdt(r.distributable)}</p>
              </div>
              <Input type="number" min="0" max={Math.floor(r.distributable)} step="100" value={amounts[r.id] ?? ""}
                onChange={(e) => setAmounts((prev) => ({ ...prev, [r.id]: e.target.value }))} className="h-8 w-28 text-sm" />
            </div>
          ))}
          <div className="flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            <span>{L("মোট", "Total")}</span><span>{bdt(total)}</span>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>{t.partners.cancel}</Button>
          <Button onClick={confirm} disabled={isPending || total <= 0}>{isPending ? t.partners.distributing : t.partners.confirm_distribute}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

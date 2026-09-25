"use client";

import { useState, useTransition } from "react";
import { TrendingUp, TrendingDown, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { declareDistribution } from "@/app/dashboard/(app)/partners/actions";
import type { Partner } from "@/types/database";
import type { Dictionary } from "@/i18n/getDictionary";
import { bdt, type PartnerAccountSummary } from "@/lib/partners/calculations";
import { cn } from "@/lib/utils";
import { useL } from "@/i18n/text";

export interface AccountEntry {
  partner: Partner;
  sharePct: number;
  acc: PartnerAccountSummary;
}

interface Props {
  partnerAccounts: AccountEntry[];
  netPL: number;
  today: string;
  t: Dictionary;
  onClose: () => void;
}

export function DeclareDistributionModal({ partnerAccounts, netPL, today, t, onClose }: Props) {
  const L = useL();
  const isLoss = netPL < 0;
  const pendingEntries = partnerAccounts
    .map(({ partner: p, acc }) => ({
      partner: p,
      pending: isLoss ? acc.pendingLoss : acc.pendingProfit,
    }))
    .filter((e) => e.pending > 0);

  const [amounts, setAmounts] = useState<Record<string, string>>(
    Object.fromEntries(pendingEntries.map((e) => [e.partner.id, e.pending.toFixed(0)]))
  );
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalAmount = Object.values(amounts).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  function handleConfirm() {
    if (!date) {
      setError("তারিখ দিন");
      return;
    }
    const entries = pendingEntries
      .map((e) => ({
        partnerId: e.partner.id,
        amount: parseFloat(amounts[e.partner.id] ?? "0") || 0,
        maxAmount: e.pending,
      }))
      .filter((e) => e.amount > 0);
    if (!entries.length) {
      setError("কোনো পরিমাণ নেই");
      return;
    }

    startTransition(async () => {
      const res = await declareDistribution({ totalAmount, date, isLoss, entries });
      if (res.error) {
        setError(res.error);
        return;
      }
      onClose();
    });
  }

  if (pendingEntries.length === 0) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.partners.declare_distribution_title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <p className="text-sm text-muted-foreground">{t.partners.all_distributed}</p>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>{t.partners.cancel}</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isLoss ? <TrendingDown className="h-4 w-4 text-orange-500" /> : <TrendingUp className="h-4 w-4 text-emerald-500" />}
            {t.partners.declare_distribution_title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t.partners.date}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </div>

          <div className="rounded-lg border bg-muted/30 overflow-hidden">
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b">
              {t.partners.distribution_preview}
            </div>
            <div className="divide-y">
              {pendingEntries.map(({ partner: p, pending }) => (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className={isLoss ? "text-orange-600" : "text-emerald-600"}>{L("বাকি", "Pending")} {bdt(pending)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-muted-foreground">৳</span>
                    <Input
                      type="number"
                      min="0"
                      step="100"
                      value={amounts[p.id] ?? ""}
                      onChange={(e) => setAmounts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      className="w-28 h-8 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className={cn("flex justify-between items-center px-3 py-2.5 border-t text-sm font-semibold", isLoss ? "text-orange-600" : "text-emerald-600")}>
              <span>{L("মোট", "Total")}</span>
              <span>{bdt(totalAmount)}</span>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={isPending}>{t.partners.cancel}</Button>
            <Button onClick={handleConfirm} disabled={isPending || totalAmount <= 0}>
              {isPending ? t.partners.distributing : t.partners.confirm_distribute}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

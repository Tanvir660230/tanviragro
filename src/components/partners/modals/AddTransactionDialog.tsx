"use client";

import { useState, useActionState, useEffect } from "react";
import { Banknote } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { addPartnerTransaction } from "@/app/dashboard/(app)/partners/actions";
import type { Partner } from "@/types/database";
import type { Dictionary } from "@/i18n/getDictionary";
import type { PartnerPosition } from "@/lib/partners/position";
import { FormField } from "@/components/partners/partner-ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useL } from "@/i18n/text";

type MoneyType = "investment" | "withdrawal" | "advance" | "loan_in" | "loan_repay";

interface Props {
  partners: Partner[];
  positions: PartnerPosition[];
  /** the farm's cash now */
  cash: number;
  today: string;
  t: Dictionary;
  /** advances and partner loans need migration 20260927100000 */
  moneyTypesEnabled: boolean;
  /** open for one partner only (profile page) */
  fixedPartnerId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const taka = (n: number) => `৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;

/** The one form for a partner's money: capital in/out, profit advance, loan to the farm and its repayment. */
export function AddTransactionDialog({ partners, positions, cash, today, t, moneyTypesEnabled, fixedPartnerId, open: openProp, onOpenChange }: Props) {
  const L = useL();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (v: boolean) => { setOpenState(v); onOpenChange?.(v); };
  const [partnerId, setPartnerId] = useState(fixedPartnerId ?? "");
  const [type, setType] = useState<MoneyType>("investment");
  const [confirm, setConfirm] = useState(false);
  const [state, action, pending] = useActionState(addPartnerTransaction, undefined);

  useEffect(() => {
    if (state?.success) {
      setTimeout(() => {
        toast.success(L("লেনদেন সেভ হলো", "Entry saved"));
        setOpen(false); setConfirm(false);
        if (!fixedPartnerId) setPartnerId("");
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const partner = partners.find((p) => p.id === partnerId);
  const pos = positions.find((p) => p.id === partnerId);
  const types: { v: MoneyType; bn: string; en: string; hint: [string, string] }[] = [
    { v: "investment", bn: "মূলধন জমা", en: "Capital in", hint: ["খামারে মূলধন দিলেন — টাকা × দিন অনুপাতে লাভ-ক্ষতির ভাগ পাবেন।", "Capital put into the farm — shares profit and loss by taka × days."] },
    { v: "withdrawal", bn: "মূলধন তোলা", en: "Capital out", hint: ["মূলধন ফেরত নিলেন — এর পর থেকে সেই টাকা ভাগ পায় না।", "Capital taken back — from then on that money earns no share."] },
    ...(moneyTypesEnabled ? [
      { v: "advance" as const, bn: "লাভের অগ্রিম", en: "Profit advance", hint: ["দরকার মতো যেকোনো দিন নিতে পারেন — পরের লাভের ভাগ থেকে কাটা যাবে।", "Taken whenever needed — it comes off their next profit share."] as [string, string] },
      { v: "loan_in" as const, bn: "খামারকে ধার দিলেন", en: "Loan to the farm", hint: ["ফেরত দিতে হবে; লাভের ভাগ নেই।", "To be paid back; earns no share of profit."] as [string, string] },
      { v: "loan_repay" as const, bn: "ধার ফেরত দেওয়া হলো", en: "Loan repaid", hint: ["খামার ধারের টাকা ফেরত দিল।", "The farm paid the loan back."] as [string, string] },
    ] : []),
  ];
  const current = types.find((x) => x.v === type) ?? types[0];

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirm(false); }}>
      {openProp === undefined && (
        <DialogTrigger className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}>
          <Banknote className="h-4 w-4" />{t.partners.add_transaction}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{partner && fixedPartnerId ? `${L("নতুন লেনদেন", "New entry")} — ${partner.name}` : t.partners.new_transaction}</DialogTitle>
        </DialogHeader>
        <form action={(fd) => { fd.set("partner_id", partnerId); fd.set("type", type); if (confirm) fd.set("confirm", "1"); action(fd); }} className="space-y-4">
          {!fixedPartnerId && (
            <FormField label={`${t.partners.partner_select} *`}>
              <Select value={partnerId === "" ? null : partnerId} onValueChange={(v) => setPartnerId(v ?? "")} required>
                <SelectTrigger>
                  <span className="truncate">{partner ? partner.name : <span className="text-muted-foreground">{t.partners.choose_partner}</span>}</span>
                </SelectTrigger>
                <SelectContent>
                  {partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
          )}

          <FormField label={t.partners.transaction_type}>
            <div className="grid grid-cols-2 gap-2">
              {types.map((x) => (
                <button key={x.v} type="button" onClick={() => { setType(x.v); setConfirm(false); }}
                  className={cn("rounded-lg border px-3 py-2 text-left text-sm font-medium", type === x.v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}>
                  {L(x.bn, x.en)}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{L(current.hint[0], current.hint[1])}</p>
          </FormField>

          {pos && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-muted/40 px-3 py-2.5 text-xs">
              <span className="text-muted-foreground">{L("খাটানো মূলধন", "Capital in")}</span><span className="text-right tabular-nums">{taka(pos.netCapital)}</span>
              <span className="text-muted-foreground">{L("তোলার মতো পাওনা", "Can take out")}</span><span className="text-right font-semibold tabular-nums">{taka(pos.withdrawable)}</span>
              {pos.advances > 0 && (<><span className="text-muted-foreground">{L("অগ্রিম নেওয়া", "Advances taken")}</span><span className="text-right tabular-nums">{taka(pos.advances)}</span></>)}
              {pos.loanBalance > 0 && (<><span className="text-muted-foreground">{L("খামারের কাছে ধার", "Loan to the farm")}</span><span className="text-right tabular-nums">{taka(pos.loanBalance)}</span></>)}
              <span className="text-muted-foreground">{L("খামারের নগদ এখন", "Farm cash now")}</span><span className="text-right tabular-nums">{(cash < 0 ? "−" : "") + taka(cash)}</span>
            </div>
          )}

          <FormField label={`${t.partners.amount} *`} id="tamount">
            <Input id="tamount" name="amount" type="number" min="1" step="any" required onChange={() => setConfirm(false)} />
          </FormField>
          <FormField label={t.partners.date} id="tdate">
            <Input id="tdate" name="recorded_at" type="date" max={today} defaultValue={today} />
          </FormField>
          <FormField label={t.partners.notes} id="tnotes">
            <Input id="tnotes" name="notes" placeholder={t.partners.optional_notes} />
          </FormField>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state?.needsConfirm && (
            <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 h-4 w-4" />
              {L("জেনে-বুঝে লিখছি (কারণ নোটে লিখেছি)", "I know — record it anyway (reason in the note)")}
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t.partners.cancel}</Button>
            <Button type="submit" disabled={pending || !partnerId || (state?.needsConfirm && !confirm)}>{pending ? t.partners.saving : t.partners.save}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

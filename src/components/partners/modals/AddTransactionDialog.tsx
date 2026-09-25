"use client";

import { useState, useActionState, useEffect } from "react";
import { Banknote } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { addPartnerTransaction } from "@/app/dashboard/(app)/partners/actions";
import type { Partner } from "@/types/database";
import type { Dictionary } from "@/i18n/getDictionary";
import { FormField, TXN_LABEL } from "@/components/partners/partner-ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useL } from "@/i18n/text";

interface Props {
  partners: Partner[];
  today: string;
  t: Dictionary;
}

export function AddTransactionDialog({ partners, today, t }: Props) {
  const L = useL();
  const [open, setOpen] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [txnType, setTxnType] = useState<"investment" | "withdrawal">("investment");
  const [state, action, pending] = useActionState(addPartnerTransaction, undefined);

  useEffect(() => {
    if (state?.success) {
      setTimeout(() => {
        toast.success(
          txnType === "investment"
            ? L("জমা যোগ হলো", "Investment added")
            : L("তোলা যোগ হলো", "Withdrawal added")
        );
        setOpen(false);
        setSelectedPartnerId("");
      }, 0);
    }
  }, [state, txnType, L]);

  if (partners.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}>
        <Banknote className="h-4 w-4" />
        {t.partners.add_transaction}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.partners.new_transaction}</DialogTitle>
        </DialogHeader>
        <form
          action={(fd) => {
            fd.set("partner_id", selectedPartnerId);
            fd.set("type", txnType);
            action(fd);
          }}
          className="space-y-4"
        >
          <FormField label={`${t.partners.partner_select} *`}>
            <Select
              value={selectedPartnerId === "" ? null : selectedPartnerId}
              onValueChange={(v) => setSelectedPartnerId(v ?? "")}
              required
            >
              <SelectTrigger>
                <span className="truncate">
                  {selectedPartnerId
                    ? partners.find((p) => p.id === selectedPartnerId)?.name
                    : <span className="text-muted-foreground">{t.partners.choose_partner}</span>}
                </span>
              </SelectTrigger>
              <SelectContent>
                {partners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label={t.partners.transaction_type}>
            <Select
              value={txnType}
              onValueChange={(v) => setTxnType(v as "investment" | "withdrawal")}
            >
              <SelectTrigger>
                <span className="truncate">
                  {txnType ? TXN_LABEL(t)[txnType] : ""}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="investment">{TXN_LABEL(t).investment}</SelectItem>
                <SelectItem value="withdrawal">{TXN_LABEL(t).withdrawal}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label={`${t.partners.amount} *`} id="tamount">
            <Input id="tamount" name="amount" type="number" min="1" step="any" required />
          </FormField>

          <FormField label={t.partners.date} id="tdate">
            <Input id="tdate" name="recorded_at" type="date" max={today} defaultValue={today} />
          </FormField>

          <FormField label={t.partners.notes} id="tnotes">
            <Input id="tnotes" name="notes" placeholder={t.partners.optional_notes} />
          </FormField>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t.partners.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t.partners.saving : t.partners.save}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

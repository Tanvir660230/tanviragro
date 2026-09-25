"use client";

import { useActionState, useState, useEffect } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { updatePartner } from "@/app/dashboard/(app)/partners/actions";
import type { Partner, PartnerTransaction, PartnerType } from "@/types/database";
import type { Dictionary } from "@/i18n/getDictionary";
import { totalCapitalOf } from "@/lib/partners/calculations";
import { FormField } from "@/components/partners/partner-ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useL } from "@/i18n/text";

export function EditPartnerDialog({
  partner: p,
  transactions,
  t,
}: {
  partner: Partner;
  transactions: PartnerTransaction[];
  t: Dictionary;
}) {
  const L = useL();
  const actualCapital = totalCapitalOf(transactions);
  const [open, setOpen] = useState(false);
  const [partnerTypeField, setPartnerTypeField] = useState<PartnerType>(p.partner_type ?? "capital");
  const [shareModeField, setShareModeField] = useState<"auto" | "manual">(p.share_mode ?? "auto");
  const [bearsLossField, setBearsLossField] = useState(p.bears_loss ?? true);
  const [state, action, pending] = useActionState(updatePartner, undefined);

  useEffect(() => {
    if (state?.success) {
      setTimeout(() => {
        toast.success(L("অংশীদার আপডেট হলো", "Partner updated"));
        setOpen(false);
      }, 0);
    }
  }, [state, L]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        setPartnerTypeField(p.partner_type ?? "capital");
        setShareModeField(p.share_mode ?? "auto");
        setBearsLossField(p.bears_loss ?? true);
      }, 0);
    }
  }, [open, p.partner_type, p.share_mode, p.bears_loss]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" aria-label="Edit partner">
        <Pencil className="h-3.5 w-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{L("অংশীদার বদলান", "Edit Partner")}</DialogTitle>
        </DialogHeader>
        <form
          action={(fd) => {
            fd.set("partner_id", p.id);
            fd.set("partner_type", partnerTypeField);
            fd.set("share_mode", shareModeField);
            action(fd);
          }}
          className="space-y-4"
        >
          <FormField label={`${t.partners.name} *`} id="ename">
            <Input id="ename" name="name" required defaultValue={p.name} />
          </FormField>

          <FormField label={t.partners.partner_type}>
            <Select
              value={partnerTypeField}
              onValueChange={(v) => {
                const type = v as PartnerType;
                setPartnerTypeField(type);
                if (type === "labor") setShareModeField("manual");
                else if (type === "capital") setShareModeField("auto");
              }}
            >
              <SelectTrigger>
                <span className="truncate">
                  {partnerTypeField === "capital" && t.partners.capital_partner}
                  {partnerTypeField === "labor" && t.partners.labor_partner}
                  {partnerTypeField === "hybrid" && t.partners.hybrid_partner}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="capital">{t.partners.capital_partner}</SelectItem>
                <SelectItem value="labor">{t.partners.labor_partner}</SelectItem>
                <SelectItem value="hybrid">{t.partners.hybrid_partner}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          {partnerTypeField !== "labor" && (
            <FormField label={t.partners.initial_investment} id="einv">
              <Input id="einv" name="investment_amount" type="number" min="0" step="100" defaultValue={actualCapital} />
              <p className="text-xs text-muted-foreground mt-1">
                Capital is tracked via the Capital Ledger — use it to add or edit investments.
              </p>
            </FormField>
          )}

          {partnerTypeField !== "capital" && (
            <>
              <FormField label={t.partners.labor_value_monthly} id="elabor">
                <Input id="elabor" name="labor_value_monthly" type="number" min="0" step="500" defaultValue={p.labor_value_monthly ?? 0} />
              </FormField>
              <FormField label={L("অপেক্ষার সময় (মাস)", "Cliff Period (months)")} id="ecliff">
                <Input id="ecliff" name="cliff_months" type="number" min="0" step="1" defaultValue={p.cliff_months ?? 0} />
                <p className="text-xs text-muted-foreground mt-1">{L("শ্রমের মূল্য যোগ হওয়ার আগে কত মাস (0 = সাথে সাথে)", "Months before labor units start vesting (0 = immediate)")}</p>
              </FormField>
            </>
          )}

          <FormField label={L("ভাগের ধরন", "Share Mode")}>
            <div className="flex gap-2">
              {(["auto", "manual"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setShareModeField(mode)}
                  className={cn(
                    "flex-1 rounded-lg border py-2 text-sm font-medium transition-colors",
                    shareModeField === mode
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  {mode === "auto" ? L("নিজে (অনুপাতে)", "Auto (ratio-based)") : L("নিজে দেওয়া %", "Manual %")}
                </button>
              ))}
            </div>
          </FormField>

          {shareModeField === "manual" && (
            <FormField label={t.partners.profit_share_pct} id="eshare">
              <Input id="eshare" name="profit_share_pct" type="number" min="0" max="100" step="0.5" defaultValue={p.profit_share_pct} />
            </FormField>
          )}

          {partnerTypeField !== "labor" && (
            <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-card">
              <div className="space-y-0.5">
                <Label htmlFor={`edit-bears-loss-${p.id}`} className="text-base">{L("ক্ষতির ভাগ নেবেন", "Bears Capital Loss")}</Label>
                <p className="text-xs text-muted-foreground">{L("এই অংশীদার কি ক্ষতিরও ভাগ নেবেন?", "Does this partner take a share of business losses?")}</p>
              </div>
              <input
                type="checkbox"
                id={`edit-bears-loss-${p.id}`}
                name="bears_loss"
                value="true"
                checked={bearsLossField}
                onChange={(e) => setBearsLossField(e.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
              />
            </div>
          )}

          <FormField label={t.partners.joined_at} id="ejoined">
            <Input id="ejoined" name="joined_at" type="date" defaultValue={p.joined_at} />
          </FormField>

          <FormField label={t.partners.notes} id="enotes">
            <Textarea id="enotes" name="notes" rows={2} maxLength={500} defaultValue={p.notes ?? ""} />
          </FormField>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t.partners.cancel}</Button>
            <Button type="submit" disabled={pending}>{pending ? t.partners.saving : t.partners.save}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

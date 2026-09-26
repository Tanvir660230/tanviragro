"use client";

import { useState, useActionState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { createPartner } from "@/app/dashboard/(app)/partners/actions";
import type { PartnerType } from "@/types/database";
import type { Dictionary } from "@/i18n/getDictionary";
import { FormField } from "@/components/partners/partner-ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useL } from "@/i18n/text";

interface Props {
  today: string;
  t: Dictionary;
}

export function AddPartnerDialog({ today, t }: Props) {
  const L = useL();
  const [open, setOpen] = useState(false);
  const [partnerTypeField, setPartnerTypeField] = useState<PartnerType>("capital");
  const [shareModeField, setShareModeField] = useState<"auto" | "manual">("auto");
  const [bearsLossField, setBearsLossField] = useState(true);
  const [state, action, pending] = useActionState(createPartner, undefined);

  useEffect(() => {
    if (state?.success) {
      setTimeout(() => {
        toast.success(L("অংশীদার যোগ হলো", "Partner added"));
        setOpen(false);
      }, 0);
    }
  }, [state, L]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants(), "gap-1.5")}>
        <Plus className="h-4 w-4" />
        {t.partners.add_partner}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.partners.new_partner}</DialogTitle>
        </DialogHeader>
        <form
          action={(fd) => {
            fd.set("partner_type", partnerTypeField);
            fd.set("share_mode", shareModeField);
            action(fd);
          }}
          className="space-y-4"
        >
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {L("নতুন অংশীদার টাকা জমার দিন থেকে লাভ-ক্ষতির ভাগ পান (টাকা × দিন) — আগের সময়ের ফল আগের অংশীদারদের থাকে। আলাদা মূল্যায়ন লাগে না।",
               "A new partner shares profit and loss from the day their money comes in (taka × days) — the result before that stays with the earlier partners. No separate valuation is needed.")}
          </p>

          <FormField label={`${t.partners.name} *`} id="pname">
            <Input id="pname" name="name" required />
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
            <FormField label={t.partners.initial_investment} id="pinv">
              <Input id="pinv" name="investment_amount" type="number" min="0" step="100" defaultValue="0" />
            </FormField>
          )}

          {partnerTypeField !== "capital" && (
            <>
              <FormField label={t.partners.labor_value_monthly} id="plabor">
                <Input id="plabor" name="labor_value_monthly" type="number" min="0" step="500" defaultValue="0" />
              </FormField>
              <FormField label={L("অপেক্ষার সময় (মাস)", "Cliff Period (months)")} id="pcliff">
                <Input id="pcliff" name="cliff_months" type="number" min="0" step="1" defaultValue="0" />
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
            <FormField label={t.partners.profit_share_pct} id="pshare">
              <div className="flex items-center gap-2">
                <Input
                  id="pshare"
                  name="profit_share_pct"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  defaultValue="0"
                />
              </div>
            </FormField>
          )}

          {partnerTypeField !== "labor" && (
            <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-card">
              <div className="space-y-0.5">
                <Label htmlFor="add-bears-loss" className="text-base">{L("ক্ষতির ভাগ নেবেন", "Bears Capital Loss")}</Label>
                <p className="text-xs text-muted-foreground">{L("এই অংশীদার কি ক্ষতিরও ভাগ নেবেন?", "Does this partner take a share of business losses?")}</p>
              </div>
              <input
                type="checkbox"
                id="add-bears-loss"
                name="bears_loss"
                value="true"
                checked={bearsLossField}
                onChange={(e) => setBearsLossField(e.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
              />
            </div>
          )}

          <FormField label={t.partners.joined_at} id="pjoined">
            <Input id="pjoined" name="joined_at" type="date" max={today} defaultValue={today} />
          </FormField>

          <FormField label={t.partners.notes} id="pnotes">
            <Textarea id="pnotes" name="notes" rows={2} maxLength={500} />
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

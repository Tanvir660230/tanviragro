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
import { bdt } from "@/lib/partners/calculations";
import { FormField } from "@/components/partners/partner-ui";
import type { CattleValuation } from "@/components/partners/PartnerCard";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  today: string;
  t: Dictionary;
  totalPartnerCapital: number;
  netPLAfterFee: number;
  cattleValuation: CattleValuation;
  totalAssetValue: number;
}

export function AddPartnerDialog({
  today,
  t,
  totalPartnerCapital,
  netPLAfterFee,
  cattleValuation,
  totalAssetValue,
}: Props) {
  const [open, setOpen] = useState(false);
  const [partnerTypeField, setPartnerTypeField] = useState<PartnerType>("capital");
  const [shareModeField, setShareModeField] = useState<"auto" | "manual">("auto");
  const [bearsLossField, setBearsLossField] = useState(true);
  const [newInvestmentAmt, setNewInvestmentAmt] = useState("");
  const [state, action, pending] = useActionState(createPartner, undefined);

  useEffect(() => {
    if (state?.success) {
      setTimeout(() => {
        toast.success("Partner added");
        setOpen(false);
        setNewInvestmentAmt("");
      }, 0);
    }
  }, [state]);

  const cattleMarketValue = cattleValuation.hasMarketPrice
    ? cattleValuation.totalEstimatedValue
    : cattleValuation.totalActiveCostBasis;
  const preMoneyValuation = Math.max(
    0,
    totalPartnerCapital + netPLAfterFee + cattleMarketValue + totalAssetValue
  );

  const newInvNum = parseFloat(newInvestmentAmt) || 0;
  const postMoneyVal = preMoneyValuation + newInvNum;
  const suggestedPct =
    postMoneyVal > 0 && newInvNum > 0
      ? Math.min(100, (newInvNum / postMoneyVal) * 100)
      : 0;

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
            fd.set("entry_netpl", String(netPLAfterFee));
            fd.set("entry_valuation", String(preMoneyValuation));
            action(fd);
          }}
          className="space-y-4"
        >
          {/* Valuation Calculator */}
          <div className="rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
              Business Valuation
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <span className="text-muted-foreground">Partner capital</span>
              <span className="text-right tabular-nums font-medium">{bdt(totalPartnerCapital)}</span>
              <span className="text-muted-foreground">Undistributed P&amp;L</span>
              <span className={cn("text-right tabular-nums font-medium", netPLAfterFee >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                {netPLAfterFee >= 0 ? "+" : "−"}{bdt(netPLAfterFee)}
              </span>
              <span className="text-muted-foreground">Cattle value</span>
              <span className="text-right tabular-nums font-medium">{bdt(cattleMarketValue)}</span>
              {totalAssetValue > 0 && (
                <>
                  <span className="text-muted-foreground">Fixed assets</span>
                  <span className="text-right tabular-nums font-medium">{bdt(totalAssetValue)}</span>
                </>
              )}
              <span className="font-semibold text-amber-800 dark:text-amber-300 border-t border-amber-200 dark:border-amber-700 pt-1">Pre-money</span>
              <span className="text-right tabular-nums font-bold text-amber-800 dark:text-amber-300 border-t border-amber-200 dark:border-amber-700 pt-1">{bdt(preMoneyValuation)}</span>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">New investment amount</label>
              <Input
                type="number"
                min="0"
                step="1000"
                placeholder="e.g. 200000"
                value={newInvestmentAmt}
                onChange={(e) => setNewInvestmentAmt(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            {newInvNum > 0 && (
              <div className="rounded-md bg-amber-100 dark:bg-amber-900/30 px-2.5 py-2 flex items-center justify-between">
                <span className="text-xs text-amber-800 dark:text-amber-300">Suggested share %</span>
                <span className="text-sm font-bold tabular-nums text-amber-800 dark:text-amber-300">
                  {suggestedPct.toFixed(1)}%
                </span>
              </div>
            )}
          </div>

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
              <FormField label="Cliff Period (months)" id="pcliff">
                <Input id="pcliff" name="cliff_months" type="number" min="0" step="1" defaultValue="0" />
                <p className="text-xs text-muted-foreground mt-1">Months before labor units start vesting (0 = immediate)</p>
              </FormField>
            </>
          )}

          <FormField label="Share Mode">
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
                  {mode === "auto" ? "Auto (Ratio-Based)" : "Manual %"}
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
                  defaultValue={suggestedPct > 0 ? suggestedPct.toFixed(1) : "0"}
                  key={suggestedPct.toFixed(1)}
                />
                {suggestedPct > 0 && (
                  <span className="text-xs text-amber-700 dark:text-amber-400 whitespace-nowrap">
                    ← suggested
                  </span>
                )}
              </div>
            </FormField>
          )}

          {partnerTypeField !== "labor" && (
            <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-card">
              <div className="space-y-0.5">
                <Label htmlFor="add-bears-loss" className="text-base">Bears Capital Loss</Label>
                <p className="text-xs text-muted-foreground">Does this partner take a share of business losses?</p>
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

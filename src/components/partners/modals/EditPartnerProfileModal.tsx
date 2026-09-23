"use client";

import { useState, useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updatePartner } from "@/app/dashboard/(app)/partners/actions";
import type { Partner, PartnerType } from "@/types/database";
import { toast } from "sonner";

interface Props {
  partner: Partner;
  totalInvested: number;
  onClose: () => void;
}

export function EditPartnerProfileModal({
  partner: p,
  totalInvested,
  onClose,
}: Props) {
  const [partnerTypeField, setPartnerTypeField] = useState<PartnerType>(
    p.partner_type ?? "capital"
  );
  const [shareModeField, setShareModeField] = useState<"auto" | "manual">(
    p.share_mode ?? "auto"
  );
  const [bearsLossField, setBearsLossField] = useState(p.bears_loss ?? true);
  const [state, action, pending] = useActionState(updatePartner, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Partner updated");
      onClose();
    }
  }, [state, onClose]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Partner — {p.name}</DialogTitle>
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
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input name="name" required defaultValue={p.name} />
          </div>

          <div className="space-y-1.5">
            <Label>Partner Type</Label>
            <Select
              value={partnerTypeField}
              onValueChange={(v) => {
                const val = v as PartnerType;
                setPartnerTypeField(val);
                if (val === "labor") setShareModeField("manual");
                else if (val === "capital") setShareModeField("auto");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="capital">Capital Partner</SelectItem>
                <SelectItem value="labor">Labor Partner</SelectItem>
                <SelectItem value="hybrid">Capital + Labor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {partnerTypeField !== "labor" && (
            <div className="space-y-1.5">
              <Label>Total Capital Invested (৳)</Label>
              <Input
                name="investment_amount"
                type="number"
                min="0"
                step="100"
                defaultValue={totalInvested}
              />
              <p className="text-xs text-muted-foreground">
                Capital is tracked via the ledger — use it to add or edit investments.
              </p>
            </div>
          )}

          {partnerTypeField !== "capital" && (
            <>
              <div className="space-y-1.5">
                <Label>Monthly Labor Value (৳/mo)</Label>
                <Input
                  name="labor_value_monthly"
                  type="number"
                  min="0"
                  step="500"
                  defaultValue={p.labor_value_monthly ?? 0}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cliff Period (months)</Label>
                <Input
                  name="cliff_months"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={p.cliff_months ?? 0}
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Profit Share Calculation Mode</Label>
            <Select
              value={shareModeField}
              onValueChange={(v) =>
                setShareModeField(v as "auto" | "manual")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  Auto — Proportional to investment / labor
                </SelectItem>
                <SelectItem value="manual">Manual — Fixed %</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {shareModeField === "manual" && (
            <div className="space-y-1.5">
              <Label>Manual Profit Share % (0–100)</Label>
              <Input
                name="profit_share_pct"
                type="number"
                min="0"
                max="100"
                step="0.5"
                defaultValue={p.profit_share_pct}
              />
            </div>
          )}

          {partnerTypeField !== "labor" && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Bears Capital Loss</p>
                <p className="text-xs text-muted-foreground">
                  Participates in business losses
                </p>
              </div>
              <input
                type="checkbox"
                name="bears_loss"
                value="true"
                checked={bearsLossField}
                onChange={(e) => setBearsLossField(e.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-primary"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Join Date</Label>
            <Input name="joined_at" type="date" defaultValue={p.joined_at} />
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              name="notes"
              rows={2}
              maxLength={500}
              defaultValue={p.notes ?? ""}
            />
          </div>

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

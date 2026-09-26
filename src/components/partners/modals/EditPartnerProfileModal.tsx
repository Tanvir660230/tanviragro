"use client";

import { useState, useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { updatePartner } from "@/app/dashboard/(app)/partners/actions";
import type { Partner, PartnerType } from "@/types/database";
import { toast } from "sonner";
import { useL } from "@/i18n/text";

interface Props {
  partner: Partner;
  onClose: () => void;
}

/** Name, type, labour value, join date, notes. The share (and loss) is changed with a dated share rule. */
export function EditPartnerProfileModal({ partner: p, onClose }: Props) {
  const L = useL();
  const [partnerTypeField, setPartnerTypeField] = useState<PartnerType>(p.partner_type ?? "capital");
  const [state, action, pending] = useActionState(updatePartner, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success(L("অংশীদার আপডেট হলো", "Partner updated"));
      onClose();
    }
  }, [state, onClose, L]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{L("অংশীদার বদলান", "Edit partner")} — {p.name}</DialogTitle>
        </DialogHeader>
        <form action={(fd) => { fd.set("partner_id", p.id); fd.set("partner_type", partnerTypeField); action(fd); }} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{L("নাম *", "Name *")}</Label>
            <Input name="name" required defaultValue={p.name} />
          </div>

          <div className="space-y-1.5">
            <Label>{L("অংশীদারের ধরন", "Partner Type")}</Label>
            <Select value={partnerTypeField} onValueChange={(v) => setPartnerTypeField(v as PartnerType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="capital">{L("মূলধন অংশীদার", "Capital Partner")}</SelectItem>
                <SelectItem value="labor">{L("শ্রম অংশীদার", "Labor Partner")}</SelectItem>
                <SelectItem value="hybrid">{L("মূলধন + শ্রম", "Capital + Labor")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {partnerTypeField !== "capital" && (
            <>
              <div className="space-y-1.5">
                <Label>{L("মাসিক শ্রমের মূল্য (৳/মাস)", "Monthly Labor Value (৳/mo)")}</Label>
                <Input name="labor_value_monthly" type="number" min="0" step="500" defaultValue={p.labor_value_monthly ?? 0} />
              </div>
              <div className="space-y-1.5">
                <Label>{L("অপেক্ষার সময় (মাস)", "Cliff Period (months)")}</Label>
                <Input name="cliff_months" type="number" min="0" step="1" defaultValue={p.cliff_months ?? 0} />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>{L("যোগদানের তারিখ", "Join Date")}</Label>
            <Input name="joined_at" type="date" defaultValue={p.joined_at} />
          </div>

          <div className="space-y-1.5">
            <Label>{L("নোট", "Notes")}</Label>
            <Textarea name="notes" rows={2} maxLength={500} defaultValue={p.notes ?? ""} />
          </div>

          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {L("লাভের ভাগ বা ক্ষতির ভাগ বদলাতে প্রোফাইলের \"ভাগের নিয়ম\" অংশে নতুন নিয়ম দিন — কবে থেকে তা লিখে।",
               "To change the profit or loss share, add a new rule in \"Share rules\" on the profile — with the date it starts.")}
          </p>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>{L("বাতিল", "Cancel")}</Button>
            <Button type="submit" disabled={pending}>{pending ? L("সেভ হচ্ছে…", "Saving…") : L("সেভ করুন", "Save changes")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

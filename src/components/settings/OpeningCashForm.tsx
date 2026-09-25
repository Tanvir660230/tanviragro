"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { saveOpeningCash } from "@/app/dashboard/(app)/settings/actions";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useL } from "@/i18n/text";

export function OpeningCashForm({ initialValue }: { initialValue: number }) {
  const L = useL();
  const [value, setValue] = useState(initialValue > 0 ? String(initialValue) : "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const amount = parseFloat(value) || 0;
    startTransition(async () => {
      const res = await saveOpeningCash(amount);
      if (res.error) toast.error(res.error);
      else toast.success(L("শুরুর নগদ সেভ হলো", "Opening cash balance saved successfully"));
    });
  }

  return (
    <div className="space-y-3 max-w-sm">
      <div className="space-y-1.5">
        <Label htmlFor="opening_cash" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {L("শুরুর নগদ (৳)", "Initial Cash Balance (BDT)")}
        </Label>
        <div className="relative flex items-center">
          <span className="absolute left-3 font-semibold text-muted-foreground text-sm">৳</span>
          <Input
            id="opening_cash"
            type="number"
            min={0}
            step={1000}
            placeholder="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="pl-8 h-10 font-mono text-sm"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {L("হিসাব শুরুর দিন হাতে যে টাকা ছিল।", "Starting balance for your cash ledger when setting up bookkeeping.")}
        </p>
      </div>
      <Button size="sm" onClick={handleSave} disabled={isPending} className="gap-1.5 shadow-sm">
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        {L("সেভ করুন", "Save Cash Balance")}
      </Button>
    </div>
  );
}

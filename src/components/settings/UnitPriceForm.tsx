"use client";

import { useActionState, useEffect } from "react";
import { saveUnitPrice } from "@/app/dashboard/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";

export function UnitPriceForm({ initialPrice }: { initialPrice: number }) {
  const [state, action, pending] = useActionState(saveUnitPrice, undefined);

  useEffect(() => {
    if (state?.success) toast.success(state.success);
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="space-y-3 max-w-sm">
      <div className="space-y-1.5">
        <Label htmlFor="unit_price_bdt" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Valuation per Unit Share (BDT)
        </Label>
        <div className="relative flex items-center">
          <span className="absolute left-3 font-semibold text-muted-foreground text-sm">৳</span>
          <Input
            id="unit_price_bdt"
            name="unit_price_bdt"
            type="number"
            min="100"
            step="100"
            defaultValue={initialPrice}
            className="pl-8 h-10 font-mono text-sm"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Each ৳{(initialPrice || 0).toLocaleString("en-IN")} invested equals 1 unit share. Labor partners also earn unit equity at this baseline.
        </p>
      </div>

      <Button type="submit" size="sm" disabled={pending} className="gap-1.5 shadow-sm">
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        Save Unit Valuation
      </Button>
    </form>
  );
}

"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateTaxSettings } from "@/app/dashboard/(app)/settings/actions";
import { Loader2, CheckCircle2, Percent } from "lucide-react";

export function TaxForm({ initialRate }: { initialRate?: number }) {
  const [state, action, isPending] = useActionState(updateTaxSettings, undefined);

  useEffect(() => {
    if (state?.success) toast.success(state.success);
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="space-y-3 max-w-sm">
      <div className="space-y-1.5">
        <Label htmlFor="tax_rate" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Default VAT / Tax Rate (%)
        </Label>
        <div className="relative flex items-center">
          <Input 
            id="tax_rate"
            type="number" 
            step="0.01"
            min={0}
            max={100}
            name="tax_rate"
            defaultValue={initialRate ?? 0}
            className="pr-8 h-10 font-mono text-sm" 
          />
          <Percent className="absolute right-3 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
        <p className="text-xs text-muted-foreground">
          Auto-applied to new vendor invoices and expense receipts by default.
        </p>
      </div>
      <Button type="submit" size="sm" disabled={isPending} className="gap-1.5 shadow-sm">
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        Save Tax Rate
      </Button>
    </form>
  );
}

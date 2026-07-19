"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateTaxSettings } from "@/app/dashboard/(app)/settings/actions";

export function TaxForm({ initialRate }: { initialRate?: number }) {
  const [state, action, isPending] = useActionState(updateTaxSettings, undefined);

  useEffect(() => {
    if (state?.success) toast.success(state.success);
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-2">
        <label className="text-sm font-medium">Default VAT/Tax Rate (%)</label>
        <div className="flex gap-2">
          <input 
            type="number" 
            step="0.01"
            name="tax_rate"
            defaultValue={initialRate ?? 0}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-card transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-w-[150px]" 
          />
          <Button disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">This rate applies to all new vendor invoices by default.</p>
      </div>
    </form>
  );
}

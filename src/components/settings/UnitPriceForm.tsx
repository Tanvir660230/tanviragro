"use client";

import { useActionState } from "react";
import { saveUnitPrice } from "@/app/dashboard/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UnitPriceForm({ initialPrice }: { initialPrice: number }) {
  const [state, action, pending] = useActionState(saveUnitPrice, undefined);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="unit_price_bdt">Price per unit (৳)</Label>
        <Input
          id="unit_price_bdt"
          name="unit_price_bdt"
          type="number"
          min="100"
          step="100"
          defaultValue={initialPrice}
          className="w-40"
        />
        <p className="text-xs text-muted-foreground">
          Each ৳{initialPrice.toLocaleString("en-IN")} invested = 1 unit.
          Labor partners also earn units at this rate per month.
        </p>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-600 dark:text-emerald-400">{state.success}</p>}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving..." : "Save Unit Price"}
      </Button>
    </form>
  );
}

"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * OPTIONAL kg in one stock unit. Hidden for kg items (always 1). Items such as straw are
 * bought, stocked and costed per piece (pieces × cost per piece) — this is never required.
 * Empty = no conversion: kg-based ration plans are simply not converted for this item.
 */
export function KgPerUnitField({ unit, defaultValue, idPrefix }: { unit: string; defaultValue?: number | null; idPrefix: string }) {
  if (!unit.trim() || unit.trim().toLowerCase() === "kg") return null;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${idPrefix}_kg_per_unit`}>kg per {unit} <span className="font-normal text-muted-foreground">(optional)</span></Label>
      <Input
        id={`${idPrefix}_kg_per_unit`}
        name="kg_per_unit"
        type="number"
        min="0.001"
        step="0.001"
        defaultValue={defaultValue ?? ""}
        placeholder="Leave empty — not needed"
      />
      <p className="text-xs text-muted-foreground">
        This item is stocked and costed per {unit} ({unit}s × cost per {unit}). Fill this only if you want
        kg-based ration plans to be shown in {unit}s.
      </p>
    </div>
  );
}

/** Shown when the entered unit price is 0: the user must say whether it was really free. */
export function ZeroPriceConfirm({ unitCost, idPrefix }: { unitCost: string; idPrefix: string }) {
  if (unitCost.trim() === "" || parseFloat(unitCost) !== 0) return null;
  return (
    <label htmlFor={`${idPrefix}_zero_confirmed`} className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50/60 p-2.5 text-xs dark:border-amber-900/60 dark:bg-amber-950/20">
      <input id={`${idPrefix}_zero_confirmed`} name="zero_confirmed" type="checkbox" className="mt-0.5" />
      <span>
        This stock was really free (৳0). If you leave this unticked, it is saved as
        <strong> price not confirmed</strong> and shown for review.
      </span>
    </label>
  );
}

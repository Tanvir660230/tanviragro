"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { saveOpeningCash } from "@/app/dashboard/(app)/settings/actions";
import { toast } from "sonner";

export function OpeningCashForm({ initialValue }: { initialValue: number }) {
  const [value, setValue] = useState(initialValue > 0 ? String(initialValue) : "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const amount = parseFloat(value) || 0;
    startTransition(async () => {
      const res = await saveOpeningCash(amount);
      if (res.error) toast.error(res.error);
      else toast.success("Opening cash balance saved");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Label htmlFor="opening_cash" className="shrink-0 text-sm">৳</Label>
        <Input
          id="opening_cash"
          type="number"
          min={0}
          step={1000}
          placeholder="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-8 text-sm"
        />
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          Save
        </Button>
      </div>
    </div>
  );
}

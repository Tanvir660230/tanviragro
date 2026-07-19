"use client";

import { useActionState } from "react";
import { saveDailyGain } from "@/app/dashboard/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DailyGainForm({ initialGain }: { initialGain: number }) {
  const [state, action, pending] = useActionState(saveDailyGain, undefined);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="default_daily_gain_kg">Average daily weight gain (kg/day)</Label>
        <Input
          id="default_daily_gain_kg"
          name="default_daily_gain_kg"
          type="number"
          min="0.1"
          max="5"
          step="0.1"
          defaultValue={initialGain}
          className="w-32"
        />
        <p className="text-xs text-muted-foreground">
          Used to estimate current cattle weight when no weigh-in has been recorded.
          Typical range: 0.5–1.0 kg/day for beef cattle.
        </p>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-600 dark:text-emerald-400">{state.success}</p>}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving..." : "Save Growth Rate"}
      </Button>
    </form>
  );
}

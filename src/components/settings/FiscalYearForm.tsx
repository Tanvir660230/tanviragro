"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateFiscalYear } from "@/app/dashboard/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function FiscalYearForm({ initialMonth }: { initialMonth: number }) {
  const [state, action, pending] = useActionState(updateFiscalYear, undefined);

  useEffect(() => {
    if (state?.success) toast.success(state.success);
    if (state?.error)   toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <label htmlFor="fiscal_month" className="text-xs font-medium text-muted-foreground">
          Fiscal Year Starts In
        </label>
        <select
          id="fiscal_month"
          name="fiscal_year_start_month"
          defaultValue={initialMonth}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-card focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Bangladesh standard: July (month 7). Affects &quot;This Year&quot; in Finance reports.
        </p>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
        Save
      </Button>
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

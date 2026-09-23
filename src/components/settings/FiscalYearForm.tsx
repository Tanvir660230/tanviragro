"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateFiscalYear } from "@/app/dashboard/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, Calendar } from "lucide-react";

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July (Bangladesh Standard: July 1 – June 30)" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

export function FiscalYearForm({ initialMonth }: { initialMonth: number }) {
  const [state, action, pending] = useActionState(updateFiscalYear, undefined);

  useEffect(() => {
    if (state?.success) toast.success(state.success);
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="space-y-3 max-w-md">
      <div className="space-y-1.5">
        <Label htmlFor="fiscal_month" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Fiscal Year Commencement Month
        </Label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <select
            id="fiscal_month"
            name="fiscal_year_start_month"
            defaultValue={initialMonth}
            className="w-full pl-9 pr-4 h-10 rounded-lg border border-input bg-background text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-muted-foreground">
          Determines the 12-month accounting cycle for Profit & Loss and financial statements.
        </p>
      </div>
      <Button type="submit" size="sm" disabled={pending} className="gap-1.5 shadow-sm">
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        Save Fiscal Cycle
      </Button>
      {state?.error && <p className="text-xs text-destructive font-medium">{state.error}</p>}
    </form>
  );
}

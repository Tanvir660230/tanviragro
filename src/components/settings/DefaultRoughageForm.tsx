"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateDefaultRoughage } from "@/app/dashboard/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const ROUGHAGE_OPTIONS = [
  { id: "straw",  label: "খড় / Straw",        hint: "DM 90% — most common in Bangladesh" },
  { id: "hay",    label: "হে / Hay",            hint: "DM 85%"                              },
  { id: "silage", label: "সাইলেজ / Silage",    hint: "DM 35%"                              },
  { id: "grass",  label: "সবুজ ঘাস / Grass",   hint: "DM 20%"                              },
] as const;

export function DefaultRoughageForm({ initialType }: { initialType: string }) {
  const [state, action, pending] = useActionState(updateDefaultRoughage, undefined);

  useEffect(() => {
    if (state?.success) toast.success(state.success);
    if (state?.error)   toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ROUGHAGE_OPTIONS.map((opt) => (
          <label key={opt.id} className="cursor-pointer">
            <input
              type="radio"
              name="default_roughage_type"
              value={opt.id}
              defaultChecked={opt.id === initialType}
              className="sr-only peer"
            />
            <div className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm transition-all peer-checked:border-primary peer-checked:bg-primary/5 peer-checked:text-primary hover:border-primary/40">
              <p className="font-medium text-xs">{opt.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{opt.hint}</p>
            </div>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Used in daily feed requirement calculations for all cattle. Can be overridden per cow.
      </p>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
        Save Roughage Default
      </Button>
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

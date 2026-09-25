"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateDefaultRoughage } from "@/app/dashboard/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useL } from "@/i18n/text";

const ROUGHAGE_OPTIONS = [
  { id: "straw",  label: "খড় / Straw",        dm: "90% DM", hint: "Most common baseline in Bangladesh", hintBn: "বাংলাদেশে সবচেয়ে বেশি" },
  { id: "hay",    label: "হে / Hay",            dm: "85% DM", hint: "Preserved dry grass", hintBn: "শুকানো ঘাস" },
  { id: "silage", label: "সাইলেজ / Silage",    dm: "35% DM", hint: "Fermented green fodder", hintBn: "গাঁজানো সবুজ ঘাস" },
  { id: "grass",  label: "সবুজ ঘাস / Grass",   dm: "20% DM", hint: "Fresh pasture / Napier", hintBn: "তাজা ঘাস / নেপিয়ার" },
] as const;

export function DefaultRoughageForm({ initialType }: { initialType: string }) {
  const L = useL();
  const [state, action, pending] = useActionState(updateDefaultRoughage, undefined);

  useEffect(() => {
    if (state?.success) toast.success(state.success);
    if (state?.error)   toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {ROUGHAGE_OPTIONS.map((opt) => (
          <label key={opt.id} className="relative cursor-pointer block">
            <input
              type="radio"
              name="default_roughage_type"
              value={opt.id}
              defaultChecked={opt.id === initialType}
              className="sr-only peer"
            />
            <div className="h-full rounded-xl border-2 border-border/70 bg-card p-3.5 transition-all peer-checked:border-primary peer-checked:bg-primary/5 peer-checked:shadow-sm hover:border-primary/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-semibold text-sm text-foreground">{opt.label}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono font-medium text-muted-foreground peer-checked:bg-primary/15 peer-checked:text-primary">
                    {opt.dm}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{L(opt.hintBn, opt.hint)}</p>
              </div>
            </div>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {L("প্রতিটি গরুর দৈনিক শুকনো খাবার (DMI) ও খড়/ঘাসের পরিমাণ এ থেকে হিসাব হয়। গরুভেদে বদলানো যায়।", "Auto-calculates daily dry matter intake (DMI) and roughage allocation for each cattle profile. Can be overridden per cow.")}
      </p>
      <Button type="submit" size="sm" disabled={pending} className="gap-1.5 shadow-sm">
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        {L("সেভ করুন", "Save Roughage Formulation")}
      </Button>
      {state?.error && <p className="text-xs text-destructive font-medium">{state.error}</p>}
    </form>
  );
}

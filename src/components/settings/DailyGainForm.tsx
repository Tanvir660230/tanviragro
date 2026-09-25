"use client";

import { useActionState, useEffect } from "react";
import { saveDailyGain } from "@/app/dashboard/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useL } from "@/i18n/text";

export function DailyGainForm({ initialGain }: { initialGain: number }) {
  const L = useL();
  const [state, action, pending] = useActionState(saveDailyGain, undefined);

  useEffect(() => {
    if (state?.success) toast.success(state.success);
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="space-y-3 max-w-sm">
      <div className="space-y-1.5">
        <Label htmlFor="default_daily_gain_kg" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {L("দৈনিক ওজন বৃদ্ধি (কেজি/দিন)", "Estimated Daily Weight Gain (kg / day)")}
        </Label>
        <div className="relative flex items-center">
          <Input
            id="default_daily_gain_kg"
            name="default_daily_gain_kg"
            type="number"
            min="0.1"
            max="5"
            step="0.05"
            defaultValue={initialGain}
            className="pr-12 h-10 font-mono text-sm"
          />
          <span className="absolute right-3 text-xs font-medium text-muted-foreground">kg/day</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {L("সাম্প্রতিক ওজন না থাকলে বর্তমান ওজন আন্দাজে এটা ব্যবহার হয়।", "Standard growth benchmark used for live weight estimation when recent scale readings are absent.")}
        </p>
      </div>

      <Button type="submit" size="sm" disabled={pending} className="gap-1.5 shadow-sm">
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        {L("সেভ করুন", "Save Growth Rate")}
      </Button>
    </form>
  );
}

"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveManagementFeeRate, deleteManagementFeeRate } from "@/app/dashboard/(app)/settings/actions";
import type { SettingsFormState } from "@/app/dashboard/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ManagementFeeRate } from "@/types/database";
import { Percent, CalendarDays, Trash2, Info } from "lucide-react";
import { useL } from "@/i18n/text";
import { todayDhaka } from "@/lib/dates";

interface Props {
  currentRate: ManagementFeeRate | null;
  history: ManagementFeeRate[];
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function DeleteButton({ id }: { id: string }) {
  const L = useL();
  const [, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => {
        startTransition(async () => {
          const res = await deleteManagementFeeRate(id);
          if (res.error) toast.error(res.error);
          else toast.success(L("হার মুছে ফেলা হলো", "Rate entry removed"));
        });
      }}
      className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
      title={L("মুছুন", "Delete this entry")}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

const FEE_HISTORY_LIMIT = 3;

export function ManagementFeeForm({ currentRate, history }: Props) {
  const L = useL();
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(
    saveManagementFeeRate, undefined
  );

  useEffect(() => {
    if (state?.success) toast.success(state.success);
    if (state?.error) toast.error(state.error);
  }, [state]);

  const today = todayDhaka();

  return (
    <div className="space-y-5">
      {/* Current rate banner */}
      <div className="flex items-start gap-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 px-5 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
          <Percent className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{L("বর্তমান ম্যানেজমেন্ট ফি", "Current Management Fee")}</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
            {currentRate ? `${currentRate.rate_percent}%` : L("দেওয়া নেই", "Not set")}
          </p>
          {currentRate && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Effective from {fmtDate(currentRate.effective_from)}
            </p>
          )}
        </div>
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground max-w-[180px]">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{L("অংশীদারদের ভাগের আগে মোট লাভ থেকে কাটা হয়", "Deducted from total profit before splitting with partners")}</span>
        </div>
      </div>

      {/* Set new rate form */}
      <form action={action} className="space-y-3">
        <p className="text-sm font-medium">{L("নতুন হার দিন", "Set New Rate")}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="mgmt_rate" className="text-xs">{L("হার", "Fee Rate")}</Label>
            <div className="relative">
              <Input
                id="mgmt_rate"
                name="rate_percent"
                type="number"
                min="0"
                max="100"
                step="0.5"
                placeholder="e.g. 15"
                className="pr-8"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mgmt_from" className="text-xs">{L("কবে থেকে", "Effective From")}</Label>
            <Input
              id="mgmt_from"
              name="effective_from"
              type="date"
              defaultValue={today}
              required
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {L("এই তারিখ ও পরের সব লাভ ভাগে নতুন হার লাগবে। আগের ভাগ বদলাবে না।", "The new rate applies to profit distributions on or after this date. Earlier ones are unaffected.")}
        </p>
        {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
        <Button type="submit" size="sm" disabled={pending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          {pending ? L("সেভ হচ্ছে…", "Saving…") : L("হার সেভ করুন", "Save rate")}
        </Button>
      </form>

      {/* Rate history */}
      {history.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-sm font-medium">{L("আগের হার", "Rate History")}</p>
          </div>
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border/60">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {L("কবে থেকে", "Effective From")}
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {L("হার", "Rate")}
                  </th>
                  <th className="w-8 px-2 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {(showAllHistory ? history : history.slice(0, FEE_HISTORY_LIMIT)).map((r, i) => (
                  <tr key={r.id} className={i === 0 ? "bg-emerald-50/50 dark:bg-emerald-950/10" : ""}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span>{fmtDate(r.effective_from)}</span>
                        {i === 0 && (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-950/50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            {L("বর্তমান", "Current")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      {r.rate_percent}%
                    </td>
                    <td className="px-2 py-3 text-right">
                      {i !== 0 && <DeleteButton id={r.id} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!showAllHistory && history.length > FEE_HISTORY_LIMIT && (
              <div className="border-t border-border/40 px-4 py-3 text-center">
                <button
                  type="button"
                  onClick={() => setShowAllHistory(true)}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  Show {history.length - FEE_HISTORY_LIMIT} older rate{history.length - FEE_HISTORY_LIMIT !== 1 ? "s" : ""}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

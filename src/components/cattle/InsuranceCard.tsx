"use client";

import { useState, useTransition } from "react";
import { Shield, Pencil, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { updateInsurance } from "@/app/dashboard/(app)/cattle/actions";

type Props = {
  cattleId: string;
  provider: string | null;
  amount: number | null;
  expiry: string | null;
};

function daysUntil(dateStr: string, now: number) {
  return Math.ceil((new Date(dateStr + "T00:00:00").getTime() - now) / 86400000);
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export function InsuranceCard({ cattleId, provider, amount, expiry }: Props) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [now] = useState(() => Date.now());

  const [form, setForm] = useState({
    insurance_provider: provider ?? "",
    insurance_amount: amount ? String(amount) : "",
    insurance_expiry: expiry ?? "",
  });

  const hasInsurance = !!provider || !!expiry || !!amount;
  const daysLeft = expiry ? daysUntil(expiry, now) : null;
  const expired = daysLeft !== null && daysLeft < 0;
  const expiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;

  function handleSave() {
    startTransition(async () => {
      const r = await updateInsurance(cattleId, {
        insurance_provider: form.insurance_provider.trim() || null,
        insurance_amount: form.insurance_amount ? parseFloat(form.insurance_amount) : null,
        insurance_expiry: form.insurance_expiry || null,
      });
      if (r.error) toast.error(r.error);
      else {
        toast.success("????? ???? ????? ??????");
        setEditing(false);
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-blue-500" />
          <h3 className="font-semibold text-sm">???????? ????</h3>
        </div>
        <button
          onClick={() => setEditing(!editing)}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">???? ????????</label>
            <input
              value={form.insurance_provider}
              onChange={(e) => setForm((f) => ({ ...f, insurance_provider: e.target.value }))}
              placeholder="????: Delta Life, Pragati"
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">????? ????? (?)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={form.insurance_amount}
                onChange={(e) => setForm((f) => ({ ...f, insurance_amount: e.target.value }))}
                placeholder="50000"
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">?????? ???</label>
              <input
                type="date"
                value={form.insurance_expiry}
                onChange={(e) => setForm((f) => ({ ...f, insurance_expiry: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditing(false)} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">?????</button>
            <button onClick={handleSave} disabled={isPending} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {isPending ? "??????? ?????..." : "??????? ????"}
            </button>
          </div>
        </div>
      ) : !hasInsurance ? (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">???? ???? ???</p>
          <button onClick={() => setEditing(true)} className="mt-2 text-xs text-primary hover:underline">+ ???? ??? ????</button>
        </div>
      ) : (
        <div className="space-y-2">
          {provider && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">????????</span>
              <span className="font-medium">{provider}</span>
            </div>
          )}
          {amount && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">????? ?????</span>
              <span className="font-medium">?{Math.round(amount).toLocaleString("en-IN")}</span>
            </div>
          )}
          {expiry && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">?????? ???</span>
              <div className="flex items-center gap-1.5">
                {expired ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                ) : expiringSoon ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                )}
                <span className={`font-medium ${expired ? "text-destructive" : expiringSoon ? "text-amber-600 dark:text-amber-400" : ""}`}>
                  {fmtDate(expiry)}
                  {expired ? " (?????? ???)" : expiringSoon ? ` (${daysLeft} ??? ????)` : ""}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { toggleAccountingPeriodLockAction } from "@/app/dashboard/(app)/finance/financial-engine-actions";

export function AccountingPeriodLockModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string) => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await toggleAccountingPeriodLockAction({
      lockName: String(fd.get("lockName") || ""),
      startDate: String(fd.get("startDate") || ""),
      endDate: String(fd.get("endDate") || ""),
      isLocked: fd.get("isLocked") === "true",
      reason: String(fd.get("reason") || ""),
    });
    setIsSubmitting(false);
    if (res?.error) setError(res.error);
    else onSuccess(`Accounting period lock successfully saved.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-xl p-6 space-y-4">
        <div className="flex justify-between items-center border-b border-border/60 pb-3">
          <h3 className="text-sm font-bold text-foreground">Accounting Period Lock</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs font-semibold">✕</button>
        </div>
        {error && <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-foreground">Period Name</label>
            <input type="text" name="lockName" defaultValue="FY2026 Q1 Audited Lock" required className="w-full mt-1 p-2 rounded-xl border border-border bg-background" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold text-foreground">Start Date</label>
              <input type="date" name="startDate" required className="w-full mt-1 p-2 rounded-xl border border-border bg-background" />
            </div>
            <div>
              <label className="font-semibold text-foreground">End Date</label>
              <input type="date" name="endDate" required className="w-full mt-1 p-2 rounded-xl border border-border bg-background" />
            </div>
          </div>
          <div>
            <label className="font-semibold text-foreground">Status</label>
            <select name="isLocked" defaultValue="true" className="w-full mt-1 p-2 rounded-xl border border-border bg-background">
              <option value="true">Locked (Prevent edits)</option>
              <option value="false">Unlocked (Allow transactions)</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold">
              {isSubmitting ? "Updating..." : "Save Lock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { runBiologicalAssetRevaluationAction } from "@/app/dashboard/(app)/finance/financial-engine-actions";

export function BiologicalValuationModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string) => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await runBiologicalAssetRevaluationAction({
      marketRatePerKg: Number(fd.get("marketRatePerKg")),
      notes: String(fd.get("notes") || ""),
    });
    setIsSubmitting(false);
    if (res?.error) setError(res.error);
    else onSuccess(`IAS 41 Valuation posted (${res?.valuation?.valuationNumber || ""}).`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-xl p-6 space-y-4">
        <div className="flex justify-between items-center border-b border-border/60 pb-3">
          <h3 className="text-sm font-bold text-foreground">IAS 41 Biological Asset Valuation</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs font-semibold">✕</button>
        </div>
        {error && <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-foreground">Market Live Weight Rate (৳/kg)</label>
            <input type="number" name="marketRatePerKg" defaultValue="450" required min="50" step="5" className="w-full mt-1 p-2 rounded-xl border border-border bg-background" />
          </div>
          <div>
            <label className="font-semibold text-foreground">Notes</label>
            <input type="text" name="notes" placeholder="e.g. Month-end IAS 41 revaluation" className="w-full mt-1 p-2 rounded-xl border border-border bg-background" />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold">
              {isSubmitting ? "Calculating..." : "Post Revaluation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

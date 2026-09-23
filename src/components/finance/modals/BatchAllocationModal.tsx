"use client";

import React, { useState } from "react";
import { runBatchCostAllocationAction } from "@/app/dashboard/(app)/finance/financial-engine-actions";
import type { AllocationMethod, TargetScope } from "@/lib/financial";

export function BatchAllocationModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string) => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await runBatchCostAllocationAction({
      sourceCategory: String(fd.get("sourceCategory") || ""),
      totalAmount: Number(fd.get("totalAmount")),
      allocationMethod: fd.get("allocationMethod") as AllocationMethod,
      targetScope: fd.get("targetScope") as TargetScope,
      notes: String(fd.get("notes") || ""),
    });
    setIsSubmitting(false);
    if (res?.error) setError(res.error);
    else onSuccess(`Overhead allocated across ${res?.recipientsCount || 0} cattle (${res?.batchNumber || ""}).`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-xl p-6 space-y-4">
        <div className="flex justify-between items-center border-b border-border/60 pb-3">
          <h3 className="text-sm font-bold text-foreground">Batch Overhead Allocation</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs font-semibold">✕</button>
        </div>
        {error && <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-foreground">Category</label>
            <input type="text" name="sourceCategory" defaultValue="Bulk Feed & Silage" required className="w-full mt-1 p-2 rounded-xl border border-border bg-background" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold text-foreground">Amount (৳)</label>
              <input type="number" name="totalAmount" required step="0.01" min="1" className="w-full mt-1 p-2 rounded-xl border border-border bg-background" />
            </div>
            <div>
              <label className="font-semibold text-foreground">Method</label>
              <select name="allocationMethod" defaultValue="head_count" className="w-full mt-1 p-2 rounded-xl border border-border bg-background">
                <option value="head_count">Head Count (Equal)</option>
                <option value="weight_proportional">Live Weight</option>
                <option value="feed_days">Days on Feed</option>
              </select>
            </div>
          </div>
          <div>
            <label className="font-semibold text-foreground">Scope</label>
            <select name="targetScope" defaultValue="all_active" className="w-full mt-1 p-2 rounded-xl border border-border bg-background">
              <option value="all_active">All Active Herd</option>
              <option value="farm">By Farm</option>
              <option value="pen">By Pen</option>
              <option value="breed">By Breed</option>
            </select>
          </div>
          <div>
            <label className="font-semibold text-foreground">Notes</label>
            <input type="text" name="notes" placeholder="Batch allocation purpose" className="w-full mt-1 p-2 rounded-xl border border-border bg-background" />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold">
              {isSubmitting ? "Allocating..." : "Execute Allocation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

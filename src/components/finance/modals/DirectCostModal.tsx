"use client";

import React, { useState } from "react";
import { recordDirectCostAction } from "@/app/dashboard/(app)/finance/financial-engine-actions";

export function DirectCostModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string) => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await recordDirectCostAction({
      amount: Number(fd.get("amount")),
      category: String(fd.get("category") || ""),
      recordedAt: String(fd.get("recordedAt") || ""),
      description: String(fd.get("description") || ""),
      costType: fd.get("costType") as "fixed" | "variable",
      entryClass: fd.get("entryClass") as "expense" | "asset",
    });
    setIsSubmitting(false);
    if (res?.error) setError(res.error);
    else onSuccess(`Direct cost recorded and journal ${res?.journalRef || ""} posted.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-xl p-6 space-y-4">
        <div className="flex justify-between items-center border-b border-border/60 pb-3">
          <h3 className="text-sm font-bold text-foreground">Record Direct Livestock Cost</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs font-semibold">✕</button>
        </div>
        {error && <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-foreground">Category</label>
            <select name="category" required className="w-full mt-1 p-2 rounded-xl border border-border bg-background">
              <option value="Feed & Nutrition">Feed & Nutrition</option>
              <option value="Veterinary & Health">Veterinary & Health</option>
              <option value="Vaccination">Vaccination</option>
              <option value="Farm Labor & Wages">Farm Labor & Wages</option>
              <option value="Transport & Freight">Transport & Freight</option>
              <option value="Repairs & Shed Maintenance">Repairs & Shed Maintenance</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold text-foreground">Amount (৳)</label>
              <input type="number" name="amount" required step="0.01" min="1" className="w-full mt-1 p-2 rounded-xl border border-border bg-background" />
            </div>
            <div>
              <label className="font-semibold text-foreground">Date</label>
              <input type="date" name="recordedAt" defaultValue={new Date().toISOString().slice(0, 10)} required className="w-full mt-1 p-2 rounded-xl border border-border bg-background" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold text-foreground">Cost Type</label>
              <select name="costType" defaultValue="variable" className="w-full mt-1 p-2 rounded-xl border border-border bg-background">
                <option value="variable">Variable</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-foreground">Entry Class</label>
              <select name="entryClass" defaultValue="expense" className="w-full mt-1 p-2 rounded-xl border border-border bg-background">
                <option value="expense">Expense</option>
                <option value="asset">Capital Asset</option>
              </select>
            </div>
          </div>
          <div>
            <label className="font-semibold text-foreground">Description</label>
            <input type="text" name="description" placeholder="Voucher / details" className="w-full mt-1 p-2 rounded-xl border border-border bg-background" />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold">
              {isSubmitting ? "Recording..." : "Record Cost"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

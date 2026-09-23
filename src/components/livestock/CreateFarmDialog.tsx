"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Building2, Loader2 } from "lucide-react";
import { createFarmAction } from "@/app/dashboard/(app)/cattle/pens/actions";

export function CreateFarmDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData(e.currentTarget);
      await createFarmAction(formData);
      setOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create farm");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-all cursor-pointer">
        <Building2 className="h-3.5 w-3.5" />
        <span>New Farm</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Farm Facility</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-600 text-xs">{error}</div>}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Farm Name</label>
            <input name="name" required placeholder="e.g. North Pasture Unit" className="w-full h-9 rounded-lg border border-border px-3 text-sm bg-background" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Code</label>
              <input name="code" required placeholder="e.g. FARM-N1" className="w-full h-9 rounded-lg border border-border px-3 text-sm bg-background uppercase font-mono" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Capacity (Head)</label>
              <input name="capacity" type="number" defaultValue="500" min="1" className="w-full h-9 rounded-lg border border-border px-3 text-sm bg-background font-mono" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Location / Address</label>
            <input name="location" placeholder="e.g. Gazipur, Sector 4" className="w-full h-9 rounded-lg border border-border px-3 text-sm bg-background" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-xs font-semibold border border-border hover:bg-muted">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5">
              {loading && <Loader2 className="h-3 w-3 animate-spin" />}
              <span>Save Farm</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

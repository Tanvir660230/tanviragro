"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { todayDhaka } from "@/lib/dates";

type Props = {
  itemId: string;
  itemName: string;
  currentStock: number;
  unit: string;
};

type FormState = { error?: string; success?: boolean } | undefined;

const REASONS = [
  { value: "physical_count", label: "Physical Count" },
  { value: "spoilage", label: "Spoilage" },
  { value: "damage", label: "Damage" },
  { value: "shrinkage", label: "Shrinkage" },
  { value: "waste", label: "Operational Waste" },
  { value: "correction", label: "Correction" },
] as const;

export function StockAdjustmentDialog({ itemId, itemName, currentStock, unit }: Props) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setFormKey((k) => k + 1); }}>
      <DialogTrigger
        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-muted-foreground hover:text-foreground")}
        title="Adjust stock count"
      >
        <ClipboardList className="h-3.5 w-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader>
          <DialogTitle>Stock Adjustment — {itemName}</DialogTitle>
        </DialogHeader>
        <AdjustmentForm key={formKey} itemId={itemId} itemName={itemName} currentStock={currentStock} unit={unit} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AdjustmentForm({ itemId, itemName, currentStock, unit, onSuccess }: Props & { onSuccess: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState("physical_count");
  const [newQty, setNewQty] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, setIsPending] = useState(false);

  const delta = parseFloat(newQty) - currentStock;
  const isPositive = delta > 0;
  const today = todayDhaka();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    try {
      const mod = await import("@/app/dashboard/(app)/inventory/actions");
      const fd = new FormData();
      fd.set("item_id", itemId);
      fd.set("adjusted_qty", newQty);
      fd.set("reason", reason);
      fd.set("recorded_at", today);
      fd.set("notes", notes);
      const result = await mod.adjustStock({}, fd);
      if (result?.error) { toast.error(result.error); }
      else { toast.success("Stock adjusted successfully"); onSuccess(); router.refresh(); }
    } catch { toast.error("Failed to adjust stock"); }
    finally { setIsPending(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-1">
      <div className="rounded-lg bg-muted/40 border border-border/60 p-3 text-sm">
        <span className="text-muted-foreground">Current count:</span>{" "}
        <span className="font-semibold font-mono">{currentStock.toLocaleString("en-IN")} {unit}</span>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="adj_qty">New Physical Count ({unit}) *</Label>
        <Input id="adj_qty" type="number" min="0" step="0.01" value={newQty} onChange={(e) => setNewQty(e.target.value)} required placeholder={`e.g. ${currentStock}`} />
        {newQty && (
          <p className={cn("text-xs font-medium", delta >= 0 ? "text-emerald-600" : "text-rose-600")}>
            {isPositive ? `+${delta.toFixed(2)}` : delta.toFixed(2)} {unit} ({isPositive ? "surplus" : "shortage"})
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Reason *</Label>
        <Select value={reason} onValueChange={(v) => { if (v != null) setReason(v); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {REASONS.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="adj_notes">Notes</Label>
        <Textarea id="adj_notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes about this adjustment..." rows={2} />
      </div>

      <DialogFooter className="pt-2">
        <Button type="submit" disabled={isPending || !newQty} className="w-full">
          {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adjusting…</> : "Confirm Adjustment"}
        </Button>
      </DialogFooter>
    </form>
  );
}

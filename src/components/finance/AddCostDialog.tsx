"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { createCostEntry, type CostFormState } from "@/app/dashboard/(app)/finance/actions";

// ── Category lists ─────────────────────────────────────────────────

const FIXED_CATEGORIES    = ["Rent", "Salary", "Utilities", "Insurance", "Other"];
const VARIABLE_CATEGORIES = ["Feed", "Medicine", "Labour", "Transport", "Veterinary", "Other"];
const ASSET_CATEGORIES    = ["Infrastructure", "Equipment", "Vehicle", "Land", "Other"];

// ── CostForm ───────────────────────────────────────────────────────

type EntryMode = "expense-fixed" | "expense-variable" | "asset";

export function CostForm({ formKey, onSuccess }: { formKey: number; onSuccess: () => void }) {
  const router   = useRouter();
  const today    = new Date().toISOString().split("T")[0];
  const [mode, setMode]         = useState<EntryMode | "">("");
  const [category, setCategory] = useState("");

  const [state, formAction, isPending] = useActionState<CostFormState, FormData>(
    createCostEntry,
    undefined
  );

  const handleModeChange = (v: EntryMode) => { setMode(v); setCategory(""); };

  const categories =
    mode === "expense-fixed"    ? FIXED_CATEGORIES    :
    mode === "expense-variable" ? VARIABLE_CATEGORIES :
    mode === "asset"            ? ASSET_CATEGORIES    : [];

  // Derive server-side fields from mode
  const costType   = mode === "asset" ? "fixed" : mode === "expense-fixed" ? "fixed" : "variable";
  const entryClass = mode === "asset" ? "asset" : "expense";

  useEffect(() => {
    if (state?.success) {
      toast.success(entryClass === "asset" ? "Asset recorded" : "Cost entry saved");
      onSuccess();
      router.refresh();
    }
    if (state?.error) toast.error(state.error);
  }, [state?.success, state?.error, onSuccess, router, entryClass]);

  return (
    <form key={formKey} action={formAction} className="space-y-4 pt-1">
      <input type="hidden" name="type"        value={costType} />
      <input type="hidden" name="entry_class" value={entryClass} />
      <input type="hidden" name="category"    value={category} />

      {/* Entry Mode */}
      <div className="space-y-1.5">
        <Label>Entry Type *</Label>
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: "expense-fixed",    label: "Fixed Cost",    sub: "Salary, rent…" },
            { value: "expense-variable", label: "Variable Cost", sub: "Feed, medicine…" },
            { value: "asset",            label: "Asset",         sub: "Equipment, shed…" },
          ] as const).map(({ value, label, sub }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleModeChange(value)}
              className={`rounded-xl border px-2 py-2.5 text-left text-xs font-medium transition-all ${
                mode === value
                  ? value === "asset"
                    ? "border-amber-500 bg-amber-500 text-white shadow-card"
                    : "border-primary bg-primary text-primary-foreground shadow-card"
                  : "border-input bg-transparent text-muted-foreground hover:border-ring hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <span className="block font-semibold">{label}</span>
              <span className="block opacity-70 text-xs mt-0.5">{sub}</span>
            </button>
          ))}
        </div>
        {mode === "asset" && (
          <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md px-2.5 py-1.5">
            Assets are <strong>not deducted from P&amp;L</strong> — they build business value and appear in your asset register.
          </p>
        )}
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label htmlFor="cost_category">Category *</Label>
        <Select value={category} onValueChange={(v) => setCategory(v ?? "")} disabled={!mode}>
          <SelectTrigger id="cost_category" className="w-full">
            <SelectValue placeholder={mode ? "Select category…" : "Select type first"} />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Amount + Date */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cost_amount">Amount (৳) *</Label>
          <Input id="cost_amount" name="amount" type="number" min="0.01" step="0.01" placeholder="e.g. 50000" required disabled={isPending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cost_date">Date *</Label>
          <Input id="cost_date" name="recorded_at" type="date" max={today} defaultValue={today} required disabled={isPending} />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="cost_desc">
          {mode === "asset" ? "Asset Name / Details" : "Description"}
        </Label>
        <Textarea
          id="cost_desc"
          name="description"
          placeholder={mode === "asset" ? "e.g. Steel cattle shed — 40×20 ft" : "Optional details…"}
          rows={3}
          disabled={isPending}
        />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      <DialogFooter>
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
          ) : mode === "asset" ? "Record Asset" : "Add Entry"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ── AddCostDialog ──────────────────────────────────────────────────

export function AddCostDialog() {
  const [open, setOpen]       = useState(false);
  const [formKey, setFormKey] = useState(0);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setFormKey((k) => k + 1);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className={buttonVariants({ size: "sm" })} aria-label="Add cost entry">
        <Plus className="mr-1.5 h-4 w-4" />
        Add Entry
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New Cost / Asset Entry</DialogTitle>
        </DialogHeader>
        <CostForm formKey={formKey} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

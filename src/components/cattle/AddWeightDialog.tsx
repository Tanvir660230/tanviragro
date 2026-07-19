"use client";

import React, { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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
import { Loader2, Ruler, Scale } from "lucide-react";
import {
  createWeightLog,
  type WeightLogFormState,
} from "@/app/dashboard/(app)/cattle/[id]/actions";
import { enqueue } from "@/lib/offlineQueue";

// Formula: Weight (kg) = Girth² × Length / 10840  (all in cm)
function girthLengthToKg(girthCm: number, lengthCm: number): number {
  if (girthCm <= 0 || lengthCm <= 0) return 0;
  return Math.round((girthCm * girthCm * lengthCm) / 10840);
}

type Mode = "direct" | "tape";

export type WeightLogRow = {
  id: string;
  weight_kg: number;
  recorded_at: string;
  notes: string | null;
  girth_cm: number | null;
  length_cm: number | null;
};

function WeightForm({
  cattleId,
  formKey,
  onSuccess,
  onOptimisticAdd,
}: {
  cattleId: string;
  formKey: number;
  onSuccess: () => void;
  onOptimisticAdd?: (entry: WeightLogRow) => void;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    WeightLogFormState,
    FormData
  >(createWeightLog, undefined);

  const [mode, setMode] = useState<Mode>("direct");
  const [girth, setGirth] = useState("");
  const [length, setLength] = useState("");

  const estimatedKg = useMemo(() => {
    const g = parseFloat(girth);
    const l = parseFloat(length);
    return g > 0 && l > 0 ? girthLengthToKg(g, l) : null;
  }, [girth, length]);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (state?.success) {
      toast.success("Weight logged");
      onSuccess();
      router.refresh();
    }
    if (state?.error) toast.error(state.error);
  }, [state?.success, state?.error, onSuccess, router]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const weightKg = parseFloat(data.get("weight_kg") as string);
    const recordedAt = (data.get("recorded_at") as string) || today;
    const notes = (data.get("notes") as string) || null;
    const girthCm = parseFloat(data.get("girth_cm") as string) || null;
    const lengthCm = parseFloat(data.get("length_cm") as string) || null;

    if (!isNaN(weightKg) && weightKg > 0) {
      onOptimisticAdd?.({
        id: `optimistic-${Date.now()}`,
        weight_kg: weightKg,
        recorded_at: recordedAt,
        notes,
        girth_cm: girthCm,
        length_cm: lengthCm,
      });
      onSuccess();
    }

    if (!navigator.onLine) {
      enqueue({
        type: "weight-log",
        cattle_id: cattleId,
        weight_kg: weightKg,
        recorded_at: recordedAt,
        notes,
        girth_cm: girthCm,
        length_cm: lengthCm,
      }).then(() => toast.info("Weight log queued — will sync when online"));
      return;
    }

    formAction(data);
  };

  return (
    <form key={formKey} onSubmit={handleSubmit} className="space-y-4 pt-1">
      <input type="hidden" name="cattle_id" value={cattleId} />

      {/* Mode toggle */}
      <div className="flex rounded-lg border border-border overflow-hidden text-sm">
        <button
          type="button"
          onClick={() => { setMode("direct"); setGirth(""); setLength(""); }}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors",
            mode === "direct" ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-muted"
          )}
        >
          <Scale className="h-3.5 w-3.5" />
          Direct KG
        </button>
        <button
          type="button"
          onClick={() => setMode("tape")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors",
            mode === "tape" ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-muted"
          )}
        >
          <Ruler className="h-3.5 w-3.5" />
          Tape Measure
        </button>
      </div>

      {/* Date */}
      <div className="space-y-1.5">
        <Label htmlFor="wl_date">Date *</Label>
        <Input
          id="wl_date"
          name="recorded_at"
          type="date"
          max={today}
          defaultValue={today}
          required
        />
      </div>

      {mode === "direct" ? (
        <div className="space-y-1.5">
          <Label htmlFor="wl_weight">Weight (kg) *</Label>
          <Input
            id="wl_weight"
            name="weight_kg"
            type="number"
            min="1"
            max="3000"
            step="0.1"
            placeholder="e.g. 210"
            required
            autoFocus
          />
        </div>
      ) : mode === "tape" ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="wl_girth">Chest Girth (cm) *</Label>
              <Input
                id="wl_girth"
                name="girth_cm"
                type="number"
                min="1"
                step="0.5"
                placeholder="e.g. 165"
                value={girth}
                onChange={(e) => setGirth(e.target.value)}
                required={mode === "tape"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wl_length">Body Length (cm) *</Label>
              <Input
                id="wl_length"
                name="length_cm"
                type="number"
                min="1"
                step="0.5"
                placeholder="e.g. 140"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                required={mode === "tape"}
              />
            </div>
          </div>

          <div
            className={`rounded-lg px-4 py-3 border transition-all ${
              estimatedKg
                ? "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30"
                : "border-border bg-muted/40"
            }`}
          >
            <p className="text-xs text-muted-foreground mb-0.5">Estimated Weight</p>
            <p
              className={`text-2xl font-bold tabular-nums ${
                estimatedKg
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-muted-foreground"
              }`}
            >
              {estimatedKg ? `${estimatedKg} kg` : "— kg"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Formula: Girth² × Length ÷ 10840
            </p>
            {estimatedKg && (
              <p className="text-xs text-primary mt-1 font-medium">
                ✓ Weight set to {estimatedKg} kg — review and save below
              </p>
            )}
          </div>

          <input type="hidden" name="weight_kg" value={estimatedKg ?? ""} />
        </>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="wl_notes">Notes</Label>
        <Textarea
          id="wl_notes"
          name="notes"
          placeholder="Optional notes…"
          rows={2}
          maxLength={500}
        />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <DialogFooter>
        <Button
          type="submit"
          disabled={isPending || (mode === "tape" && !estimatedKg)}
          className="w-full"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save Weight"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AddWeightDialog({
  cattleId,
  onOptimisticAdd,
}: {
  cattleId: string;
  onOptimisticAdd?: (entry: WeightLogRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setFormKey((k) => k + 1);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        className={buttonVariants({ size: "sm", variant: "outline" })}
        aria-label="Log weight"
      >
        <Scale className="mr-1.5 h-4 w-4" />
        Record Weight
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Record Weight</DialogTitle>
        </DialogHeader>
        <WeightForm
          cattleId={cattleId}
          formKey={formKey}
          onSuccess={() => setOpen(false)}
          onOptimisticAdd={onOptimisticAdd}
        />
      </DialogContent>
    </Dialog>
  );
}

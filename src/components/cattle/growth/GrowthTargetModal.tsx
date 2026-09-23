"use client";
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target } from "lucide-react";
import { saveGrowthTargetAction } from "@/app/dashboard/(app)/cattle/growth-actions";
import { type AnimalGrowthProfile } from "@/lib/growth/types";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cattleList: AnimalGrowthProfile[];
  preselectedCattleId?: string | null;
  onSuccess?: () => void;
}

export function GrowthTargetModal({ open, onOpenChange, cattleList, preselectedCattleId, onSuccess }: Props) {
  const [cattleId, setCattleId] = useState(preselectedCattleId || "");
  const [targetWeightKg, setTargetWeightKg] = useState<number | "">("");
  const [targetDate, setTargetDate] = useState("");
  const [targetAdgKg, setTargetAdgKg] = useState<number | "">(0.9);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedAnimal = cattleList.find((c) => c.cattleId === cattleId);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (preselectedCattleId) setCattleId(preselectedCattleId);
  }, [preselectedCattleId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cattleId || !targetWeightKg || Number(targetWeightKg) <= 0) {
      toast.error("Please enter a valid target weight");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await saveGrowthTargetAction({
        cattleId,
        targetWeightKg: Number(targetWeightKg),
        targetFinishDate: targetDate || undefined,
        targetAdgKg: targetAdgKg ? Number(targetAdgKg) : undefined,
        notes: notes.trim() || undefined,
      });
      if (res.success) {
        toast.success("Growth target established!");
        onOpenChange(false);
        onSuccess?.();
      } else toast.error(res.error || "Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <form onSubmit={handleSubmit} className="space-y-3">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-primary" /> Target Weight & Trajectory Goal
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-2 text-xs">
            <div>
              <Label className="text-xs">Animal</Label>
              <select value={cattleId} onChange={(e) => setCattleId(e.target.value)} className="w-full h-8 rounded border bg-background px-2 text-xs" required>
                <option value="">Select...</option>
                {cattleList.map((c) => (
                  <option key={c.cattleId} value={c.cattleId}>
                    Tag #{c.tagId} (Current: {c.currentWeightKg} kg)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Target Weight (kg) *</Label>
                <Input type="number" step="1" value={targetWeightKg} onChange={(e) => setTargetWeightKg(e.target.value === "" ? "" : Number(e.target.value))} className="h-8 text-xs font-bold" required />
              </div>
              <div>
                <Label className="text-xs font-semibold">Target ADG (kg/d)</Label>
                <Input type="number" step="0.05" value={targetAdgKg} onChange={(e) => setTargetAdgKg(e.target.value === "" ? "" : Number(e.target.value))} className="h-8 text-xs" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Target Finish Date</Label>
              <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="h-8 text-xs" />
            </div>

            {selectedAnimal && targetWeightKg && Number(targetWeightKg) > selectedAnimal.currentWeightKg && (
              <div className="p-2 bg-muted/40 rounded text-[11px] text-muted-foreground">
                Required Gain: <span className="font-semibold text-foreground">{(Number(targetWeightKg) - selectedAnimal.currentWeightKg).toFixed(1)} kg</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Set Goal"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

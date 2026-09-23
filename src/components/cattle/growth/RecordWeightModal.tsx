"use client";
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scale } from "lucide-react";
import { recordGrowthWeightAction } from "@/app/dashboard/(app)/cattle/growth-actions";
import { calculateWeightFromTapeSchaeffer } from "@/lib/growth/calculator";
import { type AnimalGrowthProfile } from "@/lib/growth/types";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cattleList: AnimalGrowthProfile[];
  preselectedCattleId?: string | null;
  onSuccess?: () => void;
}

export function RecordWeightModal({ open, onOpenChange, cattleList, preselectedCattleId, onSuccess }: Props) {
  const [cattleId, setCattleId] = useState(preselectedCattleId || "");
  const [recordedAt, setRecordedAt] = useState(new Date().toISOString().split("T")[0]);
  const [weightKg, setWeightKg] = useState<number | "">("");
  const [method, setMethod] = useState<"scale" | "heart_girth_tape" | "estimated">("scale");
  const [heartGirthCm, setHeartGirthCm] = useState<number | "">("");
  const [bodyLengthCm, setBodyLengthCm] = useState<number | "">("");
  const [bcs, setBcs] = useState<number>(5.0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (preselectedCattleId) setCattleId(preselectedCattleId);
    else if (cattleList.length > 0 && !cattleId) setCattleId(cattleList[0].cattleId);
  }, [preselectedCattleId, cattleList]);

  useEffect(() => {
    if (method === "heart_girth_tape" && heartGirthCm && bodyLengthCm) {
      const est = calculateWeightFromTapeSchaeffer(Number(heartGirthCm), Number(bodyLengthCm));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (est > 0) setWeightKg(est);
    }
  }, [method, heartGirthCm, bodyLengthCm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cattleId || !weightKg || Number(weightKg) <= 0) {
      toast.error("Please enter a valid weight");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await recordGrowthWeightAction({
        cattleId,
        recordedAt,
        weightKg: Number(weightKg),
        weighingMethod: method,
        girthCm: heartGirthCm ? Number(heartGirthCm) : undefined,
        lengthCm: bodyLengthCm ? Number(bodyLengthCm) : undefined,
        bcs: bcs,
      });
      if (res.success) {
        toast.success(`Weight recorded! ADG: +${res.adgSinceLastKg?.toFixed(2) ?? "0.00"} kg/d`);
        onOpenChange(false);
        onSuccess?.();
      } else toast.error(res.error || "Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <form onSubmit={handleSubmit} className="space-y-3">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Scale className="h-4 w-4 text-primary" /> Record Weigh-In
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-2 text-xs">
            <div>
              <Label className="text-xs">Animal</Label>
              <select value={cattleId} onChange={(e) => setCattleId(e.target.value)} className="w-full h-8 rounded border bg-background px-2 text-xs" required>
                <option value="">Select...</option>
                {cattleList.map((c) => (
                  <option key={c.cattleId} value={c.cattleId}>Tag #{c.tagId} ({c.currentWeightKg} kg)</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Date</Label>
                <Input type="date" value={recordedAt} onChange={(e) => setRecordedAt(e.target.value)} className="h-8 text-xs" required />
              </div>
              <div>
                <Label className="text-xs">Method</Label>
                <select value={method} onChange={(e) => setMethod(e.target.value as any)} className="w-full h-8 rounded border bg-background px-2 text-xs">
                  <option value="scale">Scale</option>
                  <option value="heart_girth_tape">Tape (Schaeffer)</option>
                  <option value="estimated">Visual</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-bold">Weight (kg) *</Label>
                <Input type="number" step="0.1" value={weightKg} onChange={(e) => setWeightKg(e.target.value === "" ? "" : Number(e.target.value))} className="h-8 text-xs font-bold" required />
              </div>
              <div>
                <Label className="text-xs">BCS (1-9)</Label>
                <Input type="number" step="0.5" min="1" max="9" value={bcs} onChange={(e) => setBcs(Number(e.target.value))} className="h-8 text-xs" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import React, { useState } from "react";
import { Flame, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { recordHeatAction } from "@/app/dashboard/(app)/cattle/breeding-actions";
import { toast } from "sonner";
import { type EstrusIntensity } from "@/lib/reproduction";

interface RecordHeatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cattleList: { id: string; tag_number: string; name?: string; gender: string }[];
  preselectedCattleId?: string;
  onSuccess?: () => void;
}

export function RecordHeatModal({
  open,
  onOpenChange,
  cattleList,
  preselectedCattleId,
  onSuccess,
}: RecordHeatModalProps) {
  const [cattleId, setCattleId] = useState(preselectedCattleId || "");
  const [detectedAt, setDetectedAt] = useState(new Date().toISOString().slice(0, 16));
  const [heatType, setHeatType] = useState<"natural" | "induced" | "sync_protocol">("natural");
  const [intensity, setIntensity] = useState<EstrusIntensity>("standing_heat");
  const [observedBy, setObservedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const females = cattleList.filter((c) => c.gender === "cow" || c.gender === "heifer");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cattleId) {
      toast.error("Please select a cow or heifer");
      return;
    }

    setLoading(true);
    try {
      const res = await recordHeatAction({
        cattleId,
        detectedAtISO: new Date(detectedAt).toISOString(),
        heatType,
        intensity,
        observedBy: observedBy || undefined,
        notes: notes || undefined,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Heat observation logged! Next cycle reminder scheduled.");
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to log heat");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-rose-500" />
            Log Estrus / Heat Observation
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Select Cow / Heifer</Label>
            <Select value={cattleId} onValueChange={(v) => v && setCattleId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose breeding female..." />
              </SelectTrigger>
              <SelectContent>
                {females.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.tag_number} {c.name ? `(${c.name})` : ""} - {c.gender}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Observed Date &amp; Time</Label>
              <Input
                type="datetime-local"
                value={detectedAt}
                onChange={(e) => setDetectedAt(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Estrus Sign</Label>
              <Select value={intensity} onValueChange={(v) => setIntensity(v as EstrusIntensity)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standing_heat">Standing Heat (Primary)</SelectItem>
                  <SelectItem value="mounting_others">Mounting Others</SelectItem>
                  <SelectItem value="mucous_discharge">Mucous Discharge</SelectItem>
                  <SelectItem value="restlessness">Restlessness / Bellowing</SelectItem>
                  <SelectItem value="silent_heat">Silent Heat</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Heat Induction</Label>
              <Select value={heatType} onValueChange={(v) => setHeatType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="natural">Natural Cycle</SelectItem>
                  <SelectItem value="induced">Hormone Induced</SelectItem>
                  <SelectItem value="sync_protocol">Ovsynch Protocol</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Observed By</Label>
              <Input
                placeholder="Herdsman / Farm staff"
                value={observedBy}
                onChange={(e) => setObservedBy(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes (Optional)</Label>
            <Textarea
              placeholder="Behavioral observations, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Heat Log
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

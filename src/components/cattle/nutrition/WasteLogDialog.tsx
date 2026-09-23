"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { type FeedNutrientProfile } from "@/lib/nutrition/nutrition-engine";

interface WasteLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventoryItems: FeedNutrientProfile[];
  wasteItemId: string;
  onWasteItemChange: (id: string) => void;
  wasteKg: number;
  onWasteKgChange: (kg: number) => void;
  wasteReason: "orts_refusal" | "trough_spillage" | "spoilage" | "weather_damage";
  onWasteReasonChange: (r: "orts_refusal" | "trough_spillage" | "spoilage" | "weather_damage") => void;
  wasteNotes: string;
  onWasteNotesChange: (notes: string) => void;
  onRecord: () => void;
  executing: boolean;
}

export function WasteLogDialog({
  open,
  onOpenChange,
  inventoryItems,
  wasteItemId,
  onWasteItemChange,
  wasteKg,
  onWasteKgChange,
  wasteReason,
  onWasteReasonChange,
  wasteNotes,
  onWasteNotesChange,
  onRecord,
  executing,
}: WasteLogDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-rose-500" />
            <span>Log Feed Waste / Orts / Refusal</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Record uneaten orts, trough spillage, or spoilage for bunk efficiency analysis.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2 text-xs">
          <div className="space-y-1">
            <label className="font-semibold">Feed Item</label>
            <select
              className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs"
              value={wasteItemId}
              onChange={(e) => onWasteItemChange(e.target.value)}
            >
              {inventoryItems.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold">Waste Quantity (kg)</label>
              <Input
                type="number"
                step="0.5"
                value={wasteKg}
                onChange={(e) => onWasteKgChange(parseFloat(e.target.value) || 0)}
                className="h-9 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold">Reason</label>
              <select
                className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs"
                value={wasteReason}
                onChange={(e) => onWasteReasonChange(e.target.value as typeof wasteReason)}
              >
                <option value="orts_refusal">Orts / Refusal</option>
                <option value="trough_spillage">Trough Spillage</option>
                <option value="spoilage">Feed Spoilage</option>
                <option value="weather_damage">Rain / Heat Damage</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="font-semibold">Notes / Bunk Observation</label>
            <Input
              placeholder="e.g. wet trough residue in Pen 3"
              value={wasteNotes}
              onChange={(e) => onWasteNotesChange(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" disabled={executing} onClick={onRecord} className="bg-rose-600 hover:bg-rose-700 text-white">
            {executing ? "Logging..." : "Record Waste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

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
import {
  type FeedNutrientProfile,
  type FeedingSlot,
} from "@/lib/nutrition/nutrition-engine";

interface QuickDispenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventoryItems: FeedNutrientProfile[];
  qdFeedId: string;
  onQdFeedChange: (id: string) => void;
  qdKgPerHead: number;
  onQdKgChange: (kg: number) => void;
  qdSlot: FeedingSlot;
  onQdSlotChange: (slot: FeedingSlot) => void;
  onDispense: () => void;
  executing: boolean;
}

export function QuickDispenseDialog({
  open,
  onOpenChange,
  inventoryItems,
  qdFeedId,
  onQdFeedChange,
  qdKgPerHead,
  onQdKgChange,
  qdSlot,
  onQdSlotChange,
  onDispense,
  executing,
}: QuickDispenseDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Herd Feed Dispense</DialogTitle>
          <DialogDescription className="text-xs">
            Immediately dispense uniform feed amount across all active cattle head.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2 text-xs">
          <div className="space-y-1">
            <label className="font-semibold">Feed Item</label>
            <select
              className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs"
              value={qdFeedId}
              onChange={(e) => onQdFeedChange(e.target.value)}
            >
              {inventoryItems.map((i) => (
                <option key={i.id} value={i.id}>{i.name} ({Math.round(i.currentStockKg)}kg available)</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold">Kg Per Head</label>
              <Input
                type="number"
                step="0.5"
                value={qdKgPerHead}
                onChange={(e) => onQdKgChange(parseFloat(e.target.value) || 0)}
                className="h-9 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold">Feeding Slot</label>
              <select
                className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs"
                value={qdSlot}
                onChange={(e) => onQdSlotChange(e.target.value as FeedingSlot)}
              >
                <option value="morning">Morning</option>
                <option value="noon">Noon</option>
                <option value="evening">Evening</option>
                <option value="night">Night</option>
              </select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" disabled={executing} onClick={onDispense} className="bg-blue-600 hover:bg-blue-700 text-white">
            {executing ? "Dispensing..." : "Dispense Now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

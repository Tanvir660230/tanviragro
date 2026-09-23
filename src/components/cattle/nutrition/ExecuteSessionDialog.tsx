"use client";

import { Play, Check, RefreshCw } from "lucide-react";
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
  type CattleNutritionState,
} from "@/lib/nutrition/nutrition-engine";

interface ExecuteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSlot: FeedingSlot;
  inventoryItems: FeedNutrientProfile[];
  selectedFeedItemId: string;
  onSelectFeedItem: (id: string) => void;
  feederOperator: string;
  onFeederOperatorChange: (op: string) => void;
  cattle: (CattleNutritionState & { penName?: string })[];
  animalRequirements: Map<string, any>;
  dispenseOverrides: Record<string, { dispensed: number; waste: number }>;
  onOverrideChange: (cid: string, val: number) => void;
  onExecute: () => void;
  executing: boolean;
}

export function ExecuteSessionDialog({
  open,
  onOpenChange,
  selectedSlot,
  inventoryItems,
  selectedFeedItemId,
  onSelectFeedItem,
  feederOperator,
  onFeederOperatorChange,
  cattle,
  animalRequirements,
  onOverrideChange,
  onExecute,
  executing,
}: ExecuteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-emerald-600 fill-current" />
            <span>Execute {selectedSlot.toUpperCase()} Feeding Session</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Dispense target rations across active herd, reduce inventory batch balances, and record financial cost entries.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Select Feed Item / Batch</label>
              <select
                className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs"
                value={selectedFeedItemId}
                onChange={(e) => onSelectFeedItem(e.target.value)}
              >
                {inventoryItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({Math.round(item.currentStockKg)} kg available · ৳{item.costPerKgAsFed}/kg)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Feeder Operator Signature</label>
              <Input
                className="h-9 text-xs"
                value={feederOperator}
                onChange={(e) => onFeederOperatorChange(e.target.value)}
                placeholder="e.g. Lead Feeder Rafiq"
              />
            </div>
          </div>

          <div className="border rounded-xl p-3 bg-muted/20 space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span>Livestock Targets ({cattle.length} Head)</span>
              <span className="text-emerald-600 dark:text-emerald-400">
                Total Target: {(cattle.reduce((s, c) => s + (animalRequirements.get(c.id)?.targetConcentrateKg || 2.0), 0)).toFixed(1)} kg
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {cattle.slice(0, 15).map((c) => {
                const req = animalRequirements.get(c.id);
                const targetKg = req?.targetConcentrateKg || 2.0;
                return (
                  <div key={c.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-card border">
                    <div className="font-mono font-bold text-foreground">#{c.tagId} ({c.currentWeightKg} kg)</div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">Target: {targetKg} kg</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">Dispensed:</span>
                        <input
                          type="number"
                          step="0.1"
                          defaultValue={targetKg}
                          onChange={(e) => onOverrideChange(c.id, parseFloat(e.target.value) || 0)}
                          className="w-16 h-7 rounded border text-center font-mono text-xs bg-background"
                        />
                        <span className="text-xs">kg</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={executing}
            onClick={onExecute}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
          >
            {executing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            <span>Confirm & Deduct Stock</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ArrowRightLeft, AlertTriangle } from "lucide-react";
import { PenEntity, PenEngine } from "@/lib/livestock/pen-engine";
import { transferCattlePenAction } from "@/app/dashboard/(app)/cattle/pens/actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pens: PenEntity[];
  activeCattle: Array<{
    id: string;
    tag_id: string;
    pen_id: string | null;
    breed: string;
    is_quarantined: boolean;
  }>;
  preselectedPen?: PenEntity | null;
}

export function MoveAnimalPenDialog({
  open,
  onOpenChange,
  pens,
  activeCattle,
  preselectedPen,
}: Props) {
  const [selectedCattleId, setSelectedCattleId] = useState<string>("");
  const [targetPenId, setTargetPenId] = useState<string>(preselectedPen?.id || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAnimal = activeCattle.find((c) => c.id === selectedCattleId);
  const targetPen = pens.find((p) => p.id === targetPenId);

  const validation = targetPen && selectedAnimal
    ? PenEngine.validateAnimalMovement(targetPen, {
        tagId: selectedAnimal.tag_id,
        isQuarantined: selectedAnimal.is_quarantined,
      })
    : null;

  async function handleTransfer() {
    if (!selectedCattleId || !targetPenId) return;
    setLoading(true);
    setError(null);
    try {
      await transferCattlePenAction(selectedCattleId, targetPenId, targetPen?.farmId);
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to move animal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-primary" />
            <span>Transfer Animal to Pen</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {error && <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-600 text-xs">{error}</div>}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Select Animal</label>
            <select
              value={selectedCattleId}
              onChange={(e) => setSelectedCattleId(e.target.value)}
              className="w-full h-9 rounded-lg border border-border px-3 text-sm bg-background font-mono"
            >
              <option value="">-- Choose Cattle Tag --</option>
              {activeCattle.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.tag_id} ({c.breed}) {c.is_quarantined ? "[QUARANTINED]" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Target Destination Pen</label>
            <select
              value={targetPenId}
              onChange={(e) => setTargetPenId(e.target.value)}
              className="w-full h-9 rounded-lg border border-border px-3 text-sm bg-background"
            >
              <option value="">-- Choose Destination Pen --</option>
              {pens.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code}) — {p.currentOccupancy}/{p.capacity} head [{p.type}]
                </option>
              ))}
            </select>
          </div>

          {/* Validation Warnings / Errors */}
          {validation && !validation.isValid && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 space-y-1">
              {validation.errors.map((err, i) => (
                <p key={i}>❌ {err}</p>
              ))}
            </div>
          )}

          {validation && validation.warnings.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-200 dark:border-amber-900 text-xs text-amber-700 dark:text-amber-400 space-y-1">
              {validation.warnings.map((warn, i) => (
                <p key={i}>⚠️ {warn}</p>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold border border-border hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleTransfer}
              disabled={loading || !selectedCattleId || !targetPenId || (validation !== null && !validation.isValid)}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {loading && <Loader2 className="h-3 w-3 animate-spin" />}
              <span>Confirm Transfer</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

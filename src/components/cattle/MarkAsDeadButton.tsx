"use client";

import { useTransition, useState } from "react";
import { Skull, RotateCcw } from "lucide-react";
import { markAsDeceased, undoMarkAsDeceased } from "@/app/dashboard/(app)/cattle/actions";
import { toast } from "sonner";

interface Props {
  cattleId: string;
  tagId: string;
  isDead?: boolean;
}

export function MarkAsDeadButton({ cattleId, tagId, isDead = false }: Props) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleConfirmDead() {
    startTransition(async () => {
      const result = await markAsDeceased(cattleId);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`Cattle #${tagId} marked as deceased`);
        setOpen(false);
      }
    });
  }

  function handleUndoDead() {
    startTransition(async () => {
      const result = await undoMarkAsDeceased(cattleId);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`Cattle #${tagId} restored to active`);
      }
    });
  }

  // Undo button for dead cattle
  if (isDead) {
    return (
      <button
        onClick={handleUndoDead}
        disabled={isPending}
        className="flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-50 dark:bg-amber-950/20 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/40 transition-colors disabled:opacity-50"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {isPending ? "…" : "Restore to Active"}
      </button>
    );
  }

  // Mark as dead button for active cattle
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
      >
        <Skull className="h-3.5 w-3.5" />
        Mark as Dead
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-1.5">
      <span className="text-xs text-destructive font-medium">Confirm death?</span>
      <button
        onClick={handleConfirmDead}
        disabled={isPending}
        className="rounded px-2 py-0.5 text-xs font-semibold bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50 transition-colors"
      >
        {isPending ? "…" : "Yes"}
      </button>
      <button
        onClick={() => setOpen(false)}
        disabled={isPending}
        className="rounded px-2 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}

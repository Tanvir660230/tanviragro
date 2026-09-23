"use client";

import React, { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

export interface UniversalDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  itemName?: string;
  itemType?: string;
  requireConfirmationText?: boolean;
  onConfirm: () => Promise<void> | void;
  loading?: boolean;
}

export function UniversalDeleteDialog({
  open,
  onOpenChange,
  title = "Delete Confirmation",
  itemName,
  itemType = "record",
  requireConfirmationText = false,
  onConfirm,
  loading = false,
}: UniversalDeleteDialogProps) {
  const [confirmInput, setConfirmInput] = useState("");

  if (!open) return null;

  const isConfirmed = !requireConfirmationText || confirmInput === itemName;

  const handleConfirm = async () => {
    if (!isConfirmed) return;
    await onConfirm();
    onOpenChange(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-md bg-card rounded-2xl border border-destructive/30 shadow-2xl p-6 space-y-5 animate-in zoom-in-95">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground font-serif">{title}</h3>
            <p className="text-xs text-muted-foreground">This action is destructive and cannot be undone.</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Are you sure you want to permanently delete {itemName ? <strong className="text-foreground">“{itemName}”</strong> : `this ${itemType}`}?
        </p>

        {requireConfirmationText && itemName && (
          <div className="space-y-1.5 pt-2">
            <label className="text-[11px] font-semibold text-muted-foreground">
              Type <span className="font-mono font-bold text-foreground">{itemName}</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs focus:ring-2 focus:ring-destructive/30 focus:outline-none"
              placeholder={itemName}
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted border border-border transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || !isConfirmed}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all shadow-xs disabled:opacity-50"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Delete Permanently</span>
          </button>
        </div>
      </div>
    </div>
  );
}

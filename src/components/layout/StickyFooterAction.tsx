"use client";

import React from "react";
import { AlertCircle, CheckCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StickyFooterActionProps {
  isDirty?: boolean;
  message?: string;
  primaryLabel?: string;
  primaryIcon?: LucideIcon;
  onPrimaryClick?: () => void;
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondaryClick?: () => void;
  secondaryDisabled?: boolean;
  discardLabel?: string;
  onDiscardClick?: () => void;
  extraActions?: React.ReactNode;
  className?: string;
}

export function StickyFooterAction({
  isDirty = false,
  message,
  primaryLabel = "Save Changes",
  primaryIcon: PrimaryIcon,
  onPrimaryClick,
  primaryLoading = false,
  primaryDisabled = false,
  secondaryLabel,
  onSecondaryClick,
  secondaryDisabled = false,
  discardLabel = "Discard",
  onDiscardClick,
  extraActions,
  className,
}: StickyFooterActionProps) {
  return (
    <div
      role="region"
      aria-label="Sticky page actions"
      className={cn(
        "sticky bottom-0 z-30 w-full py-3 px-4 sm:px-6 rounded-2xl bg-card/95 backdrop-blur-md border border-border/80 shadow-xl transition-all duration-200",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground w-full sm:w-auto">
          {isDirty ? (
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold animate-pulse">
              <AlertCircle className="h-4 w-4" />
              <span>Unsaved changes detected</span>
            </span>
          ) : (
            message && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span>{message}</span>
              </span>
            )
          )}
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
          {extraActions}

          {onDiscardClick && (
            <button
              type="button"
              onClick={onDiscardClick}
              disabled={primaryLoading}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all cursor-pointer"
            >
              {discardLabel}
            </button>
          )}

          {secondaryLabel && onSecondaryClick && (
            <button
              type="button"
              onClick={onSecondaryClick}
              disabled={secondaryDisabled || primaryLoading}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-border/80 bg-background hover:bg-accent text-foreground transition-all cursor-pointer disabled:opacity-50"
            >
              {secondaryLabel}
            </button>
          )}

          {onPrimaryClick && (
            <button
              type="button"
              onClick={onPrimaryClick}
              disabled={primaryDisabled || primaryLoading}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              {PrimaryIcon && <PrimaryIcon className="h-4 w-4" />}
              <span>{primaryLoading ? "Saving..." : primaryLabel}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

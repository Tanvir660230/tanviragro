"use client";

import React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BulkAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "destructive" | "outline" | "secondary";
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

export interface BulkActionBarProps {
  selectedCount: number;
  totalCount?: number;
  onClearSelection: () => void;
  actions: BulkAction[];
  className?: string;
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  onClearSelection,
  actions,
  className,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-foreground text-background shadow-2xl border border-border animate-in fade-in slide-in-from-bottom-4 duration-200",
        className
      )}
    >
      <div className="flex items-center gap-2 pr-2 border-r border-background/20 text-xs font-semibold">
        <span className="font-mono bg-background text-foreground px-2 py-0.5 rounded-md font-bold">
          {selectedCount}
        </span>
        <span>selected {totalCount ? `of ${totalCount}` : ""}</span>
        <button
          onClick={onClearSelection}
          className="p-1 rounded hover:bg-background/20 text-background/80 transition-colors"
          title="Clear selection"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        {actions.map((act, i) => {
          const Icon = act.icon;
          return (
            <button
              key={i}
              onClick={act.onClick}
              disabled={act.disabled}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50",
                act.variant === "destructive"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : act.variant === "outline"
                  ? "border border-background/30 text-background hover:bg-background/10"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {Icon && (React.isValidElement(Icon) ? Icon : typeof Icon === "function" ? <Icon className="h-3.5 w-3.5" /> : null)}
              <span>{act.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

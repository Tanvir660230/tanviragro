"use client";

import React, { useState } from "react";
import { MoreHorizontal, CheckCircle2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  onClick?: () => void;
  disabled?: boolean;
  shortcut?: string;
  hidden?: boolean;
}

export interface BulkActionItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  variant?: "destructive" | "default";
  onClick: (selectedIds: string[]) => void;
}

export interface ActionBarProps {
  primaryAction?: ActionItem;
  secondaryActions?: ActionItem[];
  bulkActions?: BulkActionItem[];
  selectedCount?: number;
  selectedIds?: string[];
  onClearSelection?: () => void;
  overflowActions?: ActionItem[];
  searchSlot?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function ActionBar({
  primaryAction,
  secondaryActions = [],
  bulkActions = [],
  selectedCount = 0,
  selectedIds = [],
  onClearSelection,
  overflowActions = [],
  searchSlot,
  children,
  className,
}: ActionBarProps) {
  const [open, setOpen] = useState(false);
  const isBulk = selectedCount > 0 && bulkActions.length > 0;

  return (
    <div
      role="toolbar"
      aria-label="Action Bar"
      className={cn(
        "flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2.5 rounded-2xl bg-card/80 backdrop-blur-md border border-border/70 shadow-xs",
        className
      )}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {isBulk ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            <span>{selectedCount} selected</span>
            {onClearSelection && (
              <button type="button" onClick={onClearSelection} className="ml-2 underline text-xs">Clear</button>
            )}
          </div>
        ) : searchSlot}
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
        {isBulk ? (
          bulkActions.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => a.onClick(selectedIds)}
              className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer", a.variant === "destructive" ? "bg-destructive text-destructive-foreground" : "bg-muted text-foreground")}
            >
              {a.icon && <a.icon className="h-3.5 w-3.5" />}
              <span>{a.label}</span>
            </button>
          ))
        ) : (
          <>
            {secondaryActions.filter(a => !a.hidden).map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={a.onClick}
                disabled={a.disabled}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-border/80 bg-background hover:bg-accent text-foreground disabled:opacity-50 cursor-pointer"
              >
                {a.icon && <a.icon className="h-3.5 w-3.5" />}
                <span>{a.label}</span>
                {a.shortcut && <kbd className="hidden md:inline ml-1 px-1 py-0.2 rounded text-[10px] font-mono bg-muted">{a.shortcut}</kbd>}
              </button>
            ))}

            {primaryAction && !primaryAction.hidden && (
              <button
                type="button"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {primaryAction.icon && <primaryAction.icon className="h-4 w-4" />}
                <span>{primaryAction.label}</span>
                {primaryAction.shortcut && <kbd className="hidden md:inline ml-1 px-1 py-0.2 rounded text-[10px] font-mono bg-primary-foreground/20">{primaryAction.shortcut}</kbd>}
              </button>
            )}

            {overflowActions.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpen(!open)}
                  aria-label="More options"
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/80 bg-background hover:bg-accent text-muted-foreground cursor-pointer"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {open && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-full mt-1.5 z-30 min-w-[160px] rounded-xl border border-border bg-popover p-1.5 shadow-lg">
                      {overflowActions.map((it) => (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => { it.onClick?.(); setOpen(false); }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium rounded-lg text-foreground hover:bg-accent cursor-pointer text-left"
                        >
                          {it.icon && <it.icon className="h-3.5 w-3.5 text-muted-foreground" />}
                          <span>{it.label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
        {children}
      </div>
    </div>
  );
}

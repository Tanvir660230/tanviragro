"use client";

import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button, buttonVariants } from "@/components/ui/button";
import { SlidersHorizontal, Eye, EyeOff, Pin, PinOff, ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GridColumn } from "./types";

export interface DataGridColumnCustomizerProps<T> {
  columns: GridColumn<T>[];
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;
  columnPinning: Record<string, "left" | "right" | false>;
  toggleColumnVisibility: (columnId: string) => void;
  setAllColumnsVisibility: (visible: boolean) => void;
  pinColumn: (columnId: string, side: "left" | "right" | false) => void;
  moveColumn: (columnId: string, direction: "left" | "right") => void;
}

export function DataGridColumnCustomizer<T>({
  columns,
  columnOrder,
  columnVisibility,
  columnPinning,
  toggleColumnVisibility,
  setAllColumnsVisibility,
  pinColumn,
  moveColumn,
}: DataGridColumnCustomizerProps<T>) {
  const columnMap = React.useMemo(() => {
    const map = new Map<string, GridColumn<T>>();
    columns.forEach((c) => map.set(c.id, c));
    return map;
  }, [columns]);

  return (
    <Popover>
      <PopoverTrigger
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 gap-1.5 text-xs cursor-pointer")}
      >
        <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
        <span>Columns</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3 space-y-3 bg-card border-border shadow-xl">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Customize Columns
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px] text-muted-foreground"
              onClick={() => setAllColumnsVisibility(true)}
            >
              Show All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px] text-muted-foreground"
              onClick={() => setAllColumnsVisibility(false)}
            >
              Hide All
            </Button>
          </div>
        </div>

        <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
          {columnOrder.map((colId, idx) => {
            const col = columnMap.get(colId);
            if (!col || colId === "__selection__" || colId === "__actions__") return null;

            const isVisible = columnVisibility[colId] !== false;
            const pinned = columnPinning[colId];
            const headerText = typeof col.header === "string" ? col.header : colId;

            return (
              <div
                key={colId}
                className="flex items-center justify-between p-1.5 rounded-lg text-xs hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 overflow-hidden mr-1">
                  <button
                    type="button"
                    onClick={() => toggleColumnVisibility(colId)}
                    className="text-muted-foreground hover:text-foreground"
                    title={isVisible ? "Hide column" : "Show column"}
                  >
                    {isVisible ? <Eye className="h-3.5 w-3.5 text-primary" /> : <EyeOff className="h-3.5 w-3.5 opacity-40" />}
                  </button>
                  <span className={`truncate ${!isVisible ? "line-through opacity-50" : ""}`}>
                    {headerText}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Pin left/right toggle */}
                  <button
                    type="button"
                    onClick={() => pinColumn(colId, pinned === "left" ? false : "left")}
                    className={`p-1 rounded hover:bg-muted ${pinned === "left" ? "text-primary font-bold" : "text-muted-foreground/60"}`}
                    title="Pin to Left"
                  >
                    <Pin className="h-3 w-3 rotate-45" />
                  </button>
                  {/* Move Up/Down */}
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveColumn(colId, "left")}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30"
                    title="Move Up"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === columnOrder.length - 1}
                    onClick={() => moveColumn(colId, "right")}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30"
                    title="Move Down"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

"use client";

import React, { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

export interface DataGridResizerProps {
  columnId: string;
  width: number | undefined;
  minWidth?: number;
  maxWidth?: number;
  onResize: (columnId: string, width: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
}

/**
 * `DataGridResizer` — draggable right-edge handle for resizing grid columns.
 * Accessible via keyboard (Arrow Left/Right while focused).
 */
export function DataGridResizer({
  columnId,
  width,
  minWidth = 60,
  maxWidth = 600,
  onResize,
  onResizeStart,
  onResizeEnd,
}: DataGridResizerProps) {
  const startX = useRef(0);
  const startWidth = useRef(width ?? 160);
  const dragging = useRef(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      startX.current = e.clientX;
      startWidth.current = width ?? 160;
      dragging.current = true;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      onResizeStart?.();

      const onMove = (ev: PointerEvent) => {
        if (!dragging.current) return;
        const delta = ev.clientX - startX.current;
        onResize(columnId, Math.max(minWidth, Math.min(maxWidth, startWidth.current + delta)));
      };
      const onUp = () => {
        dragging.current = false;
        onResizeEnd?.();
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [columnId, width, minWidth, maxWidth, onResize, onResizeStart, onResizeEnd]
  );

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize column`}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          e.stopPropagation();
          onResize(columnId, Math.max(minWidth, (width ?? 160) - 10));
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          e.stopPropagation();
          onResize(columnId, Math.min(maxWidth, (width ?? 160) + 10));
        }
      }}
      className={cn(
        "group/resizer absolute right-0 top-0 z-20 h-full w-1.5 cursor-col-resize select-none touch-none",
        "after:absolute after:inset-y-0 after:right-[3px] after:w-px after:bg-border/70",
        "hover:after:w-0.5 hover:after:bg-primary/60 focus-visible:after:w-0.5 focus-visible:after:bg-primary outline-none"
      )}
      title="Drag to resize column"
    />
  );
}
"use client";

import { useCallback, useEffect, useRef } from "react";

export interface KeyboardNavGridOptions {
  rowCount: number;
  columnCount: number;
  onActiveChange?: (row: number, col: number) => void;
  onSelect?: (row: number, col: number) => void;
  onEnterRow?: (row: number, col: number) => void;
  onSelectAll?: () => void;
  enabled?: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
}

export interface KeyboardNavResult {
  activeRow: number;
  activeCol: number;
  move: (dr: number, dc: number) => void;
  commit: () => void;
}

/**
 * `useKeyboardNav` — roving-focus style keyboard navigation for data grids.
 *
 * Arrow keys move the active cell, Space/Enter activates the row, Shift+Space
 * selects the current row, Home/End jump to first/last row, PageUp/PageDown
 * page the viewport, `a` with ctrl/meta selects all. Exposes `move`/`commit`
 * so row renderers can focus themselves.
 */
export function useKeyboardNavGrid({
  rowCount,
  columnCount,
  onActiveChange,
  onSelect,
  onEnterRow,
  onSelectAll,
  enabled = true,
  containerRef,
}: KeyboardNavGridOptions): KeyboardNavResult {
  const activeRow = useRef(0);
  const activeCol = useRef(0);
  const cb = useRef({ onActiveChange, onSelect, onEnterRow, onSelectAll });
  cb.current = { onActiveChange, onSelect, onEnterRow, onSelectAll };

  const emit = useCallback((row: number, col: number) => {
    activeRow.current = row;
    activeCol.current = col;
    cb.current.onActiveChange?.(row, col);
  }, []);

  const move = useCallback(
    (dr: number, dc: number) => {
      const nr = Math.max(0, Math.min(rowCount - 1, activeRow.current + dr));
      const nc = Math.max(0, Math.min(columnCount - 1, activeCol.current + dc));
      if (nr !== activeRow.current || nc !== activeCol.current) emit(nr, nc);
    },
    [rowCount, columnCount, emit]
  );

  const commit = useCallback(() => {
    cb.current.onEnterRow?.(activeRow.current, activeCol.current);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName)) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          move(1, 0);
          break;
        case "ArrowUp":
          e.preventDefault();
          move(-1, 0);
          break;
        case "ArrowLeft":
          e.preventDefault();
          move(0, -1);
          break;
        case "ArrowRight":
          e.preventDefault();
          move(0, 1);
          break;
        case "Home":
          e.preventDefault();
          emit(0, 0);
          break;
        case "End":
          e.preventDefault();
          emit(rowCount - 1, activeCol.current);
          break;
        case "PageDown":
          e.preventDefault();
          move(10, 0);
          break;
        case "PageUp":
          e.preventDefault();
          move(-10, 0);
          break;
        case "Enter":
          e.preventDefault();
          commit();
          break;
        case " ":
          if (e.shiftKey) {
            e.preventDefault();
            cb.current.onSelect?.(activeRow.current, activeCol.current);
          }
          break;
        default:
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
            e.preventDefault();
            cb.current.onSelectAll?.();
          }
      }
    };

    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [enabled, containerRef, move, commit, emit, rowCount]);

  return {
    activeRow: activeRow.current,
    activeCol: activeCol.current,
    move,
    commit,
  };
}
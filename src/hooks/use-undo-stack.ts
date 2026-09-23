"use client";

import { useCallback, useRef, useState } from "react";

export interface UndoEntry<T> {
  id: string;
  label: string;
  affectedCount: number;
  affectedIds: string[];
  snapshot: T;
  redo?: () => void;
}

/**
 * `useUndoStack` — generic undo/redo stack for bulk operations.
 *
 * Push a snapshot before mutating; call `undo()` to restore the most recent
 * snapshot and `redo()` to re-apply it. Keeps a bounded history (default 20).
 */
export function useUndoStack<T>(maxDepth: number = 20) {
  const [entries, setEntries] = useState<UndoEntry<T>[]>([]);
  const [cursor, setCursor] = useState(-1);
  const redoStack = useRef<UndoEntry<T>[]>([]);

  const canUndo = cursor >= 0;
  const canRedo = redoStack.current.length > 0;

  const push = useCallback(
    (entry: Omit<UndoEntry<T>, "id">) => {
      const full: UndoEntry<T> = { id: `undo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ...entry };
      setEntries((prev) => {
        const next = [...prev.slice(0, cursor + 1), full];
        return next.length > maxDepth ? next.slice(next.length - maxDepth) : next;
      });
      setCursor((c) => Math.min(c + 1, maxDepth - 1));
      redoStack.current = [];
    },
    [cursor, maxDepth]
  );

  const undo = useCallback((): UndoEntry<T> | null => {
    if (cursor < 0) return null;
    const entry = entries[cursor];
    setCursor((c) => c - 1);
    redoStack.current = [...redoStack.current, entry];
    return entry;
  }, [cursor, entries]);

  const redo = useCallback((): UndoEntry<T> | null => {
    const entry = redoStack.current.pop();
    if (!entry) return null;
    setEntries((prev) => [...prev.slice(0, cursor + 1), entry]);
    setCursor((c) => c + 1);
    return entry;
  }, [cursor]);

  const clear = useCallback(() => {
    setEntries([]);
    setCursor(-1);
    redoStack.current = [];
  }, []);

  return { entries, cursor, push, undo, redo, clear, canUndo, canRedo, depth: entries.length };
}
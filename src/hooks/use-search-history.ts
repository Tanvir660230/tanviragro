"use client";

import { useCallback } from "react";
import { usePersistentState } from "./use-persistent-state";

export interface SearchHistoryEntry {
  query: string;
  scope?: string;
  at: number;
}

export interface SearchHistoryActions {
  add: (query: string, scope?: string) => void;
  remove: (index: number) => void;
  clear: () => void;
  entries: SearchHistoryEntry[];
  matched: (query: string) => SearchHistoryEntry[];
}

/**
 * `useSearchHistory` — persisted list of recent search terms (localStorage).
 * Shared by every EnterpriseSearch instance so recents feel global per grid.
 */
export function useSearchHistory(
  key: string,
  maxEntries: number = 8,
  scope?: string
): SearchHistoryActions {
  const [entries, setEntries] = usePersistentState<SearchHistoryEntry[]>(`search-history:${key}`, []);

  const add = useCallback(
    (query: string, s?: string) => {
      const q = query.trim();
      if (!q) return;
      const scoped = s ?? scope;
      setEntries((prev) => {
        const next = prev.filter(
          (e) => !(e.query.toLowerCase() === q.toLowerCase() && (scoped ? e.scope === scoped : !e.scope))
        );
        next.unshift({ query: q, scope: scoped, at: Date.now() });
        return next.slice(0, maxEntries);
      });
    },
    [scope, setEntries, maxEntries]
  );

  const remove = useCallback(
    (index: number) => {
      setEntries((prev) => prev.filter((_, i) => i !== index));
    },
    [setEntries]
  );

  const clear = useCallback(() => setEntries([]), [setEntries]);

  const matched = useCallback(
    (query: string) => {
      const q = query.trim().toLowerCase();
      if (!q) return entries;
      return entries.filter((e) => e.query.toLowerCase().includes(q));
    },
    [entries]
  );

  return { add, remove, clear, entries, matched };
}
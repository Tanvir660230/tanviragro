"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * `usePersistentState` — localStorage-backed state hook.
 * Used for column layouts, search history, saved filters and grid preferences.
 *
 * @param key      Storage key (namespaced automatically with `tanvir-agro`)
 * @param initial  Initial / fallback value
 * @returns        [value, setValue] mirroring React's useState
 */
export function usePersistentState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const stored = window.localStorage.getItem(`tanvir-agro:${key}`);
      if (stored !== null) return JSON.parse(stored) as T;
    } catch {
      /* corrupt storage — fall back to initial */
    }
    return initial;
  });

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(`tanvir-agro:${key}`, JSON.stringify(value));
      }
    } catch {
      /* storage full / private mode — ignore */
    }
  }, [key, value]);

  const reset = useCallback(() => setValue(initial), [initial]);

  return [value, setValue];
}

export interface PersistentStateActions<T> {
  set: React.Dispatch<React.SetStateAction<T>>;
  reset: () => void;
  clear: () => void;
}

/**
 * Extended variant that also exposes `reset` and `clear` actions.
 */
export function usePersistentStateWithActions<T>(
  key: string,
  initial: T
): [T, PersistentStateActions<T>] {
  const [value, setValue] = usePersistentState<T>(key, initial);
  const reset = useCallback(() => setValue(initial), [setValue, initial]);
  const clear = useCallback(() => setValue(initial), [setValue, initial]);
  return [value, { set: setValue, reset, clear }];
}
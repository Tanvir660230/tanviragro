"use client";

import { useSyncExternalStore } from "react";

const subscribe = (callback: () => void) => {
  if (typeof window !== "undefined") {
    window.addEventListener("online", callback);
    window.addEventListener("offline", callback);
    return () => {
      window.removeEventListener("online", callback);
      window.removeEventListener("offline", callback);
    };
  }
  return () => {};
};

const getSnapshot = () => {
  return typeof navigator !== "undefined" ? !navigator.onLine : false;
};

const getServerSnapshot = () => false;

export function useOffline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

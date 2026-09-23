"use client";

import React, { createContext, useContext, useMemo, useState, useSyncExternalStore } from "react";
import { DashboardRole, DashboardPersonalizationState } from "./widget-types";
import { ROLE_DEFAULT_WIDGETS, MASTER_WIDGET_CATALOG } from "./default-widgets";

interface PersonalizationContextValue {
  role: DashboardRole;
  setRole: (role: DashboardRole) => void;
  visibleWidgetIds: string[];
  toggleWidgetVisibility: (id: string) => void;
  pinnedWidgetIds: string[];
  togglePinWidget: (id: string) => void;
  resetToDefault: () => void;
  isCustomizing: boolean;
  setIsCustomizing: (val: boolean) => void;
}

const PersonalizationContext = createContext<PersonalizationContextValue | null>(null);

const STORAGE_KEY = "tanvir_agro_dashboard_personalization_v1";

// saveState() dispatches a synthetic "storage" event, so same-tab writes notify subscribers too.
function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function DashboardPersonalizationProvider({
  initialRole = "owner",
  children,
}: {
  initialRole?: DashboardRole;
  children: React.ReactNode;
}) {
  const [role, setRoleState] = useState<DashboardRole>(initialRole);
  const [isCustomizing, setIsCustomizing] = useState(false);

  // localStorage is the single source of truth; the server snapshot is null so SSR renders defaults.
  const storageKey = `${STORAGE_KEY}_${role}`;
  const saved = useSyncExternalStore(
    subscribeToStorage,
    () => readStorage(storageKey),
    () => null
  );
  const parsed = useMemo<Partial<DashboardPersonalizationState> | null>(() => {
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }, [saved]);

  const roleDefaults = ROLE_DEFAULT_WIDGETS[role] || ROLE_DEFAULT_WIDGETS.owner;
  const visibleWidgetIds = parsed?.visibleWidgetIds ?? roleDefaults;
  const pinnedWidgetIds = parsed?.pinnedWidgetIds ?? [];

  // Persist changes
  const saveState = (newVisible: string[], newPinned: string[]) => {
    try {
      localStorage.setItem(
        `${STORAGE_KEY}_${role}`,
        JSON.stringify({
          role,
          visibleWidgetIds: newVisible,
          pinnedWidgetIds: newPinned,
        })
      );
      // Dispatch a storage event manually to trigger updates in other components
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: `${STORAGE_KEY}_${role}`,
          newValue: JSON.stringify({
            role,
            visibleWidgetIds: newVisible,
            pinnedWidgetIds: newPinned,
          }),
        })
      );
    } catch {
      // ignore
    }
  };

  // Saved settings for the new role (if any) are picked up by the store; otherwise its defaults apply.
  const setRole = (newRole: DashboardRole) => {
    setRoleState(newRole);
  };

  const toggleWidgetVisibility = (id: string) => {
    const next = visibleWidgetIds.includes(id)
      ? visibleWidgetIds.filter((item) => item !== id)
      : [...visibleWidgetIds, id];
    saveState(next, pinnedWidgetIds);
  };

  const togglePinWidget = (id: string) => {
    const next = pinnedWidgetIds.includes(id)
      ? pinnedWidgetIds.filter((item) => item !== id)
      : [...pinnedWidgetIds, id];
    saveState(visibleWidgetIds, next);
  };

  const resetToDefault = () => {
    saveState(roleDefaults, []);
  };

  return (
    <PersonalizationContext.Provider
      value={{
        role,
        setRole,
        visibleWidgetIds,
        toggleWidgetVisibility,
        pinnedWidgetIds,
        togglePinWidget,
        resetToDefault,
        isCustomizing,
        setIsCustomizing,
      }}
    >
      {children}
    </PersonalizationContext.Provider>
  );
}

export function useDashboardPersonalization() {
  const ctx = useContext(PersonalizationContext);
  if (!ctx) {
    throw new Error("useDashboardPersonalization must be used within DashboardPersonalizationProvider");
  }
  return ctx;
}

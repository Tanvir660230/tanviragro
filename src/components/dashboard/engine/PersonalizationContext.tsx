"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
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

export function DashboardPersonalizationProvider({
  initialRole = "owner",
  children,
}: {
  initialRole?: DashboardRole;
  children: React.ReactNode;
}) {
  const [role, setRoleState] = useState<DashboardRole>(initialRole);
  const [visibleWidgetIds, setVisibleWidgetIds] = useState<string[]>(ROLE_DEFAULT_WIDGETS[initialRole]);
  const [pinnedWidgetIds, setPinnedWidgetIds] = useState<string[]>([]);
  const [isCustomizing, setIsCustomizing] = useState(false);

  // Load from localStorage on mount and updates
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `${STORAGE_KEY}_${role}`) {
        if (e.newValue) {
          const parsed = JSON.parse(e.newValue);
          setVisibleWidgetIds(parsed.visibleWidgetIds || []);
          setPinnedWidgetIds(parsed.pinnedWidgetIds || []);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);

    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_${role}`);
      if (saved) {
        const parsed: Partial<DashboardPersonalizationState> = JSON.parse(saved);
        if (parsed.visibleWidgetIds) setVisibleWidgetIds(parsed.visibleWidgetIds);
        if (parsed.pinnedWidgetIds) setPinnedWidgetIds(parsed.pinnedWidgetIds);
      } else {
        setVisibleWidgetIds(ROLE_DEFAULT_WIDGETS[role] || ROLE_DEFAULT_WIDGETS.owner);
      }
    } catch {
      // ignore
    }

    return () => window.removeEventListener("storage", handleStorageChange);
  }, [role]);

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

  const setRole = (newRole: DashboardRole) => {
    setRoleState(newRole);
    const defaults = ROLE_DEFAULT_WIDGETS[newRole] || ROLE_DEFAULT_WIDGETS.owner;
    setVisibleWidgetIds(defaults);
  };

  const toggleWidgetVisibility = (id: string) => {
    setVisibleWidgetIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      saveState(next, pinnedWidgetIds);
      return next;
    });
  };

  const togglePinWidget = (id: string) => {
    setPinnedWidgetIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      saveState(visibleWidgetIds, next);
      return next;
    });
  };

  const resetToDefault = () => {
    const defaults = ROLE_DEFAULT_WIDGETS[role] || ROLE_DEFAULT_WIDGETS.owner;
    setVisibleWidgetIds(defaults);
    setPinnedWidgetIds([]);
    saveState(defaults, []);
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

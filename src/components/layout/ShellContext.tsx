"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type UtilityTab = "calculator" | "notes" | "tasks" | "feed_calc" | "activity";

export interface FavoritePage {
  href: string;
  label: string;
  addedAt: number;
}

export interface RecentPage {
  href: string;
  label: string;
  visitedAt: number;
}

export interface ShellContextType {
  // Sidebar state
  isSidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  toggleSidebar: () => void;
  isMobileDrawerOpen: boolean;
  setMobileDrawerOpen: (open: boolean) => void;

  // Right Utility Panel state
  isUtilityOpen: boolean;
  setUtilityOpen: (open: boolean) => void;
  activeUtilityTab: UtilityTab;
  setActiveUtilityTab: (tab: UtilityTab) => void;
  toggleUtilityPanel: (tab?: UtilityTab) => void;

  // Command palette & Shortcuts
  isCommandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  isShortcutsModalOpen: boolean;
  setShortcutsModalOpen: (open: boolean) => void;

  // Favorites
  favorites: FavoritePage[];
  addFavorite: (href: string, label: string) => void;
  removeFavorite: (href: string) => void;
  isFavorite: (href: string) => boolean;
  toggleFavorite: (href: string, label: string) => void;

  // Recent Pages
  recentPages: RecentPage[];
  trackPageVisit: (href: string, label: string) => void;
  clearRecentPages: () => void;
}

const ShellContext = createContext<ShellContextType | null>(null);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [isSidebarCollapsed, setSidebarCollapsedState] = useState<boolean>(false);
  const [isMobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [isUtilityOpen, setUtilityOpen] = useState<boolean>(false);
  const [activeUtilityTab, setActiveUtilityTab] = useState<UtilityTab>("calculator");
  const [isCommandOpen, setCommandOpen] = useState<boolean>(false);
  const [isShortcutsModalOpen, setShortcutsModalOpen] = useState<boolean>(false);
  const [favorites, setFavorites] = useState<FavoritePage[]>([]);
  const [recentPages, setRecentPages] = useState<RecentPage[]>([]);

  // Restore state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("tanvir_sidebar_collapsed");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved !== null) setSidebarCollapsedState(saved === "true");
      const savedFavs = localStorage.getItem("tanvir_favorites");
      if (savedFavs) setFavorites(JSON.parse(savedFavs));
      const savedRecent = localStorage.getItem("tanvir_recent_pages");
      if (savedRecent) setRecentPages(JSON.parse(savedRecent));
    } catch {
      // Ignore local storage error in private browsing
    }
  }, []);

  const setSidebarCollapsed = useCallback((action: boolean | ((prev: boolean) => boolean)) => {
    setSidebarCollapsedState((prev) => {
      const next = typeof action === "function" ? action(prev) : action;
      try {
        localStorage.setItem("tanvir_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, [setSidebarCollapsed]);

  const toggleUtilityPanel = useCallback((tab?: UtilityTab) => {
    setUtilityOpen((prev) => {
      if (!prev && tab) {
        setActiveUtilityTab(tab);
        return true;
      }
      if (prev && tab && activeUtilityTab !== tab) {
        setActiveUtilityTab(tab);
        return true;
      }
      return !prev;
    });
  }, [activeUtilityTab]);

  // ── Favorites ──────────────────────────────────────────────────────────────
  const persistFavorites = useCallback((favs: FavoritePage[]) => {
    try { localStorage.setItem("tanvir_favorites", JSON.stringify(favs)); } catch {}
  }, []);

  const addFavorite = useCallback((href: string, label: string) => {
    setFavorites((prev) => {
      if (prev.some((f) => f.href === href)) return prev;
      const next = [...prev, { href, label, addedAt: Date.now() }];
      persistFavorites(next);
      return next;
    });
  }, [persistFavorites]);

  const removeFavorite = useCallback((href: string) => {
    setFavorites((prev) => {
      const next = prev.filter((f) => f.href !== href);
      persistFavorites(next);
      return next;
    });
  }, [persistFavorites]);

  const isFavorite = useCallback((href: string) => {
    return favorites.some((f) => f.href === href);
  }, [favorites]);

  const toggleFavorite = useCallback((href: string, label: string) => {
    if (favorites.some((f) => f.href === href)) {
      removeFavorite(href);
    } else {
      addFavorite(href, label);
    }
  }, [favorites, addFavorite, removeFavorite]);

  // ── Recent Pages ───────────────────────────────────────────────────────────
  const persistRecent = useCallback((pages: RecentPage[]) => {
    try { localStorage.setItem("tanvir_recent_pages", JSON.stringify(pages)); } catch {}
  }, []);

  const trackPageVisit = useCallback((href: string, label: string) => {
    setRecentPages((prev) => {
      const filtered = prev.filter((p) => p.href !== href);
      const next = [{ href, label, visitedAt: Date.now() }, ...filtered].slice(0, 20);
      persistRecent(next);
      return next;
    });
  }, [persistRecent]);

  const clearRecentPages = useCallback(() => {
    setRecentPages([]);
    try { localStorage.removeItem("tanvir_recent_pages"); } catch {}
  }, []);

  return (
    <ShellContext.Provider
      value={{
        isSidebarCollapsed,
        setSidebarCollapsed,
        toggleSidebar,
        isMobileDrawerOpen,
        setMobileDrawerOpen,
        isUtilityOpen,
        setUtilityOpen,
        activeUtilityTab,
        setActiveUtilityTab,
        toggleUtilityPanel,
        isCommandOpen,
        setCommandOpen,
        isShortcutsModalOpen,
        setShortcutsModalOpen,
        favorites,
        addFavorite,
        removeFavorite,
        isFavorite,
        toggleFavorite,
        recentPages,
        trackPageVisit,
        clearRecentPages,
      }}
    >
      {children}
    </ShellContext.Provider>
  );
}

export function useShell(): ShellContextType {
  const ctx = useContext(ShellContext);
  if (!ctx) {
    return {
      isSidebarCollapsed: false,
      setSidebarCollapsed: () => {},
      toggleSidebar: () => {},
      isMobileDrawerOpen: false,
      setMobileDrawerOpen: () => {},
      isUtilityOpen: false,
      setUtilityOpen: () => {},
      activeUtilityTab: "calculator",
      setActiveUtilityTab: () => {},
      toggleUtilityPanel: () => {},
      isCommandOpen: false,
      setCommandOpen: () => {},
      isShortcutsModalOpen: false,
      setShortcutsModalOpen: () => {},
      favorites: [],
      addFavorite: () => {},
      removeFavorite: () => {},
      isFavorite: () => false,
      toggleFavorite: () => {},
      recentPages: [],
      trackPageVisit: () => {},
      clearRecentPages: () => {},
    };
  }
  return ctx;
}

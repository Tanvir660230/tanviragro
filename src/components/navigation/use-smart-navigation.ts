"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";

export interface RecentPageItem {
  href: string;
  label: string;
  timestamp: number;
}

const STORAGE_KEY_PINNED = "tanvir_nav_pinned_pages";
const STORAGE_KEY_RECENTS = "tanvir_nav_recent_pages";
const STORAGE_KEY_GROUPS = "tanvir_nav_collapsed_groups";

export function useSmartNavigation() {
  const pathname = usePathname();
  const [pinnedHrefs, setPinnedHrefs] = useState<string[]>([]);
  const [recentPages, setRecentPages] = useState<RecentPageItem[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [filterQuery, setFilterQuery] = useState<string>("");
  const [isHydrated, setIsHydrated] = useState(false);

  // Initialize from localStorage on mount
  useEffect(() => {
    try {
      const savedPinned = localStorage.getItem(STORAGE_KEY_PINNED);
      if (savedPinned) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPinnedHrefs(JSON.parse(savedPinned));
      } else {
        // Default pinned items
        const defaultPinned = ["/dashboard", "/dashboard/cattle", "/dashboard/inventory"];
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPinnedHrefs(defaultPinned);
      }

      const savedRecents = localStorage.getItem(STORAGE_KEY_RECENTS);
      if (savedRecents) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRecentPages(JSON.parse(savedRecents));
      }

      const savedGroups = localStorage.getItem(STORAGE_KEY_GROUPS);
      if (savedGroups) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCollapsedGroups(JSON.parse(savedGroups));
      }
    } catch {
      // Ignore storage errors in restricted contexts
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Track recent pages when pathname changes
  const recordRecentPage = useCallback((href: string, label: string) => {
    if (!href || href === "/login") return;

    setRecentPages((prev) => {
      const filtered = prev.filter((p) => p.href !== href);
      const updated = [{ href, label, timestamp: Date.now() }, ...filtered].slice(0, 5);
      try {
        localStorage.setItem(STORAGE_KEY_RECENTS, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  // Toggle Pinned/Favorite
  const togglePin = useCallback((href: string) => {
    setPinnedHrefs((prev) => {
      const next = prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href];
      try {
        localStorage.setItem(STORAGE_KEY_PINNED, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const isPinned = useCallback(
    (href: string) => pinnedHrefs.includes(href),
    [pinnedHrefs]
  );

  // Toggle group open/collapsed
  const toggleGroupCollapse = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      try {
        localStorage.setItem(STORAGE_KEY_GROUPS, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const isGroupCollapsed = useCallback(
    (groupId: string, defaultOpen = true) => {
      if (collapsedGroups[groupId] !== undefined) {
        return collapsedGroups[groupId];
      }
      return !defaultOpen;
    },
    [collapsedGroups]
  );

  return {
    pathname,
    pinnedHrefs,
    togglePin,
    isPinned,
    recentPages,
    recordRecentPage,
    collapsedGroups,
    toggleGroupCollapse,
    isGroupCollapsed,
    filterQuery,
    setFilterQuery,
    isHydrated,
  };
}

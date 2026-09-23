"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  X,
  ChevronDown,
  ChevronRight,
  Pin,
  Sparkles,
  Search,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/I18nProvider";
import { logout } from "@/app/(auth)/login/actions";
import {
  ENTERPRISE_NAV_CONFIG,
  NavItemDef,
  isNavActive,
  getAllNavHrefs,
  canUserAccessNavItem,
} from "./nav-config";
import { useSmartNavigation } from "./use-smart-navigation";
import { ExtendedUserRole, ROLE_BADGE_STYLE } from "@/constants/roles";
import { useShell } from "@/components/layout/ShellContext";

interface MobileSidebarDrawerProps {
  isAdmin?: boolean;
  role?: ExtendedUserRole;
  business?: { name?: string; logo_url?: string | null } | null;
  userEmail?: string;
}

export function MobileSidebarDrawer({
  isAdmin = true,
  role = "owner",
  business,
  userEmail,
}: MobileSidebarDrawerProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { isMobileDrawerOpen, setMobileDrawerOpen } = useShell();
  const {
    pinnedHrefs,
    togglePin,
    isPinned,
    toggleGroupCollapse,
    isGroupCollapsed,
    filterQuery,
    setFilterQuery,
    isHydrated,
  } = useSmartNavigation();

  const [expandedSubtrees, setExpandedSubtrees] = useState<Record<string, boolean>>({});

  const allHrefs = useMemo(() => getAllNavHrefs(ENTERPRISE_NAV_CONFIG), []);
  const bizName = business?.name ?? "Tanvir Agro";
  const bizLogo = business?.logo_url;

  // Auto close drawer on navigation
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname, setMobileDrawerOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileDrawerOpen) {
        setMobileDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileDrawerOpen, setMobileDrawerOpen]);

  const toggleSubtree = (itemId: string) => {
    setExpandedSubtrees((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  // Filter groups and items
  const filteredGroups = useMemo(() => {
    const q = filterQuery.toLowerCase().trim();

    return ENTERPRISE_NAV_CONFIG.map((group) => {
      const allowedItems = group.items.filter((item) =>
        canUserAccessNavItem(item, role, isAdmin)
      );

      if (!q) {
        return { ...group, items: allowedItems };
      }

      const matchedItems = allowedItems.filter((item) => {
        const itemLabel =
          (t.sidebar[item.labelKey as keyof typeof t.sidebar] as string) ||
          item.defaultLabel;
        const labelMatch = itemLabel.toLowerCase().includes(q);
        const keywordMatch = item.keywords?.some((k) =>
          k.toLowerCase().includes(q)
        );
        return labelMatch || keywordMatch;
      }) as NavItemDef[];

      return { ...group, items: matchedItems };
    }).filter((g) => g.items.length > 0);
  }, [filterQuery, role, isAdmin, t]);

  const pinnedItems = useMemo(() => {
    if (!isHydrated) return [];
    const itemsMap = new Map<string, { href: string; label: string; icon: React.ComponentType<{ className?: string }> }>();

    for (const group of ENTERPRISE_NAV_CONFIG) {
      for (const item of group.items) {
        if (pinnedHrefs.includes(item.href) && canUserAccessNavItem(item, role, isAdmin)) {
          if (!itemsMap.has(item.href)) {
            const label = (t.sidebar[item.labelKey as keyof typeof t.sidebar] as string) || item.defaultLabel;
            itemsMap.set(item.href, { href: item.href, label, icon: item.icon });
          }
        }
        if (item.children) {
          for (const child of item.children) {
            if (pinnedHrefs.includes(child.href) && canUserAccessNavItem(child, role, isAdmin)) {
              if (!itemsMap.has(child.href)) {
                const label = (t.sidebar[child.labelKey as keyof typeof t.sidebar] as string) || child.defaultLabel;
                itemsMap.set(child.href, { href: child.href, label, icon: item.icon });
              }
            }
          }
        }
      }
    }
    return Array.from(itemsMap.values());
  }, [pinnedHrefs, isHydrated, role, isAdmin, t]);

  const roleBadgeStyle = ROLE_BADGE_STYLE[role] || "bg-muted text-muted-foreground";
  if (!isMobileDrawerOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mobile Navigation"
      className="md:hidden fixed inset-0 z-50 flex"
    >
      {/* BACKDROP AND RENDER CONTENT HERE */}
    </div>
  );
}

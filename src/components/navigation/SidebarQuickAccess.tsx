"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Star, Clock, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useShell } from "@/components/layout/ShellContext";
import { useSmartNavigation } from "./use-smart-navigation";
import { ENTERPRISE_NAV_CONFIG, isNavActive, getAllNavHrefs } from "./nav-config";

/**
 * Quick Access section for the top of the sidebar.
 * Shows pinned pages, recently visited pages, and favorites.
 */
export function SidebarQuickAccess({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const { favorites, recentPages: shellRecents } = useShell();
  const { pinnedHrefs, recentPages: smartRecents, isHydrated } = useSmartNavigation();
  const allHrefs = useMemo(() => getAllNavHrefs(ENTERPRISE_NAV_CONFIG), []);

  const pinnedPages = useMemo(() => {
    return pinnedHrefs
      .map((href) => {
        for (const group of ENTERPRISE_NAV_CONFIG) {
          for (const item of group.items) {
            if (item.href === href) return { href, label: item.defaultLabel, Icon: item.icon };
          }
        }
        return { href, label: href.split("/").pop()?.replace(/-/g, " ") ?? "Page", Icon: Pin };
      })
      .slice(0, collapsed ? 8 : 5);
  }, [pinnedHrefs]);

  const recentPages = useMemo(
    () => shellRecents.filter((p) => p.href !== "/dashboard").slice(0, collapsed ? 4 : 3),
    [shellRecents]
  );

  if (!isHydrated || (pinnedPages.length === 0 && recentPages.length === 0 && favorites.length === 0)) {
    return null;
  }

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-all",
      active
        ? "bg-primary/10 text-primary font-semibold"
        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
    );

  const iconClass = (active: boolean) =>
    cn("h-3.5 w-3.5 shrink-0", active ? "text-primary" : "text-muted-foreground/60");

  const collapsedLinkClass = (active: boolean) =>
    cn(
      "flex items-center justify-center h-8 w-8 mx-auto rounded-lg transition-all",
      active ? "bg-primary/10 text-primary" : "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
    );

  return (
    <div className="space-y-1">
      {pinnedPages.length > 0 && (
        <div className="space-y-0.5">
          {!collapsed && (
            <div className="flex items-center gap-1.5 px-2 py-1">
              <Pin className="h-3 w-3 text-muted-foreground/50" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Pinned</span>
            </div>
          )}
          {pinnedPages.map(({ href, label, Icon }) => {
            const active = isNavActive(href, pathname);
            if (collapsed) {
              return (
                <Link key={href} href={href} title={label} className={collapsedLinkClass(active)}>
                  <Icon className="h-4 w-4" />
                </Link>
              );
            }
            return (
              <Link key={href} href={href} className={linkClass(active)}>
                <Icon className={iconClass(active)} />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      )}

      {!collapsed && favorites.length > 0 && (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 px-2 py-1">
            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Favorites</span>
          </div>
          {favorites.slice(0, 3).map((fav) => {
            const active = isNavActive(fav.href, pathname);
            return (
              <Link key={fav.href} href={fav.href} className={linkClass(active)}>
                <Star className="h-3.5 w-3.5 shrink-0 text-amber-500 fill-amber-500" />
                <span className="truncate">{fav.label}</span>
              </Link>
            );
          })}
        </div>
      )}

      {recentPages.length > 0 && (
        <div className="space-y-0.5">
          {!collapsed && (
            <div className="flex items-center gap-1.5 px-2 py-1">
              <Clock className="h-3 w-3 text-muted-foreground/50" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Recent</span>
            </div>
          )}
          {recentPages.map((page) => {
            const active = isNavActive(page.href, pathname);
            if (collapsed) {
              return (
                <Link key={page.href} href={page.href} title={page.label} className={collapsedLinkClass(active)}>
                  <Clock className="h-3.5 w-3.5" />
                </Link>
              );
            }
            return (
              <Link key={page.href + page.visitedAt} href={page.href} className={linkClass(active)}>
                <Clock className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                <span className="truncate">{page.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}



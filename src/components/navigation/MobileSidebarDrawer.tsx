"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/I18nProvider";
import { logout } from "@/app/(auth)/login/actions";
import { ExtendedUserRole } from "@/constants/roles";
import { useShell } from "@/components/layout/ShellContext";
import { ENTERPRISE_NAV_CONFIG, canUserAccessNavItem, navGroupLabel, navLabel } from "./nav-config";
import { activeHref } from "./site-map";

interface MobileSidebarDrawerProps {
  isAdmin?: boolean;
  role?: ExtendedUserRole;
  business?: { name?: string; logo_url?: string | null } | null;
  userEmail?: string;
}

/**
 * The phone menu (☰): every section and its pages from the site map. (It used to render an
 * empty, invisible full-screen layer that blocked the screen.)
 */
export function MobileSidebarDrawer({ isAdmin = true, role = "owner", business, userEmail }: MobileSidebarDrawerProps) {
  const pathname = usePathname() ?? "";
  const { locale } = useTranslation();
  const { isMobileDrawerOpen, setMobileDrawerOpen } = useShell();
  const close = () => setMobileDrawerOpen(false);

  // close on navigation and on Escape
  useEffect(() => { setMobileDrawerOpen(false); }, [pathname, setMobileDrawerOpen]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileDrawerOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setMobileDrawerOpen]);

  if (!isMobileDrawerOpen) return null;
  const current = activeHref(pathname);

  return (
    <div role="dialog" aria-modal="true" aria-label={locale === "bn" ? "মেনু" : "Menu"} className="fixed inset-0 z-[60] flex md:hidden">
      <button type="button" aria-label={locale === "bn" ? "বন্ধ করুন" : "Close"} onClick={close} className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <aside className="relative flex h-full w-[82%] max-w-xs flex-col border-r border-sidebar-border bg-sidebar shadow-xl">
        <header className="flex items-center justify-between gap-2 border-b border-sidebar-border px-4 py-3">
          <p className="truncate text-sm font-bold text-sidebar-foreground">{business?.name ?? "Tanvir Agro"}</p>
          <button type="button" onClick={close} aria-label={locale === "bn" ? "বন্ধ করুন" : "Close"}
            className="rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground">
            <X className="h-5 w-5" />
          </button>
        </header>
        <nav className="flex-1 space-y-5 overflow-y-auto p-3">
          {ENTERPRISE_NAV_CONFIG.map((group) => {
            const items = group.items.filter((i) => canUserAccessNavItem(i, role, isAdmin));
            if (!items.length) return null;
            return (
              <div key={group.id} className="space-y-1">
                <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/50">{navGroupLabel(group, locale)}</p>
                {items.map((item) => {
                  const Icon = item.icon;
                  const on = current === item.href || (item.children ?? []).some((c) => c.href === current);
                  return (
                    <div key={item.id}>
                      <Link href={item.href} onClick={close}
                        className={cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium",
                          on ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent")}>
                        <Icon className="h-4 w-4 shrink-0" />{navLabel(item, locale)}
                      </Link>
                      {on && item.children && (
                        <div className="ml-7 mt-1 space-y-0.5 border-l border-sidebar-border pl-2">
                          {item.children.map((c) => (
                            <Link key={c.id} href={c.href} onClick={close}
                              className={cn("block rounded px-2 py-1.5 text-xs",
                                current === c.href ? "font-semibold text-sidebar-foreground" : "text-sidebar-foreground/60 hover:text-sidebar-foreground")}>
                              {navLabel(c, locale)}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <footer className="flex items-center justify-between gap-2 border-t border-sidebar-border px-4 py-3">
          <span className="truncate text-xs text-sidebar-foreground/70">{userEmail ?? ""}</span>
          <form action={logout}>
            <button type="submit" aria-label={locale === "bn" ? "লগ আউট" : "Log out"} className="rounded-md p-1.5 text-sidebar-foreground/60 hover:text-destructive">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </footer>
      </aside>
    </div>
  );
}

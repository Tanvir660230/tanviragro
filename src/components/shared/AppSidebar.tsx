"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Beef,
  Package,
  BarChart3,
  BookOpen,
  Settings,
  LogOut,
  Store,
  Users,
  Landmark,
  FileText,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/app/(auth)/login/actions";
import { useTranslation } from "@/i18n/I18nProvider";

type NavItem = {
  href:      string;
  labelKey:  string;
  icon:      React.ComponentType<{ className?: string }>;
  adminOnly: boolean;
};

type NavGroup = {
  groupLabel?: string;
  items:       NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: "/dashboard",           labelKey: "dashboard", icon: LayoutDashboard, adminOnly: false },
      { href: "/dashboard/cattle",    labelKey: "cattle",    icon: Beef,            adminOnly: false },
      { href: "/dashboard/inventory", labelKey: "inventory", icon: Package,         adminOnly: false },
    ],
  },
  {
    groupLabel: "group_business",
    items: [
      { href: "/dashboard/finance",       labelKey: "finance",    icon: BarChart3, adminOnly: true  },
      { href: "/dashboard/finance/loans", labelKey: "loans",      icon: Landmark,  adminOnly: true  },
      { href: "/dashboard/accounting",    labelKey: "accounting", icon: BookOpen,  adminOnly: true  },
      { href: "/dashboard/partners",      labelKey: "partners",   icon: Users,     adminOnly: false },
      { href: "/dashboard/vendors",       labelKey: "vendors",    icon: Store,     adminOnly: false },
    ],
  },
  {
    groupLabel: "group_reports",
    items: [
      { href: "/dashboard/compliance", labelKey: "compliance", icon: ClipboardList, adminOnly: false },
      { href: "/dashboard/report",     labelKey: "report",     icon: FileText,      adminOnly: true  },
    ],
  },
  {
    groupLabel: "group_system",
    items: [
      { href: "/dashboard/settings", labelKey: "settings", icon: Settings, adminOnly: true },
    ],
  },
];

// Returns true only for the most-specific matching nav item so that
// /dashboard/finance stays inactive when /dashboard/finance/loans is active.
function isNavActive(href: string, pathname: string, allHrefs: string[]): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (!pathname.startsWith(href)) return false;
  return !allHrefs.some(
    (h) => h !== href && h.startsWith(href + "/") && pathname.startsWith(h)
  );
}

export function AppSidebar({
  isAdmin = true,
  business,
}: {
  isAdmin?: boolean;
  business?: { name?: string; logo_url?: string | null } | null;
}) {
  const pathname = usePathname();
  const { t } = useTranslation();

  const allHrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
  const bizName  = business?.name ?? "Chowdhury Agro";
  const bizLogo  = business?.logo_url;

  return (
    <aside
      aria-label="Main navigation"
      className="hidden md:flex h-svh md:w-48 lg:w-56 flex-col bg-sidebar border-r border-sidebar-border/50 sticky top-0 shrink-0 z-10"
    >
      {/* Brand */}
      <div className="flex h-14 items-center gap-3 px-4 lg:px-5 border-b border-sidebar-border/50 shrink-0">
        <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary overflow-hidden shadow-card">
          {bizLogo ? (
            <Image src={bizLogo} alt={bizName} fill sizes="28px" className="object-cover" />
          ) : (
            <span className="text-sm leading-none">🌿</span>
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-sidebar-foreground truncate leading-tight">
            {bizName}
          </span>
          <span className="text-xs text-sidebar-foreground/45 uppercase tracking-wide">
            Agro ERP
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav
        aria-label="Sidebar navigation"
        className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4 scrollbar-none"
      >
        {NAV_GROUPS.map((group, gi) => {
          const visibleItems = group.items.filter((n) => !n.adminOnly || isAdmin);
          if (visibleItems.length === 0) return null;

          return (
            <div key={gi} className="space-y-0.5">
              {/* Section label — simple, Apple-style */}
              {group.groupLabel && (
                <p className="px-3 pt-1 pb-1 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/35 select-none">
                  {t.sidebar[group.groupLabel as keyof typeof t.sidebar]}
                </p>
              )}

              {visibleItems.map(({ href, labelKey, icon: Icon }) => {
                const active = isNavActive(href, pathname, allHrefs);
                const label  = t.sidebar[labelKey as keyof typeof t.sidebar];

                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150",
                      active
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-sidebar-foreground/65 font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    {/* Active left-bar indicator */}
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-[52%] w-[3px] rounded-r-full bg-primary" />
                    )}
                    <Icon
                      className={cn(
                        "h-[17px] w-[17px] shrink-0 transition-colors duration-150",
                        active
                          ? "text-primary"
                          : "text-sidebar-foreground/40 group-hover:text-sidebar-accent-foreground"
                      )}
                    />
                    <span className="truncate">{label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Logout — part of nav, not isolated */}
      <div className="shrink-0 px-2.5 pb-3 pt-1 border-t border-sidebar-border/40">
        <form action={logout} className="w-full">
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/40 hover:bg-destructive/8 hover:text-destructive transition-all duration-150 mt-1"
          >
            <LogOut className="h-[17px] w-[17px] shrink-0" />
            <span>{t.common.logout}</span>
          </button>
        </form>
      </div>
    </aside>
  );
}

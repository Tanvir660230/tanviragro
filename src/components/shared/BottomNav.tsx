"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Home, Beef, Package, BarChart3, MoreHorizontal,
  Users, Store, Settings, ClipboardList, FileText,
  X, BookOpen, Landmark,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/I18nProvider";

const MOBILE_NAV = [
  { href: "/dashboard",           navKey: "home",      icon: Home,      adminOnly: false },
  { href: "/dashboard/cattle",    navKey: "cattle",    icon: Beef,      adminOnly: false },
  { href: "/dashboard/inventory", navKey: "inventory", icon: Package,   adminOnly: false },
  { href: "/dashboard/finance",   navKey: "finance",   icon: BarChart3, adminOnly: true  },
];

type MoreLink = {
  href:      string;
  labelKey:  string;
  icon:      React.ComponentType<{ className?: string }>;
  adminOnly: boolean;
};

type MoreGroup = {
  label:     string;
  links:     MoreLink[];
};

const MORE_GROUPS: MoreGroup[] = [
  {
    label: "Business",
    links: [
      { href: "/dashboard/finance/loans", labelKey: "loans",      icon: Landmark,     adminOnly: true  },
      { href: "/dashboard/accounting",    labelKey: "accounting", icon: BookOpen,     adminOnly: true  },
      { href: "/dashboard/partners",      labelKey: "partners",   icon: Users,        adminOnly: false },
      { href: "/dashboard/vendors",       labelKey: "vendors",    icon: Store,        adminOnly: false },
    ],
  },
  {
    label: "Reports",
    links: [
      { href: "/dashboard/compliance", labelKey: "compliance", icon: ClipboardList, adminOnly: false },
      { href: "/dashboard/report",     labelKey: "report",     icon: FileText,      adminOnly: true  },
    ],
  },
  {
    label: "System",
    links: [
      { href: "/dashboard/settings", labelKey: "settings", icon: Settings, adminOnly: true },
    ],
  },
];

/** Returns true when `href` is the most-specific match for the current pathname. */
function isNavActive(href: string, pathname: string, allHrefs: string[]): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (!pathname.startsWith(href)) return false;
  return !allHrefs.some(
    (other) => other !== href && other.startsWith(href) && pathname.startsWith(other)
  );
}

export function BottomNav({ isAdmin = true }: { isAdmin?: boolean }) {
  const pathname  = usePathname();
  const { t }     = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);

  const navItems = MOBILE_NAV.filter((n) => !n.adminOnly || isAdmin);

  const allMoreLinks: MoreLink[] = MORE_GROUPS.flatMap((g) => g.links);
  const visibleMoreGroups = MORE_GROUPS.map((g) => ({
    ...g,
    links: g.links.filter((l) => !l.adminOnly || isAdmin),
  })).filter((g) => g.links.length > 0);

  const allBottomHrefs = [
    ...navItems.map((n) => n.href),
    ...allMoreLinks.map((l) => l.href),
  ];

  const moreActive = allMoreLinks.some((l) => isNavActive(l.href, pathname, allBottomHrefs));

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "md:hidden fixed inset-0 z-40 bg-black/25 backdrop-blur-sm transition-opacity duration-200",
          moreOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setMoreOpen(false)}
      />

      {/* More menu panel */}
      <div className={cn(
        "md:hidden fixed bottom-[57px] inset-x-0 z-50 bg-sidebar border-t border-sidebar-border/50 rounded-t-2xl shadow-2xl transition-all duration-300",
        moreOpen
          ? "opacity-100 translate-y-0 pointer-events-auto ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          : "opacity-0 translate-y-4 pointer-events-none ease-in"
      )}>
        {/* Panel header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-sidebar-border/40">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t.sidebar.more}
          </span>
          <button
            onClick={() => setMoreOpen(false)}
            aria-label="Close menu"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Grouped links */}
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {visibleMoreGroups.map((group) => (
            <div key={group.label}>
              {/* Section label */}
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-sidebar-border/50" />
                <span className="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/35 select-none">
                  {group.label}
                </span>
                <div className="h-px flex-1 bg-sidebar-border/50" />
              </div>

              {/* Links grid */}
              <div className="grid grid-cols-3 gap-1.5">
                {group.links.map(({ href, labelKey, icon: Icon }) => {
                  const active = isNavActive(href, pathname, allBottomHrefs);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium transition-colors",
                        active
                          ? "text-primary bg-primary/10"
                          : "text-sidebar-foreground/65 hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <Icon className={cn("h-5 w-5", active ? "text-primary" : "")} />
                      <span className="text-center leading-tight">
                        {t.sidebar[labelKey as keyof typeof t.sidebar]}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom tab bar */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-sidebar/95 backdrop-blur-md border-t border-sidebar-border/50 safe-bottom"
      >
        <div className="flex items-stretch">
          {navItems.map(({ href, navKey, icon: Icon }) => {
            const active = isNavActive(href, pathname, allBottomHrefs);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-xs font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-sidebar-foreground/45 hover:text-sidebar-foreground"
                )}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-7 rounded-b-full bg-primary" />
                )}
                <Icon className={cn("h-5 w-5 transition-transform duration-150", active && "scale-110")} />
                <span className={cn("leading-none", active && "font-semibold")}>
                  {t.nav[navKey as keyof typeof t.nav]}
                </span>
              </Link>
            );
          })}

          {/* More tab */}
          <button
            onClick={() => setMoreOpen((o) => !o)}
            aria-label={moreOpen ? "Close more menu" : "Open more menu"}
            aria-expanded={moreOpen}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-xs font-medium transition-colors",
              (moreOpen || moreActive)
                ? "text-primary"
                : "text-sidebar-foreground/45 hover:text-sidebar-foreground"
            )}
          >
            {moreActive && !moreOpen && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-7 rounded-b-full bg-primary" />
            )}
            <MoreHorizontal className={cn("h-5 w-5 transition-transform duration-150", (moreOpen || moreActive) && "scale-110")} />
            <span className={cn("leading-none", (moreOpen || moreActive) && "font-semibold")}>
              {t.nav.more}
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}

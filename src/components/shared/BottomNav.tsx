"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Home, Beef, Package, BarChart3, MoreHorizontal,
  Users, Store, Settings, ClipboardList, FileText,
  X, BookOpen, Landmark, Activity,
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
      { href: "/dashboard/operations", labelKey: "operations", icon: Activity, adminOnly: true },
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
        "md:hidden fixed bottom-[58px] inset-x-0 z-50 bg-card border-t border-border/70 rounded-t-3xl shadow-floating transition-all duration-300 overflow-hidden",
        moreOpen
          ? "opacity-100 translate-y-0 pointer-events-auto ease-out"
          : "opacity-0 translate-y-6 pointer-events-none ease-in"
      )}>
        {/* Drag handle / Panel header */}
        <div className="flex flex-col items-center pt-2.5 pb-2 px-5 border-b border-border/50 bg-muted/20">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30 mb-2" />
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">
              {t.sidebar.more}
            </span>
            <button
              onClick={() => setMoreOpen(false)}
              aria-label="Close menu"
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Grouped links */}
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
          {visibleMoreGroups.map((group) => (
            <div key={group.label}>
              {/* Section label */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50 select-none">
                  {group.label}
                </span>
                <div className="h-px flex-1 bg-border/40" />
              </div>

              {/* Links grid */}
              <div className="grid grid-cols-3 gap-2">
                {group.links.map(({ href, labelKey, icon: Icon }) => {
                  const active = isNavActive(href, pathname, allBottomHrefs);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-2xl p-2.5 text-xs font-medium transition-all text-center",
                        active
                          ? "text-primary bg-primary/10 font-semibold shadow-xs"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground/70")} />
                      <span className="leading-tight text-[11px] line-clamp-1">
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
        className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-sidebar/90 backdrop-blur-xl border-t border-sidebar-border/50 safe-bottom shadow-lg"
      >
        <div className="flex items-stretch">
          {navItems.map(({ href, navKey, icon: Icon }) => {
            const active = isNavActive(href, pathname, allBottomHrefs);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-xs font-medium transition-all",
                  active
                    ? "text-sidebar-primary font-semibold"
                    : "text-sidebar-foreground/55 hover:text-sidebar-foreground"
                )}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[2.5px] w-8 rounded-b-full bg-sidebar-primary" />
                )}
                <Icon className={cn("h-5 w-5 transition-transform duration-150", active && "scale-110 text-sidebar-primary")} />
                <span className={cn("text-[11px] leading-none", active && "font-semibold")}>
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
              "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-xs font-medium transition-all cursor-pointer",
              (moreOpen || moreActive)
                ? "text-sidebar-primary font-semibold"
                : "text-sidebar-foreground/55 hover:text-sidebar-foreground"
            )}
          >
            {moreActive && !moreOpen && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[2.5px] w-8 rounded-b-full bg-sidebar-primary" />
            )}
            <MoreHorizontal className={cn("h-5 w-5 transition-transform duration-150", (moreOpen || moreActive) && "scale-110 text-sidebar-primary")} />
            <span className={cn("text-[11px] leading-none", (moreOpen || moreActive) && "font-semibold")}>
              {t.nav.more}
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}

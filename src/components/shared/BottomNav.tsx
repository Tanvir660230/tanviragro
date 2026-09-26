"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MoreHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/I18nProvider";
import { SITE, GROUP_LABELS, activeHref, tr, type SiteSection } from "@/components/navigation/site-map";

// the bottom bar and the "More" sheet, both from THE site map (site-map.ts)
const BOTTOM = SITE.filter((s) => s.bottomBar);
const MORE = SITE.filter((s) => !s.bottomBar);
const MORE_GROUPS = (["daily", "money", "system"] as const)
  .map((g) => ({ id: g, label: GROUP_LABELS[g], links: MORE.filter((s) => s.group === g) }))
  .filter((g) => g.links.length > 0);
const sectionHrefs = (s: SiteSection) => [s.href, ...s.pages.map((p) => p.href)];

export function BottomNav({ isAdmin = true }: { isAdmin?: boolean }) {
  const pathname  = usePathname() ?? "";
  const { t, locale } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);
  const current = activeHref(pathname);
  // a section is active when the current page is the section or one of its pages
  const isOn = (s: SiteSection) => current != null && sectionHrefs(s).includes(current);

  const navItems = BOTTOM.filter((n) => !n.adminOnly || isAdmin);
  const visibleMoreGroups = MORE_GROUPS.map((g) => ({ ...g, links: g.links.filter((l) => !l.adminOnly || isAdmin) }))
    .filter((g) => g.links.length > 0);
  const moreActive = MORE.some(isOn);

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
        "md:hidden fixed bottom-[61px] inset-x-0 z-50 bg-card border-t border-border/70 rounded-t-3xl shadow-floating transition-all duration-300 overflow-hidden",
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
            <div key={group.id}>
              {/* Section label */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50 select-none">
                  {tr(group.label, locale)}
                </span>
                <div className="h-px flex-1 bg-border/40" />
              </div>

              {/* Links grid */}
              <div className="grid grid-cols-3 gap-2">
                {group.links.map((sec) => {
                  const { href, icon: Icon } = sec;
                  const active = isOn(sec);
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
                        {tr(sec.label, locale)}
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
        className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-sidebar/95 backdrop-blur-xl border-t border-sidebar-border safe-bottom shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.12)]"
      >
        <div className="flex items-stretch">
          {navItems.map((sec) => {
            const { href, icon: Icon } = sec;
            const active = isOn(sec);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 py-1.5 min-h-[60px] transition-colors",
                  active ? "text-sidebar-primary" : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                )}
              >
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-sidebar-primary/12")}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className={cn("max-w-full truncate text-[11px] leading-tight", active ? "font-semibold" : "font-medium")}>
                  {tr(sec.label, locale)}
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
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 py-1.5 min-h-[60px] transition-colors cursor-pointer",
              (moreOpen || moreActive) ? "text-sidebar-primary" : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
            )}
          >
            <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", (moreOpen || moreActive) && "bg-sidebar-primary/12")}>
              <MoreHorizontal className="h-5 w-5" />
            </span>
            <span className={cn("max-w-full truncate text-[11px] leading-tight", (moreOpen || moreActive) ? "font-semibold" : "font-medium")}>
              {t.nav.more}
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}

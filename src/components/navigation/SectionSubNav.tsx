"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/I18nProvider";
import { activeHref, sectionOf, tr } from "./site-map";

/**
 * The current section's pages, as one row of tabs. Rendered once by the dashboard layout, so
 * every page of a section shows the same sub-menu (from the site map).
 */
export function SectionSubNav() {
  const pathname = usePathname() ?? "";
  const { locale } = useTranslation();
  const section = sectionOf(pathname);
  if (!section || section.pages.length < 2) return null;
  const current = activeHref(pathname, section.pages.map((p) => p.href));

  return (
    <nav aria-label={tr(section.label, locale)} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 scrollbar-none">
      {section.pages.map((p) => {
        const on = current === p.href;
        const Icon = p.icon;
        return (
          <Link key={p.href} href={p.href} aria-current={on ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              on ? "border-primary/25 bg-primary/10 text-primary shadow-xs" : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}>
            <Icon className="h-3.5 w-3.5" aria-hidden />{tr(p.label, locale)}
          </Link>
        );
      })}
    </nav>
  );
}

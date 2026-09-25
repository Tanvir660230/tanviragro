"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "@/i18n/I18nProvider";
import { ALL_HREFS, SITE, tr } from "./site-map";

/**
 * A page's back arrow. Hidden on pages that are on the site map (the section tabs already lead
 * everywhere); kept on detail pages (an animal, a partner, a memo).
 */
export function SiteBackLink({ href }: { href: string }) {
  const pathname = usePathname() ?? "";
  const { locale } = useTranslation();
  if (ALL_HREFS.includes(pathname)) return null;
  return (
    <Link
      href={href}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground shadow-xs hover:bg-muted hover:text-foreground hover:border-border transition-all active:scale-95 cursor-pointer"
      aria-label={locale === "bn" ? "ফিরে যান" : "Go back"}
    >
      <ChevronLeft className="h-4 w-4" />
    </Link>
  );
}

/**
 * A page's title, from THE site map when the page is on it (so the title always matches the
 * menu, in the viewer's language). Pages not on the map (an animal, a partner) keep their own.
 */
export function SitePageTitle({ fallback }: { fallback: string }) {
  const pathname = usePathname() ?? "";
  const { locale } = useTranslation();
  if (pathname === "/dashboard") return <>{fallback}</>;
  for (const s of SITE) {
    if (s.href === pathname) return <>{tr(s.label, locale)}</>;
    const p = s.pages.find((x) => x.href === pathname);
    if (p) return <>{tr(p.label, locale)}</>;
  }
  return <>{fallback}</>;
}

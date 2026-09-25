"use client";

import { usePathname } from "next/navigation";
import { useTranslation } from "@/i18n/I18nProvider";
import { SITE, tr } from "./site-map";

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

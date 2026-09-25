"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, LayoutDashboard, ArrowLeft } from "lucide-react";
import { useTranslation } from "@/i18n/I18nProvider";
import { activeHref, sectionOf, tr, type Label } from "@/components/navigation/site-map";

const DETAIL: Label = { bn: "বিস্তারিত", en: "Detail" };

/**
 * Where you are: Home › section › page › detail — names from THE site map (site-map.ts), in the
 * viewer's language. Hidden on a section's own home (its title and tabs already say it).
 */
export function Breadcrumb() {
  const pathname = usePathname() ?? "";
  const { locale } = useTranslation();
  const section = sectionOf(pathname);
  const hit = activeHref(pathname);
  if (!section || !hit || pathname === section.href) return null;

  const crumbs: { label: string; href: string }[] = [{ label: tr(section.label, locale), href: section.href }];
  const page = section.pages.find((p) => p.href === hit);
  if (hit !== section.href && page) crumbs.push({ label: tr(page.label, locale), href: hit });
  if (pathname !== hit) crumbs.push({ label: tr(DETAIL, locale), href: pathname });
  const parent = crumbs[crumbs.length - 2];

  return (
    <>
      {/* Phone: back to the page this one sits under */}
      {parent && pathname !== hit && (
        <Link href={parent.href}
          className="md:hidden -mt-1 mb-1 flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{parent.label}</span>
        </Link>
      )}

      <nav aria-label={locale === "bn" ? "অবস্থান" : "Breadcrumb"} className="hidden md:flex items-center gap-1.5 text-xs font-medium text-muted-foreground/80">
        <Link href="/dashboard" title={locale === "bn" ? "হোম" : "Home"}
          className="-ml-1.5 flex items-center rounded-md px-1.5 py-0.5 hover:bg-muted/50 hover:text-foreground">
          <LayoutDashboard className="h-3.5 w-3.5 text-muted-foreground/60" />
        </Link>
        {crumbs.map((c, i) => (
          <span key={c.href} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
            {i === crumbs.length - 1 ? (
              <span aria-current="page" className="max-w-[220px] truncate px-1 py-0.5 font-semibold text-foreground">{c.label}</span>
            ) : (
              <Link href={c.href} className="max-w-[160px] truncate rounded-md px-1.5 py-0.5 hover:bg-muted/50 hover:text-foreground">{c.label}</Link>
            )}
          </span>
        ))}
      </nav>
    </>
  );
}

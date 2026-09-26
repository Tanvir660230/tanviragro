import type React from "react";
import {
  LayoutDashboard, Beef, HeartPulse, Package, Landmark, FileText, Settings,
  List, Moon, Syringe, Stethoscope, ClipboardCheck,
  ReceiptText, Blend, CalendarRange, Scale, ArrowRightLeft, ClipboardList, History,
  Wallet, Zap, Layers, HandCoins, Users, BookOpen, Bell, UserCog, Activity, Trash2,
} from "lucide-react";
import { PERMISSIONS } from "@/constants/roles";

/**
 * THE site map: every section and page of the app, once. The sidebar, the phone menu, each
 * section's sub-menu and search are all built from it — a page added or removed here changes
 * everywhere. Plan: docs/SITE_AUDIT_AND_CENTRAL_PLAN.md §3.1.
 */
export type Label = { bn: string; en: string };
export type SitePage = { href: string; label: Label; icon: React.ComponentType<{ className?: string }>; keywords?: string[] };
export type SiteSection = SitePage & {
  id: string;
  group: "daily" | "money" | "system";
  requiredPermission?: unknown;
  adminOnly?: boolean;
  /** shown in the phone's bottom bar (max 4) */
  bottomBar?: boolean;
  /** the section's own pages, in menu order (the first is the section home) */
  pages: SitePage[];
};

export const GROUP_LABELS: Record<SiteSection["group"], Label> = {
  daily: { bn: "খামার", en: "Farm" },
  money: { bn: "টাকা-পয়সা", en: "Money" },
  system: { bn: "সিস্টেম", en: "System" },
};

export const SITE: SiteSection[] = [
  {
    id: "home", group: "daily", bottomBar: true,
    href: "/dashboard", label: { bn: "হোম", en: "Home" }, icon: LayoutDashboard,
    keywords: ["home", "today", "overview", "হোম", "আজ"],
    pages: [],
  },
  {
    id: "cattle", group: "daily", bottomBar: true, requiredPermission: PERMISSIONS.CATTLE_VIEW,
    href: "/dashboard/cattle", label: { bn: "গরু", en: "Cattle" }, icon: Beef,
    keywords: ["cow", "bull", "cattle", "weight", "tag", "গরু", "ওজন"],
    pages: [
      { href: "/dashboard/cattle", label: { bn: "সব গরু", en: "All cattle" }, icon: List },
      { href: "/dashboard/cattle/qurbani", label: { bn: "কোরবানি", en: "Qurbani" }, icon: Moon, keywords: ["eid", "qurbani", "কোরবানি", "ঈদ"] },
    ],
  },
  {
    id: "health", group: "daily", requiredPermission: PERMISSIONS.CATTLE_VIEW,
    href: "/dashboard/health", label: { bn: "স্বাস্থ্য", en: "Health" }, icon: HeartPulse,
    keywords: ["health", "vaccine", "treatment", "স্বাস্থ্য", "টিকা", "চিকিৎসা"],
    pages: [
      { href: "/dashboard/health", label: { bn: "সারসংক্ষেপ", en: "Overview" }, icon: HeartPulse },
      { href: "/dashboard/health/vaccinations", label: { bn: "টিকা ও কাজ", en: "Vaccines & tasks" }, icon: Syringe, keywords: ["vaccine", "টিকা"] },
      { href: "/dashboard/health/treatments", label: { bn: "চিকিৎসা", en: "Treatments" }, icon: Stethoscope, keywords: ["treatment", "vet", "চিকিৎসা"] },
      { href: "/dashboard/compliance", label: { bn: "টিকার রিপোর্ট", en: "Vaccine report" }, icon: ClipboardCheck, keywords: ["dls", "compliance"] },
    ],
  },
  {
    id: "inventory", group: "daily", bottomBar: true, requiredPermission: PERMISSIONS.INVENTORY_VIEW,
    href: "/dashboard/inventory", label: { bn: "খাবার ও স্টক", en: "Feed & stock" }, icon: Package,
    keywords: ["feed", "stock", "inventory", "খাবার", "স্টক"],
    pages: [
      { href: "/dashboard/inventory", label: { bn: "স্টক", en: "Stock" }, icon: Package },
      { href: "/dashboard/inventory/purchase", label: { bn: "কেনা", en: "Buy" }, icon: ReceiptText, keywords: ["purchase", "memo", "কেনা", "মেমো"] },
      { href: "/dashboard/inventory/mix", label: { bn: "মিক্স", en: "Mix" }, icon: Blend, keywords: ["mix", "recipe", "মিক্স", "রেসিপি"] },
      { href: "/dashboard/inventory/usage", label: { bn: "খাবার ব্যবহার", en: "Feed usage" }, icon: CalendarRange },
      { href: "/dashboard/inventory/feeding-chart", label: { bn: "খাবারের চার্ট", en: "Feeding chart" }, icon: Scale },
      { href: "/dashboard/inventory/movements", label: { bn: "লেনদেন", en: "Movements" }, icon: ArrowRightLeft },
      { href: "/dashboard/inventory/adjustments", label: { bn: "গণনা সমন্বয়", en: "Adjustments" }, icon: ClipboardList },
      { href: "/dashboard/inventory/purchase/history", label: { bn: "কেনার ইতিহাস", en: "Purchase history" }, icon: History },
    ],
  },
  {
    id: "finance", group: "money", bottomBar: true,
    href: "/dashboard/finance", label: { bn: "খরচ ও টাকা", en: "Money" }, icon: Landmark,
    keywords: ["expense", "cost", "cash", "খরচ", "টাকা"],
    pages: [
      { href: "/dashboard/finance", label: { bn: "সারসংক্ষেপ ও খরচ", en: "Summary & expenses" }, icon: Wallet },
      { href: "/dashboard/finance/utilities", label: { bn: "বিদ্যুৎ-পানি", en: "Utilities" }, icon: Zap },
      { href: "/dashboard/finance/bulk-add", label: { bn: "একসাথে খরচ", en: "Add several" }, icon: Layers },
      { href: "/dashboard/finance/loans", label: { bn: "ঋণ", en: "Loans" }, icon: HandCoins },
    ],
  },
  {
    id: "partners", group: "money",
    href: "/dashboard/partners", label: { bn: "অংশীদার", en: "Partners" }, icon: Users,
    keywords: ["partner", "investor", "equity", "অংশীদার"],
    pages: [],
  },
  {
    id: "accounting", group: "money",
    href: "/dashboard/accounting", label: { bn: "হিসাবের খাতা", en: "Accounts" }, icon: BookOpen,
    keywords: ["balance sheet", "income", "trial", "asset", "হিসাব"],
    pages: [
      { href: "/dashboard/accounting", label: { bn: "খাতা", en: "Overview" }, icon: BookOpen },
      { href: "/dashboard/accounting/income-statement", label: { bn: "আয়-ব্যয়", en: "Income statement" }, icon: FileText },
      { href: "/dashboard/accounting/balance-sheet", label: { bn: "ব্যালেন্স শিট", en: "Balance sheet" }, icon: Scale },
      { href: "/dashboard/accounting/cash-flow", label: { bn: "নগদ প্রবাহ", en: "Cash flow" }, icon: ArrowRightLeft },
      { href: "/dashboard/accounting/fixed-assets", label: { bn: "স্থায়ী সম্পদ", en: "Fixed assets" }, icon: Layers },
      { href: "/dashboard/accounting/trial-balance", label: { bn: "রেওয়ামিল", en: "Trial balance" }, icon: ClipboardList },
    ],
  },
  {
    id: "report", group: "money", requiredPermission: PERMISSIONS.REPORTS_VIEW,
    href: "/dashboard/report", label: { bn: "রিপোর্ট", en: "Reports" }, icon: FileText,
    keywords: ["report", "zakat", "print", "রিপোর্ট", "যাকাত"],
    pages: [],
  },
  {
    id: "settings", group: "system", adminOnly: true,
    href: "/dashboard/settings", label: { bn: "সেটিংস", en: "Settings" }, icon: Settings,
    keywords: ["settings", "team", "trash", "সেটিংস"],
    pages: [
      { href: "/dashboard/settings", label: { bn: "খামার", en: "Farm" }, icon: Settings },
      { href: "/dashboard/settings/team", label: { bn: "টিম", en: "Team" }, icon: UserCog },
      { href: "/dashboard/settings/activity", label: { bn: "কার্যকলাপ", en: "Activity" }, icon: Activity },
      { href: "/dashboard/settings/trash", label: { bn: "ট্র্যাশ", en: "Trash" }, icon: Trash2 },
      { href: "/dashboard/notifications", label: { bn: "নোটিফিকেশন", en: "Notifications" }, icon: Bell },
    ],
  },
];

export type Lang = keyof Label;
export const tr = (l: Label, lang: string | undefined): string => (lang === "bn" ? l.bn : l.en);

/** Every href of the site (sections and pages). */
/** A page's name from the site map (the same words as the menu), or null when it is not on it. */
export function siteLabel(href: string): Label | null {
  for (const sec of SITE) {
    const page = sec.pages.find((x) => x.href === href);
    if (page) return page.label;
    if (sec.href === href) return sec.label;
  }
  return null;
}

/** A page title in the viewer's language from the site map, e.g. siteTitle(L, "/dashboard/finance/loans", "Loans"). */
export const siteTitle = (L: (bn: string, en: string) => string, href: string, fallback: string): string => {
  const l = siteLabel(href);
  return l ? L(l.bn, l.en) : fallback;
};

export const ALL_HREFS: string[] = [...new Set(SITE.flatMap((s) => [s.href, ...s.pages.map((p) => p.href)]))];

/** The single most specific href for a path (longest match), so parents do not light up with children. */
export function activeHref(pathname: string, hrefs: string[] = ALL_HREFS): string | null {
  if (pathname === "/dashboard") return "/dashboard";
  return hrefs.filter((h) => h !== "/dashboard" && (pathname === h || pathname.startsWith(h + "/")))
    .sort((a, b) => b.length - a.length)[0] ?? null;
}

/** The section a path belongs to (its own href or one of its pages). */
export function sectionOf(pathname: string): SiteSection | null {
  const hit = activeHref(pathname);
  if (!hit) return null;
  return SITE.find((s) => s.href === hit || s.pages.some((p) => p.href === hit)) ?? null;
}

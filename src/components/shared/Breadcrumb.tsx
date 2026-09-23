"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronDown,
  LayoutDashboard,
  ArrowLeft,
  Beef,
  Package,
  BarChart3,
  Settings,
  FileText,
  Users,
  Store,
  ShoppingCart,
  Landmark,
  BookOpen,
  ShieldCheck,
  Bell,
  ClipboardList,
  Sparkles,
  LifeBuoy,
} from "lucide-react";

const LABEL_MAP: Record<string, string> = {
  dashboard: "Dashboard",
  cattle: "Livestock",
  inventory: "Inventory",
  finance: "Finance",
  settings: "Settings",
  report: "Report",
  compliance: "Compliance",
  partners: "Partners",
  vendors: "Vendors",
  accounting: "Accounting",
  commerce: "Commerce",
  ai: "AI Insights",
  help: "Help",
  notifications: "Notifications",
  operations: "Operations",
  "mix-feed": "Mix Feed",
  "balance-sheet": "Balance Sheet",
  "cash-flow": "Cash Flow",
  "fixed-assets": "Fixed Assets",
  "income-statement": "Income Statement",
  "trial-balance": "Trial Balance",
  activity: "Activity",
  team: "Team",
  trash: "Trash",
  statement: "Statement",
  export: "Export",
  loans: "Loans",
  "bulk-add": "Bulk Add",
  purchase: "Purchase",
  history: "History",
  pens: "Pens",
  growth: "Growth",
  health: "Health",
  breeding: "Breeding",
  feed: "Feed",
  analytics: "Analytics",
  qurbani: "Qurbani",
  expenses: "Expenses",
  income: "Income",
  transfers: "Transfers",
  sales: "Sales",
  purchases: "Purchases",
  transactions: "Transactions",
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  cattle: Beef,
  inventory: Package,
  finance: BarChart3,
  settings: Settings,
  report: FileText,
  compliance: ShieldCheck,
  partners: Users,
  vendors: Store,
  accounting: BookOpen,
  commerce: ShoppingCart,
  ai: Sparkles,
  help: LifeBuoy,
  notifications: Bell,
  operations: ClipboardList,
  loans: Landmark,
  team: Users,
  growth: BarChart3,
  health: ShieldCheck,
  breeding: Beef,
  feed: Package,
  analytics: BarChart3,
  expenses: BarChart3,
  income: BarChart3,
  sales: ShoppingCart,
  purchases: ShoppingCart,
};

function isUUID(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export function Breadcrumb() {
  const pathname = usePathname();
  const router = useRouter();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length <= 1) return null;

  const crumbs: { label: string; href: string; segment: string }[] = [];
  let path = "";
  for (const seg of segments) {
    path += `/${seg}`;
    const label = isUUID(seg) ? "Detail" : (LABEL_MAP[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " "));
    crumbs.push({ label, href: path, segment: seg });
  }

  const parentCrumb = crumbs[crumbs.length - 2];
  // Show middle crumbs (collapse deep routes)
  const showCollapsed = crumbs.length > 3;
  const middleCrumb = showCollapsed ? crumbs[1] : null;

  return (
    <>
      {/* Mobile: back button */}
      {parentCrumb && (
        <button
          onClick={() => router.back()}
          className="md:hidden flex items-center gap-1.5 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-3.5 -mt-1 cursor-pointer"
          aria-label={`Back to ${parentCrumb.label}`}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{parentCrumb.label}</span>
        </button>
      )}

      {/* Desktop: full breadcrumb trail with icons */}
      <nav
        aria-label="Breadcrumb"
        className="hidden md:flex items-center gap-1.5 text-xs font-medium text-muted-foreground/80 mb-4"
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-1 hover:text-foreground hover:bg-muted/50 transition-colors rounded-md px-1.5 py-0.5 -ml-1.5"
          title="Dashboard Home"
        >
          <LayoutDashboard className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
        </Link>

        {crumbs.map((crumb, i) => {
          const isFirst = i === 0;
          const isLast = i === crumbs.length - 1;
          const Icon = ICON_MAP[crumb.segment];

          // Collapse middle crumb for deep routes (show as "...")
          if (showCollapsed && i === 1 && !isLast) {
            return (
              <span key={crumb.href} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                <span className="text-muted-foreground/50 px-1" title={crumb.label}>
                  <ChevronDown className="h-3 w-3 rotate-[-90deg]" />
                </span>
              </span>
            );
          }

          return (
            <span key={crumb.href} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
              {isLast ? (
                <span className="flex items-center gap-1.5 font-semibold text-foreground px-1 py-0.5" aria-current="page">
                  {Icon && <Icon className="h-3.5 w-3.5 text-primary/80" />}
                  <span className="truncate max-w-[220px]">{crumb.label}</span>
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="flex items-center gap-1 hover:text-foreground hover:bg-muted/50 rounded-md px-1.5 py-0.5 transition-colors truncate max-w-[150px]"
                >
                  {Icon && !isFirst && <Icon className="h-3 w-3 shrink-0 text-muted-foreground/50" />}
                  <span>{crumb.label}</span>
                </Link>
              )}
            </span>
          );
        })}
      </nav>
    </>
  );
}

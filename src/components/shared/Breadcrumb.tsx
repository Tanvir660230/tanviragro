"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, LayoutDashboard, ArrowLeft } from "lucide-react";

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
};

function isUUID(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export function Breadcrumb() {
  const pathname = usePathname();
  const router = useRouter();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length <= 1) return null;

  const crumbs: { label: string; href: string }[] = [];
  let path = "";
  for (const seg of segments) {
    path += `/${seg}`;
    const label = isUUID(seg) ? "Detail" : (LABEL_MAP[seg] ?? seg);
    crumbs.push({ label, href: path });
  }

  const parentCrumb = crumbs[crumbs.length - 2];

  return (
    <>
      {/* Mobile: back button */}
      {parentCrumb && (
        <button
          onClick={() => router.back()}
          className="md:hidden flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3 -mt-1"
          aria-label={`Back to ${parentCrumb.label}`}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {parentCrumb.label}
        </button>
      )}

      {/* Desktop: full breadcrumb trail */}
      <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-1 text-sm text-muted-foreground mb-2">
        <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
        {crumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            {i === crumbs.length - 1 ? (
              <span
                className="font-medium text-foreground"
                aria-current="page"
              >
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="hover:text-foreground hover:underline underline-offset-2 transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>
    </>
  );
}

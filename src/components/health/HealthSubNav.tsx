"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ClipboardList,
  Syringe,
  Pill,
  Bug,
  ShieldAlert,
  History,
  Skull,
  FileBarChart,
  Sparkles,
  ScrollText,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard/health", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/health/records", label: "Records", icon: ClipboardList },
  { href: "/dashboard/health/vaccinations", label: "Vaccinations", icon: Syringe },
  { href: "/dashboard/health/treatments", label: "Treatments", icon: Pill },
  { href: "/dashboard/health/diseases", label: "Diseases", icon: Bug },
  { href: "/dashboard/health/quarantine", label: "Quarantine", icon: ShieldAlert },
  { href: "/dashboard/health/timeline", label: "Timeline", icon: History },
  { href: "/dashboard/health/mortality", label: "Mortality", icon: Skull },
  { href: "/dashboard/health/reports", label: "Reports", icon: FileBarChart },
  { href: "/dashboard/health/ai", label: "AI Insights", icon: Sparkles },
  { href: "/dashboard/health/audit", label: "Audit", icon: ScrollText },
] as const;

function isActive(href: string, pathname: string): boolean {
  if (href === "/dashboard/health") {
    return pathname === "/dashboard/health";
  }
  return pathname.startsWith(href);
}

export function HealthSubNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn("flex gap-1 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1", className)}
      aria-label="Health & Veterinary navigation"
      role="navigation"
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all shrink-0",
              active
                ? "bg-primary/10 text-primary border border-primary/20 shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent"
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
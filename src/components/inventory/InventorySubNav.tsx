"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ArrowRightLeft,
  ClipboardList,
  FileBarChart,
  Sparkles,
  History,
  FlaskConical,
  ReceiptText,
  CalendarRange,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard/inventory", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/inventory/usage", label: "Feed Usage", icon: CalendarRange },
  { href: "/dashboard/inventory/products", label: "Products", icon: Package },
  { href: "/dashboard/inventory/warehouse", label: "Warehouses", icon: Warehouse },
  { href: "/dashboard/inventory/movements", label: "Movements", icon: ArrowRightLeft },
  { href: "/dashboard/inventory/adjustments", label: "Adjustments", icon: ClipboardList },
  { href: "/dashboard/inventory/purchase", label: "Purchase", icon: ReceiptText },
  { href: "/dashboard/inventory/purchase/history", label: "History", icon: History },
  { href: "/dashboard/inventory/reports", label: "Reports", icon: FileBarChart },
  { href: "/dashboard/inventory/ai", label: "AI Insights", icon: Sparkles },
] as const;

function isActive(href: string, pathname: string): boolean {
  if (href === "/dashboard/inventory") {
    return pathname === "/dashboard/inventory";
  }
  return pathname.startsWith(href);
}

export function InventorySubNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "flex gap-1 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1",
        className
      )}
      aria-label="Inventory navigation"
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

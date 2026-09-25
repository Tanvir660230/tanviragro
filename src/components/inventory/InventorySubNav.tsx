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
  ReceiptText,
  CalendarRange,
  ChevronDown,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// The everyday sections; the rest sit under "More" (all ten destinations stay reachable).
const MAIN_ITEMS = [
  { href: "/dashboard/inventory", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/inventory/usage", label: "Feed Usage", icon: CalendarRange },
  { href: "/dashboard/inventory/purchase", label: "Purchase", icon: ReceiptText },
  { href: "/dashboard/inventory/movements", label: "Movements", icon: ArrowRightLeft },
  { href: "/dashboard/inventory/reports", label: "Reports", icon: FileBarChart },
] as const;

const MORE_ITEMS = [
  { href: "/dashboard/inventory/purchase/history", label: "Purchase history", icon: History },
  { href: "/dashboard/inventory/products", label: "Products", icon: Package },
  { href: "/dashboard/inventory/adjustments", label: "Adjustments", icon: ClipboardList },
  { href: "/dashboard/inventory/warehouse", label: "Warehouses", icon: Warehouse },
  { href: "/dashboard/inventory/ai", label: "AI Insights", icon: Sparkles },
] as const;

/** The single best-matching section (longest prefix), so e.g. Purchase history does not also light up Purchase. */
function activeHref(pathname: string): string | null {
  const all = [...MAIN_ITEMS, ...MORE_ITEMS].map((i) => i.href as string);
  if (pathname === "/dashboard/inventory") return "/dashboard/inventory";
  return all.filter((h) => h !== "/dashboard/inventory" && pathname.startsWith(h)).sort((a, b) => b.length - a.length)[0] ?? null;
}

export function InventorySubNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const current = activeHref(pathname);
  const moreActive = MORE_ITEMS.find((i) => i.href === current);

  const base = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all shrink-0 border";
  const on = "bg-primary/10 text-primary border-primary/20 shadow-xs";
  const off = "text-muted-foreground hover:text-foreground hover:bg-muted/60 border-transparent";

  return (
    <nav className={cn("flex gap-1 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1", className)} aria-label="Inventory navigation">
      {MAIN_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = current === item.href;
        return (
          <Link key={item.href} href={item.href} className={cn(base, active ? on : off)} aria-current={active ? "page" : undefined}>
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        );
      })}
      <DropdownMenu>
        <DropdownMenuTrigger className={cn(base, moreActive ? on : off, "outline-none focus-visible:ring-2 focus-visible:ring-ring")}>
          {moreActive ? <moreActive.icon className="h-3.5 w-3.5" /> : null}
          {moreActive ? moreActive.label : "More"}
          <ChevronDown className="h-3 w-3 opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {MORE_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <DropdownMenuItem key={item.href} className="cursor-pointer gap-2" render={<Link href={item.href} />}>
                <Icon className="h-4 w-4 text-muted-foreground" />
                {item.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}

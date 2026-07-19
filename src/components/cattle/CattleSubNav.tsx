"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Beef, HeartPulse, Moon, BarChart3, Wheat } from "lucide-react";
import { cn } from "@/lib/utils";

const SUB_PAGES = [
  "/dashboard/cattle/health",
  "/dashboard/cattle/qurbani",
  "/dashboard/cattle/analytics",
  "/dashboard/cattle/feed",
];

const LINKS = [
  { href: "/dashboard/cattle",          label: "Cattle",    icon: Beef      },
  { href: "/dashboard/cattle/health",   label: "Health",    icon: HeartPulse },
  { href: "/dashboard/cattle/qurbani",  label: "Qurbani",   icon: Moon      },
  { href: "/dashboard/cattle/analytics",label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/cattle/feed",     label: "Feed Plan", icon: Wheat     },
];

export function CattleSubNav() {
  const pathname = usePathname();

  // "Cattle" tab is active for the list page AND detail pages ([id]), but NOT for named sub-pages.
  const isCattleActive = !SUB_PAGES.some((p) => pathname.startsWith(p));

  return (
    <div className="relative">
      <nav
        aria-label="Cattle sections"
        className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5"
      >
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/dashboard/cattle"
              ? isCattleActive
              : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-all shrink-0",
                active
                  ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/20"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          );
        })}
      </nav>
      {/* Right-edge fade — signals scrollable tabs on narrow screens */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent md:hidden" />
    </div>
  );
}

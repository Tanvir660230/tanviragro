"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Beef, HeartPulse, Moon, BarChart3, Wheat, Scale, Heart, Syringe, Warehouse, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const SUB_PAGES = [
  "/dashboard/cattle/health",
  "/dashboard/cattle/vaccinations",
  "/dashboard/cattle/qurbani",
  "/dashboard/cattle/analytics",
  "/dashboard/cattle/feed",
  "/dashboard/cattle/growth",
  "/dashboard/cattle/breeding",
  "/dashboard/cattle/pens",
];

const LINKS = [
  { href: "/dashboard/cattle",           label: "Cattle",     icon: Beef       },
  { href: "/dashboard/cattle/growth",    label: "Growth",     icon: Scale      },
  { href: "/dashboard/cattle/feed",      label: "Feed Plan",  icon: Wheat      },
  { href: "/dashboard/cattle/health",    label: "Health",     icon: HeartPulse },
  { href: "/dashboard/cattle/breeding",  label: "Breeding",   icon: Heart      },
  { href: "/dashboard/cattle/vaccinations", label: "Vaccines", icon: Syringe    },
  { href: "/dashboard/cattle/qurbani",   label: "Qurbani",    icon: Moon       },
  { href: "/dashboard/cattle/pens",      label: "Pens & Farms", icon: Warehouse },
  { href: "/dashboard/cattle/analytics", label: "Analytics",  icon: BarChart3  },
];

export function CattleSubNav() {
  const pathname = usePathname();

  // "Cattle" tab is active for the list page AND detail pages ([id]), but NOT for named sub-pages.
  const isCattleActive = !SUB_PAGES.some((p) => pathname.startsWith(p));

  return (
    <div className="relative mb-2">
      <nav
        aria-label="Cattle sections"
        className="flex items-center gap-1.5 overflow-x-auto scrollbar-none p-1 bg-muted/40 backdrop-blur-sm border border-border/50 rounded-2xl w-fit max-w-full"
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
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-150 shrink-0",
                active
                  ? "bg-card text-foreground font-semibold shadow-xs border border-border/60"
                  : "text-muted-foreground hover:bg-card/50 hover:text-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground/70")} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      {/* Right-edge fade for overflow indication on mobile */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent md:hidden" />
    </div>
  );
}


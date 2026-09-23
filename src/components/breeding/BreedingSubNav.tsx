"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Beef,
  Flame,
  Sparkles,
  Baby,
  Dna,
  FlaskConical,
  BarChart3,
  FileText,
  Lightbulb,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard",    href: "/dashboard/breeding",           icon: LayoutDashboard },
  { label: "Animals",      href: "/dashboard/breeding/animals",   icon: Beef           },
  { label: "Heat",         href: "/dashboard/breeding/heat",      icon: Flame          },
  { label: "Pregnancy",    href: "/dashboard/breeding/pregnancy", icon: Sparkles       },
  { label: "Calving",      href: "/dashboard/breeding/calving",   icon: Baby           },
  { label: "Genetics",     href: "/dashboard/breeding/genetics",  icon: Dna            },
  { label: "Semen",        href: "/dashboard/breeding/semen",     icon: FlaskConical   },
  { label: "Analytics",    href: "/dashboard/breeding/analytics", icon: BarChart3      },
  { label: "AI Insights",  href: "/dashboard/breeding/ai",        icon: Lightbulb      },
  { label: "Reports",      href: "/dashboard/breeding/reports",   icon: FileText       },
] as const;

export function BreedingSubNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Breeding sub-navigation"
      className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 bg-background/95 backdrop-blur-sm border-b border-border/60 px-4 sm:px-6 lg:px-8"
    >
      <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none py-0 min-h-[44px]">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive =
            href === "/dashboard/breeding"
              ? pathname === "/dashboard/breeding"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all duration-150 whitespace-nowrap",
                isActive
                  ? "bg-primary/10 text-primary border-b-2 border-primary rounded-b-none"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

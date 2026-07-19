"use client";

import { useState, Suspense } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BarChart3, Receipt, TrendingUp, Landmark, Building2, History, Calculator } from "lucide-react";
import { FinanceDateFilter } from "./FinanceDateFilter";

const TABS = [
  { value: "pl",        label: "P&L",       icon: BarChart3  },
  { value: "costs",     label: "Costs",     icon: Receipt    },
  { value: "loans",     label: "Loans",     icon: Landmark   },
  { value: "budget",    label: "Budget",    icon: TrendingUp },
  { value: "assets",    label: "Assets",    icon: Building2  },
  { value: "statement", label: "Statement", icon: History    },
  { value: "whatif",    label: "What-if",   icon: Calculator },
] as const;

type Tab = (typeof TABS)[number]["value"];

const TABS_WITH_DATE_FILTER = new Set<Tab>(["pl", "costs"]);

export function FinanceTabs({
  plSummary,
  costList,
  assets,
  budget,
  loans,
  statement,
  whatif,
  salesCount,
  costsCount,
  assetCount,
  loansCount,
}: {
  plSummary: ReactNode;
  costList: ReactNode;
  assets: ReactNode;
  budget: ReactNode;
  loans: ReactNode;
  statement: ReactNode;
  whatif: ReactNode;
  salesCount?: number;
  costsCount?: number;
  assetCount?: number;
  loansCount?: number;
}) {
  const [active, setActive] = useState<Tab>("pl");
  const [visited, setVisited] = useState<ReadonlySet<Tab>>(new Set(["pl"] as Tab[]));

  function handleTabChange(val: Tab) {
    setActive(val);
    if (!visited.has(val)) setVisited(prev => new Set([...prev, val]));
  }

  const contentMap: Record<Tab, ReactNode> = {
    pl: plSummary,
    costs: costList,
    loans,
    budget,
    assets,
    statement,
    whatif,
  };

  return (
    <div className="space-y-0">
      {/* ── Tab bar — underline style ── */}
      <div
        role="tablist"
        aria-label="Finance sections"
        className="flex min-w-0 overflow-x-auto scrollbar-none border-b border-border"
      >
        {TABS.map(({ value, label, icon: Icon }) => {
          const count =
            value === "pl"    ? salesCount  :
            value === "costs" ? costsCount  :
            value === "assets"? assetCount  :
            value === "loans" ? loansCount  : undefined;

          const isActive = active === value;

          return (
            <button
              key={value}
              role="tab"
              id={`tab-${value}`}
              aria-selected={isActive}
              aria-controls={`panel-${value}`}
              onClick={() => handleTabChange(value)}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors duration-150",
                "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-t-full after:transition-all after:duration-150",
                isActive
                  ? "text-foreground after:bg-primary"
                  : "text-muted-foreground hover:text-foreground after:bg-transparent"
              )}
            >
              <Icon className={cn(
                "h-3.5 w-3.5 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground/60"
              )} />
              {label}
              {count !== undefined && count > 0 && (
                <span className={cn(
                  "inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-bold leading-none",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "bg-muted-foreground/15 text-muted-foreground"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Date filter — only for P&L and Costs tabs ── */}
      {TABS_WITH_DATE_FILTER.has(active) && (
        <div className="border-b border-border/50 px-4 py-2">
          <Suspense fallback={null}>
            <FinanceDateFilter />
          </Suspense>
        </div>
      )}

      {/* ── Tab content — stays mounted after first visit for instant switching ── */}
      <div className="pt-4">
        {TABS.map(({ value }) =>
          visited.has(value) ? (
            <div
              key={value}
              role="tabpanel"
              id={`panel-${value}`}
              aria-labelledby={`tab-${value}`}
              aria-hidden={active !== value}
              className={active === value ? "" : "hidden"}
            >
              {contentMap[value]}
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

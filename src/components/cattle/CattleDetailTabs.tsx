"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Activity, Heart, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/I18nProvider";

type TabId = "overview" | "health" | "growth_finance";

const TAB_ICONS: Record<TabId, React.ElementType> = {
  overview: Activity,
  health: Heart,
  growth_finance: TrendingUp,
};

const TAB_ORDER: TabId[] = ["overview", "health", "growth_finance"];

export function CattleDetailTabs({
  overview,
  health,
  growthFinance,
  defaultTab = "overview",
}: {
  overview: React.ReactNode;
  health: React.ReactNode;
  growthFinance: React.ReactNode;
  defaultTab?: TabId;
}) {
  const { t } = useTranslation();
  const tabs = t.cattle_details.tabs;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Derive active tab from URL — fall back to defaultTab prop
  const tabParam = searchParams.get("tab") as TabId | null;
  const active: TabId = TAB_ORDER.includes(tabParam as TabId) ? (tabParam as TabId) : defaultTab;

  // Track which tabs have been visited for lazy rendering
  const [visited, setVisited] = useState<Set<TabId>>(new Set([active]));
  const navRef = useRef<HTMLDivElement>(null);

  const setActive = useCallback((id: TabId) => {
    setVisited(prev => new Set([...prev, id]));
    const params = new URLSearchParams(searchParams.toString());
    if (id === "overview") params.delete("tab");
    else params.set("tab", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, pathname, searchParams]);

  // Keyboard navigation: arrow keys cycle through tabs
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!navRef.current?.contains(document.activeElement)) return;
      const idx = TAB_ORDER.indexOf(active);
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setActive(TAB_ORDER[(idx + 1) % TAB_ORDER.length]);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActive(TAB_ORDER[(idx - 1 + TAB_ORDER.length) % TAB_ORDER.length]);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active, setActive]);

  const TABS: { id: TabId; label: string }[] = [
    { id: "overview",      label: tabs.overview },
    { id: "health",        label: tabs.health },
    { id: "growth_finance",label: tabs.growth_finance },
  ];

  return (
    <div className="space-y-5">
      {/* Tab navigation */}
      <div ref={navRef} className="flex border-b border-border overflow-x-auto scrollbar-none" role="tablist">
        {TABS.map(({ id, label }) => {
          const Icon = TAB_ICONS[id];
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active === id}
              aria-controls={`tab-panel-${id}`}
              onClick={() => setActive(id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                active === id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab panels — lazy: only render once visited */}
      <div
        id="tab-panel-overview"
        role="tabpanel"
        className={cn("space-y-5", active !== "overview" && "hidden")}
      >
        {visited.has("overview") && overview}
      </div>
      <div
        id="tab-panel-health"
        role="tabpanel"
        className={cn("space-y-5", active !== "health" && "hidden")}
      >
        {visited.has("health") && health}
      </div>
      <div
        id="tab-panel-growth_finance"
        role="tabpanel"
        className={cn("space-y-5", active !== "growth_finance" && "hidden")}
      >
        {visited.has("growth_finance") && growthFinance}
      </div>
    </div>
  );
}

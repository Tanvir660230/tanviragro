"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Activity,
  HeartPulse,
  Scale,
  Utensils,
  Receipt,
  Images,
  History,
  QrCode,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/I18nProvider";
import { useL } from "@/i18n/text";

export type CattleWorkspaceTabId =
  | "overview"
  | "health"
  | "weight"
  | "feed"
  | "finance"
  | "gallery"
  | "timeline"
  | "identity";

interface TabItem {
  id: CattleWorkspaceTabId;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
}

interface Props {
  overview: React.ReactNode;
  health: React.ReactNode;
  weight: React.ReactNode;
  feed: React.ReactNode;
  finance: React.ReactNode;
  gallery: React.ReactNode;
  timeline: React.ReactNode;
  identity: React.ReactNode;
  defaultTab?: CattleWorkspaceTabId;
  healthPendingCount?: number;
  weightLogsCount?: number;
  photosCount?: number;
}

export function CattleDetailTabs({
  overview,
  health,
  weight,
  feed,
  finance,
  gallery,
  timeline,
  identity,
  defaultTab = "overview",
  healthPendingCount = 0,
  weightLogsCount,
  photosCount,
}: Props) {
  const L = useL();
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const TABS: TabItem[] = [
    { id: "overview", label: t.cattle_details.tabs.overview || "Overview", icon: Activity },
    {
      id: "health",
      label: t.cattle_details.tabs.health || "Health",
      icon: HeartPulse,
      badge: healthPendingCount > 0 ? healthPendingCount : undefined,
    },
    {
      id: "weight",
      label: L("ওজন ও বৃদ্ধি", "Weight & growth"),
      icon: Scale,
      badge: weightLogsCount !== undefined ? weightLogsCount : undefined,
    },
    { id: "feed", label: L("খাবার", "Feed"), icon: Utensils },
    { id: "finance", label: L("টাকার হিসাব", "Money"), icon: Receipt },
    {
      id: "gallery",
      label: t.cattle_details.photos.photos || "Gallery",
      icon: Images,
      badge: photosCount !== undefined ? photosCount : undefined,
    },
    { id: "timeline", label: L("সময়রেখা", "Timeline"), icon: History },
    { id: "identity", label: "QR & ID", icon: QrCode },
  ];

  const TAB_ORDER = TABS.map((t) => t.id);

  // "weights" is an old spelling still found in saved links
  const rawTab = searchParams.get("tab");
  const tabParam = (rawTab === "weights" ? "weight" : rawTab) as CattleWorkspaceTabId | null;
  const active: CattleWorkspaceTabId =
    tabParam && TAB_ORDER.includes(tabParam)
      ? tabParam
      : (defaultTab as CattleWorkspaceTabId);

  const [visited, setVisited] = useState<Set<CattleWorkspaceTabId>>(new Set([active]));
  const navRef = useRef<HTMLDivElement>(null);

  const setActive = useCallback(
    (id: CattleWorkspaceTabId) => {
      setVisited((prev) => new Set([...prev, id]));
      const params = new URLSearchParams(searchParams.toString());
      if (id === "overview") params.delete("tab");
      else params.set("tab", id);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

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
  }, [active, setActive, TAB_ORDER]);

  return (
    <div className="space-y-6">
      {/* Workspace Tab Navigation Bar */}
      <div className="sticky top-14 z-20 -mx-4 sm:mx-0 px-4 sm:px-0 bg-background/95 backdrop-blur-md py-2 border-b border-border/40 sm:border-0 sm:bg-transparent">
        <div
          ref={navRef}
          className="inline-flex p-1.5 rounded-2xl bg-muted/70 border border-border/70 shadow-2xs gap-1 overflow-x-auto max-w-full scrollbar-none"
          role="tablist"
        >
          {TABS.map(({ id, label, icon: Icon, badge }) => {
            const isSelected = active === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={isSelected}
                aria-controls={`tab-panel-${id}`}
                onClick={() => setActive(id)}
                className={cn(
                  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring select-none cursor-pointer",
                  isSelected
                    ? "bg-card text-foreground shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/40"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isSelected ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <span>{label}</span>
                {badge !== undefined && (
                  <span
                    className={cn(
                      "px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground border border-border"
                    )}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab panels — lazy: only render once visited */}
      <div id="tab-panel-overview" role="tabpanel" className={cn("space-y-6 animate-fade-in", active !== "overview" && "hidden")}>
        {visited.has("overview") && overview}
      </div>
      <div id="tab-panel-health" role="tabpanel" className={cn("space-y-6 animate-fade-in", active !== "health" && "hidden")}>
        {visited.has("health") && health}
      </div>
      <div id="tab-panel-weight" role="tabpanel" className={cn("space-y-6 animate-fade-in", active !== "weight" && "hidden")}>
        {visited.has("weight") && weight}
      </div>
      <div id="tab-panel-feed" role="tabpanel" className={cn("space-y-6 animate-fade-in", active !== "feed" && "hidden")}>
        {visited.has("feed") && feed}
      </div>
      <div id="tab-panel-finance" role="tabpanel" className={cn("space-y-6 animate-fade-in", active !== "finance" && "hidden")}>
        {visited.has("finance") && finance}
      </div>
      <div id="tab-panel-gallery" role="tabpanel" className={cn("space-y-6 animate-fade-in", active !== "gallery" && "hidden")}>
        {visited.has("gallery") && gallery}
      </div>
      <div id="tab-panel-timeline" role="tabpanel" className={cn("space-y-6 animate-fade-in", active !== "timeline" && "hidden")}>
        {visited.has("timeline") && timeline}
      </div>
      <div id="tab-panel-identity" role="tabpanel" className={cn("space-y-6 animate-fade-in", active !== "identity" && "hidden")}>
        {visited.has("identity") && identity}
      </div>
    </div>
  );
}

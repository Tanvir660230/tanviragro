"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Info,
  HeartPulse,
  Package,
  Landmark,
  Shield,
  Scale,
  ChevronRight,
  Search,
  Pin,
  Archive,
  Check,
  CheckCheck,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ALERT_HIERARCHY, compareSeverity } from "@/lib/alerts/hierarchy";
import { NotificationItem, NotificationCategory, NotificationFilterState } from "@/lib/notifications/types";
import { useL } from "@/i18n/text";

const ICON_MAP = {
  heart: HeartPulse,
  package: Package,
  landmark: Landmark,
  shield: Shield,
  scale: Scale,
  dollar: Landmark,
  alert: AlertCircle,
  info: Info,
  bell: Bell,
};

const CATEGORY_TABS: { id: NotificationCategory; label: string; labelBn: string }[] = [
  { id: "all", label: "All Alerts", labelBn: "সকল" },
  { id: "cattle", label: "Livestock & Health", labelBn: "গরু ও স্বাস্থ্য" },
  { id: "inventory", label: "Feed & Supplies", labelBn: "খাদ্য ও স্টক" },
  { id: "finance", label: "Finance & Loans", labelBn: "অর্থ ও ঋণ" },
  { id: "compliance", label: "Compliance & Safety", labelBn: "কমপ্লায়েন্স" },
];

const LOCAL_STORAGE_KEY = "tanvir_agro_notification_state_v2";

export function NotificationCenterClient({
  initialNotifications,
}: {
  initialNotifications: NotificationItem[];
}) {
  const L = useL();
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>("all");
  const [activeState, setActiveState] = useState<NotificationFilterState>("all");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, { isRead?: boolean; isPinned?: boolean; isArchived?: boolean }>;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setNotifications((prev) =>
          prev.map((item) => {
            const override = parsed[item.id];
            if (!override) return item;
            return {
              ...item,
              isRead: override.isRead !== undefined ? override.isRead : item.isRead,
              isPinned: override.isPinned !== undefined ? override.isPinned : item.isPinned,
              isArchived: override.isArchived !== undefined ? override.isArchived : item.isArchived,
            };
          })
        );
      }
    } catch {
      // Non-critical
    }
    setIsLoaded(true);
  }, []);

  const saveStateToStorage = (updated: NotificationItem[]) => {
    try {
      const stateMap: Record<string, { isRead: boolean; isPinned: boolean; isArchived: boolean }> = {};
      for (const n of updated) {
        stateMap[n.id] = { isRead: n.isRead, isPinned: n.isPinned, isArchived: n.isArchived };
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateMap));
    } catch {
      // Non-critical
    }
  };

  const handleToggleRead = (id: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const updated = notifications.map((n) => (n.id === id ? { ...n, isRead: !n.isRead } : n));
    setNotifications(updated);
    saveStateToStorage(updated);
  };

  const handleTogglePin = (id: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const updated = notifications.map((n) => (n.id === id ? { ...n, isPinned: !n.isPinned } : n));
    setNotifications(updated);
    saveStateToStorage(updated);
  };

  const handleToggleArchive = (id: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const updated = notifications.map((n) => (n.id === id ? { ...n, isArchived: !n.isArchived } : n));
    setNotifications(updated);
    saveStateToStorage(updated);
  };

  const handleMarkAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, isRead: true }));
    setNotifications(updated);
    saveStateToStorage(updated);
  };

  const activeItems = useMemo(() => notifications.filter((n) => !n.isArchived), [notifications]);
  const unreadCount = useMemo(() => activeItems.filter((n) => !n.isRead).length, [activeItems]);
  const criticalCount = useMemo(() => activeItems.filter((n) => n.severity === "critical").length, [activeItems]);
  const pinnedCount = useMemo(() => activeItems.filter((n) => n.isPinned).length, [activeItems]);

  const filteredItems = useMemo(() => {
    return notifications
      .filter((n) => {
        if (activeState === "archived") {
          if (!n.isArchived) return false;
        } else {
          if (n.isArchived) return false;
          if (activeState === "unread" && n.isRead) return false;
          if (activeState === "pinned" && !n.isPinned) return false;
        }
        if (activeCategory !== "all" && n.category !== activeCategory) return false;
        if (selectedSeverity !== "all" && n.severity !== selectedSeverity) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = n.title.toLowerCase().includes(q);
          const matchSub = n.subtitle.toLowerCase().includes(q);
          if (!matchTitle && !matchSub) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        const sevDiff = compareSeverity(a.severity, b.severity);
        if (sevDiff !== 0) return sevDiff;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
  }, [notifications, activeState, activeCategory, selectedSeverity, searchQuery]);

  return (
    <div className="space-y-6">
      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{L("মোট সক্রিয়", "Total Active")}</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1">{activeItems.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{L("সব অংশ মিলিয়ে", "Across all modules")}</p>
        </div>
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">{L("জরুরি", "Critical Priority")}</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-rose-700 dark:text-rose-400 mt-1">{criticalCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{L("এখনই দেখুন", "Immediate attention")}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">{L("না পড়া", "Unread")}</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1">{unreadCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{L("নতুন", "New notices")}</p>
        </div>
        <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">{L("পিন করা", "Pinned")}</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-primary mt-1">{pinnedCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{L("গুরুত্বপূর্ণ", "High focus")}</p>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-border/60">
        {CATEGORY_TABS.map((tab) => {
          const isSelected = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={cn(
                "px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 -mb-[1px] flex items-center gap-1.5",
                isSelected
                  ? "border-primary text-primary font-bold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <span>{L(tab.labelBn, tab.label)}</span>
            </button>
          );
        })}
      </div>

      {/* Control Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/70 shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={L("সতর্কতা, ট্যাগ বা জিনিস খুঁজুন…", "Search alerts, tag, or item...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs rounded-xl"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
          {/* State pills */}
          <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-xl">
            {(["all", "unread", "pinned", "archived"] as NotificationFilterState[]).map((st) => (
              <button
                key={st}
                onClick={() => setActiveState(st)}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-semibold rounded-lg capitalize transition-colors",
                  activeState === st
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {L(({ all: "সব", unread: "না পড়া", pinned: "পিন করা", archived: "আর্কাইভ" } as Record<string, string>)[st] ?? st, st)}
              </button>
            ))}
          </div>

          {/* Quick Mark All Read */}
          {unreadCount > 0 && activeState !== "archived" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="h-8 text-xs gap-1 rounded-xl cursor-pointer"
            >
              <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{L("সব পড়া হয়েছে", "Mark all read")}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Notification Rows List */}
      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 p-12 text-center bg-card">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/40 mx-auto mb-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-sm font-bold text-foreground">{L("এখানে কোনো সতর্কতা নেই", "No alerts in this view")}</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {activeState === "archived"
              ? L("আর্কাইভ করা সতর্কতা এখানে দেখা যাবে।", "Archived notices will appear here.")
              : L("সব ঠিক আছে — কোনো বাকি সতর্কতা নেই।", "Everything is fine — no pending alerts.")}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredItems.map((item) => {
            const Icon = ICON_MAP[item.iconKey] || AlertCircle;
            const sev = ALERT_HIERARCHY[item.severity];

            return (
              <div
                key={item.id}
                className={cn(
                  "group relative rounded-2xl border p-4 transition-all duration-150 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 bg-card hover:shadow-xs",
                  !item.isRead && "border-l-4 border-l-primary bg-muted/[0.04]",
                  item.isPinned && "border-primary/50 shadow-xs",
                  item.severity === "critical" && "border-rose-500/30 dark:border-rose-900/40",
                  item.severity === "high" && "border-amber-500/30 dark:border-amber-900/40"
                )}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      sev.colorClass.badge
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                          sev.colorClass.badge
                        )}
                      >
                        {L(sev.labelBn, sev.labelEn)}
                      </span>
                      <h4
                        className={cn(
                          "text-sm font-semibold truncate",
                          item.isRead ? "text-muted-foreground" : "text-foreground font-bold"
                        )}
                      >
                        {item.title}
                      </h4>
                      {item.isPinned && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded">
                          <Pin className="h-2.5 w-2.5 rotate-45" /> {L("পিন করা", "Pinned")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                      {item.subtitle}
                    </p>
                  </div>
                </div>
                {/* Right Actions Toolbar */}
                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                  <button
                    onClick={(e) => handleTogglePin(item.id, e)}
                    title={item.isPinned ? L("পিন সরান", "Unpin") : L("উপরে পিন করুন", "Pin to top")}
                    className={cn(
                      "p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer",
                      item.isPinned && "text-primary bg-primary/10"
                    )}
                    aria-label={item.isPinned ? L("পিন সরান", "Unpin") : L("পিন করুন", "Pin")}
                  >
                    <Pin className="h-3.5 w-3.5 rotate-45" />
                  </button>

                  <button
                    onClick={(e) => handleToggleRead(item.id, e)}
                    title={item.isRead ? L("না পড়া করুন", "Mark unread") : L("পড়া হয়েছে", "Mark as read")}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    aria-label={item.isRead ? L("না পড়া করুন", "Mark unread") : L("পড়া হয়েছে", "Mark as read")}
                  >
                    {item.isRead ? <Check className="h-3.5 w-3.5" /> : <CheckCheck className="h-3.5 w-3.5 text-primary" />}
                  </button>

                  <button
                    onClick={(e) => handleToggleArchive(item.id, e)}
                    title={item.isArchived ? L("ফেরত আনুন", "Unarchive") : L("আর্কাইভ করুন", "Archive")}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    aria-label={item.isArchived ? L("ফেরত আনুন", "Unarchive") : L("আর্কাইভ করুন", "Archive")}
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>

                  <Link
                    href={item.href}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline ml-1 px-2.5 py-1 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors"
                  >
                    <span>{item.actionLabel || L("দেখুন", "View")}</span>
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

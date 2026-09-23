"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Bell, HeartPulse, Package, Clock, Landmark, Shield,
  Scale, CheckCircle2, Megaphone,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type {
  HealthEvent, InventoryItem, LoanDueAlert, InsuranceAlert, UnweighedAlert,
} from "@/components/shared/SmartAlertsDropdown";

export interface NotificationCenterProps {
  overdueHealth?: HealthEvent[];
  upcomingHealth?: HealthEvent[];
  lowStockItems?: InventoryItem[];
  loansDue?: LoanDueAlert[];
  insuranceExpiring?: InsuranceAlert[];
  unweighedCattle?: UnweighedAlert[];
}

type TabKey = "alerts" | "tasks" | "approvals" | "announcements";
type Priority = "critical" | "high" | "medium" | "info";

interface NotificationItem {
  id: string;
  tab: TabKey;
  title: string;
  subtitle: string;
  priority: Priority;
  timestamp: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  unread: boolean;
}

const PRIORITY_BADGE: Record<Priority, { label: string; cls: string }> = {
  critical: { label: "CRITICAL", cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400" },
  high: { label: "HIGH", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" },
  medium: { label: "MEDIUM", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400" },
  info: { label: "INFO", cls: "bg-muted text-muted-foreground" },
};

export function NotificationCenter({
  overdueHealth = [],
  upcomingHealth = [],
  lowStockItems = [],
  loansDue = [],
  insuranceExpiring = [],
  unweighedCattle = [],
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("alerts");

  const allNotifications = useMemo<NotificationItem[]>(() => {
    const list: NotificationItem[] = [];

    overdueHealth.forEach((h) => {
      list.push({
        id: `h-ov-${h.id}`,
        tab: "alerts",
        title: `Overdue: ${h.title}`,
        subtitle: `Cattle #${h.cattle?.tag_id ?? "Unknown"}`,
        priority: "critical",
        timestamp: "Overdue",
        icon: HeartPulse,
        href: "/dashboard/cattle",
        unread: true,
      });
    });

    lowStockItems.forEach((item) => {
      list.push({
        id: `st-${item.id}`,
        tab: "alerts",
        title: `Low Stock: ${item.name}`,
        subtitle: `Remaining: ${item.stock} ${item.unit}`,
        priority: "high",
        timestamp: "Today",
        icon: Package,
        href: "/dashboard/inventory",
        unread: true,
      });
    });

    loansDue.forEach((l) => {
      list.push({
        id: `ln-${l.id}`,
        tab: "approvals",
        title: `Loan Due: ${l.lender_name}`,
        subtitle: `৳${l.principal_amount.toLocaleString()} due`,
        priority: "high",
        timestamp: l.due_date,
        icon: Landmark,
        href: "/dashboard/finance",
        unread: true,
      });
    });

    insuranceExpiring.forEach((ins) => {
      list.push({
        id: `in-${ins.id}`,
        tab: "alerts",
        title: `Insurance Expiring: #${ins.tag_id}`,
        subtitle: `Expires on ${ins.insurance_expiry}`,
        priority: "medium",
        timestamp: ins.insurance_expiry,
        icon: Shield,
        href: "/dashboard/cattle",
        unread: false,
      });
    });

    unweighedCattle.forEach((u) => {
      list.push({
        id: `un-${u.id}`,
        tab: "tasks",
        title: `Weight Log Due: #${u.tag_id}`,
        subtitle: "No weight log recorded in > 14 days",
        priority: "medium",
        timestamp: "Due",
        icon: Scale,
        href: "/dashboard/cattle?open=bulk-weigh",
        unread: true,
      });
    });

    upcomingHealth.forEach((h) => {
      list.push({
        id: `up-${h.id}`,
        tab: "tasks",
        title: `Upcoming: ${h.title}`,
        subtitle: `Cattle #${h.cattle?.tag_id ?? "Unknown"}`,
        priority: "info",
        timestamp: h.scheduled_at,
        icon: Clock,
        href: "/dashboard/cattle",
        unread: false,
      });
    });

    list.push({
      id: "ann-sys-1",
      tab: "announcements",
      title: "Tanvir Agro ERP Operational",
      subtitle: "Multi-tenant sync & livestock engine online.",
      priority: "info",
      timestamp: "Active",
      icon: Megaphone,
      href: "/dashboard",
      unread: false,
    });

    return list;
  }, [overdueHealth, upcomingHealth, lowStockItems, loansDue, insuranceExpiring, unweighedCattle]);

  const unreadCount = allNotifications.filter((n) => n.unread).length;
  const filteredList = allNotifications.filter((n) => n.tab === activeTab);

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key: "alerts", label: "Alerts", count: allNotifications.filter((n) => n.tab === "alerts" && n.unread).length },
    { key: "tasks", label: "Tasks", count: allNotifications.filter((n) => n.tab === "tasks" && n.unread).length },
    { key: "approvals", label: "Approvals", count: allNotifications.filter((n) => n.tab === "approvals" && n.unread).length },
    { key: "announcements", label: "Updates", count: 0 },
  ];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
        aria-label={`Notifications (${unreadCount} unread)`}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white shadow-xs animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 sm:w-96 p-0 rounded-2xl border border-border shadow-2xl bg-card overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-bold text-foreground">Notification Center</h4>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">
            {unreadCount} unread
          </span>
        </div>

        <div className="flex border-b border-border/40 bg-muted/10 px-2 pt-1 gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-t-lg transition-all",
                activeTab === tab.key
                  ? "bg-card text-primary border-b-2 border-primary shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-bold">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="max-h-72 overflow-y-auto divide-y divide-border/20 p-1">
          {filteredList.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-foreground">All caught up</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">No pending {activeTab} at this time.</p>
            </div>
          ) : (
            filteredList.map((item) => {
              const Icon = item.icon;
              const pInfo = PRIORITY_BADGE[item.priority];
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-start gap-3 p-2.5 rounded-xl transition-colors hover:bg-muted/50",
                    item.unread && "bg-primary/5"
                  )}
                >
                  <div className="p-2 rounded-lg bg-muted text-foreground shrink-0 mt-0.5">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-foreground truncate leading-tight">
                        {item.title}
                      </span>
                      <span className={cn("text-[9px] font-bold px-1 py-0.2 rounded shrink-0", pInfo.cls)}>
                        {pInfo.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                      {item.subtitle}
                    </p>
                    <span className="text-[10px] text-muted-foreground/60 mt-1 block">
                      {item.timestamp}
                    </span>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        <div className="p-2 border-t border-border/50 bg-muted/20 flex items-center justify-between text-xs">
          <span className="text-[11px] text-muted-foreground/70">
            {allNotifications.length} notifications total
          </span>
          <Link
            href="/dashboard/notifications"
            onClick={() => setOpen(false)}
            className="text-xs font-semibold text-primary hover:underline"
          >
            View all →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

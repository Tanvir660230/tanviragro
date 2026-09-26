"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Bell, HeartPulse, Package, Clock, Landmark, Shield, Scale, CheckCircle2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useL } from "@/i18n/text";
import { useTranslation } from "@/i18n/I18nProvider";
import { fmtDay } from "@/lib/format";
import { WEIGH_EVERY_DAYS } from "@/lib/home/home-model";
import type { HealthEvent, InventoryItem, LoanDueAlert, InsuranceAlert, UnweighedAlert } from "@/components/shared/SmartAlertsDropdown";

export interface NotificationCenterProps {
  overdueHealth?: HealthEvent[];
  upcomingHealth?: HealthEvent[];
  lowStockItems?: InventoryItem[];
  loansDue?: LoanDueAlert[];
  insuranceExpiring?: InsuranceAlert[];
  unweighedCattle?: UnweighedAlert[];
}

type TabKey = "alerts" | "tasks";
type Priority = "critical" | "high" | "medium" | "info";

interface NotificationItem {
  id: string;
  tab: TabKey;
  title: string;
  subtitle: string;
  priority: Priority;
  when: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

const PRIORITY_CLS: Record<Priority, string> = {
  critical: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
  info: "bg-muted text-muted-foreground",
};

/**
 * The bell: the same alerts as the notifications page (lib/supabase/topbar-alerts.ts), in the
 * viewer's language. Things to fix now under "Alerts", things to do soon under "Tasks".
 */
export function NotificationCenter({
  overdueHealth = [], upcomingHealth = [], lowStockItems = [], loansDue = [], insuranceExpiring = [], unweighedCattle = [],
}: NotificationCenterProps) {
  const L = useL();
  const { locale } = useTranslation();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("alerts");
  const day = (d: string) => fmtDay(d.slice(0, 10), locale);
  const priorityLabel: Record<Priority, string> = {
    critical: L("জরুরি", "Urgent"), high: L("গুরুত্বপূর্ণ", "High"), medium: L("মাঝারি", "Medium"), info: L("তথ্য", "Info"),
  };

  const all = useMemo<NotificationItem[]>(() => {
    const list: NotificationItem[] = [];
    for (const h of overdueHealth) list.push({
      id: `h-ov-${h.id}`, tab: "alerts", priority: "critical", icon: HeartPulse, href: `/dashboard/cattle/${h.cattle_id}?tab=health`,
      title: `#${h.cattle?.tag_id ?? "?"} — ${h.title}`, subtitle: L(`তারিখ ছিল ${day(h.scheduled_at)} — সময় পেরিয়েছে`, `Was due ${day(h.scheduled_at)} — overdue`), when: day(h.scheduled_at),
    });
    for (const i of lowStockItems) list.push({
      id: `st-${i.id}`, tab: "alerts", priority: i.stock <= 0 ? "critical" : "high", icon: Package, href: "/dashboard/inventory",
      title: i.stock <= 0 ? L(`${i.name} — স্টক শেষ`, `${i.name} — out of stock`) : L(`${i.name} কম আছে`, `${i.name} is low`),
      subtitle: L(`স্টকে ${i.stock.toLocaleString("en-IN", { maximumFractionDigits: 1 })} ${i.unit}`, `${i.stock.toLocaleString("en-IN", { maximumFractionDigits: 1 })} ${i.unit} left`), when: L("আজ", "Today"),
    });
    for (const l of loansDue) list.push({
      id: `ln-${l.id}`, tab: "alerts", priority: "high", icon: Landmark, href: "/dashboard/finance/loans",
      title: L(`${l.lender_name} — ঋণ শোধের সময়`, `${l.lender_name} — loan due`), subtitle: L(`আসল ৳${l.principal_amount.toLocaleString("en-IN")}`, `Principal ৳${l.principal_amount.toLocaleString("en-IN")}`), when: day(l.due_date),
    });
    for (const u of unweighedCattle) list.push({
      id: `un-${u.id}`, tab: "tasks", priority: "medium", icon: Scale, href: `/dashboard/cattle/${u.id}`,
      title: L(`#${u.tag_id} — ওজন নিন`, `#${u.tag_id} — weigh it`), subtitle: L(`${WEIGH_EVERY_DAYS} দিনের বেশি ওজন নেওয়া হয়নি`, `Not weighed in over ${WEIGH_EVERY_DAYS} days`), when: L("বাকি", "Due"),
    });
    for (const h of upcomingHealth) list.push({
      id: `up-${h.id}`, tab: "tasks", priority: "info", icon: Clock, href: `/dashboard/cattle/${h.cattle_id}?tab=health`,
      title: `#${h.cattle?.tag_id ?? "?"} — ${h.title}`, subtitle: L(`তারিখ ${day(h.scheduled_at)}`, `Due ${day(h.scheduled_at)}`), when: day(h.scheduled_at),
    });
    for (const ins of insuranceExpiring) list.push({
      id: `in-${ins.id}`, tab: "tasks", priority: "medium", icon: Shield, href: `/dashboard/cattle/${ins.id}`,
      title: L(`#${ins.tag_id} — বীমার মেয়াদ শেষ হচ্ছে`, `#${ins.tag_id} — insurance ends`), subtitle: L(`মেয়াদ শেষ ${day(ins.insurance_expiry)}`, `Ends ${day(ins.insurance_expiry)}`), when: day(ins.insurance_expiry),
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overdueHealth, upcomingHealth, lowStockItems, loansDue, insuranceExpiring, unweighedCattle, locale]);

  const alertCount = all.filter((n) => n.tab === "alerts").length;
  const shown = all.filter((n) => n.tab === activeTab);
  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "alerts", label: L("সতর্কতা", "Alerts"), count: alertCount },
    { key: "tasks", label: L("কাজ", "Tasks"), count: all.length - alertCount },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="relative flex h-10 w-10 md:h-9 md:w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
        aria-label={L(`নোটিফিকেশন (${alertCount}টি সতর্কতা)`, `Notifications (${alertCount} alerts)`)}
      >
        <Bell className="h-[18px] w-[18px] md:h-4 md:w-4" />
        {alertCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-xs">
            {alertCount > 9 ? "9+" : alertCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))] p-0 rounded-2xl border border-border shadow-2xl bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/20">
          <h4 className="flex items-center gap-2 text-sm font-bold text-foreground"><Bell className="h-4 w-4 text-primary" />{L("নোটিফিকেশন", "Notifications")}</h4>
          <span className="text-xs text-muted-foreground">{L(`মোট ${all.length}টি`, `${all.length} in all`)}</span>
        </div>

        <div className="flex gap-1 border-b border-border/40 bg-muted/10 px-2 pt-1">
          {tabs.map((tab) => (
            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
              className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-t-lg py-2 text-sm font-semibold transition-all",
                activeTab === tab.key ? "border-b-2 border-primary bg-card text-primary" : "text-muted-foreground hover:text-foreground")}>
              {tab.label}
              {tab.count > 0 && <span className={cn("rounded-full px-1.5 text-[10px] font-bold", tab.key === "alerts" ? "bg-rose-500 text-white" : "bg-muted text-muted-foreground")}>{tab.count}</span>}
            </button>
          ))}
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-border/30 p-1">
          {shown.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto mb-1.5 h-6 w-6 text-emerald-500" />
              <p className="text-sm font-semibold text-foreground">{L("সব ঠিক আছে", "All caught up")}</p>
            </div>
          ) : shown.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.id} href={item.href} onClick={() => setOpen(false)} className="flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted/50">
                <div className="mt-0.5 shrink-0 rounded-lg bg-muted p-2 text-foreground"><Icon className="h-3.5 w-3.5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-sm font-semibold leading-tight text-foreground">{item.title}</span>
                    <span className={cn("shrink-0 rounded px-1.5 py-px text-[10px] font-bold", PRIORITY_CLS[item.priority])}>{priorityLabel[item.priority]}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{item.subtitle}</p>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground/70">{item.when}</span>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center justify-end border-t border-border/50 bg-muted/20 p-2">
          <Link href="/dashboard/notifications" onClick={() => setOpen(false)} className="text-sm font-semibold text-primary hover:underline">{L("সব দেখুন →", "View all →")}</Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

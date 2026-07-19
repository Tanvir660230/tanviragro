"use client";

import { useState } from "react";
import {
  Bell, HeartPulse, Package, CheckCircle2,
  Clock, Landmark, Shield, Scale,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/I18nProvider";

// ── Exported types (consumed by TopBar) ─────────────────────────────────────

export type HealthEvent = {
  id: string;
  title: string;
  scheduled_at: string;
  cattle_id: string;
  cattle: { tag_id: string | null } | null;
};

export type InventoryItem = {
  id: string;
  name: string;
  unit: string;
  stock: number;
  low_stock_threshold: number | null;
};

export type LoanDueAlert = {
  id: string;
  lender_name: string;
  principal_amount: number;
  due_date: string;
};

export type InsuranceAlert = {
  id: string;
  tag_id: string;
  insurance_expiry: string;
};

export type UnweighedAlert = {
  id: string;
  tag_id: string;
};

// ── Internal types ───────────────────────────────────────────────────────────

type Severity = "critical" | "warning" | "info";

type AlertItem = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  severity: Severity;
  title: string;
  subtitle: string;
  badge: string;
  href: string;
};

type AlertGroup = {
  key: string;
  label: string;
  items: AlertItem[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function relDate(iso: string, now: number): string {
  const ms = new Date(iso).getTime() - now;
  const days = Math.round(ms / 86400000);
  if (days < -60) return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short" });
  if (days < -1)  return `${Math.abs(days)}d ago`;
  if (days === -1) return "yesterday";
  if (days === 0)  return "today";
  if (days === 1)  return "tomorrow";
  if (days <= 7)  return `in ${days}d`;
  if (days <= 30) return `in ${days}d`;
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

function bdt(n: number) {
  return "৳" + Math.round(n).toLocaleString("en-IN");
}

// ── Icon + colour maps ───────────────────────────────────────────────────────

const SEVERITY_ICON_BG: Record<Severity, string> = {
  critical: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
  warning:  "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  info:     "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
};

const SEVERITY_BADGE: Record<Severity, string> = {
  critical: "text-rose-600 dark:text-rose-400",
  warning:  "text-amber-600 dark:text-amber-400",
  info:     "text-blue-600 dark:text-blue-400",
};

// ── Component ────────────────────────────────────────────────────────────────

export function SmartAlertsDropdown({
  overdueHealth,
  upcomingHealth,
  lowStockItems,
  loansDue,
  insuranceExpiring,
  unweighedCattle,
}: {
  overdueHealth: HealthEvent[];
  upcomingHealth: HealthEvent[];
  lowStockItems: InventoryItem[];
  loansDue: LoanDueAlert[];
  insuranceExpiring: InsuranceAlert[];
  unweighedCattle: UnweighedAlert[];
}) {
  const [open, setOpen] = useState(false);
  const [now] = useState(() => Date.now());
  const { t } = useTranslation();
  const sa = t.smart_alerts;

  // ── Build grouped alerts ─────────────────────────────────────────────────

  const healthItems: AlertItem[] = [
    ...overdueHealth.map((h) => ({
      id: `h-${h.id}`,
      icon: HeartPulse,
      severity: "critical" as Severity,
      title: h.title,
      subtitle: `Cow #${h.cattle?.tag_id ?? "?"}`,
      badge: relDate(h.scheduled_at, now),
      href: `/dashboard/cattle/${h.cattle_id}`,
    })),
    ...upcomingHealth.map((h) => ({
      id: `u-${h.id}`,
      icon: Clock,
      severity: "warning" as Severity,
      title: h.title,
      subtitle: `Cow #${h.cattle?.tag_id ?? "?"}`,
      badge: relDate(h.scheduled_at, now),
      href: `/dashboard/cattle/${h.cattle_id}`,
    })),
  ];

  const financeItems: AlertItem[] = [
    ...loansDue.map((l) => {
      const overdue = new Date(l.due_date).getTime() < now;
      return {
        id: `l-${l.id}`,
        icon: Landmark,
        severity: (overdue ? "critical" : "warning") as Severity,
        title: overdue ? `Loan overdue — ${l.lender_name}` : `Loan due — ${l.lender_name}`,
        subtitle: bdt(l.principal_amount),
        badge: relDate(l.due_date, now),
        href: `/dashboard/finance/loans`,
      };
    }),
    ...insuranceExpiring.map((c) => {
      const overdue = new Date(c.insurance_expiry).getTime() < now;
      return {
        id: `ins-${c.id}`,
        icon: Shield,
        severity: (overdue ? "critical" : "warning") as Severity,
        title: overdue ? "Insurance expired" : "Insurance expiring",
        subtitle: `Cow #${c.tag_id}`,
        badge: relDate(c.insurance_expiry, now),
        href: `/dashboard/cattle/${c.id}`,
      };
    }),
  ];

  const farmItems: AlertItem[] = unweighedCattle.map((c) => ({
    id: `w-${c.id}`,
    icon: Scale,
    severity: "warning" as Severity,
    title: "Not weighed recently",
    subtitle: `Cow #${c.tag_id}`,
    badge: "7d+",
    href: `/dashboard/cattle/${c.id}`,
  }));

  const stockItems: AlertItem[] = lowStockItems.map((i) => ({
    id: `s-${i.id}`,
    icon: Package,
    severity: (i.stock <= 0 ? "critical" : "warning") as Severity,
    title: i.stock <= 0 ? `Out of stock: ${i.name}` : `Low stock: ${i.name}`,
    subtitle: sa.only_remaining.replace("{{n}}", String(i.stock)).replace("{{unit}}", i.unit),
    badge: `${i.stock} ${i.unit}`,
    href: `/dashboard/inventory`,
  }));

  const groups: AlertGroup[] = [
    { key: "health",  label: "Health",  items: healthItems  },
    { key: "finance", label: "Finance", items: financeItems },
    { key: "farm",    label: "Farm",    items: farmItems    },
    { key: "stock",   label: "Stock",   items: stockItems   },
  ].filter((g) => g.items.length > 0);

  const totalCount = groups.reduce((s, g) => s + g.items.length, 0);
  const hasCritical = groups.some((g) => g.items.some((i) => i.severity === "critical"));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          hasCritical
            ? "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            : totalCount > 0
            ? "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
            : "text-muted-foreground hover:bg-muted"
        )}
        aria-label={totalCount > 0 ? `${totalCount} alerts` : "No alerts"}
      >
        <Bell className="h-[18px] w-[18px]" />
        {totalCount > 0 && (
          <span
            className={cn(
              "absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold text-white leading-none",
              hasCritical ? "bg-rose-500" : "bg-amber-500"
            )}
          >
            {totalCount > 9 ? "9+" : totalCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[calc(100vw-2rem)] sm:w-[360px] p-0 shadow-floating border-border/60 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">{sa.title}</h3>
          </div>
          {totalCount > 0 && (
            <span
              className={cn(
                "text-xs font-bold px-2 py-0.5 rounded-full",
                hasCritical
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              )}
            >
              {totalCount} active
            </span>
          )}
        </div>

        {/* Body */}
        <div className="max-h-[420px] overflow-y-auto">
          {totalCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30 mb-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
              <p className="text-sm font-semibold text-foreground">{sa.all_clear}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{sa.all_clear_desc}</p>
            </div>
          ) : (
            <div>
              {groups.map((group, gi) => (
                <div key={group.key}>
                  {/* Group header */}
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground/50">
                      {group.label}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground/40">
                      · {group.items.length}
                    </span>
                    <div className="flex-1 h-px bg-border/40" />
                  </div>

                  {/* Group items */}
                  <div className={cn(gi < groups.length - 1 && "border-b border-border/30 pb-1")}>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors"
                        >
                          <div
                            className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                              SEVERITY_ICON_BG[item.severity]
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate leading-tight">
                              {item.title}
                            </p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {item.subtitle}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "text-xs font-bold whitespace-nowrap shrink-0 tabular-nums",
                              SEVERITY_BADGE[item.severity]
                            )}
                          >
                            {item.badge}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/50 bg-muted/10 px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground/60">
            {totalCount > 0 ? `${totalCount} alerts need attention` : "All systems normal"}
          </span>
          <Link
            href="/dashboard/notifications"
            onClick={() => setOpen(false)}
            className="text-xs font-semibold text-primary hover:underline"
          >
            সব দেখুন →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

"use client";

import { useState, useEffect } from "react";
import type { ActivityItem, ActivityType } from "@/lib/supabase/queries/dashboard";
import { Beef, Scale, TrendingUp, TrendingDown, Activity, Package, Stethoscope, Syringe, Landmark, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { Dictionary, Locale } from "@/i18n/getDictionary";
import Link from "next/link";

const ICON_MAP: Record<ActivityType, LucideIcon> = {
  cattle_added: Beef,
  weight_logged: Scale,
  sale_recorded: TrendingUp,
  cost_entered: TrendingDown,
  inventory_purchased: Package,
  medical_treatment: Stethoscope,
  health_event: Syringe,
  partner_txn: Landmark,
  loan: CreditCard,
};

const COLOR_MAP: Record<ActivityType, { bg: string; text: string; line: string }> = {
  cattle_added: {
    bg: "bg-emerald-100 dark:bg-emerald-950/70",
    text: "text-emerald-700 dark:text-emerald-400",
    line: "bg-emerald-200 dark:bg-emerald-800/50",
  },
  weight_logged: {
    bg: "bg-blue-100 dark:bg-blue-950/70",
    text: "text-blue-700 dark:text-blue-400",
    line: "bg-blue-200 dark:bg-blue-800/50",
  },
  sale_recorded: {
    bg: "bg-amber-100 dark:bg-amber-950/70",
    text: "text-amber-700 dark:text-amber-400",
    line: "bg-amber-200 dark:bg-amber-800/50",
  },
  cost_entered: {
    bg: "bg-red-100 dark:bg-red-950/60",
    text: "text-red-600 dark:text-red-400",
    line: "bg-red-200 dark:bg-red-800/50",
  },
  inventory_purchased: {
    bg: "bg-amber-100 dark:bg-amber-950/70",
    text: "text-amber-700 dark:text-amber-400",
    line: "bg-amber-200 dark:bg-amber-800/50",
  },
  medical_treatment: {
    bg: "bg-pink-100 dark:bg-pink-950/70",
    text: "text-pink-700 dark:text-pink-400",
    line: "bg-pink-200 dark:bg-pink-800/50",
  },
  health_event: {
    bg: "bg-purple-100 dark:bg-purple-950/70",
    text: "text-purple-700 dark:text-purple-400",
    line: "bg-purple-200 dark:bg-purple-800/50",
  },
  partner_txn: {
    bg: "bg-indigo-100 dark:bg-indigo-950/70",
    text: "text-indigo-700 dark:text-indigo-400",
    line: "bg-indigo-200 dark:bg-indigo-800/50",
  },
  loan: {
    bg: "bg-orange-100 dark:bg-orange-950/70",
    text: "text-orange-700 dark:text-orange-400",
    line: "bg-orange-200 dark:bg-orange-800/50",
  },
};

function relativeDate(dateStr: string, locale: Locale, t: Dictionary): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  const af = t.activity;
  if (diffDays === 0) return af.today;
  if (diffDays === 1) return af.yesterday;
  if (diffDays < 7) return `${diffDays}${af.days_ago}`;
  return date.toLocaleDateString(locale === "bn" ? "bn-BD" : "en-US", { month: "short", day: "numeric" });
}

interface Props {
  items: ActivityItem[];
  t: Dictionary;
  locale: Locale;
}

export function ActivityFeed({ items, t, locale }: Props) {
  const af = t.activity;
  // Tick every 60s so relative timestamps ("2 hours ago") stay fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
          <Activity className="h-5 w-5 text-muted-foreground/40" />
        </div>
        <p className="text-sm font-medium text-foreground">{af.no_activity}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{af.no_activity_desc}</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {items.map((item, idx) => {
        const Icon = ICON_MAP[item.type];
        const colors = COLOR_MAP[item.type];
        const isLast = idx === items.length - 1;

        const inner = (
          <div className={cn(
            "group relative flex items-start gap-3.5 py-3 px-1",
            item.href && "cursor-pointer hover:bg-muted/30 rounded-lg transition-colors"
          )}>
            {/* Timeline connector */}
            {!isLast && (
              <div className={cn("absolute left-[19px] top-10 bottom-0 w-px", colors.line)} />
            )}

            {/* Icon bubble */}
            <div className={cn(
              "relative z-10 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-2 ring-background transition-transform duration-150 group-hover:scale-105",
              colors.bg, colors.text
            )}>
              <Icon className="h-4 w-4" />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 pt-1">
              <p className="truncate text-sm font-semibold text-foreground leading-snug" title={item.label}>
                {item.label}
              </p>
              <p className="mt-0.5 text-xs font-medium text-muted-foreground">{item.detail}</p>
            </div>

            {/* Relative date chip */}
            <div className="shrink-0 pt-1">
              <span className="text-xs font-medium text-muted-foreground/70 bg-muted/50 rounded-full px-2 py-0.5 whitespace-nowrap">
                {relativeDate(item.date, locale, t)}
              </span>
            </div>
          </div>
        );

        return item.href ? (
          <Link key={item.id} href={item.href} className="block">
            {inner}
          </Link>
        ) : (
          <div key={item.id}>{inner}</div>
        );
      })}
    </div>
  );
}

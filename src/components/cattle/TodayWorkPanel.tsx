"use client";

import Link from "next/link";
import { Scale, HeartPulse, AlertTriangle, CheckCircle2 } from "lucide-react";
import { BulkWeightDialog } from "./BulkWeightDialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  unweighedCattle: { id: string; tag_id: string }[];
  overdueHealthCount: number;
  highFcrCount: number;
}

export function TodayWorkPanel({ unweighedCattle, overdueHealthCount, highFcrCount }: Props) {
  const hasWork = unweighedCattle.length > 0 || overdueHealthCount > 0 || highFcrCount > 0;

  if (!hasWork) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200/70 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/15 px-4 py-3">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
          All cattle weighed and on track — nothing urgent today.
        </p>
      </div>
    );
  }

  const items = [
    unweighedCattle.length > 0 && {
      icon: <Scale className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
      iconBg: "bg-amber-500/10",
      title: `${unweighedCattle.length} cattle need weighing`,
      sub: "Not logged in the last 7 days",
      action: (
        <BulkWeightDialog
          cattle={unweighedCattle}
          triggerLabel={`Weigh Now (${unweighedCattle.length})`}
          triggerVariant="default"
        />
      ),
    },
    overdueHealthCount > 0 && {
      icon: <HeartPulse className="h-4 w-4 text-red-500 dark:text-red-400" />,
      iconBg: "bg-red-500/10",
      title: `${overdueHealthCount} health event${overdueHealthCount !== 1 ? "s" : ""} overdue`,
      sub: "Scheduled treatments, vaccines, or checkups",
      action: (
        <Link
          href="/dashboard/cattle/health"
          className={cn(buttonVariants({ variant: "default", size: "sm" }), "shrink-0")}
        >
          Open Health Hub →
        </Link>
      ),
    },
    highFcrCount > 0 && {
      icon: <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />,
      iconBg: "bg-orange-500/10",
      title: `${highFcrCount} cattle with high FCR`,
      sub: "FCR above 10 — review feed efficiency",
      action: (
        <Link
          href="/dashboard/cattle/analytics"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
        >
          View Analytics →
        </Link>
      ),
    },
  ].filter(Boolean) as {
    icon: React.ReactNode;
    iconBg: string;
    title: string;
    sub: string;
    action: React.ReactNode;
  }[];

  return (
    <div className="rounded-xl border border-border/70 bg-card shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-border/60 bg-muted/20">
        <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        <h2 className="text-sm font-semibold">Today&apos;s Work</h2>
        <span className="ml-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs font-bold px-2 py-0.5">
          {items.length} item{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Task rows */}
      <div className="divide-y divide-border">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5"
          >
            {/* Icon */}
            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", item.iconBg)}>
              {item.icon}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-snug">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{item.sub}</p>
            </div>

            {/* Action */}
            <div className="shrink-0">
              {item.action}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

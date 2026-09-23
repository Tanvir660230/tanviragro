import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendBadge } from "@/components/dashboard/TrendBadge";

export type AccentColor = "emerald" | "blue" | "amber" | "violet" | "rose" | "slate" | "destructive" | "warning" | "muted";

const ACCENT: Record<
  AccentColor,
  {
    iconBg: string;
    iconColor: string;
  }
> = {
  emerald: {
    iconBg: "bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  blue: {
    iconBg: "bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  amber: {
    iconBg: "bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  warning: {
    iconBg: "bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  violet: {
    iconBg: "bg-purple-500/10 dark:bg-purple-500/15 border border-purple-500/20",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
  rose: {
    iconBg: "bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20",
    iconColor: "text-rose-600 dark:text-rose-400",
  },
  destructive: {
    iconBg: "bg-red-500/10 dark:bg-red-500/15 border border-red-500/20",
    iconColor: "text-red-600 dark:text-red-400",
  },
  slate: {
    iconBg: "bg-muted/80 border border-border/60",
    iconColor: "text-muted-foreground",
  },
  muted: {
    iconBg: "bg-muted/80 border border-border/60",
    iconColor: "text-muted-foreground",
  },
};

interface Props {
  label: string;
  value: React.ReactNode;
  subtext?: string;
  sub?: string;
  icon?: LucideIcon | React.ReactNode;
  positive?: boolean;
  trend?: { pct: number | null; inverted?: boolean };
  href?: string;
  accentColor?: AccentColor;
  color?: AccentColor;
  className?: string;
}

function isIconComponent(v: unknown): v is React.ComponentType<{ className?: string }> {
  if (!v || React.isValidElement(v)) return false;
  return typeof v === "function" || (typeof v === "object" && ("$$typeof" in v || "render" in v));
}

export function StatCard({
  label,
  value,
  subtext,
  sub,
  icon,
  positive,
  trend,
  href,
  accentColor = "emerald",
  color,
  className,
}: Props) {
  const chosenColor = color || accentColor;
  const isNeutral = positive === undefined;
  const accent = ACCENT[chosenColor] ?? ACCENT.emerald;

  const iconBg = isNeutral
    ? accent.iconBg
    : positive
      ? "bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20"
      : "bg-red-500/10 dark:bg-red-500/15 border border-red-500/20";

  const iconColor = isNeutral
    ? accent.iconColor
    : positive
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-red-600 dark:text-red-400";

  const valueColor = isNeutral
    ? "text-foreground"
    : positive
      ? "text-emerald-700 dark:text-emerald-400"
      : "text-destructive";

  const description = subtext || sub;

  const inner = (
    <div className="flex flex-col gap-3 p-4 sm:p-5 h-full">
      {/* Header: label + icon */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-none truncate">
          {label}
        </p>
        {icon && (
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-xs transition-transform duration-200 group-hover:scale-105",
              iconBg
            )}
          >
            {isIconComponent(icon) ? (
              React.createElement(icon, { className: cn("h-4 w-4", iconColor) })
            ) : React.isValidElement(icon) ? (
              icon
            ) : (
              <span className={cn("text-xs font-bold", iconColor)}>{icon as React.ReactNode}</span>
            )}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="mt-auto">
        <div
          className={cn(
            "text-2xl sm:text-[1.75rem] font-bold tabular-nums leading-none tracking-tight",
            valueColor
          )}
        >
          {value}
        </div>
        <div className="mt-2 flex items-center gap-2 flex-wrap min-h-[16px]">
          {description && (
            <p className="text-xs text-muted-foreground line-clamp-1">{description}</p>
          )}
          {trend && trend.pct !== null && (
            <TrendBadge pct={trend.pct} inverted={trend.inverted} />
          )}
        </div>
      </div>
    </div>
  );

  const base = cn(
    "group overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card transition-all duration-200 h-full relative",
    href && "hover:shadow-card-md hover:-translate-y-0.5 hover:border-border cursor-pointer active:scale-[0.99]",
    className
  );

  if (href) {
    return (
      <Link href={href} className={base}>
        {inner}
      </Link>
    );
  }
  return <div className={base}>{inner}</div>;
}

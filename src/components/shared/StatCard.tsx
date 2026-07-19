import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendBadge } from "@/components/dashboard/TrendBadge";

export type AccentColor = "emerald" | "blue" | "amber" | "violet";

const ACCENT: Record<AccentColor, {
  iconBg:    string;
  iconColor: string;
}> = {
  emerald: {
    iconBg:    "bg-emerald-100 dark:bg-emerald-900/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  blue: {
    iconBg:    "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  amber: {
    iconBg:    "bg-amber-100 dark:bg-amber-900/30",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  violet: {
    iconBg:    "bg-violet-100 dark:bg-violet-900/30",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
};

interface Props {
  label:        string;
  value:        string;
  subtext?:     string;
  icon:         LucideIcon;
  positive?:    boolean;
  trend?:       { pct: number | null; inverted?: boolean };
  href?:        string;
  accentColor?: AccentColor;
}

export function StatCard({
  label,
  value,
  subtext,
  icon: Icon,
  positive,
  trend,
  href,
  accentColor = "emerald",
}: Props) {
  const isNeutral = positive === undefined;
  const accent    = ACCENT[accentColor];

  const iconBg = isNeutral
    ? accent.iconBg
    : positive
      ? "bg-emerald-100 dark:bg-emerald-900/30"
      : "bg-red-100 dark:bg-red-900/30";

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

  const inner = (
    <div className="flex flex-col gap-3 p-4 sm:p-5 h-full">
      {/* Header: label + icon */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground leading-none">
          {label}
        </p>
        <div className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          iconBg
        )}>
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>
      </div>

      {/* Value */}
      <div className="mt-auto">
        <p className={cn(
          "text-2xl sm:text-[1.75rem] font-bold tabular-nums leading-none tracking-tight",
          valueColor
        )}>
          {value}
        </p>
        <div className="mt-1.5 flex items-center gap-2 flex-wrap min-h-[16px]">
          {subtext && (
            <p className="text-xs text-muted-foreground line-clamp-1">{subtext}</p>
          )}
          {trend && trend.pct !== null && (
            <TrendBadge pct={trend.pct} inverted={trend.inverted} />
          )}
        </div>
      </div>
    </div>
  );

  const base = cn(
    "group overflow-hidden rounded-xl border border-border/60 bg-card shadow-card transition-all duration-200 h-full",
    href && "hover:shadow-card-md hover:-translate-y-0.5 hover:border-border cursor-pointer"
  );

  if (href) {
    return <Link href={href} className={base}>{inner}</Link>;
  }
  return <div className={base}>{inner}</div>;
}

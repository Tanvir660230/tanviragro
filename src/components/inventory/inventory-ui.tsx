import React from "react";
import { cn } from "@/lib/utils";
import {
  Wheat,
  Pill,
  Wrench,
  Package,
  Layers,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";

export const CATEGORY_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ElementType;
    badge: string;
    dot: string;
    border: string;
    bgLight: string;
  }
> = {
  feed: {
    label: "Concentrate Feed",
    icon: Wheat,
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    dot: "bg-emerald-500",
    border: "border-emerald-500/30",
    bgLight: "bg-emerald-500/[0.03]",
  },
  roughage: {
    label: "Roughage / Fodder",
    icon: Layers,
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    dot: "bg-amber-500",
    border: "border-amber-500/30",
    bgLight: "bg-amber-500/[0.03]",
  },
  medicine: {
    label: "Medicine & Health",
    icon: Pill,
    badge: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
    dot: "bg-blue-500",
    border: "border-blue-500/30",
    bgLight: "bg-blue-500/[0.03]",
  },
  equipment: {
    label: "Farm Equipment",
    icon: Wrench,
    badge: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
    dot: "bg-purple-500",
    border: "border-purple-500/30",
    bgLight: "bg-purple-500/[0.03]",
  },
  other: {
    label: "General Supplies",
    icon: Package,
    badge: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
    dot: "bg-slate-500",
    border: "border-slate-500/30",
    bgLight: "bg-slate-500/[0.03]",
  },
};

export function CategoryBadge({
  category,
  className,
}: {
  category: string;
  className?: string;
}) {
  const conf = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.other;
  const Icon = conf.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border capitalize transition-colors",
        conf.badge,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", conf.dot)} />
      <Icon className="h-3 w-3 opacity-80" />
      <span>{conf.label.split(" ")[0]}</span>
    </span>
  );
}

export function InventoryStatCard({
  icon: Icon,
  label,
  value,
  subtext,
  badgeText,
  variant = "default",
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtext?: string;
  badgeText?: string;
  variant?: "default" | "warning" | "danger" | "success" | "accent";
  onClick?: () => void;
}) {
  const variantStyles = {
    default: {
      card: "border-border/80 bg-card hover:border-border",
      icon: "bg-muted text-muted-foreground",
      value: "text-foreground",
    },
    warning: {
      card: "border-amber-500/30 bg-amber-500/[0.04] hover:border-amber-500/50",
      icon: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      value: "text-amber-600 dark:text-amber-400",
    },
    danger: {
      card: "border-rose-500/30 bg-rose-500/[0.04] hover:border-rose-500/50",
      icon: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
      value: "text-rose-600 dark:text-rose-400",
    },
    success: {
      card: "border-emerald-500/30 bg-emerald-500/[0.04] hover:border-emerald-500/50",
      icon: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      value: "text-emerald-600 dark:text-emerald-400",
    },
    accent: {
      card: "border-primary/30 bg-primary/[0.04] hover:border-primary/50",
      icon: "bg-primary/15 text-primary",
      value: "text-foreground",
    },
  }[variant];

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative rounded-2xl border p-4 sm:p-5 transition-all shadow-sm",
        onClick && "cursor-pointer active:scale-[0.99]",
        variantStyles.card
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
            {label}
          </p>
          <div className="flex items-baseline gap-2 pt-0.5">
            <span className={cn("text-2xl sm:text-3xl font-bold tracking-tight font-mono tabular-nums", variantStyles.value)}>
              {value}
            </span>
            {badgeText && (
              <span className="text-xs font-medium text-muted-foreground">
                {badgeText}
              </span>
            )}
          </div>
          {subtext && (
            <p className="text-xs text-muted-foreground/90 font-medium pt-1">
              {subtext}
            </p>
          )}
        </div>
        <div className={cn("rounded-xl p-2.5 shrink-0", variantStyles.icon)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function StockHealthIndicator({
  stock,
  threshold,
  unit,
  avgDaily,
}: {
  stock: number;
  threshold: number | null;
  unit: string;
  avgDaily: number | null;
}) {
  const isOut = stock <= 0;
  const isLow = !isOut && threshold !== null && stock <= threshold;
  const days = avgDaily && avgDaily > 0 ? stock / avgDaily : null;

  let progress = 100;
  if (threshold && threshold > 0) {
    progress = Math.min(100, Math.max(8, (stock / (threshold * 2)) * 100));
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground font-mono tabular-nums">
          {stock.toLocaleString("en-IN", { maximumFractionDigits: 2 })} {unit}
        </span>
        {isOut ? (
          <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
            <ShieldAlert className="h-3 w-3" /> Depleted
          </span>
        ) : isLow ? (
          <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Low Stock
          </span>
        ) : (
          <span className="text-muted-foreground/70 font-medium">Optimal</span>
        )}
      </div>

      <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isOut
              ? "w-0 bg-rose-500"
              : isLow
              ? "bg-amber-500"
              : "bg-emerald-500"
          )}
          style={{ width: isOut ? "0%" : `${progress}%` }}
        />
      </div>
    </div>
  );
}

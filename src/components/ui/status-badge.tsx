import * as React from "react";
import { cn } from "@/lib/utils";

export type EntityStatus =
  | "active"
  | "sold"
  | "dead"
  | "quarantined"
  | "sick"
  | "pregnant"
  | "due_soon"
  | "pending"
  | "completed"
  | "overdue"
  | "draft"
  | "paid"
  | "unpaid"
  | "partial"
  | "in_stock"
  | "low_stock"
  | "out_of_stock";

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: EntityStatus | string;
  label?: string;
  pulse?: boolean;
}

const STATUS_CONFIG: Record<
  string,
  {
    bg: string;
    text: string;
    border: string;
    dot: string;
    label: string;
  }
> = {
  active: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/20 dark:border-emerald-500/30",
    dot: "bg-emerald-500",
    label: "Active",
  },
  sold: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-500/20 dark:border-blue-500/30",
    dot: "bg-blue-500",
    label: "Sold",
  },
  dead: {
    bg: "bg-red-50 dark:bg-red-950/40",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-500/20 dark:border-red-500/30",
    dot: "bg-red-500",
    label: "Deceased",
  },
  quarantined: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-800 dark:text-amber-300",
    border: "border-amber-500/20 dark:border-amber-500/30",
    dot: "bg-amber-500",
    label: "Quarantined",
  },
  sick: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-500/20 dark:border-rose-500/30",
    dot: "bg-rose-500",
    label: "Sick",
  },
  pregnant: {
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-500/20 dark:border-purple-500/30",
    dot: "bg-purple-500",
    label: "Pregnant",
  },
  due_soon: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-800 dark:text-amber-300",
    border: "border-amber-500/20 dark:border-amber-500/30",
    dot: "bg-amber-500",
    label: "Due Soon",
  },
  completed: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/20 dark:border-emerald-500/30",
    dot: "bg-emerald-500",
    label: "Completed",
  },
  paid: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/20 dark:border-emerald-500/30",
    dot: "bg-emerald-500",
    label: "Paid",
  },
  pending: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-800 dark:text-amber-300",
    border: "border-amber-500/20 dark:border-amber-500/30",
    dot: "bg-amber-500",
    label: "Pending",
  },
  overdue: {
    bg: "bg-red-50 dark:bg-red-950/40",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-500/20 dark:border-red-500/30",
    dot: "bg-red-500",
    label: "Overdue",
  },
  draft: {
    bg: "bg-muted/60",
    text: "text-muted-foreground",
    border: "border-border/60",
    dot: "bg-muted-foreground/60",
    label: "Draft",
  },
  in_stock: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/20 dark:border-emerald-500/30",
    dot: "bg-emerald-500",
    label: "In Stock",
  },
  low_stock: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-800 dark:text-amber-300",
    border: "border-amber-500/20 dark:border-amber-500/30",
    dot: "bg-amber-500",
    label: "Low Stock",
  },
  out_of_stock: {
    bg: "bg-red-50 dark:bg-red-950/40",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-500/20 dark:border-red-500/30",
    dot: "bg-red-500",
    label: "Out of Stock",
  },
};

export function StatusBadge({
  status,
  label,
  pulse = false,
  className,
  ...props
}: StatusBadgeProps) {
  const normalized = status.toLowerCase();
  const config = STATUS_CONFIG[normalized] ?? {
    bg: "bg-muted/60",
    text: "text-muted-foreground",
    border: "border-border/60",
    dot: "bg-muted-foreground/60",
    label: status,
  };

  const displayLabel = label ?? config.label;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-tight whitespace-nowrap select-none",
        config.bg,
        config.text,
        config.border,
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          config.dot,
          pulse && "animate-pulse"
        )}
      />
      {displayLabel}
    </span>
  );
}
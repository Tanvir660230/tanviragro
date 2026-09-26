import React from "react";
import {
  Banknote,
  Wrench,
  TrendingUp,
  ArrowUpCircle,
  ArrowDownCircle,
  TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PartnerType } from "@/types/database";
import type { Dictionary } from "@/i18n/getDictionary";
import { Label } from "@/components/ui/label";

export const TYPE_CONFIG: Record<
  PartnerType,
  { icon: React.ReactNode; cls: string; label: (t: Dictionary) => string }
> = {
  capital: {
    icon: <Banknote className="h-3 w-3" />,
    cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    label: (t) => t.partners.capital_badge,
  },
  labor: {
    icon: <Wrench className="h-3 w-3" />,
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    label: (t) => t.partners.labor_badge,
  },
  hybrid: {
    icon: <TrendingUp className="h-3 w-3" />,
    cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    label: (t) => t.partners.hybrid_badge,
  },
};

export function SummaryCard({
  icon: Icon,
  label,
  value,
  iconCls,
  valueColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  iconCls: string;
  valueColor?: "green" | "red";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center gap-2.5 mb-3">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0", iconCls)}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs font-medium text-muted-foreground leading-tight">{label}</p>
      </div>
      <p
        className={cn(
          "text-xl font-bold tabular-nums tracking-tight truncate",
          valueColor === "green"
            ? "text-emerald-600 dark:text-emerald-400"
            : valueColor === "red"
            ? "text-destructive"
            : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function QuickStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: "green" | "red";
}) {
  return (
    <div className="rounded-xl bg-muted/40 dark:bg-muted/20 px-2.5 py-2.5 border border-border/40">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
        {label}
      </p>
      <p
        className={cn(
          "text-sm font-bold tabular-nums",
          color === "green"
            ? "text-emerald-600 dark:text-emerald-400"
            : color === "red"
            ? "text-destructive"
            : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full", className)}>
      {children}
    </span>
  );
}

export function FormField({
  label,
  id,
  children,
}: {
  label: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      {children}
    </div>
  );
}

export function EmptyState({ t }: { t: Dictionary }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Banknote className="h-6 w-6 text-muted-foreground/50" />
      </div>
      <h3 className="text-base font-semibold">{t.partners.no_partners}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {t.partners.no_partners_desc}
      </p>
    </div>
  );
}

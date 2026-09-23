"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface SummaryMetric {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: "up" | "down" | "neutral";
  icon?: LucideIcon;
  variant?: "default" | "success" | "warning" | "primary";
}

export interface SummaryBarProps {
  metrics: SummaryMetric[];
  className?: string;
}

export function SummaryBar({ metrics, className }: SummaryBarProps) {
  const variantStyles = {
    default: "text-foreground",
    primary: "text-primary",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
  };

  return (
    <div
      className={cn(
        "grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-card border border-border/80 shadow-xs",
        className
      )}
    >
      {metrics.map((m, i) => {
        const Icon = m.icon;
        return (
          <div
            key={i}
            className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/20 border border-border/40"
          >
            {Icon && (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                <Icon className="h-4 w-4" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-muted-foreground truncate uppercase tracking-wider">
                {m.label}
              </div>
              <div
                className={cn(
                  "text-lg sm:text-xl font-bold font-mono tracking-tight truncate",
                  variantStyles[m.variant ?? "default"]
                )}
              >
                {m.value}
              </div>
              {m.subtext && (
                <div className="text-[10px] text-muted-foreground truncate">{m.subtext}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

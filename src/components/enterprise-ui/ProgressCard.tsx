"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface ProgressCardProps {
  title: string;
  current: number;
  target: number;
  unit?: string;
  subtitle?: string;
  variant?: "primary" | "emerald" | "amber" | "destructive";
  className?: string;
}

export function ProgressCard({
  title,
  current,
  target,
  unit = "",
  subtitle,
  variant = "primary",
  className,
}: ProgressCardProps) {
  const percentage = Math.min(100, Math.max(0, target > 0 ? (current / target) * 100 : 0));

  const variantColors = {
    primary: "bg-primary text-primary",
    emerald: "bg-emerald-500 text-emerald-500",
    amber: "bg-amber-500 text-amber-500",
    destructive: "bg-destructive text-destructive",
  };

  return (
    <div className={cn("p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </span>
        <span className="text-xs font-mono font-bold text-foreground">
          {percentage.toFixed(1)}%
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <div className="text-xl font-bold font-mono text-foreground">
          {current.toLocaleString()} {unit}
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          of {target.toLocaleString()} {unit}
        </div>
      </div>

      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full transition-all duration-300 rounded-full", variantColors[variant].split(" ")[0])}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

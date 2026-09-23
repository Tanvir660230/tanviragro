"use client";

import React from "react";
import Image from "next/image";
import { MoreVertical, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EntityCardStat {
  label: string;
  value: React.ReactNode;
}

export interface EntityCardProps {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: "default" | "success" | "warning" | "destructive";
  imageUrl?: string | null;
  placeholderIcon?: LucideIcon;
  stats?: EntityCardStat[];
  actions?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function EntityCard({
  title,
  subtitle,
  badge,
  badgeVariant = "default",
  imageUrl,
  placeholderIcon: PlaceholderIcon,
  stats = [],
  actions,
  onClick,
  className,
}: EntityCardProps) {
  const badgeStyles = {
    default: "bg-primary/10 text-primary border-primary/20",
    success: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex flex-col justify-between p-4 rounded-2xl bg-card border border-border shadow-xs hover:shadow-md transition-all duration-200",
        onClick && "cursor-pointer hover:border-primary/50",
        className
      )}
    >
      <div className="space-y-3">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted border border-border/60 overflow-hidden text-muted-foreground">
              {imageUrl ? (
                <Image src={imageUrl} alt={title} fill className="object-cover" />
              ) : PlaceholderIcon ? (
                <PlaceholderIcon className="h-5 w-5 text-primary" />
              ) : (
                <span className="text-xs font-bold font-serif">{title.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div className="space-y-0.5 min-w-0">
              <h4 className="text-sm font-bold text-foreground truncate">{title}</h4>
              {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {badge && (
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                  badgeStyles[badgeVariant]
                )}
              >
                {badge}
              </span>
            )}
            {actions && <div onClick={(e) => e.stopPropagation()}>{actions}</div>}
          </div>
        </div>

        {/* Stats Grid */}
        {stats.length > 0 && (
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50 text-xs">
            {stats.map((stat, i) => (
              <div key={i} className="space-y-0.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </div>
                <div className="font-mono font-medium text-foreground">{stat.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

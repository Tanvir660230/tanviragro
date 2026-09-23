"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PageSectionProps {
  title?: string;
  subtitle?: string;
  badge?: string | number;
  icon?: LucideIcon;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
  variant?: "default" | "card" | "flush" | "muted";
  className?: string;
}

export function PageSection({
  title,
  subtitle,
  badge,
  icon: Icon,
  collapsible = false,
  defaultCollapsed = false,
  actions,
  children,
  variant = "card",
  className,
}: PageSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const containerVariants = {
    default: "p-0",
    card: "p-4 sm:p-6 rounded-2xl bg-card border border-border/80 shadow-xs",
    flush: "border-b border-border/60 pb-6",
    muted: "p-4 sm:p-6 rounded-2xl bg-muted/40 border border-border/60",
  };

  const hasHeader = title || subtitle || actions || collapsible;

  return (
    <section className={cn("space-y-4 transition-all", containerVariants[variant], className)}>
      {hasHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
          <div
            className={cn(
              "flex items-center gap-2.5",
              collapsible && "cursor-pointer select-none"
            )}
            onClick={() => collapsible && setCollapsed(!collapsed)}
          >
            {Icon && (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
                <Icon className="h-4 w-4" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                {title && <h2 className="text-base sm:text-lg font-bold text-foreground font-serif tracking-tight">{title}</h2>}
                {badge !== undefined && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                    {badge}
                  </span>
                )}
                {collapsible && (
                  <button type="button" aria-label="Toggle section" className="text-muted-foreground hover:text-foreground">
                    {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </button>
                )}
              </div>
              {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
          </div>

          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}

      {!collapsed && <div className="space-y-4 animate-fade-in">{children}</div>}
    </section>
  );
}

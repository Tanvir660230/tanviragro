"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface FormSectionProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  badge?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({
  title,
  description,
  icon: Icon,
  badge,
  children,
  className,
}: FormSectionProps) {
  return (
    <div className={cn("p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4", className)}>
      <div className="flex items-start justify-between pb-3 border-b border-border/50">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-primary" />}
            <h3 className="text-sm font-bold text-foreground font-serif">{title}</h3>
            {badge && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                {badge}
              </span>
            )}
          </div>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>

      <div className="space-y-4 pt-1">{children}</div>
    </div>
  );
}

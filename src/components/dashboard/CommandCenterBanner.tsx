"use client";

import React from "react";
import { AlertTriangle, Clock, ShieldAlert, CheckCircle2, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface AttentionItem {
  id: string;
  type: "critical" | "warning" | "approval" | "info";
  title: string;
  subtitle: string;
  href: string;
  actionLabel?: string;
}

export interface CommandCenterBannerProps {
  items: AttentionItem[];
  className?: string;
}

export function CommandCenterBanner({ items, className }: CommandCenterBannerProps) {
  if (!items || items.length === 0) {
    return (
      <div className={cn("p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between", className)}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground font-serif">Command Center: All Systems Nominal</h4>
            <p className="text-xs text-muted-foreground">No urgent alerts, overdue protocols, or pending approvals requiring action today.</p>
          </div>
        </div>
      </div>
    );
  }

  const typeConfig = {
    critical: {
      border: "border-destructive/30 bg-destructive/5",
      badge: "bg-destructive text-destructive-foreground",
      icon: AlertTriangle,
      iconColor: "text-destructive",
    },
    warning: {
      border: "border-amber-500/30 bg-amber-500/5",
      badge: "bg-amber-500 text-white",
      icon: Clock,
      iconColor: "text-amber-600",
    },
    approval: {
      border: "border-primary/30 bg-primary/5",
      badge: "bg-primary text-primary-foreground",
      icon: ShieldAlert,
      iconColor: "text-primary",
    },
    info: {
      border: "border-border bg-card",
      badge: "bg-muted text-foreground",
      icon: CheckCircle2,
      iconColor: "text-muted-foreground",
    },
  };

  return (
    <div className={cn("p-4 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3", className)}>
      <div className="flex items-center justify-between pb-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Attention Required Today ({items.length})
          </h3>
        </div>
        <span className="text-[11px] text-muted-foreground">Prioritized by urgency</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {items.map((item) => {
          const cfg = typeConfig[item.type];
          const Icon = cfg.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "group flex items-start justify-between p-3 rounded-xl border transition-all hover:shadow-xs",
                cfg.border
              )}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", cfg.iconColor)} />
                <div className="space-y-0.5 min-w-0">
                  <div className="text-xs font-bold text-foreground truncate">{item.title}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{item.subtitle}</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 ml-2 mt-0.5" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Circle } from "lucide-react";

export interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  icon?: LucideIcon;
  variant?: "default" | "success" | "warning" | "destructive" | "primary";
  actorName?: string;
}

export interface ActivityTimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export function ActivityTimeline({ events, className }: ActivityTimelineProps) {
  const variantStyles = {
    default: "bg-muted text-muted-foreground border-border",
    primary: "bg-primary/10 text-primary border-primary/30",
    success: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    warning: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    destructive: "bg-destructive/10 text-destructive border-destructive/30",
  };

  return (
    <div className={cn("relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border", className)}>
      {events.map((event) => {
        const Icon = event.icon || Circle;
        const style = variantStyles[event.variant ?? "default"];

        return (
          <div key={event.id} className="relative group">
            {/* Timeline Dot */}
            <div
              className={cn(
                "absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border shadow-xs transition-transform group-hover:scale-110",
                style
              )}
            >
              <Icon className="h-2.5 w-2.5" />
            </div>

            {/* Content */}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-foreground">{event.title}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{event.timestamp}</span>
              </div>
              {event.description && (
                <p className="text-xs text-muted-foreground leading-relaxed">{event.description}</p>
              )}
              {event.actorName && (
                <div className="text-[10px] text-muted-foreground font-medium">By {event.actorName}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

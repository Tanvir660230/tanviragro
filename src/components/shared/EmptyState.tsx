import React from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  /** Lucide icon or any ReactNode (custom SVG, emoji) */
  icon?: LucideIcon | ReactNode;
  title: string;
  description?: string;
  /** Primary CTA button/link */
  action?: ReactNode;
  /** Secondary CTA */
  secondaryAction?: ReactNode;
  /** `compact` = smaller padding, used inside existing cards */
  compact?: boolean;
  className?: string;
}

function isIconComponent(v: unknown): v is React.ComponentType<{ className?: string }> {
  if (!v || React.isValidElement(v)) return false;
  return typeof v === "function" || (typeof v === "object" && ("$$typeof" in v || "render" in v));
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/40 backdrop-blur-xs text-center transition-all animate-fade-in",
        compact ? "gap-2.5 py-8 px-4" : "gap-4 py-12 px-6",
        className
      )}
    >
      {/* Icon */}
      {icon && (
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-2xl bg-muted/40 border border-border/60 shadow-xs",
            compact ? "h-11 w-11" : "h-14 w-14"
          )}
        >
          {isIconComponent(icon) ? (
            React.createElement(icon, {
              className: cn(
                "text-muted-foreground/70",
                compact ? "h-5 w-5" : "h-6 w-6"
              ),
            })
          ) : (
            icon as ReactNode
          )}
        </div>
      )}

      {/* Text */}
      <div className="space-y-1 max-w-sm">
        <p
          className={cn(
            "font-bold text-foreground font-heading tracking-tight",
            compact ? "text-sm" : "text-base"
          )}
        >
          {title}
        </p>
        {description && (
          <p className={cn("text-muted-foreground/80 leading-relaxed", compact ? "text-xs" : "text-sm")}>
            {description}
          </p>
        )}
      </div>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-1">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

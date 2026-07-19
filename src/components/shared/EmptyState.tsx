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

function isLucideIcon(v: unknown): v is LucideIcon {
  return typeof v === "function";
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
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 text-center",
        compact ? "gap-3 py-8 px-6" : "gap-4 py-12 px-8",
        className
      )}
    >
      {/* Icon */}
      {icon && (
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-xl bg-muted/60",
            compact ? "h-12 w-12" : "h-16 w-16"
          )}
        >
          {isLucideIcon(icon) ? (
            (() => {
              const Icon = icon as LucideIcon;
              return (
                <Icon
                  className={cn(
                    "text-muted-foreground/40",
                    compact ? "h-5 w-5" : "h-7 w-7"
                  )}
                />
              );
            })()
          ) : (
            icon
          )}
        </div>
      )}

      {/* Text */}
      <div className="space-y-1.5 max-w-xs">
        <p
          className={cn(
            "font-semibold text-foreground",
            compact ? "text-sm" : "text-base"
          )}
        >
          {title}
        </p>
        {description && (
          <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
            {description}
          </p>
        )}
      </div>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title:         string;
  subtitle?:     string;
  icon?:         LucideIcon;
  iconColor?:    string;
  /** href string → renders a back link */
  back?:         string;
  /** Number badge shown next to title */
  badge?:        number | string;
  badgeVariant?: "default" | "warning" | "destructive";
  actions?:      ReactNode;
  className?:    string;
}

const BADGE_STYLE: Record<NonNullable<PageHeaderProps["badgeVariant"]>, string> = {
  default:     "bg-primary/10 text-primary",
  warning:     "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  destructive: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
};

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  iconColor,
  back,
  badge,
  badgeVariant = "default",
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 animate-fade-in-up", className)}>
      <div className="flex items-center gap-3 min-w-0">
        {/* Back button */}
        {back && (
          <Link
            href={back}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground shadow-card hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        )}

        {/* Icon badge */}
        {Icon && (
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              "bg-primary/10",
              iconColor
            )}
          >
            <Icon className="h-[18px] w-[18px] text-primary" />
          </div>
        )}

        {/* Text */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground leading-snug truncate">
              {title}
            </h1>
            {badge !== undefined && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums shrink-0",
                  BADGE_STYLE[badgeVariant]
                )}
              >
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}

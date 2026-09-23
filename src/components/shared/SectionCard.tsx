import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface SectionCardProps {
  /** Optional header title */
  title?: string;
  /** Optional small description shown below title */
  description?: string;
  /** Icon shown as a badge in the header */
  icon?: LucideIcon;
  /** Custom colour classes for the icon badge — defaults to primary */
  iconVariant?: "primary" | "emerald" | "amber" | "blue" | "red" | "purple";
  /** Node rendered on the right side of the header */
  action?: ReactNode;
  /** Node rendered in a bordered footer strip */
  footer?: ReactNode;
  /** Content padding preset */
  padding?: "default" | "tight" | "none";
  /** Extra classes on the outer wrapper */
  className?: string;
  /** Extra classes on the header row */
  headerClassName?: string;
  /** Extra classes on the content area */
  contentClassName?: string;
  children: ReactNode;
}

const ICON_VARIANT: Record<NonNullable<SectionCardProps["iconVariant"]>, string> = {
  primary: "bg-primary/10 text-primary border border-primary/20",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
  amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  blue:    "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
  red:     "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
  purple:  "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
};

const PADDING: Record<NonNullable<SectionCardProps["padding"]>, string> = {
  default: "p-5",
  tight:   "p-3.5",
  none:    "",
};

export function SectionCard({
  title,
  description,
  icon: Icon,
  iconVariant = "primary",
  action,
  footer,
  padding = "default",
  className,
  headerClassName,
  contentClassName,
  children,
}: SectionCardProps) {
  const hasHeader = !!(title || action);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card",
        className
      )}
    >
      {hasHeader && (
        <div
          className={cn(
            "flex items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-4 sm:px-5 py-3.5",
            headerClassName
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && (
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-xs",
                  ICON_VARIANT[iconVariant]
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <p className="text-sm font-semibold text-foreground truncate font-heading">{title}</p>
              )}
              {description && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{description}</p>
              )}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}

      <div className={cn(PADDING[padding], contentClassName)}>
        {children}
      </div>

      {footer && (
        <div className="border-t border-border/60 bg-muted/15 px-5 py-3">
          {footer}
        </div>
      )}
    </div>
  );
}

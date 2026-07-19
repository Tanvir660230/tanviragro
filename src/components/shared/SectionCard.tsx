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
  primary: "bg-primary/10 text-primary",
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400",
  amber:   "bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400",
  blue:    "bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400",
  red:     "bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400",
  purple:  "bg-purple-100 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400",
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
        "overflow-hidden rounded-xl border border-border bg-card shadow-card",
        className
      )}
    >
      {hasHeader && (
        <div
          className={cn(
            "flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3.5",
            headerClassName
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && (
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                  ICON_VARIANT[iconVariant]
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <p className="text-sm font-semibold text-foreground truncate">{title}</p>
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
        <div className="border-t border-border/60 px-5 py-3">
          {footer}
        </div>
      )}
    </div>
  );
}

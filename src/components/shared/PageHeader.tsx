import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { SitePageTitle, SiteBackLink } from "@/components/navigation/SitePageTitle";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  /** href string → renders a back link */
  back?: string;
  /** Number badge shown next to title */
  badge?: number | string;
  badgeVariant?: "default" | "warning" | "destructive" | "info" | "secondary";
  actions?: ReactNode;
  className?: string;
}

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
    <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 mb-6 animate-fade-in-up", className)}>
      <div className="flex items-center gap-3 min-w-0">
        {/* Back button */}
        {back && <SiteBackLink href={back} />}

        {/* Icon badge */}
        {Icon && (
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              "bg-primary/10 border border-primary/20 shadow-xs",
              iconColor
            )}
          >
            <Icon className="h-4.5 w-4.5 text-primary" />
          </div>
        )}

        {/* Text */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-tight truncate font-heading">
              <SitePageTitle fallback={title} />
            </h1>
            {badge !== undefined && (
              <Badge variant={badgeVariant === "destructive" ? "destructive" : badgeVariant === "warning" ? "warning" : "secondary"} className="h-5 px-2 text-[11px] font-semibold">
                {badge}
              </Badge>
            )}
          </div>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-start sm:justify-end pt-1 sm:pt-0">
          {actions}
        </div>
      )}
    </div>
  );
}

import React from "react"
import Link from "next/link"
import { CheckCircle2, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface SuccessStateProps {
  /** Main heading */
  title?: string
  /** Descriptive message */
  description?: string
  /** Primary action button/link */
  action?: React.ReactNode
  /** Optional link to redirect user */
  href?: string
  /** Link label */
  hrefLabel?: string
  /** Compact mode for in-card usage */
  compact?: boolean
  className?: string
}

/**
 * Reusable success state shown after completing an action (e.g. form submission).
 * Follows the same pattern as ErrorView and EmptyState.
 */
export function SuccessState({
  title = "Success!",
  description,
  action,
  href,
  hrefLabel = "Go to Dashboard",
  compact = false,
  className,
}: SuccessStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl bg-card text-center transition-all animate-fade-in",
        compact ? "gap-3 py-8 px-4" : "gap-5 py-12 px-6",
        className
      )}
    >
      {/* Icon */}
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 ring-8 ring-emerald-500/5 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-7 w-7" />
      </div>

      {/* Text */}
      <div className="space-y-1.5 max-w-sm">
        <h2
          className={cn(
            "font-bold text-foreground font-heading tracking-tight",
            compact ? "text-base" : "text-lg"
          )}
        >
          {title}
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {/* Actions */}
      {(action || href) && (
        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-1">
          {action}
          {href && (
            <Link
              href={href}
              className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all tap-press cursor-pointer"
            >
              {hrefLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

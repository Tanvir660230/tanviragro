import React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoadingStateProps {
  /** Loading message shown below the spinner */
  message?: string
  /** Size variant */
  size?: "sm" | "md" | "lg"
  /** Full-viewport height (default true) */
  fullPage?: boolean
  className?: string
}

const SIZES = {
  sm: { spinner: "h-5 w-5", text: "text-xs" },
  md: { spinner: "h-7 w-7", text: "text-sm" },
  lg: { spinner: "h-9 w-9", text: "text-base" },
} as const

/**
 * Reusable loading indicator for page-level or section-level loading.
 * Shows a spinner + optional message with consistent enterprise styling.
 */
export function LoadingState({
  message,
  size = "md",
  fullPage = true,
  className,
}: LoadingStateProps) {
  const s = SIZES[size]

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-muted-foreground animate-fade-in",
        fullPage && "min-h-[40vh]",
        !fullPage && "py-10",
        className
      )}
    >
      <Loader2
        className={cn(s.spinner, "text-primary animate-spin")}
        aria-hidden="true"
      />
      {message && (
        <p className={cn(s.text, "font-medium")}>{message}</p>
      )}
      <span className="sr-only">Loading…</span>
    </div>
  )
}

/**
 * Compact inline spinner for buttons or small sections.
 */
export function InlineSpinner({
  className,
  size = 16,
}: {
  className?: string
  size?: number
}) {
  return (
    <Loader2
      className={cn("animate-spin text-current", className)}
      size={size}
      aria-hidden="true"
    />
  )
}

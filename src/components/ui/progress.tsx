"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface ProgressProps extends React.ComponentProps<"div"> {
  value: number
  max?: number
  size?: "sm" | "default" | "lg"
  tone?: "primary" | "success" | "warning" | "destructive" | "info"
  showValue?: boolean
  indeterminate?: boolean
}

function Progress({
  value, max = 100, size = "default", tone = "primary",
  showValue = false, indeterminate = false, className, ...props
}: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const height = { sm: "h-1", default: "h-1.5", lg: "h-2.5" }[size]
  const barColors = {
    primary: "bg-primary",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    destructive: "bg-destructive",
    info: "bg-blue-500",
  }

  return (
    <div data-slot="progress" className={cn("flex w-full items-center gap-2", className)} {...props}>
      <div
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn("relative w-full overflow-hidden rounded-full bg-muted", height)}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            barColors[tone],
            indeterminate && "w-1/3 animate-[progress-slide_1.2s_ease-in-out_infinite]"
          )}
          style={indeterminate ? undefined : { width: `${pct}%` }}
        />
      </div>
      {showValue && !indeterminate && (
        <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{Math.round(pct)}%</span>
      )}
    </div>
  )
}

/* ── LinearLoader (top-of-page loading bar) ──────────────────────── */

function LinearLoader({ className }: { className?: string }) {
  return (
    <div data-slot="linear-loader" className={cn("absolute inset-x-0 top-0 z-50 h-0.5 overflow-hidden", className)} aria-hidden="true">
      <div className="h-full w-1/3 animate-[progress-indeterminate_1.1s_ease-in-out_infinite] rounded-full bg-primary" />
    </div>
  )
}

export { Progress, LinearLoader }
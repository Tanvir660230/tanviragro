"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/* ── SegmentedControl ────────────────────────────────────────────── */

export interface SegmentedControlOption {
  value: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  disabled?: boolean
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[]
  value: string
  onValueChange: (value: string) => void
  size?: "sm" | "default" | "lg"
  className?: string
  fullWidth?: boolean
}

function SegmentedControl({
  options, value, onValueChange, size = "default", className, fullWidth = false,
}: SegmentedControlProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const indicatorRef = React.useRef<HTMLDivElement>(null)
  const sizeClasses = {
    sm: "h-7 text-[11px] gap-1",
    default: "h-8 text-xs gap-1.5",
    lg: "h-9 text-sm gap-2",
  }

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const activeIdx = options.findIndex(o => o.value === value)
    const buttons = container.querySelectorAll<HTMLElement>("[data-segmented-trigger]")
    const btn = buttons[activeIdx]
    if (btn && indicatorRef.current) {
      indicatorRef.current.style.left = `${btn.offsetLeft}px`
      indicatorRef.current.style.width = `${btn.offsetWidth}px`
    }
  }, [value, options])

  return (
    <div
      data-slot="segmented-control"
      role="tablist"
      aria-label="Segmented control"
      className={cn(
        "relative inline-flex items-center rounded-xl bg-muted/60 border border-border/50 p-0.5",
        fullWidth && "w-full",
        className
      )}
      ref={containerRef}
    >
      <div
        ref={indicatorRef}
        className="absolute top-0.5 bottom-0.5 rounded-lg bg-card shadow-xs border border-border/50 transition-all duration-200 ease-default z-0"
        aria-hidden="true"
      />
      {options.map(opt => {
        const isActive = opt.value === value
        const Icon = opt.icon
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={opt.disabled}
            onClick={() => onValueChange(opt.value)}
            className={cn(
              "relative z-10 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 font-medium whitespace-nowrap transition-colors outline-none select-none cursor-pointer",
              sizeClasses[size],
              fullWidth && "flex-1",
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              opt.disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {Icon && <Icon className={cn("shrink-0", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export { SegmentedControl }
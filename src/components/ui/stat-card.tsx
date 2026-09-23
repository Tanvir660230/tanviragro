"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import { ArrowUpRightIcon, ArrowDownRightIcon, Loader2Icon } from "lucide-react"

export interface StatCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  hint?: string
  trend?: number
  trendLabel?: string
  trendDirection?: "up" | "down"
  invertTrendMeaning?: boolean
  loading?: boolean
  onClick?: () => void
  className?: string
  iconClassName?: string
}

function StatCard({
  label, value, icon: Icon, hint, trend, trendLabel,
  trendDirection: explicitDirection, invertTrendMeaning = false,
  loading = false, onClick, className, iconClassName,
}: StatCardProps) {
  const isPositive = trend != null && trend >= 0
  const dir = explicitDirection ?? (isPositive ? "up" : "down")
  const good = invertTrendMeaning ? dir === "down" : dir === "up"
  const TrendIcon = dir === "up" ? ArrowUpRightIcon : ArrowDownRightIcon

  return (
    <div
      data-slot="stat-card"
      onClick={onClick}
      className={cn(
        "group rounded-xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs transition-all duration-200",
        onClick && "cursor-pointer hover:border-border hover:shadow-card-md hover:-translate-y-0.5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {Icon && (
          <div className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/80 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary",
            iconClassName
          )}>
            <Icon className="h-4.5 w-4.5" />
          </div>
        )}
        {loading ? (
          <Loader2Icon className="size-5 text-muted-foreground animate-spin" />
        ) : (
          trend != null && (
            <span className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
              good ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
            )}>
              <TrendIcon className="h-3 w-3" />
              {Math.abs(trend)}%
            </span>
          )
        )}
      </div>
      <div className="mt-3.5 space-y-1.5">
        <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        {loading ? (
          <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
        ) : (
          <p className="font-heading text-2xl sm:text-3xl font-bold text-foreground tracking-tight tabular-nums leading-none">
            {value}
          </p>
        )}
        {(hint || trendLabel) && (
          <p className="text-xs text-muted-foreground/90 truncate pt-0.5">
            {hint}
            {trendLabel && <span className="ml-1 font-medium text-foreground/80">{trendLabel}</span>}
          </p>
        )}
      </div>
    </div>
  )
}

export interface MetricCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  delta?: number
  className?: string
}

function MetricCard({ label, value, icon: Icon, delta, className }: MetricCardProps) {
  const up = (delta ?? 0) >= 0
  return (
    <div data-slot="metric-card" className={cn("flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3", className)}>
      {Icon && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-base font-bold text-foreground tabular-nums">{value}</span>
          {delta !== undefined && (
            <span className={cn("text-[11px] font-semibold tabular-nums", up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
              {up ? "+" : ""}{delta}%
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export interface ProgressCardProps {
  label: string
  value: number
  max?: number
  unit?: string
  icon?: LucideIcon
  size?: "sm" | "default" | "lg"
  className?: string
}

function ProgressCard({ label, value, max = 100, unit = "%", icon: Icon, size = "default", className }: ProgressCardProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const tone = pct >= 80 ? "primary" : pct >= 50 ? "info" : pct >= 25 ? "warning" : "destructive"
  const barColors = { primary: "bg-primary", info: "bg-blue-500", warning: "bg-amber-500", destructive: "bg-destructive" }
  const height = { sm: "h-1.5", default: "h-2", lg: "h-2.5" }[size]

  return (
    <div data-slot="progress-card" className={cn("rounded-2xl border border-border/70 bg-card p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
          <p className="mt-1 font-heading text-xl font-bold text-foreground tabular-nums leading-none">
            {value}<span className="text-xs font-medium text-muted-foreground ml-0.5">{unit}</span>
          </p>
        </div>
        {Icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className={cn("mt-3 w-full overflow-hidden rounded-full bg-muted", height)}>
        <div className={cn("h-full rounded-full transition-all duration-500 ease-out", barColors[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export { StatCard, MetricCard, ProgressCard }
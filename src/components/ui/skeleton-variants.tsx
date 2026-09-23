"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

/* ── CardSkeleton ────────────────────────────────────────────────── */

export interface CardSkeletonProps {
  lines?: number
  withAvatar?: boolean
  withActions?: boolean
  className?: string
}

function CardSkeleton({ lines = 3, withAvatar = false, withActions = false, className }: CardSkeletonProps) {
  return (
    <div data-slot="card-skeleton" className={cn("rounded-2xl border border-border/70 bg-card p-4 sm:p-5 space-y-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-32" />
        </div>
        {withAvatar && <Skeleton className="h-9 w-9 rounded-full" />}
      </div>
      {Array.from({ length: Math.max(1, lines) }).map((_, i) => (
        <Skeleton key={i} className={cn("h-2.5", i === lines - 1 ? "w-3/4" : "w-full")} />
      ))}
      {withActions && <Skeleton className="h-8 w-full" />}
    </div>
  )
}

/* ── TableSkeleton ───────────────────────────────────────────────── */

export interface TableSkeletonProps {
  rows?: number
  columns?: number
  withHeader?: boolean
  className?: string
}

function TableSkeleton({ rows = 5, columns = 4, withHeader = true, className }: TableSkeletonProps) {
  return (
    <div data-slot="table-skeleton" className={cn("space-y-3", className)}>
      {withHeader && (
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-16" />
            ))}
          </div>
        </div>
      )}
      <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="grid gap-6" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, j) => (
              <Skeleton key={j} className={cn("h-3.5", j === 0 && "w-20")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── ListSkeleton ────────────────────────────────────────────────── */

export interface ListSkeletonProps {
  count?: number
  withAvatar?: boolean
  className?: string
}

function ListSkeleton({ count = 5, withAvatar = true, className }: ListSkeletonProps) {
  return (
    <div data-slot="list-skeleton" className={cn("divide-y divide-border/50 rounded-xl border border-border/60 bg-card", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          {withAvatar && <Skeleton className="h-8 w-8 shrink-0 rounded-full" />}
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── ChartSkeleton ───────────────────────────────────────────────── */

function ChartSkeleton({ className, height = 220 }: { className?: string; height?: number }) {
  return (
    <div data-slot="chart-skeleton" className={cn("rounded-2xl border border-border/70 bg-card p-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3.5 w-12" />
      </div>
      <div className="mt-3.5 relative flex items-end gap-1.5" style={{ height }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="flex-1 rounded-t-md" style={{ height: `${30 + Math.sin(i * 1.3) * 25 + 35}%` }} />
        ))}
      </div>
    </div>
  )
}

/* ── PageSkeleton ────────────────────────────────────────────────── */

export interface PageSkeletonProps {
  withHeader?: boolean
  withFilterBar?: boolean
  className?: string
}

function PageSkeleton({ withHeader = true, withFilterBar = true, className }: PageSkeletonProps) {
  return (
    <div data-slot="page-skeleton" className={cn("space-y-4", className)}>
      {withHeader && (
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      )}
      {withFilterBar && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-20 ml-auto" />
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} withAvatar lines={2} />)}
      </div>
      <TableSkeleton rows={6} />
    </div>
  )
}

export { CardSkeleton, TableSkeleton, ListSkeleton, ChartSkeleton, PageSkeleton }
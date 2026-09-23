"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

export interface TimelineItem {
  title: string
  description?: string
  timestamp?: string
  icon?: LucideIcon
  tone?: "default" | "success" | "warning" | "destructive" | "info"
  active?: boolean
}

export interface TimelineProps {
  items: TimelineItem[]
  orientation?: "vertical" | "horizontal"
  className?: string
}

const toneStyles = {
  default: "bg-muted text-muted-foreground border-border/60",
  success: "bg-emerald-50 text-emerald-600 border-emerald-500/25 dark:bg-emerald-950/40 dark:text-emerald-400",
  warning: "bg-amber-50 text-amber-600 border-amber-500/25 dark:bg-amber-950/40 dark:text-amber-400",
  destructive: "bg-red-50 text-red-600 border-red-500/25 dark:bg-red-950/40 dark:text-red-400",
  info: "bg-blue-50 text-blue-600 border-blue-500/25 dark:bg-blue-950/40 dark:text-blue-400",
}

function Timeline({ items, orientation = "vertical", className }: TimelineProps) {
  const isHorizontal = orientation === "horizontal"
  return (
    <ol data-slot="timeline" className={cn(isHorizontal ? "flex items-start gap-0" : "relative space-y-6", className)}>
      {items.map((item, idx) => {
        const Icon = item.icon
        const tone = toneStyles[item.tone ?? "default"]
        return (
          <li key={`${item.title}-${idx}`} className={cn("relative flex", isHorizontal ? "flex-1 flex-col items-center text-center" : "gap-3")}>
            {idx < items.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute bg-border/70 z-0",
                  isHorizontal ? "top-4 left-1/2 h-0.5 w-full" : "left-4 top-9 bottom-[-1.5rem] w-0.5"
                )}
              />
            )}
            <div className="relative z-10 flex shrink-0">
              <span className={cn("flex items-center justify-center rounded-full border shadow-xs", Icon ? "h-8 w-8" : "h-5 w-5", tone, isHorizontal && "mx-auto")}>
                {Icon ? <Icon className="h-4 w-4" /> : null}
              </span>
            </div>
            <div className={cn("min-w-0", isHorizontal && "mt-2 flex flex-col items-center px-1")}>
              <p className={cn("text-sm font-heading font-semibold text-foreground leading-tight", item.active && "text-primary")}>
                {item.title}
              </p>
              {item.timestamp && <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{item.timestamp}</p>}
              {item.description && <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{item.description}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export interface ActivityFeedActivity {
  id: string
  type: "create" | "update" | "delete" | "status" | "note" | "comment" | "system"
  title: string
  description?: string
  author?: string
  timestamp?: string
}

export interface ActivityFeedProps {
  activities: ActivityFeedActivity[]
  className?: string
  showEmpty?: boolean
}

const activityDotTone: Record<ActivityFeedActivity["type"], string> = {
  create: "bg-emerald-500",
  update: "bg-blue-500",
  delete: "bg-red-500",
  status: "bg-amber-500",
  note: "bg-purple-500",
  comment: "bg-sky-500",
  system: "bg-muted-foreground",
}

function ActivityFeed({ activities, className, showEmpty = true }: ActivityFeedProps) {
  if (activities.length === 0 && showEmpty) {
    return (
      <div className={cn("rounded-xl border border-dashed border-border/60 p-8 text-center text-xs text-muted-foreground", className)}>
        No recent activity
      </div>
    )
  }
  return (
    <ul data-slot="activity-feed" className={cn("space-y-0", className)}>
      {activities.map((a, idx) => (
        <li key={a.id} className="relative flex gap-3 pb-5 last:pb-0">
          {idx < activities.length - 1 && <span aria-hidden="true" className="absolute left-2 top-4 bottom-0 w-px bg-border/70" />}
          <span className={cn("relative z-10 mt-1.5 h-2 w-2 shrink-0 rounded-full ring-4 ring-card", activityDotTone[a.type])} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
              {a.timestamp && <span className="shrink-0 text-[11px] text-muted-foreground">{a.timestamp}</span>}
            </div>
            {a.description && <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{a.description}</p>}
          </div>
        </li>
      ))}
    </ul>
  )
}

/* ── AuditLog ────────────────────────────────────────────────────── */

export interface AuditLogEntry {
  id: string
  actor: string
  action: "create" | "update" | "delete" | "view" | "login" | "logout" | "export" | "import" | "approve" | "reject"
  target: string
  before?: string
  after?: string
  timestamp?: string
}

export interface AuditLogProps {
  entries: AuditLogEntry[]
  className?: string
}

const actionLabel: Record<AuditLogEntry["action"], { text: string; cls: string }> = {
  create: { text: "Created", cls: "text-emerald-600 dark:text-emerald-400" },
  update: { text: "Updated", cls: "text-blue-600 dark:text-blue-400" },
  delete: { text: "Deleted", cls: "text-red-600 dark:text-red-400" },
  view: { text: "Viewed", cls: "text-muted-foreground" },
  login: { text: "Logged in", cls: "text-emerald-600 dark:text-emerald-400" },
  logout: { text: "Logged out", cls: "text-muted-foreground" },
  export: { text: "Exported", cls: "text-purple-600 dark:text-purple-400" },
  import: { text: "Imported", cls: "text-purple-600 dark:text-purple-400" },
  approve: { text: "Approved", cls: "text-emerald-600 dark:text-emerald-400" },
  reject: { text: "Rejected", cls: "text-red-600 dark:text-red-400" },
}

function AuditLog({ entries, className }: AuditLogProps) {
  return (
    <div data-slot="audit-log" className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[560px] text-xs">
        <thead>
          <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 font-medium">Actor</th>
            <th className="px-3 py-2 font-medium">Action</th>
            <th className="px-3 py-2 font-medium">Target</th>
            <th className="px-3 py-2 font-medium">Changes</th>
            <th className="px-3 py-2 font-medium text-right">Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => {
            const action = actionLabel[entry.action] ?? actionLabel.view
            return (
              <tr key={entry.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">{entry.actor}</td>
                <td className="px-3 py-2.5"><span className={cn("font-semibold", action.cls)}>{action.text}</span></td>
                <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[160px]">{entry.target}</td>
                <td className="px-3 py-2.5 text-muted-foreground max-w-[220px] truncate">
                  {entry.before && <span className="line-through opacity-60 mr-1">{entry.before}</span>}
                  {entry.after && <span className="font-medium text-foreground">{entry.after}</span>}
                </td>
                <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">{entry.timestamp}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export { Timeline, ActivityFeed, AuditLog }
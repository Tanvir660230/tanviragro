"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface SplitLayoutProps {
  /** Main content */
  children: React.ReactNode
  /** Right sidebar panel */
  sidebar?: React.ReactNode
  /** Sidebar width preset */
  sidebarWidth?: "sm" | "md" | "lg"
  /** Sidebar position */
  sidebarPosition?: "right" | "left"
  /** Whether sidebar is sticky */
  sticky?: boolean
  className?: string
}

const SIDEBAR_WIDTHS = {
  sm: "w-64",
  md: "w-80",
  lg: "w-96",
} as const

/**
 * Two-column layout with a main content area and a sidebar panel.
 * Used for detail pages (e.g., cattle detail, report viewer).
 */
export function SplitLayout({
  children,
  sidebar,
  sidebarWidth = "md",
  sidebarPosition = "right",
  sticky = true,
  className,
}: SplitLayoutProps) {
  const sidebarEl = sidebar && (
    <aside
      className={cn(
        "flex-1 min-w-0",
        SIDEBAR_WIDTHS[sidebarWidth],
        sticky && "sticky top-14 h-[calc(100svh-3.5rem)] overflow-y-auto",
        "border-border/60",
        sidebarPosition === "right" ? "border-l" : "border-r"
      )}
    >
      {sidebar}
    </aside>
  )

  return (
    <div
      data-slot="split-layout"
      className={cn(
        "flex items-start gap-0 min-h-0",
        sidebarPosition === "left" && "flex-row-reverse",
        className
      )}
    >
      <main className="flex-1 min-w-0">{children}</main>
      {sidebarEl}
    </div>
  )
}

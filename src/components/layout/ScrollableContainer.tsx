"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface ScrollableContainerProps {
  children: React.ReactNode
  /** Height constraint */
  maxHeight?: string
  /** Show scroll fade at bottom */
  showFade?: boolean
  className?: string
}

/**
 * Scrollable container with optional bottom fade gradient.
 * Used for scrollable panels, long lists, and sidebar content.
 */
export function ScrollableContainer({
  children,
  maxHeight = "auto",
  showFade = true,
  className,
}: ScrollableContainerProps) {
  return (
    <div
      data-slot="scrollable-container"
      className={cn("relative flex flex-col min-h-0", className)}
    >
      <div
        className="flex-1 overflow-y-auto scroll-touch scrollbar-none"
        style={{ maxHeight }}
      >
        {children}
      </div>
      {showFade && (
        <div
          className="pointer-events-none absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-card to-transparent opacity-80"
          aria-hidden="true"
        />
      )}
    </div>
  )
}

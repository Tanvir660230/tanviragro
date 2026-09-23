"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface HoverCardProps {
  trigger: React.ReactNode
  children: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
  className?: string
  openDelay?: number
}

function HoverCard({ trigger, children, side = "bottom", align = "center", className, openDelay = 150 }: HoverCardProps) {
  const [open, setOpen] = React.useState(false)
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const openTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const show = () => {
    clearTimeout(closeTimerRef.current)
    openTimerRef.current = setTimeout(() => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const popoverWidth = 288
      const popoverHeight = 180

      let left = rect.left
      if (align === "center") left = rect.left + rect.width / 2 - popoverWidth / 2
      else if (align === "end") left = rect.right - popoverWidth

      let top = rect.bottom + 8
      if (side === "top") top = rect.top - popoverHeight - 8
      else if (side === "left") { top = rect.top; left = rect.left - popoverWidth - 8 }
      else if (side === "right") { top = rect.top; left = rect.right + 8 }

      setCoords({ top, left })
      setOpen(true)
    }, openDelay)
  }

  const hide = () => {
    clearTimeout(openTimerRef.current)
    closeTimerRef.current = setTimeout(() => setOpen(false), 100)
  }

  React.useEffect(() => () => { clearTimeout(openTimerRef.current); clearTimeout(closeTimerRef.current) }, [])

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {trigger}
      {open && coords && (
        <div
          role="dialog"
          className={cn(
            "fixed z-50 w-72 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-dropdown",
            "animate-in fade-in-0 zoom-in-95",
            className
          )}
          style={{ top: coords.top, left: coords.left }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export { HoverCard }
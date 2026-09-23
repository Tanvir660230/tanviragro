"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface ContextMenuItemData {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  shortcut?: string
  onClick?: () => void
  disabled?: boolean
  destructive?: boolean
  separator?: boolean
}

export interface ContextMenuProps {
  items: ContextMenuItemData[]
  children: React.ReactNode
  className?: string
}

function ContextMenu({ items, children, className }: ContextMenuProps) {
  const [open, setOpen] = React.useState(false)
  const [coords, setCoords] = React.useState({ x: 0, y: 0 })
  const containerRef = React.useRef<HTMLDivElement>(null)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const x = Math.min(e.clientX, window.innerWidth - 220)
    const y = Math.min(e.clientY, window.innerHeight - Math.min(items.length * 36 + 32, 260))
    setCoords({ x, y })
    setOpen(true)
  }

  const close = React.useCallback(() => setOpen(false), [])

  React.useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close()
    }
    const onScroll = () => close()
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close() }
    window.addEventListener("mousedown", onMouseDown)
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", onMouseDown)
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("keydown", onKey)
    }
  }, [open, close])

  return (
    <div ref={containerRef} className={cn("inline-block", className)} onContextMenu={handleContextMenu}>
      {children}
      {open && (
        <div
          role="menu"
          className="fixed z-50 min-w-[200px] rounded-lg border border-border bg-popover p-1 shadow-dropdown animate-in fade-in-0 zoom-in-95"
          style={{ top: coords.y, left: coords.x }}
        >
          {items.map((item, idx) =>
            item.separator ? (
              <div key={idx} className="my-1 h-px bg-border/70" />
            ) : (
              <button
                key={idx}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => { close(); item.onClick?.() }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm font-medium outline-none transition-colors",
                  "hover:bg-accent focus-visible:bg-accent",
                  item.destructive && item.destructive ? "text-destructive hover:bg-destructive/10" : "text-foreground",
                  item.disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                {item.icon && <item.icon className="h-4 w-4 shrink-0" />}
                <span className="flex-1 truncate">{item.label}</span>
                {item.shortcut && <span className="text-[11px] text-muted-foreground">{item.shortcut}</span>}
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}

export { ContextMenu }
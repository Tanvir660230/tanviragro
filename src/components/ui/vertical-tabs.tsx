"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

export interface VerticalTabsItem {
  value: string
  label: string
  icon?: LucideIcon
  badge?: React.ReactNode
  disabled?: boolean
}

export interface VerticalTabsProps {
  items: VerticalTabsItem[]
  value: string
  onValueChange: (value: string) => void
  className?: string
  listClassName?: string
  contentClassName?: string
  children?: React.ReactNode
}

function VerticalTabs({
  items, value, onValueChange, className, listClassName, contentClassName, children,
}: VerticalTabsProps) {
  const active = items.find(i => i.value === value)

  return (
    <div data-slot="vertical-tabs" className={cn("flex gap-4", className)}>
      <div
        role="tablist"
        aria-orientation="vertical"
        className={cn("flex w-44 shrink-0 flex-col gap-1", listClassName)}
      >
        {items.map(item => {
          const Icon = item.icon
          const isActive = item.value === value
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={item.disabled}
              onClick={() => onValueChange(item.value)}
              className={cn(
                "group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium outline-none transition-colors",
                "focus-visible:ring-3 focus-visible:ring-ring/30",
                isActive ? "bg-primary/10 text-primary border border-primary/20" : "border border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                item.disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {Icon && <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />}
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge}
            </button>
          )
        })}
      </div>
      <div className={cn("min-w-0 flex-1", contentClassName)}>
        {children ?? (
          active && (
            <div className="text-sm text-muted-foreground">
              Content for &quot;{active.label}&quot;
            </div>
          )
        )}
      </div>
    </div>
  )
}

export { VerticalTabs }
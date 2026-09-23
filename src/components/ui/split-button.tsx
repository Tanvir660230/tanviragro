"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button, type ButtonProps } from "@/components/ui/button"
import { ChevronDownIcon } from "lucide-react"

export interface SplitButtonAction {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  onClick?: () => void
  disabled?: boolean
  destructive?: boolean
}

export interface SplitButtonProps extends ButtonProps {
  menuItems: SplitButtonAction[]
  menuLabel?: string
}

function SplitButton({
  className, menuItems, menuLabel = "More options", children, ...props
}: SplitButtonProps) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])

  return (
    <div ref={containerRef} className={cn("inline-flex", className)}>
      <Button {...props} className="rounded-r-none border-r border-primary-foreground/10" >
        {children}
      </Button>
      <span className="relative">
        <Button
          type="button"
          variant={props.variant ?? "default"}
          size={props.size ?? "default"}
          aria-label={menuLabel}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          disabled={props.disabled || props.loading}
          className="rounded-l-none border-l border-input px-2 [&_svg]:size-3.5"
        >
          <ChevronDownIcon className={cn("transition-transform duration-150", open && "rotate-180")} />
        </Button>
        {open && (
          <div
            role="menu"
            className="absolute right-0 z-50 mt-1 min-w-44 rounded-lg border border-border bg-popover p-1 shadow-dropdown animate-in fade-in-0 zoom-in-95"
          >
            {menuItems.map(item => {
              const ItemIcon = item.icon
              return (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => { setOpen(false); item.onClick?.() }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm font-medium outline-none transition-colors",
                    "hover:bg-accent focus-visible:bg-accent",
                    item.destructive ? "text-destructive hover:bg-destructive/10" : "text-foreground",
                    item.disabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {ItemIcon && <ItemIcon className="h-4 w-4 shrink-0" />}
                  <span className="truncate">{item.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </span>
    </div>
  )
}

export { SplitButton }
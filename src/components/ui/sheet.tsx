"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock"

/**
 * Sheet — A modal overlay panel that slides in from an edge.
 * Wraps Drawer primitives with a consistent overlay + focus behavior.
 */
interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  side?: "left" | "right" | "top" | "bottom"
  children: React.ReactNode
}

function Sheet({ open, onOpenChange, side = "right", children }: SheetProps) {
  // Close on Escape
  React.useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false)
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, onOpenChange])

  // Prevent body scroll when open
  useBodyScrollLock(open)

  return (
    <>
      <div
        data-slot="sheet-overlay"
        className={cn(
          "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        data-slot="sheet"
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed z-50 bg-card shadow-floating transition-transform duration-200 outline-none",
          {
            "inset-y-0 left-0 h-full w-80 sm:w-96 border-r": side === "left",
            "inset-y-0 right-0 h-full w-80 sm:w-96 border-l": side === "right",
            "inset-x-0 top-0 w-full max-h-[85vh] border-b rounded-b-2xl": side === "top",
            "inset-x-0 bottom-0 w-full max-h-[85vh] border-t rounded-t-2xl": side === "bottom",
          },
          open
            ? "translate-x-0 translate-y-0"
            : side === "left" && "-translate-x-full",
          side === "right" && !open && "translate-x-full",
          side === "top" && !open && "-translate-y-full",
          side === "bottom" && !open && "translate-y-full",
          !open && "pointer-events-none"
        )}
      >
        {children}
      </div>
    </>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-6 pb-4 border-b border-border/60", className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="sheet-title"
      className={cn("font-heading text-lg font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function SheetDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn("flex-1 overflow-y-auto p-6", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("flex items-center justify-end gap-2 p-6 pt-4 border-t border-border/60", className)}
      {...props}
    />
  )
}

export { Sheet, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter }

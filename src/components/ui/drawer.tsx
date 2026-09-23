"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface DrawerContextType {
  open: boolean
  onOpenChange: (open: boolean) => void
  side: "left" | "right" | "top" | "bottom"
}

const DrawerContext = React.createContext<DrawerContextType>({
  open: false,
  onOpenChange: () => {},
  side: "right",
})

function Drawer({
  open,
  onOpenChange,
  side = "right",
  children,
  ...props
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  side?: "left" | "right" | "top" | "bottom"
  children: React.ReactNode
}) {
  return (
    <DrawerContext.Provider value={{ open, onOpenChange, side }}>
      <div data-slot="drawer" {...props}>{children}</div>
    </DrawerContext.Provider>
  )
}

function DrawerOverlay({ className, ...props }: React.ComponentProps<"div">) {
  const { open, onOpenChange } = React.useContext(DrawerContext)
  if (!open) return null
  return (
    <div
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/40 backdrop-blur-md transition-opacity duration-200",
        "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      onClick={() => onOpenChange(false)}
      {...props}
    />
  )
}

function DrawerContent({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const { open, side } = React.useContext(DrawerContext)

  const sideClasses = {
    left: "inset-y-0 left-0 h-full w-80 border-r",
    right: "inset-y-0 right-0 h-full w-80 border-l",
    top: "inset-x-0 top-0 w-full h-auto max-h-[80vh] border-b",
    bottom: "inset-x-0 bottom-0 w-full h-auto max-h-[80vh] border-t",
  }

  const slideClasses = {
    left: "data-open:slide-in-from-left data-closed:slide-out-to-left",
    right: "data-open:slide-in-from-right data-closed:slide-out-to-right",
    top: "data-open:slide-in-from-top data-closed:slide-out-to-top",
    bottom: "data-open:slide-in-from-bottom data-closed:slide-out-to-bottom",
  }

  return (
    <div
      data-slot="drawer-content"
      className={cn(
        "fixed z-50 bg-card shadow-floating transition-all duration-200",
        sideClasses[side],
        slideClasses[side],
        open
          ? "data-open:animate-in data-open:fade-in-0"
          : "data-closed:animate-out data-closed:fade-out-0 pointer-events-none",
        className
      )}
      {...props}
    >
      {open && children}
    </div>
  )
}

function DrawerHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn("flex flex-col gap-1.5 p-6 pb-4 border-b border-border/60", className)}
      {...props}
    />
  )
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="drawer-title"
      className={cn("font-heading text-lg font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="drawer-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function DrawerBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-body"
      className={cn("flex-1 overflow-y-auto p-6", className)}
      {...props}
    />
  )
}

function DrawerFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("flex items-center justify-end gap-2 p-6 pt-4 border-t border-border/60", className)}
      {...props}
    />
  )
}

function DrawerClose({
  className,
  ...props
}: React.ComponentProps<"button">) {
  const { onOpenChange } = React.useContext(DrawerContext)
  return (
    <button
      data-slot="drawer-close"
      type="button"
      onClick={() => onOpenChange(false)}
      className={cn("cursor-pointer", className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerBody,
  DrawerFooter,
  DrawerClose,
}

"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface CenteredLayoutProps {
  children: React.ReactNode
  maxWidth?: "narrow" | "prose" | "standard"
  /** Vertically center the content */
  vertically?: boolean
  className?: string
}

const WIDTHS = {
  narrow: "max-w-3xl",
  prose: "max-w-4xl",
  standard: "max-w-7xl",
} as const

/**
 * Centered content layout for settings, auth flows, or focused forms.
 */
export function CenteredLayout({
  children,
  maxWidth = "prose",
  vertically = false,
  className,
}: CenteredLayoutProps) {
  return (
    <div
      data-slot="centered-layout"
      className={cn(
        "w-full mx-auto",
        WIDTHS[maxWidth],
        vertically && "min-h-[calc(100svh-8rem)] flex flex-col items-center justify-center",
        className
      )}
    >
      {children}
    </div>
  )
}

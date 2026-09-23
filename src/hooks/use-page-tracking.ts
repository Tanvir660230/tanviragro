"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { useShell } from "@/components/layout/ShellContext"

/**
 * Automatically track page visits via ShellContext.
 * Place this component once in the AppShell or layout to track all route changes.
 *
 * @example
 * // Inside AppShell or layout
 * <PageVisitTracker />
 */
export function PageVisitTracker() {
  const pathname = usePathname()
  const { trackPageVisit } = useShell()
  const lastTracked = useRef("")

  useEffect(() => {
    if (!pathname || pathname === lastTracked.current) return
    lastTracked.current = pathname

    // Generate a human-readable label from the pathname
    const label = pathname
      .split("/")
      .filter(Boolean)
      .map((seg) =>
        seg
          .replace(/[-_]/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
      )
      .join(" / ") || "Dashboard"

    trackPageVisit(pathname, label)
  }, [pathname, trackPageVisit])

  return null
}

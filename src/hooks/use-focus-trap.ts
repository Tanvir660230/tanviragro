"use client"

import { useEffect, useRef, useCallback } from "react"

/** Selectors for focusable elements */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Trap keyboard focus within a container element.
 * Used in dialogs, modals, drawers to prevent tab escaping.
 *
 * @param active - Whether the focus trap is active
 * @param containerRef - Ref to the container element
 */
export function useFocusTrap(
  active: boolean,
  containerRef: React.RefObject<HTMLElement | null>
) {
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Remember what was focused before trap
  useEffect(() => {
    if (active) {
      previousFocusRef.current = document.activeElement as HTMLElement
    }
  }, [active])

  // Restore focus when trap deactivates
  useEffect(() => {
    return () => {
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
        previousFocusRef.current.focus()
      }
    }
  }, [active])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!active || !containerRef.current || e.key !== "Tab") return

      const focusableElements = containerRef.current.querySelectorAll(FOCUSABLE)
      if (focusableElements.length === 0) return

      const first = focusableElements[0] as HTMLElement
      const last = focusableElements[focusableElements.length - 1] as HTMLElement

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    [active, containerRef]
  )

  useEffect(() => {
    if (!active) return
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [active, handleKeyDown])

  // Auto-focus the first focusable element when trap activates
  useEffect(() => {
    if (!active || !containerRef.current) return
    const timer = setTimeout(() => {
      const firstFocusable = containerRef.current?.querySelector(FOCUSABLE) as HTMLElement | null
      firstFocusable?.focus()
    }, 50)
    return () => clearTimeout(timer)
  }, [active, containerRef])
}

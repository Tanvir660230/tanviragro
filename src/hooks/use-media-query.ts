"use client"

import { useState, useEffect } from "react"

/**
 * Hook to respond to CSS media queries programmatically.
 * Uses matchMedia for performance — no polling or ResizeObserver.
 *
 * @example
 * const isMobile = useMediaQuery("(max-width: 767px)")
 * const isDesktop = useMediaQuery("(min-width: 1024px)")
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMatches(mql.matches)
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [query])

  return matches
}

/** Convenience hooks for common breakpoints */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)")
}

export function useIsTablet(): boolean {
  return useMediaQuery("(min-width: 768px) and (max-width: 1023px)")
}

export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)")
}

export function useIsLargeScreen(): boolean {
  return useMediaQuery("(min-width: 1280px)")
}

/** Detect if user prefers reduced motion */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)")
}

/** Detect dark mode from system preference or class-based theme */
export function useIsDarkMode(): boolean {
  return useMediaQuery("(prefers-color-scheme: dark)")
}

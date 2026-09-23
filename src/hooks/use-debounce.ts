"use client"

import { useState, useEffect } from "react"

/**
 * Debounce a rapidly changing value (e.g. search input).
 *
 * @param value  The value to debounce
 * @param delay  Delay in milliseconds (default 300)
 * @returns      The debounced value, which only updates after `delay` ms of inactivity
 *
 * @example
 * const [query, setQuery] = useState("")
 * const debouncedQuery = useDebounce(query, 300)
 * // debouncedQuery only changes 300ms after the user stops typing
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const STORAGE_PREFIX = "tanvir_scroll_pos_";
const SCROLL_DEBOUNCE_MS = 100;
const MAX_SAVED_POSITIONS = 50;

/**
 * Persists and restores scroll position per route.
 * Attach to the scrollable container (or window) to enable scroll memory
 * across client-side navigations, browser back/forward, and page reloads.
 *
 * @example
 * // Inside AppShell or layout
 * <ScrollRestoration />
 */
export function ScrollRestoration() {
  const pathname = usePathname();
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPathnameRef = useRef(pathname);

  // Restore scroll position when pathname changes
  useEffect(() => {
    // Small delay to let the DOM settle after route change
    const timer = setTimeout(() => {
      const saved = sessionStorage.getItem(STORAGE_PREFIX + pathname);
      if (saved) {
        try {
          const { top } = JSON.parse(saved) as { top: number };
          window.scrollTo({ top, behavior: "instant" });
        } catch {
          // Ignore malformed entries
        }
      } else if (lastPathnameRef.current === pathname) {
        // Same page — don't scroll to top (e.g., after modal dismiss)
      } else {
        // New page — scroll to top for fresh start
        window.scrollTo({ top: 0, behavior: "instant" });
      }
      lastPathnameRef.current = pathname;
    }, 50);

    return () => clearTimeout(timer);
  }, [pathname]);

  // Save scroll position on scroll (debounced)
  useEffect(() => {
    function handleScroll() {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        try {
          const pos = { top: window.scrollY, left: window.scrollX };
          sessionStorage.setItem(STORAGE_PREFIX + pathname, JSON.stringify(pos));

          // Prune old entries when exceeding limit
          const keys: string[] = [];
          for (let i = 0; i < sessionStorage.length; i++) {
            const k = sessionStorage.key(i);
            if (k?.startsWith(STORAGE_PREFIX)) keys.push(k);
          }
          if (keys.length > MAX_SAVED_POSITIONS) {
            keys
              .sort((a, b) => {
                const aTime = JSON.parse(sessionStorage.getItem(a) || "{}").time || 0;
                const bTime = JSON.parse(sessionStorage.getItem(b) || "{}").time || 0;
                return aTime - bTime;
              })
              .slice(0, keys.length - MAX_SAVED_POSITIONS)
              .forEach((k) => sessionStorage.removeItem(k));
          }
        } catch {
          // Ignore storage errors in restricted contexts
        }
      }, SCROLL_DEBOUNCE_MS);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [pathname]);

  return null;
}

"use client"

import React from "react"
import Link from "next/link"
import { Star, Clock, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useShell } from "@/components/layout/ShellContext"

/**
 * FavoritesManager — displays user's favorited and recently visited pages.
 * Can be rendered in the sidebar, command palette, or a standalone panel.
 */
export function FavoritesManager({ className }: { className?: string }) {
  const {
    favorites,
    removeFavorite,
    recentPages,
    clearRecentPages,
  } = useShell()

  const hasContent = favorites.length > 0 || recentPages.length > 0

  if (!hasContent) return null

  return (
    <div className={cn("space-y-4", className)}>
      {/* Favorites */}
      {favorites.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Favorites
            </span>
          </div>
          <div className="space-y-0.5">
            {favorites.map((fav) => (
              <div
                key={fav.href}
                className="group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Link
                  href={fav.href}
                  className="flex-1 text-xs font-medium text-foreground truncate hover:underline underline-offset-2"
                >
                  {fav.label}
                </Link>
                <button
                  type="button"
                  onClick={() => removeFavorite(fav.href)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-opacity cursor-pointer"
                  aria-label={`Remove ${fav.label} from favorites`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Pages */}
      {recentPages.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recent
              </span>
            </div>
            <button
              type="button"
              onClick={clearRecentPages}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
          <div className="space-y-0.5">
            {recentPages.slice(0, 8).map((page) => (
              <Link
                key={page.href + page.visitedAt}
                href={page.href}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <span className="text-xs text-muted-foreground truncate">{page.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

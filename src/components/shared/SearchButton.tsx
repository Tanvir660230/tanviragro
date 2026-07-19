"use client";

import { Search } from "lucide-react";

export function SearchButton() {
  return (
    <button
      aria-label="Open search (Ctrl+K)"
      className="w-full h-9 flex items-center gap-2.5 rounded-lg border border-border/70 bg-muted/40 px-3.5 text-sm text-muted-foreground hover:bg-muted hover:border-border transition-colors"
      onClick={() =>
        window.dispatchEvent(
          new KeyboardEvent("keydown", { ctrlKey: true, key: "k", bubbles: true })
        )
      }
    >
      <Search className="h-4 w-4 shrink-0 opacity-60" />
      <span className="flex-1 text-left opacity-60">Search anything...</span>
      <div className="flex items-center gap-0.5 shrink-0">
        <kbd className="rounded border border-border bg-background/80 px-1.5 py-0.5 font-mono text-xs leading-none">Ctrl</kbd>
        <kbd className="rounded border border-border bg-background/80 px-1.5 py-0.5 font-mono text-xs leading-none">K</kbd>
      </div>
    </button>
  );
}

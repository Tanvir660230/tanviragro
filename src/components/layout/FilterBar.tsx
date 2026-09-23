"use client";

import React from "react";
import { Search, X, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterChip {
  id: string;
  label: string;
  onRemove: () => void;
}

export interface FilterBarProps {
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  chips?: FilterChip[];
  activeFilterCount?: number;
  onClearFilters?: () => void;
  showAdvancedToggle?: boolean;
  isAdvancedOpen?: boolean;
  onToggleAdvanced?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters,
  chips = [],
  activeFilterCount = 0,
  onClearFilters,
  showAdvancedToggle = false,
  isAdvancedOpen = false,
  onToggleAdvanced,
  actions,
  className,
}: FilterBarProps) {
  const hasChips = chips.length > 0;

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-2xl bg-card border border-border/80 shadow-xs">
        <div className="flex flex-1 items-center gap-2.5 flex-wrap">
          {onSearchChange !== undefined && (
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchValue ?? ""}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full h-9 pl-9 pr-8 rounded-xl bg-muted/40 border border-input text-xs font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
              />
              {searchValue && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {filters}

          {showAdvancedToggle && onToggleAdvanced && (
            <button
              type="button"
              onClick={onToggleAdvanced}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer",
                isAdvancedOpen
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-background border-border/80 text-muted-foreground hover:text-foreground"
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}

          {activeFilterCount > 0 && onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {hasChips && (
        <div className="flex items-center gap-1.5 flex-wrap px-1">
          <span className="text-[11px] font-semibold text-muted-foreground mr-1">Active:</span>
          {chips.map((chip) => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-muted text-foreground border border-border/60"
            >
              <span>{chip.label}</span>
              <button
                type="button"
                onClick={chip.onRemove}
                className="hover:text-destructive cursor-pointer"
                aria-label={`Remove filter ${chip.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}


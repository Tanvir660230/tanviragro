"use client";

import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, CalendarDays, X } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

// ── Pagination bar ────────────────────────────────────────────────────────────
interface PaginationProps {
  total: number;
  page: number;          // 0-indexed
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  className?: string;
}

export function DataPagination({
  total,
  page,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  onPageChange,
  onPageSizeChange,
  className,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to   = Math.min((page + 1) * pageSize, total);

  if (total === 0) return null;

  const btn = (disabled: boolean, onClick: () => void, children: React.ReactNode, label: string) => (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 pt-2", className)}>
      {/* Per-page selector */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="hidden sm:inline text-xs">Show</span>
        <div className="flex items-center gap-0.5 rounded-lg bg-muted p-1">
          {pageSizeOptions.map((size) => (
            <button
              key={size}
              onClick={() => { onPageSizeChange(size); onPageChange(0); }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                pageSize === size
                  ? "bg-background text-foreground shadow-card"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Counter + navigation */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">
          {from}–{to} / {total}
        </span>
        <div className="flex items-center gap-1">
          {btn(page === 0,              () => onPageChange(0),            <ChevronFirst className="h-3.5 w-3.5" />, "First page")}
          {btn(page === 0,              () => onPageChange(page - 1),     <ChevronLeft  className="h-3.5 w-3.5" />, "Previous page")}
          <span className="min-w-[3.5rem] text-center text-xs font-semibold tabular-nums">
            {page + 1} / {totalPages}
          </span>
          {btn(page >= totalPages - 1,  () => onPageChange(page + 1),     <ChevronRight className="h-3.5 w-3.5" />, "Next page")}
          {btn(page >= totalPages - 1,  () => onPageChange(totalPages-1), <ChevronLast  className="h-3.5 w-3.5" />, "Last page")}
        </div>
      </div>
    </div>
  );
}

// ── Date range filter bar ─────────────────────────────────────────────────────
interface DateRangeProps {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange:   (v: string) => void;
  onClear: () => void;
  filteredCount?: number;
  totalCount?: number;
  className?: string;
}

export function DateRangeFilter({
  from, to, onFromChange, onToChange, onClear,
  filteredCount, totalCount, className,
}: DateRangeProps) {
  const isActive = !!(from || to);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <input
        type="date"
        value={from}
        max={to || undefined}
        onChange={(e) => onFromChange(e.target.value)}
        className="h-7 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        placeholder="From"
      />
      <span className="text-xs text-muted-foreground shrink-0">–</span>
      <input
        type="date"
        value={to}
        min={from || undefined}
        onChange={(e) => onToChange(e.target.value)}
        className="h-7 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        placeholder="To"
      />
      {isActive && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      )}
      {filteredCount !== undefined && totalCount !== undefined && isActive && (
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {filteredCount} / {totalCount}
        </span>
      )}
    </div>
  );
}

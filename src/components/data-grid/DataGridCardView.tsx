"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { MoreHorizontal, ChevronDown, ChevronRight, AlertCircle, WifiOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useL } from "@/i18n/text";
import type { GridColumn, RowAction } from "./types";

export interface DataGridCardViewProps<T extends Record<string, any>> {
  data: T[];
  columns: GridColumn<T>[];
  getRowId: (row: T, index: number) => string;
  selectedIds: string[];
  toggleSelectRow: (id: string) => void;
  enableSelection?: boolean;
  expandedIds: string[];
  toggleExpandRow: (id: string) => void;
  enableRowExpansion?: boolean;
  renderExpandedRow?: (row: T) => React.ReactNode;
  renderCustomCard?: (row: T, isSelected: boolean, toggleSelect: () => void) => React.ReactNode;
  rowActions?: RowAction<T>[];
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | string | null;
  onRetry?: () => void;
  isOffline?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  emptyIcon?: React.ReactNode;
}

export function DataGridCardView<T extends Record<string, any>>(props: DataGridCardViewProps<T>) {
  const L = useL();
  const {
    data,
    columns,
    getRowId,
    selectedIds,
    toggleSelectRow,
    enableSelection,
    expandedIds,
    toggleExpandRow,
    enableRowExpansion,
    renderExpandedRow,
    renderCustomCard,
    rowActions,
    onRowClick,
    isLoading,
    isError,
    error,
    onRetry,
    isOffline,
    emptyTitle,
    emptyDescription,
    emptyAction,
    emptyIcon,
  } = props;

  if (isOffline) {
    return (
      <div className="p-8 text-center bg-card rounded-xl border border-border">
        <WifiOff className="h-8 w-8 text-amber-500 mx-auto mb-2" />
        <div className="font-semibold text-foreground">You are currently offline</div>
        <div className="text-xs text-muted-foreground mt-1">Check internet connection.</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-center bg-card rounded-xl border border-border">
        <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
        <div className="font-semibold text-destructive">Failed to load data</div>
        <div className="text-xs text-muted-foreground mt-1">
          {typeof error === "string" ? error : error?.message || L("কিছু একটা ভুল হয়েছে", "An error occurred")}
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="mt-3 text-xs">
            {L("আবার চেষ্টা", "Retry")}
          </Button>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`sk-card-${i}`} className="p-4 rounded-xl border border-border bg-card space-y-3">
            <div className="flex justify-between items-center">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="p-8 text-center bg-card rounded-xl border border-border">
        <EmptyState title={emptyTitle ?? L("কিছু পাওয়া যায়নি", "No records found")} description={emptyDescription ?? L("এই শর্তে কোনো রেকর্ড নেই।", "There are no records matching your criteria.")} action={emptyAction} icon={emptyIcon} compact />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {data.map((row, idx) => {
        const rowId = getRowId(row, idx);
        const isSelected = selectedIds.includes(rowId);
        const isExpanded = expandedIds.includes(rowId);
        const visibleActions = rowActions ? rowActions.filter((a) => !a.hidden || !a.hidden(row)) : [];

        if (renderCustomCard) {
          return (
            <div key={rowId}>
              {renderCustomCard(row, isSelected, () => toggleSelectRow(rowId))}
            </div>
          );
        }

        const titleCol = columns[0];
        const badgeCol = columns[1];
        const otherCols = columns.slice(2);

        return (
          <div
            key={rowId}
            onClick={() => onRowClick?.(row)}
            className={`p-3 rounded-xl border transition-all bg-card ${
              isSelected ? "border-primary ring-1 ring-primary/30 bg-primary/5" : "border-border/80 hover:border-border"
            } ${onRowClick ? "cursor-pointer" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {enableSelection && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleSelectRow(rowId);
                    }}
                    aria-label={`Select card ${rowId}`}
                    className="rounded border-border accent-primary h-4 w-4 cursor-pointer"
                  />
                )}
                <div className="font-semibold text-sm truncate text-foreground">
                  {titleCol?.cell
                    ? titleCol.cell({ row, value: titleCol.accessorKey ? row[titleCol.accessorKey] : undefined, index: idx, isExpanded, toggleExpand: () => toggleExpandRow(rowId) })
                    : titleCol?.accessorKey ? String(row[titleCol.accessorKey] ?? "") : L(`#${idx + 1}`, `Item #${idx + 1}`)}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                {badgeCol && (
                  <div className="text-xs">
                    {badgeCol.cell
                      ? badgeCol.cell({ row, value: badgeCol.accessorKey ? row[badgeCol.accessorKey] : undefined, index: idx, isExpanded, toggleExpand: () => toggleExpandRow(rowId) })
                      : badgeCol.accessorKey ? String(row[badgeCol.accessorKey] ?? "") : null}
                  </div>
                )}

                {visibleActions.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36 bg-card border-border shadow-lg">
                      {visibleActions.map((action) => (
                        <DropdownMenuItem
                          key={action.id}
                          disabled={action.disabled?.(row)}
                          onClick={() => action.action(row)}
                          className={`text-xs gap-2 ${action.danger ? "text-destructive" : ""}`}
                        >
                          {action.icon}
                          <span>{action.label}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>

            <div className="mt-2 space-y-1 text-xs text-muted-foreground border-t border-border/50 pt-2">
              {otherCols.map((col, cIdx) => {
                const headerText = typeof col.header === "string" ? col.header : col.id;
                const cellContent = col.cell
                  ? col.cell({ row, value: col.accessorKey ? row[col.accessorKey] : undefined, index: idx, isExpanded, toggleExpand: () => toggleExpandRow(rowId) })
                  : col.accessorKey ? String(row[col.accessorKey] ?? "") : null;

                if (!cellContent) return null;

                return (
                  <div key={col.id || cIdx} className="flex items-center justify-between gap-2">
                    <span className="font-medium text-muted-foreground/80">{headerText}:</span>
                    <span className="text-foreground font-medium truncate text-right">{cellContent}</span>
                  </div>
                );
              })}
            </div>

            {enableRowExpansion && renderExpandedRow && (
              <div className="mt-2 pt-2 border-t border-border/50">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpandRow(rowId);
                  }}
                  className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                >
                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <span>{isExpanded ? L("বিস্তারিত লুকান", "Hide details") : L("বিস্তারিত দেখুন", "View details")}</span>
                </button>
                {isExpanded && <div className="mt-2 pt-2 text-xs">{renderExpandedRow(row)}</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { GridColumn, SortConfig } from "./types";
import { DataGridResizer } from "./DataGridResizer";

export interface DataGridHeaderProps<T> {
  columns: GridColumn<T>[];
  enableSelection?: boolean;
  isAllSelected?: boolean;
  toggleSelectAll?: () => void;
  sortConfigs: SortConfig[];
  toggleSort: (columnId: string, multi: boolean) => void;
  enableResizing?: boolean;
  onResizeColumn?: (columnId: string, width: number) => void;
}

export function DataGridHeader<T>({
  columns,
  enableSelection,
  isAllSelected,
  toggleSelectAll,
  sortConfigs,
  toggleSort,
  enableResizing,
  onResizeColumn,
}: DataGridHeaderProps<T>) {
  return (
    <TableHeader className="bg-muted/40 backdrop-blur-xs sticky top-0 z-10 select-none border-b border-border/70">
      <TableRow className="border-b border-border/70 hover:bg-transparent">
        {enableSelection && (
          <TableHead className="w-10 px-3 text-center">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={toggleSelectAll}
              aria-label="Select all rows"
              className="rounded border-border accent-primary h-4 w-4 cursor-pointer align-middle"
            />
          </TableHead>
        )}

        {columns.map((col, idx) => {
          const sort = sortConfigs.find((s) => s.key === col.id);
          const isSortable = col.sortable !== false;
          const sortIdx = sortConfigs.findIndex((s) => s.key === col.id);
          const headerText = typeof col.header === "string" ? col.header : String(col.id);
          const ariaSortValue = sort
            ? sort.order === "asc"
              ? "ascending" as const
              : ("descending" as const)
            : ("none" as const);

          return (
            <TableHead
              key={col.id || idx}
              style={{
                width: col.width ? `${col.width}px` : undefined,
                minWidth: col.minWidth ? `${col.minWidth}px` : undefined,
                maxWidth: col.maxWidth ? `${col.maxWidth}px` : undefined,
              }}
              aria-sort={isSortable ? ariaSortValue : undefined}
              aria-label={headerText}
              scope="col"
              className={`h-11 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 transition-colors relative ${
                isSortable ? "cursor-pointer hover:text-foreground" : ""
              } ${col.pinned === "left" ? "sticky left-0 bg-background/95 z-10" : ""} ${
                col.pinned === "right" ? "sticky right-0 bg-background/95 z-10" : ""
              } ${col.headerClassName || col.className || ""}`}
              onClick={(e) => {
                if (!isSortable) return;
                toggleSort(col.id, e.shiftKey);
              }}
              tabIndex={isSortable ? 0 : undefined}
              onKeyDown={(e) => {
                if (!isSortable) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleSort(col.id, e.shiftKey);
                }
              }}
            >
              <div
                className={`flex items-center gap-1.5 ${
                  col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : "justify-start"
                }`}
              >
                <span>{col.header}</span>
                {isSortable && (
                  <span className="inline-flex items-center text-muted-foreground/70" aria-hidden="true">
                    {sort ? (
                      sort.order === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-primary" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40 hover:opacity-100" />
                    )}
                    {sortConfigs.length > 1 && sortIdx > -1 && (
                      <span className="text-[9px] font-bold text-primary ml-0.5">{sortIdx + 1}</span>
                    )}
                  </span>
                )}
              </div>

              {/* Column resize handle */}
              {enableResizing && col.resizable !== false && onResizeColumn && (
                <DataGridResizer
                  columnId={col.id}
                  width={col.width}
                  minWidth={col.minWidth}
                  maxWidth={col.maxWidth}
                  onResize={onResizeColumn}
                />
              )}
            </TableHead>
          );
        })}
      </TableRow>
    </TableHeader>
  );
}

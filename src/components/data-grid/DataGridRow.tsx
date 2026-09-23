"use client";

import React, { memo } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, ChevronRight, ChevronDown } from "lucide-react";
import type { GridColumn, RowAction, GridDensity } from "./types";

export interface DataGridRowProps<T extends Record<string, any>> {
  row: T;
  rowIndex: number;
  rowId: string;
  columns: GridColumn<T>[];
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  enableSelection?: boolean;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  enableRowExpansion?: boolean;
  renderExpandedRow?: (row: T) => React.ReactNode;
  rowActions?: RowAction<T>[];
  density: GridDensity;
  onRowClick?: (row: T) => void;
  striped?: boolean;
  /** Tree nesting depth: first cell is indented accordingly. */
  treeIndentLevel?: number;
  /** Row is focused via roving keyboard navigation. */
  isFocused?: boolean;
}

const DENSITY_PADDING: Record<GridDensity, string> = {
  compact: "py-2 px-3 text-xs",
  standard: "py-3 sm:py-3.5 px-4 text-xs sm:text-sm",
  relaxed: "py-4 sm:py-4.5 px-5 text-sm",
};

export const DataGridRow = memo(function DataGridRow<T extends Record<string, any>>(
  props: DataGridRowProps<T>
) {
  const {
    row,
    rowIndex,
    rowId,
    columns,
    isSelected,
    onToggleSelect,
    enableSelection,
    isExpanded,
    onToggleExpand,
    enableRowExpansion,
    renderExpandedRow,
    rowActions,
    density,
    onRowClick,
    striped,
    treeIndentLevel = 0,
    isFocused = false,
  } = props;

  const visibleActions = rowActions ? rowActions.filter((a) => !a.hidden || !a.hidden(row)) : [];
  const inlineActions = visibleActions.filter((a) => a.inline);
  const menuActions = visibleActions.filter((a) => !a.inline);
  const cellPadding = DENSITY_PADDING[density] || DENSITY_PADDING.standard;

  return (
    <React.Fragment>
      <TableRow
        role="row"
        aria-rowindex={rowIndex + 1}
        data-state={isSelected ? "selected" : undefined}
        aria-selected={enableSelection ? isSelected : undefined}
        tabIndex={isFocused ? 0 : -1}
        className={`group transition-colors border-b border-border/70 ${
          isSelected ? "bg-primary/5 dark:bg-primary/10" : striped && rowIndex % 2 === 1 ? "bg-muted/20" : ""
        } ${onRowClick ? "cursor-pointer hover:bg-muted/40" : "hover:bg-muted/30"} ${
          isFocused ? "outline outline-1 outline-primary/60 -outline-offset-1" : ""
        }`}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button, input, a, [role='menuitem']")) return;
          onRowClick?.(row);
        }}
      >
        {enableSelection && (
          <TableCell className="w-10 px-3 text-center" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(rowId)}
              aria-label={`Select row ${rowId}`}
              className="rounded border-border accent-primary h-4 w-4 cursor-pointer align-middle"
            />
          </TableCell>
        )}

        {columns.map((col, cIdx) => {
          const isFirstVisibleCol = cIdx === 0;
          let cellContent: React.ReactNode = null;
          if (col.cell) {
            cellContent = col.cell({
              row,
              value: col.accessorKey ? row[col.accessorKey] : col.accessorFn ? col.accessorFn(row) : undefined,
              index: rowIndex,
              isExpanded,
              toggleExpand: () => onToggleExpand(rowId),
            });
          } else if (col.accessorFn) {
            cellContent = String(col.accessorFn(row) ?? "");
          } else if (col.accessorKey) {
            cellContent = String(row[col.accessorKey] ?? "");
          }

          return (
            <TableCell
              key={col.id || cIdx}
              className={`${cellPadding} ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"} ${
                col.pinned === "left" ? "sticky left-0 bg-background/95 z-10" : ""
              } ${col.pinned === "right" ? "sticky right-0 bg-background/95 z-10" : ""} ${col.className || ""}`}
            >
              {isFirstVisibleCol && enableRowExpansion ? (
                <div className="flex items-center gap-2" style={{ paddingLeft: treeIndentLevel * 20 }}>
                  {treeIndentLevel > 0 && (
                    <span className="inline-block w-4 shrink-0" aria-hidden="true">
                      <span className="block h-px bg-border" />
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleExpand(rowId);
                    }}
                    className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                    aria-expanded={isExpanded}
                    title={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                  <div className="flex-1 truncate">{cellContent}</div>
                </div>
              ) : treeIndentLevel > 0 && isFirstVisibleCol ? (
                <div className="flex items-center" style={{ paddingLeft: treeIndentLevel * 20 }}>
                  <span className="inline-block w-4 shrink-0" aria-hidden="true">
                    <span className="block h-px bg-border" />
                  </span>
                  <span className="flex-1 truncate">{cellContent}</span>
                </div>
              ) : (
                cellContent
              )}
            </TableCell>
          );
        })}

        {visibleActions.length > 0 && (
          <TableCell className={`${cellPadding} text-right w-20 shrink-0`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-end gap-1">
              {inlineActions.map((action) => (
                <Button
                  key={action.id}
                  variant="ghost"
                  size="sm"
                  disabled={action.disabled?.(row)}
                  onClick={() => action.action(row)}
                  className={`h-7 w-7 p-0 ${action.danger ? "text-destructive hover:bg-destructive/10" : "text-muted-foreground hover:text-foreground"}`}
                  title={action.label}
                >
                  {action.icon}
                </Button>
              ))}

              {menuActions.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40 bg-card border-border shadow-xl">
                    {menuActions.map((action, aIdx) => (
                      <React.Fragment key={action.id}>
                        {action.danger && aIdx > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuItem
                          disabled={action.disabled?.(row)}
                          onClick={() => action.action(row)}
                          className={`text-xs gap-2 ${action.danger ? "text-destructive focus:text-destructive" : ""}`}
                        >
                          {action.icon}
                          <span>{action.label}</span>
                        </DropdownMenuItem>
                      </React.Fragment>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </TableCell>
        )}
      </TableRow>

      {enableRowExpansion && isExpanded && renderExpandedRow && (
        <TableRow className="bg-muted/10 border-b border-border/70 hover:bg-muted/10">
          <TableCell colSpan={columns.length + (enableSelection ? 1 : 0) + (visibleActions.length > 0 ? 1 : 0)} className="p-4">
            {renderExpandedRow(row)}
          </TableCell>
        </TableRow>
      )}
    </React.Fragment>
  );
}) as <T extends Record<string, any>>(props: DataGridRowProps<T>) => React.JSX.Element;

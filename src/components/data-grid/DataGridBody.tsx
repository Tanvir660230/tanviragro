"use client";

import React from "react";
import { TableBody, TableRow, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, WifiOff, RefreshCw, FolderOpen, Sigma } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataGridRow } from "./DataGridRow";
import { useL } from "@/i18n/text";
import { ROW_MARKERS, type GridColumn, type RowAction, type GridDensity, type GroupHeadMeta, type GroupFootMeta } from "./types";
import { cn } from "@/lib/utils";

export interface DataGridBodyProps<T extends Record<string, any>> {
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
  rowActions?: RowAction<T>[];
  density: GridDensity;
  onRowClick?: (row: T) => void;
  striped?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | string | null;
  onRetry?: () => void;
  isOffline?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  emptyIcon?: React.ReactNode;
  renderGroupHeader?: (meta: GroupHeadMeta) => React.ReactNode;
  /**
   * Virtualization window. When provided, the body renders only the rows at
   * `indices` and pads with spacer rows so total height matches the full dataset.
   */
  virtualWindow?: { indices: number[]; totalHeight: number; windowHeight: number };
  /** Index of the row with keyboard focus (-1 = none). */
  focusedRowIndex?: number;
}

export function DataGridBody<T extends Record<string, any>>(props: DataGridBodyProps<T>) {
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
    rowActions,
    density,
    onRowClick,
    striped,
    isLoading,
    isError,
    error,
    onRetry,
    isOffline,
    emptyTitle,
    emptyDescription,
    emptyAction,
    emptyIcon,
    renderGroupHeader,
    virtualWindow,
    focusedRowIndex = -1,
  } = props;

  const totalCols = columns.length + (enableSelection ? 1 : 0) + (rowActions && rowActions.length > 0 ? 1 : 0);

  if (isOffline) {
    return (
      <TableBody>
        <TableRow>
          <TableCell colSpan={totalCols} className="p-8 text-center">
            <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto text-muted-foreground">
              <WifiOff className="h-8 w-8 text-amber-500" />
              <div className="font-semibold text-foreground">You are currently offline</div>
              <div className="text-xs">Data will update automatically once connection is restored.</div>
              {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry} className="mt-2 text-xs gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" /> Retry Connection
                </Button>
              )}
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    );
  }

  if (isError) {
    return (
      <TableBody>
        <TableRow>
          <TableCell colSpan={totalCols} className="p-8 text-center">
            <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto text-destructive">
              <AlertCircle className="h-8 w-8" />
              <div className="font-semibold">Failed to load data</div>
              <div className="text-xs text-muted-foreground">
                {typeof error === "string" ? error : error?.message || L("কিছু একটা ভুল হয়েছে।", "An unexpected error occurred.")}
              </div>
              {onRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  className="mt-2 text-xs gap-1.5 border-destructive/30 text-foreground hover:bg-destructive/10"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Try Again
                </Button>
              )}
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    );
  }
if (isLoading) {
    return (
      <TableBody>
        {Array.from({ length: 5 }).map((_, rIdx) => (
          <TableRow key={`skeleton-row-${rIdx}`} className="border-b border-border/70">
            {enableSelection && (
              <TableCell className="w-10 px-3 text-center">
                <Skeleton className="h-4 w-4 mx-auto rounded" />
              </TableCell>
            )}
            {columns.map((_, cIdx) => (
              <TableCell key={`sc-${rIdx}-${cIdx}`} className="py-3 px-3.5">
                <Skeleton className={`h-4 ${cIdx === 0 ? "w-3/4" : "w-1/2"}`} />
              </TableCell>
            ))}
            {rowActions && rowActions.length > 0 && (
              <TableCell className="w-20 text-right py-3 px-3.5">
                <Skeleton className="h-4 w-6 ml-auto" />
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    );
  }

  if (data.length === 0) {
    return (
      <TableBody>
        <TableRow>
          <TableCell colSpan={totalCols} className="p-10 text-center">
            <EmptyState
              title={emptyTitle ?? L("কিছু পাওয়া যায়নি", "No records found")}
              description={emptyDescription ?? L("এই শর্তে কোনো রেকর্ড নেই।", "There are no records matching your criteria.")}
              action={emptyAction}
              icon={emptyIcon}
              compact
            />
          </TableCell>
        </TableRow>
      </TableBody>
    );
  }

  // ── Virtual window: render visible rows + two spacer rows ─────────────
  if (virtualWindow) {
    const { indices, totalHeight, windowHeight } = virtualWindow;
    const headSpacer = indices[0] ?? 0;
    const tailCount = Math.max(0, totalHeight - (indices.length ? indices[indices.length - 1] + 1 : 0));
    const rowHeightPx = Math.max(28, Math.round(windowHeight / Math.max(1, indices.length)));

    return (
      <TableBody>
        {headSpacer > 0 && (
          <TableRow aria-hidden="true" className="border-0 hover:bg-transparent">
            <TableCell
              colSpan={totalCols}
              style={{ height: headSpacer * rowHeightPx, padding: 0, border: 0 }}
              className="p-0 border-0"
            />
          </TableRow>
        )}
        {indices.map((i) => (
          <RenderRow
            key={getRowId(data[i], i)}
            row={data[i]}
            index={i}
            columns={columns}
            getRowId={getRowId}
            selectedIds={selectedIds}
            toggleSelectRow={toggleSelectRow}
            enableSelection={enableSelection}
            expandedIds={expandedIds}
            toggleExpandRow={toggleExpandRow}
            enableRowExpansion={enableRowExpansion}
            renderExpandedRow={renderExpandedRow}
            rowActions={rowActions}
            density={density}
            onRowClick={onRowClick}
            striped={striped}
            renderGroupHeader={renderGroupHeader}
            focusedRowIndex={focusedRowIndex}
          />
        ))}
        {tailCount > 0 && (
          <TableRow aria-hidden="true" className="border-0 hover:bg-transparent">
            <TableCell
              colSpan={totalCols}
              style={{ height: tailCount * rowHeightPx, padding: 0, border: 0 }}
              className="p-0 border-0"
            />
          </TableRow>
        )}
      </TableBody>
    );
  }

  // ── Normal render ─────────────────────────────────────────────────────
  return (
    <TableBody>
      {data.map((row, idx) => (
        <RenderRow
          key={getRowId(row, idx)}
          row={row}
          index={idx}
          columns={columns}
          getRowId={getRowId}
          selectedIds={selectedIds}
          toggleSelectRow={toggleSelectRow}
          enableSelection={enableSelection}
          expandedIds={expandedIds}
          toggleExpandRow={toggleExpandRow}
          enableRowExpansion={enableRowExpansion}
          renderExpandedRow={renderExpandedRow}
          rowActions={rowActions}
          density={density}
          onRowClick={onRowClick}
          striped={striped}
          renderGroupHeader={renderGroupHeader}
          focusedRowIndex={focusedRowIndex}
        />
      ))}
    </TableBody>
  );
}
interface RenderRowProps<T extends Record<string, any>> {
  row: T;
  index: number;
  columns: GridColumn<T>[];
  getRowId: (row: T, index: number) => string;
  selectedIds: string[];
  toggleSelectRow: (id: string) => void;
  enableSelection?: boolean;
  expandedIds: string[];
  toggleExpandRow: (id: string) => void;
  enableRowExpansion?: boolean;
  renderExpandedRow?: (row: T) => React.ReactNode;
  rowActions?: RowAction<T>[];
  density: GridDensity;
  onRowClick?: (row: T) => void;
  striped?: boolean;
  renderGroupHeader?: (meta: GroupHeadMeta) => React.ReactNode;
  /** Index of the row with keyboard focus (-1 = none). */
  focusedRowIndex?: number;
}

/**
 * Dispatches a single display row: group header, group footer, or regular row.
 * Tree rows carry a `__treeDepth` marker used for indent styling.
 */
function RenderRow<T extends Record<string, any>>(props: RenderRowProps<T>) {
  const {
    row,
    index,
    columns,
    getRowId,
    selectedIds,
    toggleSelectRow,
    enableSelection,
    expandedIds,
    toggleExpandRow,
    enableRowExpansion,
    renderExpandedRow,
    rowActions,
    density,
    onRowClick,
    striped,
    renderGroupHeader,
    focusedRowIndex = -1,
  } = props;

  const rowId = getRowId(row, index);
  const isSelected = selectedIds.includes(rowId);
  const isExpanded = expandedIds.includes(rowId);
  const totalCols = columns.length + (enableSelection ? 1 : 0) + (rowActions && rowActions.length > 0 ? 1 : 0);

  const groupHead = (row as any)[ROW_MARKERS.GROUP_HEAD] as GroupHeadMeta | undefined;
  const groupFoot = (row as any)[ROW_MARKERS.GROUP_FOOT] as GroupFootMeta | undefined;
  const treeDepth = (row as any)[ROW_MARKERS.TREE_DEPTH] as number | undefined;

  if (groupHead) {
    return (
      <TableRow key={rowId} className="border-b border-border/70 bg-muted/40 hover:bg-muted/40">
        <TableCell colSpan={totalCols} className="px-3 py-1.5">
          {renderGroupHeader ? (
            renderGroupHeader(groupHead)
          ) : (
            <div
              className={cn("flex items-center gap-2 text-xs font-semibold select-none", onRowClick && "cursor-pointer")}
              onClick={() => onRowClick?.(row)}
            >
              <FolderOpen className="h-3.5 w-3.5 text-primary/70" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{groupHead.label}</span>
              <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                {groupHead.childCount}
              </span>
            </div>
          )}
        </TableCell>
      </TableRow>
    );
  }

  if (groupFoot) {
    return (
      <TableRow key={rowId} className="border-b border-border/70 bg-muted/30 hover:bg-muted/30">
        <TableCell colSpan={totalCols} className="px-3 py-1.5 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
            <Sigma className="h-3 w-3" />
            <span>Subtotal — {groupFoot.value ?? ""}</span>
            <span className="ml-auto flex items-center gap-3">
              {columns
                .filter((c) => c.aggregate && groupFoot.aggregates[c.id] !== undefined)
                .map((c) => (
                  <span key={c.id} className="tabular-nums">
                    <span className="mr-1 font-mono text-[10px] uppercase">
                      {typeof c.header === "string" ? c.header : c.id}:
                    </span>
                    <strong className="text-foreground">{String(groupFoot.aggregates[c.id])}</strong>
                  </span>
                ))}
            </span>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <DataGridRow
      row={row}
      rowIndex={index}
      rowId={rowId}
      columns={columns}
      isSelected={isSelected}
      onToggleSelect={toggleSelectRow}
      enableSelection={enableSelection}
      isExpanded={isExpanded}
      onToggleExpand={toggleExpandRow}
      enableRowExpansion={enableRowExpansion}
      renderExpandedRow={renderExpandedRow}
      rowActions={rowActions}
      density={density}
      onRowClick={onRowClick}
      striped={striped}
      treeIndentLevel={treeDepth ?? 0}
      isFocused={focusedRowIndex === index}
    />
  );
}
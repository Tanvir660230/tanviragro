"use client";

import * as React from "react";
import { EnterpriseDataGrid } from "@/components/data-grid/EnterpriseDataGrid";
import type { GridColumn, GridDensity, RowAction, BulkAction } from "@/components/data-grid/types";

export interface ColumnDef<T> {
  id?: string;
  header: string | React.ReactNode;
  accessorKey?: keyof T;
  accessorFn?: (item: T) => any;
  cell?: (item: T) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  className?: string;
  width?: number;
  align?: "left" | "center" | "right";
}

export interface UniversalDataTableProps<T extends Record<string, any>> {
  data: T[];
  columns: (ColumnDef<T> | GridColumn<T>)[];
  searchPlaceholder?: string;
  searchFilterKey?: keyof T;
  searchKeys?: (keyof T)[];
  pageSize?: number;
  pageSizeOptions?: number[];
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | string | null;
  onRetry?: () => void;
  isOffline?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  toolbarActions?: React.ReactNode;
  className?: string;
  onRowClick?: (item: T) => void;
  enableSelection?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (selectedIds: string[], selectedRows: T[]) => void;
  rowActions?: RowAction<T>[];
  bulkActions?: BulkAction<T>[];
  density?: GridDensity;
  enableExport?: boolean;
  enableAdvancedFilter?: boolean;
  enableSavedViews?: boolean;
  enableColumnVisibility?: boolean;
}

export function UniversalDataTable<T extends Record<string, any>>(props: UniversalDataTableProps<T>) {
  const {
    data,
    columns,
    searchPlaceholder = "Search...",
    searchFilterKey,
    searchKeys,
    pageSize = 10,
    pageSizeOptions,
    isLoading = false,
    isError = false,
    error,
    onRetry,
    isOffline,
    emptyTitle = "No records found",
    emptyDescription = "There are no items to display.",
    emptyAction,
    toolbarActions,
    className,
    onRowClick,
    enableSelection = false,
    selectedIds,
    onSelectionChange,
    rowActions,
    bulkActions,
    density = "standard",
    enableExport = true,
    enableAdvancedFilter = true,
    enableSavedViews = true,
    enableColumnVisibility = true,
  } = props;

  const gridColumns: GridColumn<T>[] = React.useMemo(() => {
    return columns.map((col, idx) => {
      const colId = col.id || (col.accessorKey ? String(col.accessorKey) : `col_${idx}`);
      return {
        id: colId,
        header: col.header,
        accessorKey: col.accessorKey,
        accessorFn: (col as any).accessorFn,
        sortable: col.sortable !== false,
        filterable: col.filterable !== false,
        className: col.className,
        width: (col as any).width,
        align: (col as any).align || "left",
        cell: col.cell
          ? (context: any) => {
              return typeof col.cell === "function"
                ? (col.cell as any)(context.row || context)
                : null;
            }
          : undefined,
      };
    });
  }, [columns]);

  return (
    <EnterpriseDataGrid
      data={data}
      columns={gridColumns}
      searchPlaceholder={searchPlaceholder}
      searchFilterKey={searchFilterKey}
      searchKeys={searchKeys}
      pageSize={pageSize}
      pageSizeOptions={pageSizeOptions}
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={onRetry}
      isOffline={isOffline}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      emptyAction={emptyAction}
      toolbarActions={toolbarActions}
      className={className}
      onRowClick={onRowClick}
      enableSelection={enableSelection}
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      rowActions={rowActions}
      bulkActions={bulkActions}
      density={density}
      enableExport={enableExport}
      enableAdvancedFilter={enableAdvancedFilter}
      enableSavedViews={enableSavedViews}
      enableColumnVisibility={enableColumnVisibility}
    />
  );
}

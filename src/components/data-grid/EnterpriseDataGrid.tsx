"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Table } from "@/components/ui/table";
import { BulkActionBar } from "@/components/enterprise-ui/BulkActionBar";
import { DataGridToolbar } from "./DataGridToolbar";
import { DataGridHeader } from "./DataGridHeader";
import { DataGridBody } from "./DataGridBody";
import { DataGridCardView } from "./DataGridCardView";
import { DataGridPagination } from "./DataGridPagination";
import { useDataGridState } from "./useDataGridState";
import { cn } from "@/lib/utils";
import type { EnterpriseDataGridProps } from "./types";

export function EnterpriseDataGrid<T extends Record<string, any>>(props: EnterpriseDataGridProps<T>) {
  const {
    data,
    columns,
    rowKey = "id",
    title,
    subtitle,
    isLoading = false,
    isError = false,
    error = null,
    onRetry,
    isOffline = false,
    enableGlobalSearch = true,
    searchPlaceholder,
    searchFilterKey,
    searchKeys,
    enableAdvancedFilter = true,
    enableColumnOrdering = true,
    enableColumnPinning = true,
    enableColumnResizing = true,
    enableColumnVisibility = true,
    enableDensitySelector = true,
    enableSavedViews = true,
    enableExport = true,
    enableSelection = false,
    enableMultiSort = true,
    enableRowGrouping = false,
    enableRowExpansion = false,
    enableTreeData = false,
    enableVirtualization = false,
    virtualRowHeight = 44,
    virtualHeight = 500,
    responsiveMode = "auto",
    density: controlledDensity,
    defaultDensity = "standard",
    renderExpandedRow,
    renderCustomCard,
    rowActions,
    bulkActions,
    onRowClick,
    selectedIds: controlledSelectedIds,
    onSelectionChange,
    toolbarActions,
    savedViewsKey,
    defaultSavedViews,
    pageSize: initialPageSize = 10,
    pageSizeOptions = [10, 20, 50, 100],
    serverSide = false,
    totalCount: serverTotalCount,
    onServerParamsChange,
    emptyTitle,
    emptyDescription,
    emptyAction,
    emptyIcon,
    className,
    tableClassName,
    striped = true,
    bordered = true,
    stickyHeader = true,
  } = props;

  const state = useDataGridState({
    data,
    columns,
    rowKey,
    defaultDensity,
    defaultPageSize: initialPageSize,
    enableMultiSort,
    searchFilterKey,
    searchKeys,
    savedViewsKey,
    defaultSavedViews,
    serverSide,
    totalCount: serverTotalCount,
    onServerParamsChange,
    groupBy: enableRowGrouping ? props.groupBy : undefined,
    showGroupFooters: props.showGroupFooters,
    enableTreeData,
    treeChildrenKey: props.treeChildrenKey,
  });

  const density = controlledDensity || state.density;
  const selectedIds = controlledSelectedIds || state.selectedIds;

  // Sync external selection change callback
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(state.selectedIds, state.selectedRows);
    }
  }, [state.selectedIds, state.selectedRows, onSelectionChange]);

  // Responsive mode detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (responsiveMode !== "auto") return;
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [responsiveMode]);

  const showCardView = responsiveMode === "card" || (responsiveMode === "auto" && isMobile);

  // Keyboard navigation focus index
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const items = state.paginatedData;
      if (items.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedRowIndex((prev) => Math.min(prev + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedRowIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === " " && focusedRowIndex >= 0 && focusedRowIndex < items.length) {
        e.preventDefault();
        const rowId = state.getRowId(items[focusedRowIndex], focusedRowIndex);
        state.toggleSelectRow(rowId);
      } else if (e.key === "Enter" && focusedRowIndex >= 0 && focusedRowIndex < items.length) {
        e.preventDefault();
        onRowClick?.(items[focusedRowIndex]);
      } else if (e.key === "Escape") {
        state.clearSelection();
      }
    },
    [state, focusedRowIndex, onRowClick]
  );

  // Format bulk actions for BulkActionBar
  const formattedBulkActions = useMemo(() => {
    if (!bulkActions || bulkActions.length === 0) return [];
    return bulkActions.map((action) => ({
      label: action.label,
      icon: action.icon,
      variant: action.variant || "default",
      onClick: () => action.action(state.selectedRows, state.selectedIds),
    }));
  }, [bulkActions, state.selectedRows, state.selectedIds]);

  return (
    <div
      ref={gridContainerRef}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label={title || "Data Grid"}
      className={cn("space-y-3.5 focus:outline-none", className)}
    >
      {/* Title & Subtitle Header */}
      {(title || subtitle) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            {title && <h2 className="text-lg font-bold text-foreground tracking-tight">{title}</h2>}
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      )}

      {/* Main Toolbar */}
      <DataGridToolbar
        searchQuery={state.searchQuery}
        onSearchChange={state.setSearchQuery}
        searchPlaceholder={searchPlaceholder}
        enableGlobalSearch={enableGlobalSearch}
        enableAdvancedFilter={enableAdvancedFilter}
        columns={columns}
        filters={state.filters}
        addFilter={state.addFilter}
        removeFilter={state.removeFilter}
        clearFilters={state.clearFilters}
        enableSavedViews={enableSavedViews}
        savedViews={state.savedViews}
        activeViewId={state.activeViewId}
        applySavedView={state.applySavedView}
        saveCurrentView={state.saveCurrentView}
        deleteSavedView={state.deleteSavedView}
        enableColumnVisibility={enableColumnVisibility}
        columnOrder={state.columnOrder}
        columnVisibility={state.columnVisibility}
        columnPinning={state.columnPinning}
        toggleColumnVisibility={state.toggleColumnVisibility}
        setAllColumnsVisibility={state.setAllColumnsVisibility}
        pinColumn={state.pinColumn}
        moveColumn={state.moveColumn}
        enableDensitySelector={enableDensitySelector}
        density={density}
        setDensity={state.setDensity}
        enableExport={enableExport}
        exportData={state.processedData}
        selectedRows={state.selectedRows}
        allDataset={data}
        exportTitle={title}
        toolbarActions={toolbarActions}
        onRefresh={props.onRetry}
        isLoading={isLoading}
      />

      {/* Grid Content: Responsive Card View vs Data Table */}
      {showCardView ? (
        <DataGridCardView
          data={state.paginatedData}
          columns={state.orderedVisibleColumns}
          getRowId={state.getRowId}
          selectedIds={selectedIds}
          toggleSelectRow={state.toggleSelectRow}
          enableSelection={enableSelection}
          expandedIds={state.expandedIds}
          toggleExpandRow={state.toggleExpandRow}
          enableRowExpansion={enableRowExpansion}
          renderExpandedRow={renderExpandedRow}
          renderCustomCard={renderCustomCard}
          rowActions={rowActions}
          onRowClick={onRowClick}
          isLoading={isLoading}
          isError={isError}
          error={error}
          onRetry={onRetry}
          isOffline={isOffline}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          emptyAction={emptyAction}
          emptyIcon={emptyIcon}
        />
      ) : (
        <div
          className={cn(
            "relative rounded-2xl overflow-x-auto bg-card shadow-xs transition-all",
            bordered ? "border border-border/80" : "",
            tableClassName
          )}
        >
          <Table
            className="w-full text-left border-collapse"
            role="grid"
            aria-rowcount={state.totalCount}
            aria-colcount={state.orderedVisibleColumns.length + (enableSelection ? 1 : 0) + (rowActions && rowActions.length > 0 ? 1 : 0)}
            aria-label={title || "Data Grid"}
          >
            <DataGridHeader
              columns={state.orderedVisibleColumns}
              enableSelection={enableSelection}
              isAllSelected={state.isAllPageSelected}
              toggleSelectAll={state.toggleSelectAllPage}
              sortConfigs={state.sortConfigs}
              toggleSort={state.toggleSort}
              enableResizing={enableColumnResizing}
              onResizeColumn={state.setColumnWidth}
            />

            <DataGridBody
              data={state.paginatedData}
              columns={state.orderedVisibleColumns}
              getRowId={state.getRowId}
              selectedIds={selectedIds}
              toggleSelectRow={state.toggleSelectRow}
              enableSelection={enableSelection}
              expandedIds={state.expandedIds}
              toggleExpandRow={state.toggleExpandRow}
              enableRowExpansion={enableRowExpansion}
              renderExpandedRow={renderExpandedRow}
              rowActions={rowActions}
              density={density}
              onRowClick={onRowClick}
              striped={striped}
              isLoading={isLoading}
              isError={isError}
              error={error}
              onRetry={onRetry}
              isOffline={isOffline}
              emptyTitle={emptyTitle}
              emptyDescription={emptyDescription}
              emptyAction={emptyAction}
              emptyIcon={emptyIcon}
              focusedRowIndex={focusedRowIndex}
            />
          </Table>
        </div>
      )}

      {/* Pagination Footer */}
      {!isLoading && state.totalCount > 0 && (
        <DataGridPagination
          page={state.page}
          pageSize={state.pageSize}
          totalCount={state.totalCount}
          onPageChange={state.setPage}
          onPageSizeChange={state.setPageSize}
          pageSizeOptions={pageSizeOptions}
          className="pt-1"
        />
      )}

      {/* Floating Bulk Action Bar */}
      {formattedBulkActions.length > 0 && selectedIds.length > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.length}
          totalCount={state.totalCount}
          onClearSelection={state.clearSelection}
          actions={formattedBulkActions as any}
        />
      )}

      {/* Screen reader live region for state changes */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {state.totalCount > 0 && (
          <span>
            {state.totalCount} record{state.totalCount !== 1 ? "s" : ""}
            {selectedIds.length > 0 && `, ${selectedIds.length} selected`}
            {state.sortConfigs.length > 0 && `, sorted by ${state.sortConfigs.map((s) => s.key).join(", ")}`}
            {state.filters.length > 0 && `, ${state.filters.length} filter${state.filters.length !== 1 ? "s" : ""} applied`}
          </span>
        )}
      </div>
    </div>
  );
}

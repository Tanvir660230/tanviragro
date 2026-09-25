"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, X, Download, RefreshCw, LayoutList, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { DataGridAdvancedFilters } from "./DataGridAdvancedFilters";
import { DataGridSavedViews } from "./DataGridSavedViews";
import { DataGridColumnCustomizer } from "./DataGridColumnCustomizer";
import { DataGridExportModal } from "./DataGridExportModal";
import { useL } from "@/i18n/text";
import type { GridColumn, FilterConfig, SavedView, GridDensity } from "./types";

export interface DataGridToolbarProps<T extends Record<string, any>> {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchPlaceholder?: string;
  enableGlobalSearch?: boolean;
  enableAdvancedFilter?: boolean;
  columns: GridColumn<T>[];
  filters: FilterConfig[];
  addFilter: (filter: FilterConfig) => void;
  removeFilter: (columnId: string) => void;
  clearFilters: () => void;
  enableSavedViews?: boolean;
  savedViews: SavedView[];
  activeViewId: string | null;
  applySavedView: (view: SavedView) => void;
  saveCurrentView: (name: string) => void;
  deleteSavedView: (id: string) => void;
  enableColumnVisibility?: boolean;
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;
  columnPinning: Record<string, "left" | "right" | false>;
  toggleColumnVisibility: (columnId: string) => void;
  setAllColumnsVisibility: (visible: boolean) => void;
  pinColumn: (columnId: string, side: "left" | "right" | false) => void;
  moveColumn: (columnId: string, direction: "left" | "right") => void;
  enableDensitySelector?: boolean;
  density: GridDensity;
  setDensity: (density: GridDensity) => void;
  enableExport?: boolean;
  exportData: T[];
  selectedRows: T[];
  allDataset?: T[];
  exportTitle?: string;
  toolbarActions?: React.ReactNode;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function DataGridToolbar<T extends Record<string, any>>(props: DataGridToolbarProps<T>) {
  const L = useL();
  const {
    searchQuery,
    onSearchChange,
    searchPlaceholder,
    enableGlobalSearch = true,
    enableAdvancedFilter = true,
    columns,
    filters,
    addFilter,
    removeFilter,
    clearFilters,
    enableSavedViews = true,
    savedViews,
    activeViewId,
    applySavedView,
    saveCurrentView,
    deleteSavedView,
    enableColumnVisibility = true,
    columnOrder,
    columnVisibility,
    columnPinning,
    toggleColumnVisibility,
    setAllColumnsVisibility,
    pinColumn,
    moveColumn,
    enableDensitySelector = true,
    density,
    setDensity,
    enableExport = true,
    exportData,
    selectedRows,
    allDataset,
    exportTitle,
    toolbarActions,
    onRefresh,
    isLoading,
  } = props;

  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-lg">
          {enableGlobalSearch && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder ?? L("খুঁজুন…", "Search records…")}
                className="pl-9 pr-8 h-9 text-sm bg-background/50 focus:bg-background"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {enableAdvancedFilter && (
            <DataGridAdvancedFilters
              columns={columns}
              filters={filters}
              addFilter={addFilter}
              removeFilter={removeFilter}
              clearFilters={clearFilters}
            />
          )}

          {enableSavedViews && (
            <DataGridSavedViews
              savedViews={savedViews}
              activeViewId={activeViewId}
              onApplyView={applySavedView}
              onSaveView={saveCurrentView}
              onDeleteView={deleteSavedView}
            />
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap justify-end">
          {enableDensitySelector && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 w-9 p-0 cursor-pointer")}
                title={L("ঘনত্ব", "Density")}
              >
                <LayoutList className="h-4 w-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-28 bg-card border-border shadow-lg">
                {(["compact", "standard", "relaxed"] as const).map((d) => (
                  <DropdownMenuItem key={d} onClick={() => setDensity(d)} className="text-xs capitalize flex justify-between">
                    <span>{d}</span>
                    {density === d && <Check className="h-3 w-3 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {enableColumnVisibility && (
            <DataGridColumnCustomizer
              columns={columns}
              columnOrder={columnOrder}
              columnVisibility={columnVisibility}
              columnPinning={columnPinning}
              toggleColumnVisibility={toggleColumnVisibility}
              setAllColumnsVisibility={setAllColumnsVisibility}
              pinColumn={pinColumn}
              moveColumn={moveColumn}
            />
          )}

          {enableExport && (
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setExportOpen(true)}>
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{L("নামান", "Export")}</span>
            </Button>
          )}

          {onRefresh && (
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={onRefresh} disabled={isLoading} title="Refresh">
              <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          )}

          {toolbarActions}
        </div>
      </div>

      {filters.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className="text-[10px] text-muted-foreground font-medium">Filters:</span>
          {filters.map((f) => {
            const col = columns.find((c) => c.id === f.columnId);
            const header = typeof col?.header === "string" ? col.header : f.columnId;
            return (
              <span key={f.columnId} className="inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded text-[10px] font-medium">
                <span>{header}: {String(f.value)}</span>
                <button type="button" onClick={() => removeFilter(f.columnId)} className="hover:text-destructive">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {enableExport && (
        <DataGridExportModal
          open={exportOpen}
          onOpenChange={setExportOpen}
          data={exportData}
          selectedRows={selectedRows}
          allDataset={allDataset}
          columns={columns}
          title={exportTitle}
        />
      )}
    </div>
  );
}

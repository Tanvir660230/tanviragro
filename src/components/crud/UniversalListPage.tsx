"use client";

import React, { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { EnterprisePageHeader } from "@/components/layout/PageHeader";
import { SummaryBar, type SummaryMetric } from "@/components/layout/SummaryBar";
import { FilterBar } from "@/components/layout/FilterBar";
import { BulkActionBar, type BulkAction } from "@/components/enterprise-ui/BulkActionBar";
import { UniversalDataTable, type ColumnDef } from "@/components/shared/UniversalDataTable";
import { Plus, Download, RefreshCw, SlidersHorizontal } from "lucide-react";

export interface UniversalListPageProps<T extends Record<string, any>> {
  title: string;
  subtitle?: string;
  badge?: string;
  metrics?: SummaryMetric[];
  data: T[];
  columns: ColumnDef<T>[];
  keyField?: string;
  searchPlaceholder?: string;
  searchFields?: (keyof T)[];
  filters?: React.ReactNode;
  activeFilterCount?: number;
  onClearFilters?: () => void;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ComponentType<{ className?: string }>;
  };
  bulkActions?: (selectedRows: T[]) => BulkAction[];
  onRefresh?: () => void;
  onExport?: () => void;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

export function UniversalListPage<T extends Record<string, any>>({
  title,
  subtitle,
  badge,
  metrics,
  data,
  columns,
  keyField = "id",
  searchPlaceholder = "Search records...",
  searchFields,
  filters,
  activeFilterCount = 0,
  onClearFilters,
  primaryAction,
  bulkActions,
  onRefresh,
  onExport,
  pageSize = 10,
  emptyTitle,
  emptyDescription,
  className,
}: UniversalListPageProps<T>) {
  const [searchValue, setSearchValue] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filter data by search
  const filteredData = React.useMemo(() => {
    if (!searchValue.trim()) return data;
    const q = searchValue.toLowerCase();
    return data.filter((item) => {
      if (searchFields && searchFields.length > 0) {
        return searchFields.some((f) => String(item[f] ?? "").toLowerCase().includes(q));
      }
      return Object.values(item).some((v) => String(v ?? "").toLowerCase().includes(q));
    });
  }, [data, searchValue, searchFields]);

  const selectedRows = React.useMemo(() => {
    const idSet = new Set(selectedIds);
    return data.filter((item) => idSet.has(String(item[keyField])));
  }, [data, selectedIds, keyField]);

  return (
    <PageContainer maxWidth="wide" className={className}>
      {/* Header */}
      <EnterprisePageHeader
        title={title}
        subtitle={subtitle}
        badge={badge}
        actions={
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border/80 transition-colors"
                title="Refresh records"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
            {onExport && (
              <button
                onClick={onExport}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted border border-border/80 transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button>
            )}
            {primaryAction && (
              <button
                onClick={primaryAction.onClick}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs"
              >
                {primaryAction.icon ? (
                  <primaryAction.icon className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                <span>{primaryAction.label}</span>
              </button>
            )}
          </div>
        }
      />

      {/* KPI Ribbon */}
      {metrics && metrics.length > 0 && <SummaryBar metrics={metrics} />}

      {/* Filter and Search Bar */}
      <FilterBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder={searchPlaceholder}
        filters={filters}
        activeFilterCount={activeFilterCount}
        onClearFilters={onClearFilters}
      />

      {/* Data Table */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
        <UniversalDataTable
          data={filteredData}
          columns={columns}
          pageSize={pageSize}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
        />
      </div>

      {/* Floating Bulk Action Bar */}
      {bulkActions && selectedIds.length > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.length}
          totalCount={data.length}
          onClearSelection={() => setSelectedIds([])}
          actions={bulkActions(selectedRows)}
        />
      )}
    </PageContainer>
  );
}

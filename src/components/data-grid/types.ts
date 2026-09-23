import React from "react";

export type GridDensity = "compact" | "standard" | "relaxed";

export type FilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "in"
  | "is_empty"
  | "is_not_empty";

export interface FilterOption {
  label: string;
  value: any;
  icon?: React.ReactNode;
  badgeCount?: number;
}

export interface GridColumn<T = any> {
  id: string;
  header: React.ReactNode | string;
  accessorKey?: keyof T;
  accessorFn?: (row: T) => any;
  cell?: (context: {
    row: T;
    value: any;
    index: number;
    isExpanded: boolean;
    toggleExpand: () => void;
  }) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: "text" | "number" | "date" | "select" | "boolean";
  filterOptions?: FilterOption[];
  resizable?: boolean;
  minWidth?: number;
  width?: number;
  maxWidth?: number;
  pinned?: "left" | "right" | false;
  hidden?: boolean;
  className?: string;
  headerClassName?: string;
  align?: "left" | "center" | "right";
  aggregate?: "sum" | "count" | "avg" | "min" | "max" | ((values: any[]) => any);
  priority?: number; // Lower number = higher priority to stay visible on tablet/mobile
  tooltip?: string;
}

export interface SortConfig {
  key: string;
  order: "asc" | "desc";
}

export interface FilterConfig {
  columnId: string;
  operator: FilterOperator;
  value: any;
  valueTo?: any; // For "between"
}

export interface SavedView {
  id: string;
  name: string;
  isDefault?: boolean;
  sort?: SortConfig[];
  filters?: FilterConfig[];
  search?: string;
  columnVisibility?: Record<string, boolean>;
  columnOrder?: string[];
  density?: GridDensity;
  pageSize?: number;
  groupBy?: string[];
}

export interface RowAction<T = any> {
  id: string;
  label: string;
  icon?: React.ReactNode;
  action: (row: T) => void | Promise<void>;
  danger?: boolean;
  hidden?: (row: T) => boolean;
  disabled?: (row: T) => boolean;
  permission?: string;
  shortcut?: string;
  inline?: boolean;
}

export interface BulkAction<T = any> {
  id: string;
  label: string;
  icon?: React.ReactNode;
  action: (selectedRows: T[], selectedIds: string[]) => void | Promise<void>;
  variant?: "default" | "outline" | "destructive" | "secondary";
  confirmMessage?: string;
  permission?: string;
}

export interface PaginationConfig {
  page: number; // 0-indexed or 1-indexed (DataGrid uses 0-indexed internally)
  pageSize: number;
  pageSizeOptions?: number[];
  totalCount?: number;
  mode?: "offset" | "cursor" | "infinite" | "virtual";
  cursor?: string | null;
  nextCursor?: string | null;
  hasMore?: boolean;
}

/**
 * View modes for the list experience: table, card (mobile cards),
 * compact (dense table), list (row = card line), timeline (chronological flow).
 */
export type ViewMode = "table" | "card" | "compact" | "list" | "timeline";

/** Hidden row markers injected by grouping/tree flattening. */
export const ROW_MARKERS = {
  GROUP_HEAD: "__groupHead",
  GROUP_FOOT: "__groupFoot",
  TREE_DEPTH: "__treeDepth",
} as const;

export interface GroupHeadMeta {
  groupKey: string;
  label: string;
  columnId: string;
  value: any;
  childCount: number;
}

export interface GroupFootMeta {
  groupKey: string;
  columnId: string;
  value: any;
  aggregates: Record<string, any>;
}

/** Aggregate context passed to column footer renderers. */
export interface AggregateContext {
  rows: any[];
  values: any[];
  count: number;
  sum: number | null;
  avg: number | null;
  min: number | null;
  max: number | null;
}

export interface EnterpriseDataGridProps<T extends Record<string, any> = Record<string, any>> {
  data: T[];
  columns: GridColumn<T>[];
  rowKey?: keyof T | ((row: T) => string);
  title?: string;
  subtitle?: string;
  
  // Loading & State
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | string | null;
  onRetry?: () => void;
  isOffline?: boolean;
  
  // Feature Toggles
  enableGlobalSearch?: boolean;
  searchPlaceholder?: string;
  searchFilterKey?: keyof T;
  searchKeys?: (keyof T)[];
  
  enableAdvancedFilter?: boolean;
  enableColumnOrdering?: boolean;
  enableColumnPinning?: boolean;
  enableColumnResizing?: boolean;
  enableColumnVisibility?: boolean;
  enableDensitySelector?: boolean;
  enableSavedViews?: boolean;
  enableExport?: boolean;
  enableSelection?: boolean;
  enableMultiSort?: boolean;
  enableRowGrouping?: boolean;
  enableRowExpansion?: boolean;
  enableTreeData?: boolean;
  enableVirtualization?: boolean;
  enableKeyboardNavigation?: boolean;
  enableColumnResizer?: boolean;
  virtualRowHeight?: number;
  virtualHeight?: number;
  showGroupFooters?: boolean;
  renderGroupHeader?: (meta: GroupHeadMeta) => React.ReactNode;
  
  // Display & Responsive
  responsiveMode?: "table" | "card" | "auto";
  view?: ViewMode;
  onViewChange?: (view: ViewMode) => void;
  density?: GridDensity;
  defaultDensity?: GridDensity;
  renderExpandedRow?: (row: T) => React.ReactNode;
  renderCustomCard?: (row: T, isSelected: boolean, toggleSelect: () => void) => React.ReactNode;
  groupBy?: string[];
  treeChildrenKey?: keyof T;
  
  // Actions
  rowActions?: RowAction<T>[];
  bulkActions?: BulkAction<T>[];
  onRowClick?: (row: T) => void;
  
  // Selection
  selectedIds?: string[];
  onSelectionChange?: (selectedIds: string[], selectedRows: T[]) => void;
  
  // Toolbar & Custom slots
  toolbarActions?: React.ReactNode;
  savedViewsKey?: string;
  defaultSavedViews?: SavedView[];
  
  // Pagination
  pagination?: Partial<PaginationConfig>;
  pageSize?: number;
  pageSizeOptions?: number[];
  
  // Server-side
  serverSide?: boolean;
  totalCount?: number;
  onServerParamsChange?: (params: {
    page: number;
    pageSize: number;
    search: string;
    sort: SortConfig[];
    filters: FilterConfig[];
  }) => void;
  onFetchNextPage?: () => void;
  
  // Empty states
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  emptyIcon?: React.ReactNode;
  
  // Styling
  className?: string;
  tableClassName?: string;
  striped?: boolean;
  bordered?: boolean;
  stickyHeader?: boolean;
}

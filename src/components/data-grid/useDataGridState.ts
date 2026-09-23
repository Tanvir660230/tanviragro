import { useState, useMemo, useCallback, useEffect } from "react";
import type {
  GridColumn,
  SortConfig,
  FilterConfig,
  GridDensity,
  SavedView,
  PaginationConfig,
  GroupHeadMeta,
  GroupFootMeta,
} from "./types";
import { ROW_MARKERS, type AggregateContext } from "./types";
import { resolveAggregate } from "./aggregate-utils";

export interface UseDataGridStateOptions<T> {
  data: T[];
  columns: GridColumn<T>[];
  rowKey?: keyof T | ((row: T) => string);
  defaultDensity?: GridDensity;
  defaultPageSize?: number;
  enableMultiSort?: boolean;
  searchFilterKey?: keyof T;
  searchKeys?: (keyof T)[];
  savedViewsKey?: string;
  defaultSavedViews?: SavedView[];
  serverSide?: boolean;
  totalCount?: number;
  onServerParamsChange?: (params: any) => void;
  /** Group rows by these column ids (displays group headers + footers). */
  groupBy?: string[];
  /** Whether to render aggregate footer rows under each group. */
  showGroupFooters?: boolean;
  /** Enable tree data flattening using `treeChildrenKey`. */
  enableTreeData?: boolean;
  /** Key on rows holding nested children array. */
  treeChildrenKey?: keyof T;
}

export interface RowViewMarker {
  [ROW_MARKERS.GROUP_HEAD]?: GroupHeadMeta;
  [ROW_MARKERS.GROUP_FOOT]?: GroupFootMeta;
  [ROW_MARKERS.TREE_DEPTH]?: number;
}

export function useDataGridState<T extends Record<string, any>>(options: UseDataGridStateOptions<T>) {
  const {
    data,
    columns,
    rowKey = "id",
    defaultDensity = "standard",
    defaultPageSize = 10,
    enableMultiSort = false,
    searchFilterKey,
    searchKeys,
    savedViewsKey,
    defaultSavedViews = [],
    serverSide = false,
    totalCount: serverTotalCount,
    onServerParamsChange,
    groupBy,
    showGroupFooters = false,
    enableTreeData = false,
    treeChildrenKey,
  } = options;

  // Helper to extract row identifier
  const getRowId = useCallback(
    (row: T, index: number): string => {
      if (typeof rowKey === "function") return rowKey(row);
      if (row && row[rowKey] !== undefined) return String(row[rowKey]);
      return `row-${index}`;
    },
    [rowKey]
  );

  // Core States
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([]);
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [page, setPage] = useState(0); // 0-indexed
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [density, setDensity] = useState<GridDensity>(defaultDensity);
  const [columnOrder, setColumnOrder] = useState<string[]>(() => columns.map((c) => c.id));
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    columns.forEach((c) => {
      init[c.id] = c.hidden !== true;
    });
    return init;
  });
  const [columnPinning, setColumnPinning] = useState<Record<string, "left" | "right" | false>>(() => {
    const init: Record<string, "left" | "right" | false> = {};
    columns.forEach((c) => {
      init[c.id] = c.pinned || false;
    });
    return init;
  });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    if (typeof window !== "undefined" && savedViewsKey) {
      try {
        const stored = localStorage.getItem(`grid_views_${savedViewsKey}`);
        if (stored) return JSON.parse(stored);
      } catch (e) {
        console.warn("Failed to read saved views", e);
      }
    }
    return defaultSavedViews;
  });
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  // Sync columns changes
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColumnOrder((prev) => {
      const currentIds = columns.map((c) => c.id);
      const existing = prev.filter((id) => currentIds.includes(id));
      const newOnes = currentIds.filter((id) => !prev.includes(id));
      return [...existing, ...newOnes];
    });
    setColumnVisibility((prev) => {
      const updated = { ...prev };
      columns.forEach((c) => {
        if (updated[c.id] === undefined) {
          updated[c.id] = c.hidden !== true;
        }
      });
      return updated;
    });
  }, [columns]);

  // Toggle sort handler
  const toggleSort = useCallback(
    (columnId: string, multi: boolean = false) => {
      setSortConfigs((prev) => {
        const existingIndex = prev.findIndex((s) => s.key === columnId);
        if (existingIndex > -1) {
          const current = prev[existingIndex];
          if (current.order === "asc") {
            const next = [...prev];
            next[existingIndex] = { key: columnId, order: "desc" };
            return multi && enableMultiSort ? next : [{ key: columnId, order: "desc" }];
          } else {
            // Remove sort
            if (multi && enableMultiSort) {
              return prev.filter((s) => s.key !== columnId);
            }
            return [];
          }
        } else {
          const newSort: SortConfig = { key: columnId, order: "asc" };
          return multi && enableMultiSort ? [...prev, newSort] : [newSort];
        }
      });
      setPage(0);
    },
    [enableMultiSort]
  );

  // Filter actions
  const addFilter = useCallback((newFilter: FilterConfig) => {
    setFilters((prev) => {
      const idx = prev.findIndex((f) => f.columnId === newFilter.columnId);
      if (idx > -1) {
        const updated = [...prev];
        updated[idx] = newFilter;
        return updated;
      }
      return [...prev, newFilter];
    });
    setPage(0);
  }, []);

  const removeFilter = useCallback((columnId: string) => {
    setFilters((prev) => prev.filter((f) => f.columnId !== columnId));
    setPage(0);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters([]);
    setSearchQuery("");
    setPage(0);
  }, []);

  // Selection actions
  const toggleSelectRow = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  // Expansion actions
  const toggleExpandRow = useCallback((id: string) => {
    setExpandedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }, []);

  // Column Customization actions
  const toggleColumnVisibility = useCallback((columnId: string) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [columnId]: !prev[columnId],
    }));
  }, []);

  const setAllColumnsVisibility = useCallback((visible: boolean) => {
    setColumnVisibility((prev) => {
      const updated: Record<string, boolean> = {};
      Object.keys(prev).forEach((k) => {
        updated[k] = visible;
      });
      return updated;
    });
  }, []);

  const pinColumn = useCallback((columnId: string, side: "left" | "right" | false) => {
    setColumnPinning((prev) => ({
      ...prev,
      [columnId]: side,
    }));
  }, []);

  const setColumnWidth = useCallback((columnId: string, width: number) => {
    setColumnWidths((prev) => ({
      ...prev,
      [columnId]: width,
    }));
  }, []);

  const moveColumn = useCallback((columnId: string, direction: "left" | "right") => {
    setColumnOrder((prev) => {
      const index = prev.indexOf(columnId);
      if (index < 0) return prev;
      const targetIndex = direction === "left" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, item);
      return copy;
    });
  }, []);

  // Saved views actions
  const saveCurrentView = useCallback(
    (name: string) => {
      const newView: SavedView = {
        id: `view_${Date.now()}`,
        name,
        sort: sortConfigs,
        filters,
        search: searchQuery,
        columnVisibility,
        columnOrder,
        density,
        pageSize,
      };
      setSavedViews((prev) => {
        const next = [...prev, newView];
        if (typeof window !== "undefined" && savedViewsKey) {
          try {
            localStorage.setItem(`grid_views_${savedViewsKey}`, JSON.stringify(next));
          } catch (e) {
            console.warn("Failed to persist saved views", e);
          }
        }
        return next;
      });
      setActiveViewId(newView.id);
      return newView;
    },
    [sortConfigs, filters, searchQuery, columnVisibility, columnOrder, density, pageSize, savedViewsKey]
  );

  const applySavedView = useCallback((view: SavedView) => {
    setActiveViewId(view.id);
    if (view.sort) setSortConfigs(view.sort);
    if (view.filters) setFilters(view.filters);
    if (view.search !== undefined) setSearchQuery(view.search);
    if (view.columnVisibility) setColumnVisibility(view.columnVisibility);
    if (view.columnOrder) setColumnOrder(view.columnOrder);
    if (view.density) setDensity(view.density);
    if (view.pageSize) setPageSize(view.pageSize);
    setPage(0);
  }, []);

  const deleteSavedView = useCallback(
    (id: string) => {
      setSavedViews((prev) => {
        const next = prev.filter((v) => v.id !== id);
        if (typeof window !== "undefined" && savedViewsKey) {
          try {
            localStorage.setItem(`grid_views_${savedViewsKey}`, JSON.stringify(next));
          } catch (e) {
            console.warn("Failed to delete saved view", e);
          }
        }
        return next;
      });
      if (activeViewId === id) setActiveViewId(null);
    },
    [activeViewId, savedViewsKey]
  );

  // Notify server parameters if in server-side mode
  useEffect(() => {
    if (serverSide && onServerParamsChange) {
      onServerParamsChange({
        page,
        pageSize,
        search: searchQuery,
        sort: sortConfigs,
        filters,
      });
    }
  }, [serverSide, onServerParamsChange, page, pageSize, searchQuery, sortConfigs, filters]);

  // Column map for easy lookup
  const columnMap = useMemo(() => {
    const map = new Map<string, GridColumn<T>>();
    columns.forEach((col) => map.set(col.id, col));
    return map;
  }, [columns]);

  // Ordered & visible columns
  const orderedVisibleColumns = useMemo(() => {
    const list: GridColumn<T>[] = [];
    columnOrder.forEach((id) => {
      const col = columnMap.get(id);
      if (col && columnVisibility[id] !== false) {
        list.push({
          ...col,
          pinned: columnPinning[id] || false,
          width: columnWidths[id] || col.width,
        });
      }
    });
    return list;
  }, [columnOrder, columnMap, columnVisibility, columnPinning, columnWidths]);

  // Client-Side Data Pipeline: 1. Search -> 2. Advanced Filters -> 3. Sorting
  const processedData = useMemo(() => {
    if (serverSide) return data;

    let result = [...data];

    // 1. Global Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((row) => {
        if (searchFilterKey) {
          return String(row[searchFilterKey] ?? "").toLowerCase().includes(q);
        }
        if (searchKeys && searchKeys.length > 0) {
          return searchKeys.some((k) => String(row[k] ?? "").toLowerCase().includes(q));
        }
        return Object.values(row).some((val) => {
          if (val === null || val === undefined) return false;
          if (typeof val === "object") return false;
          return String(val).toLowerCase().includes(q);
        });
      });
    }

    // 2. Advanced Filters
    if (filters.length > 0) {
      result = result.filter((row) => {
        return filters.every((filter) => {
          const col = columnMap.get(filter.columnId);
          const rowVal = col?.accessorKey ? row[col.accessorKey] : col?.accessorFn ? col.accessorFn(row) : (row as any)[filter.columnId];

          if (rowVal === null || rowVal === undefined) {
            if (filter.operator === "is_empty") return true;
            if (filter.operator === "is_not_empty") return false;
            return false;
          }

          const strVal = String(rowVal).toLowerCase();
          const targetVal = String(filter.value ?? "").toLowerCase();

          switch (filter.operator) {
            case "equals":
              return strVal === targetVal;
            case "not_equals":
              return strVal !== targetVal;
            case "contains":
              return strVal.includes(targetVal);
            case "not_contains":
              return !strVal.includes(targetVal);
            case "starts_with":
              return strVal.startsWith(targetVal);
            case "ends_with":
              return strVal.endsWith(targetVal);
            case "gt":
              return Number(rowVal) > Number(filter.value);
            case "gte":
              return Number(rowVal) >= Number(filter.value);
            case "lt":
              return Number(rowVal) < Number(filter.value);
            case "lte":
              return Number(rowVal) <= Number(filter.value);
            case "between":
              return Number(rowVal) >= Number(filter.value) && Number(rowVal) <= Number(filter.valueTo);
            case "in":
              return Array.isArray(filter.value) ? filter.value.includes(rowVal) : false;
            case "is_empty":
              return rowVal === "" || rowVal === null || rowVal === undefined;
            case "is_not_empty":
              return rowVal !== "" && rowVal !== null && rowVal !== undefined;
            default:
              return true;
          }
        });
      });
    }

    // 3. Sorting
    if (sortConfigs.length > 0) {
      result.sort((a, b) => {
        for (const sort of sortConfigs) {
          const col = columnMap.get(sort.key);
          const valA = col?.accessorKey ? a[col.accessorKey] : col?.accessorFn ? col.accessorFn(a) : (a as any)[sort.key];
          const valB = col?.accessorKey ? b[col.accessorKey] : col?.accessorFn ? col.accessorFn(b) : (b as any)[sort.key];

          if (valA === valB) continue;
          if (valA === null || valA === undefined) return 1;
          if (valB === null || valB === undefined) return -1;

          const comparison =
            typeof valA === "number" && typeof valB === "number"
              ? valA - valB
              : String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: "base" });

          return sort.order === "asc" ? comparison : -comparison;
        }
        return 0;
      });
    }

    return result;
  }, [data, serverSide, searchQuery, searchFilterKey, searchKeys, filters, columnMap, sortConfigs]);

  // ── Tree flattening & Grouping (produces flat display rows with markers) ──
  const hasGrouping = !!groupBy && groupBy.length > 0;
  const hasTree = enableTreeData && !!treeChildrenKey;

  const rowViewData = useMemo<any[]>(() => {
    if (serverSide) return processedData;

    let rows: any[] = processedData;

    // 1. Tree flatten — collapse a parent's children when not expanded.
    if (hasTree) {
      const flat: any[] = [];
      const walk = (items: any[], depth: number) => {
        (items || []).forEach((item) => {
          const id = getRowId(item, 0);
          flat.push({ ...item, [ROW_MARKERS.TREE_DEPTH]: depth });
          const kids = item[treeChildrenKey as keyof T];
          if (Array.isArray(kids) && kids.length > 0 && expandedIds.includes(id)) {
            walk(kids, depth + 1);
          }
        });
      };
      walk(rows, 0);
      rows = flat;
    }

    // 2. Grouping — insert group header rows and (optionally) aggregate footer rows.
    if (hasGrouping && groupBy) {
      const groupLabelFor = (row: any): string =>
        groupBy
          .map((g) => {
            const col = columnMap.get(g);
            const val = col?.accessorKey
              ? row[col.accessorKey]
              : col?.accessorFn
              ? col.accessorFn(row)
              : row[g];
            return val === null || val === undefined ? "—" : String(val);
          })
          .join(" / ");

      const groups: { key: string; label: string; firstRow: any; members: any[] }[] = [];
      const groupIndex = new Map<string, number>();

      rows.forEach((row) => {
        const label = groupLabelFor(row);
        const key = label;
        if (!groupIndex.has(label)) {
          groupIndex.set(label, groups.length);
          groups.push({ key: label, label, firstRow: row, members: [] });
        }
        groups[groupIndex.get(label)!].members.push(row);
      });

      const flat: any[] = [];
      groups.forEach((group) => {
        const colForGroup = columnMap.get(groupBy[0]);
        const headerValue =
          colForGroup?.accessorKey
            ? group.firstRow[colForGroup.accessorKey]
            : colForGroup?.accessorFn
            ? colForGroup.accessorFn(group.firstRow)
            : group.firstRow[groupBy[0]];

        const headMeta: GroupHeadMeta = {
          groupKey: group.key,
          label: group.label,
          columnId: groupBy[0],
          value: headerValue ?? null,
          childCount: group.members.length,
        };
        flat.push(Object.assign({}, group.firstRow, { [ROW_MARKERS.GROUP_HEAD]: headMeta }));

        group.members.forEach((r) => flat.push(r));

        if (showGroupFooters) {
          const aggregates: Record<string, any> = {};
          columns.forEach((col) => {
            if (!col.aggregate) return;
            const values = group.members
              .map((r2) =>
                col.accessorKey
                  ? r2[col.accessorKey]
                  : col.accessorFn
                  ? col.accessorFn(r2)
                  : null
              )
              .filter((v): v is any => v !== null && v !== undefined);
            aggregates[col.id] = resolveAggregate(col.aggregate, values).value;
          });
          const footMeta: GroupFootMeta = {
            groupKey: group.key,
            columnId: groupBy[0],
            value: headerValue ?? null,
            aggregates,
          };
          flat.push(Object.assign({}, group.firstRow, { [ROW_MARKERS.GROUP_FOOT]: footMeta }));
        }
      });
      rows = flat;
    }

    return rows;
  }, [
    processedData,
    serverSide,
    hasTree,
    treeChildrenKey,
    expandedIds,
    getRowId,
    hasGrouping,
    groupBy,
    columnMap,
    showGroupFooters,
    columns,
  ]);

  // Total count & Paginated slice
  const totalCount = serverSide ? (serverTotalCount ?? data.length) : rowViewData.length;

  const paginatedData = useMemo(() => {
    if (serverSide) return rowViewData;
    const start = page * pageSize;
    return rowViewData.slice(start, start + pageSize);
  }, [rowViewData, serverSide, page, pageSize]);

  // Selection helpers (marker rows like group headers/footers are never selectable)
  const isMarkerRow = useCallback((row: any): boolean => {
    return !!(row && (row[ROW_MARKERS.GROUP_HEAD] || row[ROW_MARKERS.GROUP_FOOT]));
  }, []);

  const isAllPageSelected = useMemo(() => {
    const selectable = paginatedData.filter((row) => !isMarkerRow(row));
    if (selectable.length === 0) return false;
    return selectable.every((row, idx) => selectedIds.includes(getRowId(row, idx)));
  }, [paginatedData, selectedIds, getRowId, isMarkerRow]);

  const toggleSelectAllPage = useCallback(() => {
    if (isAllPageSelected) {
      const pageRowIds = new Set(
        paginatedData.filter((row) => !isMarkerRow(row)).map((row, idx) => getRowId(row, idx))
      );
      setSelectedIds((prev) => prev.filter((id) => !pageRowIds.has(id)));
    } else {
      const pageRowIds = paginatedData
        .filter((row) => !isMarkerRow(row))
        .map((row, idx) => getRowId(row, idx));
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageRowIds])));
    }
  }, [isAllPageSelected, paginatedData, getRowId, isMarkerRow]);

  const selectEntireDataset = useCallback(() => {
    const allIds = processedData.map((row, idx) => getRowId(row, idx));
    setSelectedIds(allIds);
  }, [processedData, getRowId]);

  // Selected row objects
  const selectedRows = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return processedData.filter((row, idx) => selectedSet.has(getRowId(row, idx)));
  }, [processedData, selectedIds, getRowId]);

  return {
    getRowId,
    // State values
    searchQuery,
    setSearchQuery,
    sortConfigs,
    toggleSort,
    filters,
    addFilter,
    removeFilter,
    clearFilters,
    page,
    setPage,
    pageSize,
    setPageSize,
    density,
    setDensity,
    columnOrder,
    columnVisibility,
    columnPinning,
    columnWidths,
    toggleColumnVisibility,
    setAllColumnsVisibility,
    pinColumn,
    setColumnWidth,
    moveColumn,
    selectedIds,
    setSelectedIds,
    toggleSelectRow,
    toggleSelectAllPage,
    selectEntireDataset,
    clearSelection,
    isAllPageSelected,
    selectedRows,
    expandedIds,
    toggleExpandRow,
    savedViews,
    activeViewId,
    saveCurrentView,
    applySavedView,
    deleteSavedView,
    // Derived datasets
    processedData,
    rowViewData,
    paginatedData,
    totalCount,
    orderedVisibleColumns,
    columnMap,
    isMarkerRow,
  };
}

export type DataGridStateReturn<T extends Record<string, any> = any> = ReturnType<typeof useDataGridState>;


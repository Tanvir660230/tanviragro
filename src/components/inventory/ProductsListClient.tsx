"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EnterpriseDataGrid } from "@/components/data-grid/EnterpriseDataGrid";
import type { GridColumn, RowAction, BulkAction } from "@/components/data-grid/types";
import { StatusBadge } from "@/components/ui/status-badge";
import { CategoryBadge } from "@/components/inventory/inventory-ui";
import { DaysRemainingBadge } from "@/components/inventory/DaysRemainingBadge";
import { AddItemDialog } from "@/components/inventory/AddItemDialog";
import { Package, Trash2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface ProductRow {
  id: string;
  name: string;
  category: string;
  unit: string;
  low_stock_threshold: number | null;
  is_active_roughage: boolean | null;
  is_discontinued: boolean;
  stock: number;
  created_at?: string | null;
}

export function ProductsListClient({ items }: { items: ProductRow[] }) {
  const router = useRouter();
  const [, setSelectedIds] = useState<string[]>([]);
  const [, setSelectedRows] = useState<ProductRow[]>([]);

  const handleRowClick = (row: ProductRow) => {
    router.push(`/dashboard/inventory/products/${row.id}`);
  };

  const handleArchive = async (row: ProductRow) => {
    try {
      const mod = await import("@/app/dashboard/(app)/inventory/actions");
      const result = await mod.archiveInventoryItem(row.id);
      if (result.error) toast.error(result.error);
      else { toast.success(`"${row.name}" archived`); router.refresh(); }
    } catch { toast.error("Failed to archive item"); }
  };

  const columns: GridColumn<ProductRow>[] = useMemo(() => [
    {
      id: "name", header: "Product", accessorKey: "name", sortable: true, filterable: true,
      filterType: "text", priority: 1, resizable: true, pinned: "left", minWidth: 220,
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
            row.category === "feed" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
            : row.category === "medicine" ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
            : row.category === "equipment" ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
            : "bg-slate-500/10 text-slate-600 border-slate-500/20")}>
            <Package className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm text-foreground truncate">{row.name}</p>
            {row.is_active_roughage && <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">★ Active Roughage</span>}
          </div>
        </div>
      ),
    },
    {
      id: "category", header: "Category", accessorKey: "category", sortable: true, filterable: true,
      filterType: "select", priority: 4,
      filterOptions: ["feed", "medicine", "equipment", "roughage", "other"].map((c) => ({ label: c, value: c })),
      cell: ({ row }) => <CategoryBadge category={row.category} />,
    },
    {
      id: "stock", header: "Stock On Hand", accessorKey: "stock", sortable: true, filterable: true,
      filterType: "number", align: "right", priority: 2, aggregate: "sum",
      cell: ({ row }) => {
        const isOut = row.stock <= 0;
        const isLow = !isOut && row.low_stock_threshold !== null && row.stock <= row.low_stock_threshold;
        return (
          <span className={cn("font-mono font-semibold text-sm tabular-nums",
            isOut ? "text-rose-600 dark:text-rose-400" : isLow ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>
            {row.stock.toLocaleString("en-IN", { maximumFractionDigits: 2 })}{" "}
            <span className="text-[10px] font-normal text-muted-foreground">{row.unit}</span>
          </span>
        );
      },
    },
    {
      id: "status", header: "Status", sortable: true, filterable: true, filterType: "select", priority: 3,
      filterOptions: [
        { label: "In Stock", value: "in_stock" },
        { label: "Low Stock", value: "low_stock" },
        { label: "Out of Stock", value: "out_of_stock" },
      ],
      cell: ({ row }) => {
        if (row.stock <= 0) return <StatusBadge status="out_of_stock" />;
        if (row.low_stock_threshold !== null && row.stock <= row.low_stock_threshold) return <StatusBadge status="low_stock" />;
        return <StatusBadge status="in_stock" />;
      },
    },
    {
      id: "threshold", header: "Reorder Level", accessorKey: "low_stock_threshold", sortable: true,
      align: "right", priority: 6,
      cell: ({ row }) => (
        row.low_stock_threshold !== null
          ? <span className="font-mono text-xs text-muted-foreground tabular-nums">{row.low_stock_threshold} <span className="text-[10px]">{row.unit}</span></span>
          : <span className="text-muted-foreground/40">—</span>
      ),
    },
  ], []);

  const rowActions: RowAction<ProductRow>[] = useMemo(() => [
    { id: "view", label: "View Details", icon: <ExternalLink className="h-3.5 w-3.5" />, action: handleRowClick, inline: true },
    { id: "archive", label: "Archive", icon: <Trash2 className="h-3.5 w-3.5" />, danger: true, action: handleArchive },
  ], [router]);

  const bulkActions: BulkAction<ProductRow>[] = useMemo(() => {
    const archiveMany = async (rows: ProductRow[]) => {
      try {
        const mod = await import("@/app/dashboard/(app)/inventory/actions");
        let ok = 0, fail = 0;
        for (const r of rows) {
          const res = await mod.archiveInventoryItem(r.id);
          if (res.error) fail++; else ok++;
        }
        if (ok > 0) toast.success(`${ok} item${ok > 1 ? "s" : ""} archived`);
        if (fail > 0) toast.error(`${fail} failed`);
        router.refresh();
      } catch { toast.error("Bulk archive failed"); }
    };
    return [
      { id: "archive", label: "Archive Selected", icon: <Trash2 className="h-3.5 w-3.5" />, variant: "destructive" as const, confirmMessage: "Archive the selected items? History will be preserved.", action: archiveMany },
    ];
  }, [router]);

  return (
    <EnterpriseDataGrid
      data={items}
      columns={columns}
      rowKey="id"
      title="Product Catalog"
      subtitle={`${items.length} products tracked across feed, medicine, equipment & roughage`}
      enableGlobalSearch
      searchKeys={["name", "category", "unit"]}
      searchPlaceholder="Search products…"
      enableAdvancedFilter
      enableColumnVisibility
      enableColumnOrdering
      enableColumnResizing
      enableDensitySelector
      enableSavedViews
      enableExport
      enableSelection
      enableRowGrouping
      enableVirtualization
      enableKeyboardNavigation
      virtualRowHeight={56}
      responsiveMode="auto"
      density="standard"
      pageSize={15}
      pageSizeOptions={[10, 15, 25, 50, 100]}
      onRowClick={handleRowClick}
      rowActions={rowActions}
      bulkActions={bulkActions}
      onSelectionChange={(ids, rows) => { setSelectedIds(ids); setSelectedRows(rows); }}
      toolbarActions={<AddItemDialog />}
      emptyTitle="No products yet"
      emptyDescription="Add your first inventory item to start tracking stock."
      savedViewsKey="inventory-products"
      striped
    />
  );
}

"use client";

import { useMemo, useState } from "react";
import { EnterpriseDataGrid } from "@/components/data-grid/EnterpriseDataGrid";
import type { GridColumn } from "@/components/data-grid/types";
import { StatusBadge } from "@/components/ui/status-badge";
import { CategoryBadge } from "@/components/inventory/inventory-ui";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useL } from "@/i18n/text";

export interface MovementRow {
  id: string;
  item_id: string;
  itemName: string;
  category: string;
  unit: string;
  type: string;
  qty: number;
  unit_cost: number | null;
  cattle_id: string | null;
  recorded_at: string;
  notes: string | null;
}

const IN_TYPES = new Set(["purchase", "adjustment_in", "transfer_in", "return", "production_in"]);
function isInbound(t: string) { return IN_TYPES.has(t); }
function connectType(type: string, L: (bn: string, en: string) => string) {
  const map: Record<string, { label: string; color: "in_stock" | "low_stock" | "out_of_stock" }> = {
    purchase: { label: L("কেনা", "Purchase"), color: "in_stock" },
    consumption: { label: L("খাওয়ানো", "Consumption"), color: "out_of_stock" },
    transfer_in: { label: L("স্থানান্তর আসা", "Transfer in"), color: "in_stock" },
    transfer_out: { label: L("স্থানান্তর যাওয়া", "Transfer out"), color: "out_of_stock" },
    adjustment_in: { label: L("গণনা +", "Adjustment +"), color: "in_stock" },
    adjustment_out: { label: L("গণনা −", "Adjustment −"), color: "out_of_stock" },
    waste: { label: L("নষ্ট", "Waste"), color: "out_of_stock" },
    return: { label: L("ফেরত", "Return"), color: "in_stock" },
    production_in: { label: L("মিক্স তৈরি", "Production"), color: "in_stock" },
    production_out: { label: L("মিক্সে গেছে", "Component use"), color: "out_of_stock" },
  };
  return map[type] ?? { label: type.replace(/_/g, " "), color: "low_stock" as const };
}

export function MovementsClient({ movements }: { movements: MovementRow[] }) {
  const L = useL();
  const [, setSelectedIds] = useState<string[]>([]);

  const columns: GridColumn<MovementRow>[] = useMemo(() => [
    {
      id: "item", header: L("জিনিস", "Product"), accessorKey: "itemName", sortable: true, filterable: true,
      filterType: "text", priority: 1, pinned: "left", minWidth: 200, resizable: true,
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="font-medium text-sm text-foreground truncate">{row.itemName}</p>
          <CategoryBadge category={row.category} />
        </div>
      ),
    },
    {
      id: "type", header: L("ধরন", "Movement"), accessorKey: "type", sortable: true, filterable: true, filterType: "select",
      filterOptions: Array.from(new Set(movements.map((m) => m.type))).map((t) => ({ label: t, value: t })),
      priority: 2,
      cell: ({ row }) => { const c = connectType(row.type, L); return <StatusBadge status={c.color} label={c.label} />; },
    },
    {
      id: "direction", header: L("দিক", "Direction"), sortable: true, filterable: true, priority: 5,
      filterOptions: [
        { label: L("এসেছে", "Inbound"), value: "IN" },
        { label: L("গেছে", "Outbound"), value: "OUT" },
      ],
      cell: ({ row }) => isInbound(row.type) ? (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400"><ArrowDownLeft className="h-3.5 w-3.5" /> {L("এসেছে", "In")}</span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400"><ArrowUpRight className="h-3.5 w-3.5" /> {L("গেছে", "Out")}</span>
      ),
    },
    {
      id: "qty", header: L("পরিমাণ", "Quantity"), accessorKey: "qty", sortable: true, filterable: true, filterType: "number",
      align: "right", priority: 3, aggregate: "sum",
      cell: ({ row }) => (
        <span className={cn("font-mono font-semibold tabular-nums", isInbound(row.type) ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
          {isInbound(row.type) ? "+" : "−"}{(row.qty ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })} {row.unit}
        </span>
      ),
    },
    {
      id: "unit_cost", header: L("দাম/একক", "Unit cost"), accessorKey: "unit_cost", sortable: true, align: "right", priority: 6,
      cell: ({ row }) => row.unit_cost != null ? <span className="font-mono text-xs text-muted-foreground">৳{row.unit_cost.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span> : <span className="text-muted-foreground/40">—</span>,
    },
    {
      id: "recorded_at", header: L("তারিখ", "Date"), accessorKey: "recorded_at", sortable: true, filterable: true, filterType: "date", priority: 4,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
          {row.recorded_at.slice(0, 10)}
        </span>
      ),
    },
    {
      id: "notes", header: L("বিবরণ", "Reference"), accessorKey: "notes", sortable: false, filterable: false, priority: 7,
      cell: ({ row }) => <span className="text-xs text-muted-foreground truncate block max-w-[220px]">{row.notes || "—"}</span>,
    },
  ], [L, movements]);

  return (
    <EnterpriseDataGrid
      data={movements}
      columns={columns}
      rowKey="id"
      title={L("স্টকের সব লেনদেন", "Movement Ledger")}
      subtitle={L(`${movements.length}টি লেনদেন`, `${movements.length} stock movements`)}
      enableGlobalSearch
      searchKeys={["itemName", "notes", "type"]}
      searchPlaceholder={L("জিনিস, বিবরণ বা ধরন খুঁজুন…", "Search by product, reference, type…")}
      enableAdvancedFilter
      enableColumnVisibility
      enableColumnOrdering
      enableExport
      enableSavedViews
      enableSelection
      enableVirtualization
      enableKeyboardNavigation
      virtualRowHeight={64}
      responsiveMode="auto"
      density="compact"
      pageSize={20}
      pageSizeOptions={[10, 20, 50, 100, 250]}
      onSelectionChange={(ids) => setSelectedIds(ids)}
      emptyTitle={L("এখনো কোনো লেনদেন নেই", "No movements yet")}
      emptyDescription={L("কেনা, খাওয়ানো ও গণনা করলে এখানে দেখা যাবে।", "Stock transactions will appear here as you buy, consume and adjust.")}
      savedViewsKey="inventory-movements"
      striped
    />
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
  /** purchase = into stock, consumption = out of stock (the ledger's direction) */
  type: string;
  /** what the movement was: purchase, mix made, daily deduction, count adjustment, … */
  movement_type: string | null;
  qty: number;
  unit_cost: number | null;
  cattle_id: string | null;
  recorded_at: string;
  notes: string | null;
}

/** the ledger's own direction: "purchase" rows add to stock, every other row takes from it */
function isInbound(r: Pick<MovementRow, "type">) { return r.type === "purchase"; }

/** the kind of movement shown (and filtered on): the movement type, a daily deduction told apart */
function kindOf(r: Pick<MovementRow, "type" | "movement_type" | "notes">): string {
  if (r.notes?.startsWith("Correction")) return "correction";
  if (r.movement_type === "consumption" && r.notes?.startsWith("Auto:")) return "auto";
  return r.movement_type ?? r.type;
}
function connectType(kind: string, L: (bn: string, en: string) => string) {
  const map: Record<string, { label: string; color: "in_stock" | "low_stock" | "out_of_stock" }> = {
    purchase: { label: L("কেনা", "Purchase"), color: "in_stock" },
    opening_balance: { label: L("শুরুর স্টক", "Opening stock"), color: "in_stock" },
    own_production: { label: L("নিজের জমি থেকে", "Own land"), color: "in_stock" },
    consumption: { label: L("ব্যবহার", "Used"), color: "out_of_stock" },
    auto: { label: L("খাওয়ানো (প্রতিদিন)", "Fed (daily)"), color: "out_of_stock" },
    consumption_reversal: { label: L("ব্যবহার বাতিল", "Use undone"), color: "in_stock" },
    purchase_reversal: { label: L("কেনা বাতিল", "Purchase undone"), color: "out_of_stock" },
    feed_mix_input: { label: L("মিক্সে গেছে", "Into a mix"), color: "out_of_stock" },
    feed_mix_output: { label: L("মিক্স তৈরি", "Mix made"), color: "in_stock" },
    adjustment_in: { label: L("গণনা +", "Count +"), color: "in_stock" },
    adjustment_out: { label: L("গণনা −", "Count −"), color: "out_of_stock" },
    wastage: { label: L("নষ্ট / হারিয়েছে", "Lost / spoiled"), color: "out_of_stock" },
    return: { label: L("ফেরত", "Return"), color: "in_stock" },
    correction: { label: L("সংশোধন", "Correction"), color: "low_stock" },
  };
  return map[kind] ?? { label: kind.replace(/_/g, " "), color: "low_stock" as const };
}

type GridRow = MovementRow & { kind: string; direction: "IN" | "OUT" };

export function MovementsClient({ movements: raw }: { movements: MovementRow[] }) {
  const L = useL();
  const movements: GridRow[] = useMemo(() => raw.map((r) => ({ ...r, kind: kindOf(r), direction: isInbound(r) ? "IN" : "OUT" })), [raw]);
  const [, setSelectedIds] = useState<string[]>([]);

  const columns: GridColumn<GridRow>[] = useMemo(() => [
    {
      id: "item", header: L("জিনিস", "Product"), accessorKey: "itemName", sortable: true, filterable: true,
      filterType: "text", priority: 1, pinned: "left", minWidth: 200, resizable: true,
      cell: ({ row }) => (
        <div className="min-w-0">
          <Link href={`/dashboard/inventory/products/${row.item_id}`} className="block truncate text-sm font-medium text-foreground hover:text-primary hover:underline">{row.itemName}</Link>
          <CategoryBadge category={row.category} />
        </div>
      ),
    },
    {
      id: "type", header: L("ধরন", "Movement"), accessorKey: "kind", sortable: true, filterable: true, filterType: "select",
      filterOptions: Array.from(new Set(movements.map((m) => m.kind))).map((k) => ({ label: connectType(k, L).label, value: k })),
      priority: 2,
      cell: ({ row }) => { const c = connectType(row.kind, L); return <StatusBadge status={c.color} label={c.label} />; },
    },
    {
      id: "direction", header: L("দিক", "Direction"), accessorKey: "direction", sortable: true, filterable: true, filterType: "select", priority: 5,
      filterOptions: [
        { label: L("এসেছে", "Inbound"), value: "IN" },
        { label: L("গেছে", "Outbound"), value: "OUT" },
      ],
      cell: ({ row }) => isInbound(row) ? (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400"><ArrowDownLeft className="h-3.5 w-3.5" /> {L("এসেছে", "In")}</span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400"><ArrowUpRight className="h-3.5 w-3.5" /> {L("গেছে", "Out")}</span>
      ),
    },
    {
      id: "qty", header: L("পরিমাণ", "Quantity"), accessorKey: "qty", sortable: true, filterable: true, filterType: "number",
      align: "right", priority: 3, aggregate: "sum",
      cell: ({ row }) => (
        <span className={cn("font-mono font-semibold tabular-nums", isInbound(row) ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
          {isInbound(row) ? "+" : "−"}{(row.qty ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })} {row.unit}
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
      searchKeys={["itemName", "notes", "kind"]}
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

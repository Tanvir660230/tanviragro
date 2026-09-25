"use client";

import { useMemo, useState } from "react";
import { EnterpriseDataGrid } from "@/components/data-grid/EnterpriseDataGrid";
import type { GridColumn } from "@/components/data-grid/types";
import { CategoryBadge } from "@/components/inventory/inventory-ui";
import { ClipboardList, ArrowDownLeft, ArrowUpRight, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useL } from "@/i18n/text";

export interface AdjustmentRow {
  id: string;
  item_id: string;
  itemName: string;
  category: string;
  unit: string;
  type: string;
  qty: number;
  unit_cost: number | null;
  recorded_at: string;
  notes: string | null;
}

const REASON_BN: Record<string, string> = {
  Unknown: "অজানা", "Physical Count": "গণনা", Spoilage: "নষ্ট", Damage: "ক্ষতি", Shrinkage: "কমে যাওয়া",
  "Operational Waste": "অপচয়", Correction: "সংশোধন", Expiry: "মেয়াদ শেষ",
};

function parseReason(notes: string | null): string {
  if (!notes) return "Unknown";
  const lower = notes.toLowerCase();
  if (lower.includes("physical count")) return "Physical Count";
  if (lower.includes("spoilage")) return "Spoilage";
  if (lower.includes("damage")) return "Damage";
  if (lower.includes("shrinkage")) return "Shrinkage";
  if (lower.includes("waste")) return "Operational Waste";
  if (lower.includes("correction")) return "Correction";
  if (lower.includes("expiry")) return "Expiry";
  return notes.length > 40 ? notes.slice(0, 40) + "…" : notes;
}

export function AdjustmentsClient({ adjustments }: { adjustments: AdjustmentRow[] }) {
  const L = useL();
  const [, setSelectedIds] = useState<string[]>([]);

  const columns: GridColumn<AdjustmentRow>[] = useMemo(() => [
    {
      id: "item", header: L("জিনিস", "Product"), accessorKey: "itemName", sortable: true, filterable: true,
      filterType: "text", priority: 1, pinned: "left", minWidth: 200, resizable: true,
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
            row.category === "feed" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
            : row.category === "medicine" ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
            : "bg-slate-500/10 text-slate-600 border-slate-500/20")}>
            <ClipboardList className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm text-foreground truncate">{row.itemName}</p>
            <CategoryBadge category={row.category} />
          </div>
        </div>
      ),
    },
    {
      id: "type", header: L("দিক", "Direction"), accessorKey: "type", sortable: true, filterable: true,
      filterType: "select", priority: 2,
      filterOptions: [
        { label: L("বেশি (+)", "Surplus (+)"), value: "adjustment_in" },
        { label: L("কম (−)", "Shortage (−)"), value: "adjustment_out" },
      ],
      cell: ({ row }) => {
        const isIn = row.type === "adjustment_in";
        return (
          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
            isIn ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
            : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-500/20")}>
            {isIn ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
            {isIn ? L("বেশি", "Surplus") : L("কম", "Shortage")}
          </span>
        );
      },
    },
    {
      id: "reason", header: L("কারণ", "Reason"), accessorKey: "notes", sortable: false, filterable: true,
      filterType: "select", priority: 3,
      filterOptions: ["Physical Count", "Spoilage", "Damage", "Shrinkage", "Operational Waste", "Correction"]
        .map((r) => ({ label: L(REASON_BN[r] ?? r, r), value: r })),
      cell: ({ row }) => (
        <span className="text-xs font-medium text-foreground bg-muted/60 rounded-md px-2 py-0.5">
          {L(REASON_BN[parseReason(row.notes)] ?? parseReason(row.notes), parseReason(row.notes))}
        </span>
      ),
    },
    {
      id: "qty", header: L("পরিমাণ", "Quantity"), accessorKey: "qty", sortable: true, filterable: true,
      filterType: "number", align: "right", priority: 4, aggregate: "sum",
      cell: ({ row }) => (
        <span className={cn("font-mono font-semibold tabular-nums",
          row.type === "adjustment_in" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
          {row.type === "adjustment_in" ? "+" : "−"}
          {(row.qty ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })} {row.unit}
        </span>
      ),
    },
    {
      id: "recorded_at", header: L("তারিখ", "Date"), accessorKey: "recorded_at", sortable: true,
      filterable: true, filterType: "date", priority: 5,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
          {row.recorded_at.slice(0, 10)}
        </span>
      ),
    },
    {
      id: "notes", header: L("নোট", "Notes"), accessorKey: "notes", sortable: false, filterable: false, priority: 7,
      cell: ({ row }) => <span className="text-xs text-muted-foreground truncate block max-w-[220px]">{row.notes || "—"}</span>,
    },
  ], [L]);

  const totalSurplus = adjustments.filter((a) => a.type === "adjustment_in").reduce((s, a) => s + a.qty, 0);
  const totalShortage = adjustments.filter((a) => a.type === "adjustment_out").reduce((s, a) => s + a.qty, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border/70 bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/80">
              <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{L("মোট সমন্বয়", "Total Adjustments")}</span>
          </div>
          <p className="font-heading text-2xl font-bold text-foreground tabular-nums">{adjustments.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
              <Plus className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-emerald-600">{L("বেশি", "Surplus")}</span>
          </div>
          <p className="font-heading text-2xl font-bold text-emerald-600 tabular-nums">
            +{totalSurplus.toLocaleString("en-IN", { maximumFractionDigits: 1 })}
          </p>
        </div>
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10">
              <Minus className="h-3.5 w-3.5 text-rose-600" />
            </div>
            <span className="text-xs font-medium text-rose-600">{L("কম", "Shortage")}</span>
          </div>
          <p className="font-heading text-2xl font-bold text-rose-600 tabular-nums">
            −{totalShortage.toLocaleString("en-IN", { maximumFractionDigits: 1 })}
          </p>
        </div>
      </div>

      <EnterpriseDataGrid
        data={adjustments}
        columns={columns}
        rowKey="id"
        title={L("গণনা সমন্বয়ের তালিকা", "Adjustment Ledger")}
        subtitle={L(`${adjustments.length}টি সমন্বয় · গণনা, নষ্ট, ক্ষতি ও সংশোধন`, `${adjustments.length} stock adjustments · counts, spoilage, damage & corrections`)}
        enableGlobalSearch
        searchKeys={["itemName", "notes"]}
        searchPlaceholder={L("জিনিস বা নোট খুঁজুন…", "Search by product or notes…")}
        enableAdvancedFilter
        enableColumnVisibility
        enableColumnOrdering
        enableColumnResizing
        enableExport
        enableSavedViews
        enableSelection
        enableVirtualization
        enableKeyboardNavigation
        virtualRowHeight={64}
        responsiveMode="auto"
        density="compact"
        pageSize={20}
        pageSizeOptions={[10, 20, 50, 100]}
        onSelectionChange={(ids) => setSelectedIds(ids)}
        emptyTitle={L("কোনো সমন্বয় নেই", "No adjustments recorded")}
        emptyDescription={L("গণনা, নষ্ট বা সংশোধনের সমন্বয় এখানে দেখা যাবে।", "Stock adjustments from physical counts, spoilage or corrections will appear here.")}
        savedViewsKey="inventory-adjustments"
        striped
      />
    </div>
  );
}
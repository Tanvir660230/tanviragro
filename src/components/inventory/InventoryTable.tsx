"use client";

import { useOptimistic } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import { ItemActions, type CattleOption } from "./ItemActions";
import { ArchiveItemButton } from "./ArchiveItemButton";
import { DaysRemainingBadge } from "./DaysRemainingBadge";
import { EditItemDialog } from "./EditItemDialog";

export interface InventoryRow {
  id: string;
  name: string;
  category: string;
  unit: string;
  low_stock_threshold: number | null;
  stock: number;
  avgDailyConsumption: number | null;
  currentCost?: number | null;
  is_active_roughage?: boolean | null;
  is_discontinued?: boolean;
}

const CATEGORY_STYLE: Record<string, string> = {
  feed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  medicine: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  equipment: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
  roughage: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  other: "bg-muted text-muted-foreground",
};

function fmtCost(cost: number, unit: string) {
  return `৳${cost.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}/${unit}`;
}

export function InventoryTable({
  items,
  cattle,
}: {
  items: InventoryRow[];
  cattle: CattleOption[];
}) {
  const [optimisticItems, updateOptimistic] = useOptimistic(
    items,
    (state, { id, delta }: { id: string; delta: number }) =>
      state.map((item) =>
        item.id === id
          ? { ...item, stock: parseFloat(Math.max(0, item.stock - delta).toFixed(3)) }
          : item
      )
  );

  if (!optimisticItems.length) return null;

  return (
    <div className="hidden md:block overflow-x-auto overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Item</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Current Stock</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">FIFO Cost</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Alert At</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Days Left</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            <th className="px-4 py-3 w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {optimisticItems.map((item) => {
            const isLow =
              item.low_stock_threshold !== null &&
              item.stock <= item.low_stock_threshold;
            const isOut = item.stock <= 0;

            return (
              <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {isLow && (
                      <AlertTriangle
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isOut
                            ? "text-destructive"
                            : "text-amber-500 dark:text-amber-400"
                        )}
                      />
                    )}
                    <span className="font-medium truncate max-w-[180px] block">{item.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                      CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE.other
                    )}
                  >
                    {item.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      isOut
                        ? "text-destructive"
                        : isLow
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-foreground"
                    )}
                  >
                    {item.stock.toLocaleString("en-IN", { maximumFractionDigits: 2 })}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      {item.unit}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground text-xs tabular-nums">
                  {item.currentCost != null
                    ? fmtCost(item.currentCost, item.unit)
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {item.low_stock_threshold !== null
                    ? `${item.low_stock_threshold} ${item.unit}`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <DaysRemainingBadge
                    stock={item.stock}
                    avgDailyConsumption={item.avgDailyConsumption}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <ItemActions
                    item={item}
                    cattle={cattle}
                    onOptimisticConsume={(qty) =>
                      updateOptimistic({ id: item.id, delta: qty })
                    }
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <EditItemDialog item={item} />
                    <ArchiveItemButton id={item.id} name={item.name} isDiscontinued={item.is_discontinued ?? false} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

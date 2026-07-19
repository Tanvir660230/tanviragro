"use client";

import { useOptimistic } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import { ItemActions, type CattleOption } from "./ItemActions";
import { ArchiveItemButton } from "./ArchiveItemButton";
import { DaysRemainingBadge } from "./DaysRemainingBadge";
import type { InventoryRow } from "./InventoryTable";
import { EditItemDialog } from "./EditItemDialog";

const CATEGORY_STYLE: Record<string, string> = {
  feed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  medicine: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  equipment: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
  roughage: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  other: "bg-muted text-muted-foreground",
};

export function InventoryCards({
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
    <div className="flex flex-col gap-3 md:hidden">
      {optimisticItems.map((item) => {
        const isLow =
          item.low_stock_threshold !== null &&
          item.stock <= item.low_stock_threshold;
        const isOut = item.stock <= 0;

        return (
          <div
            key={item.id}
            className={cn(
              "rounded-xl bg-card p-4 ring-1",
              isOut
                ? "ring-destructive/40"
                : isLow
                  ? "ring-amber-400/60"
                  : "ring-foreground/10"
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-1.5">
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
                <p className="font-semibold text-sm leading-tight truncate">{item.name}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                  CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE.other
                )}
              >
                {item.category}
              </span>
            </div>

            {/* Stats */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Current Stock</dt>
                <dd
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
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Low Alert</dt>
                <dd className="font-medium text-muted-foreground">
                  {item.low_stock_threshold !== null
                    ? `${item.low_stock_threshold} ${item.unit}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Days Left</dt>
                <dd className="font-medium mt-0.5">
                  <DaysRemainingBadge
                    stock={item.stock}
                    avgDailyConsumption={item.avgDailyConsumption}
                  />
                </dd>
              </div>
              {item.currentCost != null && (
                <div>
                  <dt className="text-xs text-muted-foreground">FIFO Cost</dt>
                  <dd className="font-medium text-xs tabular-nums">
                    ৳{item.currentCost.toLocaleString("en-IN", { maximumFractionDigits: 2 })}/{item.unit}
                  </dd>
                </div>
              )}
            </dl>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-2 pt-3 border-t border-border/50">
              <div className="flex flex-wrap items-center gap-1.5 justify-start">
                <ItemActions
                  item={item}
                  cattle={cattle}
                  onOptimisticConsume={(qty) =>
                    updateOptimistic({ id: item.id, delta: qty })
                  }
                />
              </div>
              <div className="flex items-center justify-end gap-1">
                <EditItemDialog item={item} />
                <ArchiveItemButton id={item.id} name={item.name} isDiscontinued={item.is_discontinued ?? false} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

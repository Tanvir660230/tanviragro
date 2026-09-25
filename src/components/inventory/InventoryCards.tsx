"use client";

import { useOptimistic } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, ShieldAlert, Package, TrendingDown } from "lucide-react";
import { ItemActions, type CattleOption } from "./ItemActions";
import { ArchiveItemButton } from "./ArchiveItemButton";
import { DaysRemainingBadge } from "./DaysRemainingBadge";
import type { InventoryRow } from "./InventoryTable";
import { EditItemDialog } from "./EditItemDialog";
import { CategoryBadge } from "./inventory-ui";

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
    <div className="flex flex-col gap-3.5 md:hidden">
      {optimisticItems.map((item) => {
        const isOut = item.stock <= 0;
        const isLow =
          !isOut &&
          item.low_stock_threshold !== null &&
          item.stock <= item.low_stock_threshold;

        return (
          <div
            key={item.id}
            className={cn(
              "rounded-2xl bg-card p-4 border transition-all shadow-sm",
              isOut
                ? "border-rose-300/80 dark:border-rose-900/60 bg-rose-500/[0.02]"
                : isLow
                ? "border-amber-300/80 dark:border-amber-900/60 bg-amber-500/[0.02]"
                : "border-border/80"
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2.5 mb-3">
              <div className="flex items-start gap-2.5 min-w-0">
                {isOut ? (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 mt-0.5">
                    <ShieldAlert className="h-4 w-4" />
                  </span>
                ) : isLow ? (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 mt-0.5">
                    <AlertTriangle className="h-4 w-4" />
                  </span>
                ) : (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground mt-0.5">
                    <Package className="h-4 w-4" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-base leading-snug text-foreground truncate">
                    {item.name}
                  </p>
                  {item.is_active_roughage && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 mt-0.5">
                      ★ Active Roughage
                    </span>
                  )}
                </div>
              </div>

              <CategoryBadge category={item.category} />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-muted/30 border border-border/50 text-sm mb-3">
              <div>
                <span className="text-[11px] font-medium text-muted-foreground block">
                  Current Stock
                </span>
                <span
                  className={cn(
                    "font-bold tabular-nums text-sm block mt-0.5",
                    isOut
                      ? "text-rose-600 dark:text-rose-400"
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
                {item.low_stock_threshold !== null && item.low_stock_threshold > 0 && (
                  <div className="w-full h-1 bg-muted rounded-full overflow-hidden mt-1.5">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        isOut
                          ? "bg-rose-500 w-0"
                          : isLow
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      )}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(10, (item.stock / (item.low_stock_threshold * 2)) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                )}
              </div>

              <div>
                <span className="text-[11px] font-medium text-muted-foreground block">
                  Runway
                </span>
                <div className="mt-0.5">
                  <DaysRemainingBadge
                    stock={item.stock}
                    avgDailyConsumption={item.avgDailyConsumption}
                  />
                </div>
              </div>

              <div>
                <span className="text-[11px] font-medium text-muted-foreground block">
                  Avg Unit Cost
                </span>
                <span className="font-medium text-xs text-foreground tabular-nums block mt-0.5">
                  {item.currentCost != null
                    ? `৳${item.currentCost.toLocaleString("en-IN", { maximumFractionDigits: 2 })}/${item.unit}`
                    : "—"}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-muted-foreground block">
                  Total Valuation
                </span>
                <span className="font-semibold text-xs text-foreground tabular-nums block mt-0.5">
                  {item.currentCost != null && item.stock > 0
                    ? `৳${Math.round(item.stock * item.currentCost).toLocaleString("en-IN")}`
                    : "—"}
                </span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
              <div className="flex flex-wrap items-center gap-1.5">
                <ItemActions
                  item={item}
                  cattle={cattle}
                  onOptimisticConsume={(qty) =>
                    updateOptimistic({ id: item.id, delta: qty })
                  }
                />
              </div>
              <div className="flex items-center gap-1">
                <EditItemDialog item={item} />
                <ArchiveItemButton
                  id={item.id}
                  name={item.name}
                  isDiscontinued={item.is_discontinued ?? false}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

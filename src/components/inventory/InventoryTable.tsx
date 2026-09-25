"use client";

import { useState, useOptimistic, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Package,
} from "lucide-react";
import { ItemActions, type CattleOption } from "./ItemActions";
import { ArchiveItemButton } from "./ArchiveItemButton";
import { DaysRemainingBadge } from "./DaysRemainingBadge";
import { EditItemDialog } from "./EditItemDialog";
import { CategoryBadge } from "./inventory-ui";
import { useL } from "@/i18n/text";

export interface InventoryRow {
  id: string;
  name: string;
  category: string;
  unit: string;
  low_stock_threshold: number | null;
  /** signed stock on hand; negative = consumption recorded without matching stock-in */
  stock: number;
  avgDailyConsumption: number | null;
  kg_per_unit?: number | null;
  currentCost?: number | null;
  is_active_roughage?: boolean | null;
  is_discontinued?: boolean;
}

export type SortField = "name" | "category" | "stock" | "cost" | "value" | "alert" | "days";
export type SortOrder = "asc" | "desc";

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
  const L = useL();
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const [optimisticItems, updateOptimistic] = useOptimistic(
    items,
    (state, { id, delta }: { id: string; delta: number }) =>
      state.map((item) =>
        item.id === id
          ? { ...item, stock: parseFloat((item.stock - delta).toFixed(3)) }
          : item
      )
  );

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  }

  const sortedItems = useMemo(() => {
    return [...optimisticItems].sort((a, b) => {
      let comparison = 0;
      if (sortField === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === "category") {
        comparison = a.category.localeCompare(b.category);
      } else if (sortField === "stock") {
        comparison = a.stock - b.stock;
      } else if (sortField === "cost") {
        comparison = (a.currentCost ?? 0) - (b.currentCost ?? 0);
      } else if (sortField === "value") {
        const valA = a.stock * (a.currentCost ?? 0);
        const valB = b.stock * (b.currentCost ?? 0);
        comparison = valA - valB;
      } else if (sortField === "alert") {
        comparison = (a.low_stock_threshold ?? 0) - (b.low_stock_threshold ?? 0);
      } else if (sortField === "days") {
        const daysA = a.avgDailyConsumption ? a.stock / a.avgDailyConsumption : 99999;
        const daysB = b.avgDailyConsumption ? b.stock / b.avgDailyConsumption : 99999;
        comparison = daysA - daysB;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [optimisticItems, sortField, sortOrder]);

  if (!sortedItems.length) return null;

  return (
    <div className="hidden md:block overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-border/80 bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 select-none">
              <th scope="col" className="py-3.5 pl-5 pr-3">
                <button
                  type="button"
                  onClick={() => handleSort("name")}
                  className="group flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wider hover:text-foreground transition-colors"
                >
                  <span>{L("জিনিস", "Item")}</span>
                  {sortField === "name" ? (
                    sortOrder === "asc" ? <ArrowUp className="h-3.5 w-3.5 text-primary" /> : <ArrowDown className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <ArrowUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50" />
                  )}
                </button>
              </th>
              <th scope="col" className="px-3 py-3.5">
                <button
                  type="button"
                  onClick={() => handleSort("category")}
                  className="group flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wider hover:text-foreground transition-colors"
                >
                  <span>{L("ধরন", "Category")}</span>
                  {sortField === "category" ? (
                    sortOrder === "asc" ? <ArrowUp className="h-3.5 w-3.5 text-primary" /> : <ArrowDown className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <ArrowUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50" />
                  )}
                </button>
              </th>
              <th scope="col" className="px-3 py-3.5 text-right">
                <button
                  type="button"
                  onClick={() => handleSort("stock")}
                  className="group ml-auto flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wider hover:text-foreground transition-colors"
                >
                  <span>{L("স্টক", "Stock")}</span>
                  {sortField === "stock" ? (
                    sortOrder === "asc" ? <ArrowUp className="h-3.5 w-3.5 text-primary" /> : <ArrowDown className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <ArrowUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50" />
                  )}
                </button>
              </th>
              <th scope="col" className="px-3 py-3.5 text-right">
                <button
                  type="button"
                  onClick={() => handleSort("cost")}
                  className="group ml-auto flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wider hover:text-foreground transition-colors"
                >
                  <span>{L("গড় দাম", "Avg unit cost")}</span>
                  {sortField === "cost" ? (
                    sortOrder === "asc" ? <ArrowUp className="h-3.5 w-3.5 text-primary" /> : <ArrowDown className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <ArrowUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50" />
                  )}
                </button>
              </th>
              <th scope="col" className="px-3 py-3.5 text-right">
                <button
                  type="button"
                  onClick={() => handleSort("alert")}
                  className="group ml-auto flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wider hover:text-foreground transition-colors"
                >
                  <span>{L("সতর্কতার সীমা", "Alert level")}</span>
                  {sortField === "alert" ? (
                    sortOrder === "asc" ? <ArrowUp className="h-3.5 w-3.5 text-primary" /> : <ArrowDown className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <ArrowUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50" />
                  )}
                </button>
              </th>
              <th scope="col" className="px-3 py-3.5 text-right">
                <button
                  type="button"
                  onClick={() => handleSort("days")}
                  className="group ml-auto flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wider hover:text-foreground transition-colors"
                >
                  <span>{L("কদিন চলবে", "Runway")}</span>
                  {sortField === "days" ? (
                    sortOrder === "asc" ? <ArrowUp className="h-3.5 w-3.5 text-primary" /> : <ArrowDown className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <ArrowUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50" />
                  )}
                </button>
              </th>
              <th scope="col" className="px-4 py-3.5 text-right font-semibold text-xs uppercase tracking-wider">
                {L("কাজ", "Quick Actions")}
              </th>
              <th scope="col" className="py-3.5 pr-4 pl-1 w-16 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 bg-card">
            {sortedItems.map((item) => {
              const isOut = item.stock <= 0;
              const isLow =
                !isOut &&
                item.low_stock_threshold !== null &&
                item.stock <= item.low_stock_threshold;

              return (
                <tr
                  key={item.id}
                  className={cn(
                    "group transition-colors hover:bg-muted/30",
                    isOut
                      ? "bg-rose-500/[0.02]"
                      : isLow
                      ? "bg-amber-500/[0.02]"
                      : ""
                  )}
                >
                  {/* Name */}
                  <td className="py-3.5 pl-5 pr-3">
                    <div className="flex items-center gap-2.5">
                      {isOut ? (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </span>
                      ) : isLow ? (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          <Package className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <div>
                        <span className="font-semibold text-foreground tracking-tight text-sm block">
                          {item.name}
                        </span>
                        {item.is_active_roughage && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                            ★ Active Roughage
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="px-3 py-3.5">
                    <CategoryBadge category={item.category} />
                  </td>
                  {/* Stock */}
                  <td className="px-3 py-3.5 text-right">
                    <div className="inline-flex flex-col items-end">
                      <span
                        className={cn(
                          "font-bold tabular-nums text-sm",
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
                      {item.stock < 0 && (
                        <span className="mt-0.5 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                          {L("স্টক ঋণাত্মক — কোনো কেনা বা গোনা লেখা হয়নি", "Negative stock — a purchase or count is missing")}
                        </span>
                      )}
                      {item.low_stock_threshold !== null && item.low_stock_threshold > 0 && (
                        <div className="w-16 h-1 bg-muted rounded-full overflow-hidden mt-1">
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
                  </td>

                  {/* Weighted-average unit cost */}
                  <td className="px-3 py-3.5 text-right">
                    {item.currentCost != null ? (
                      <span className="text-xs font-medium text-foreground tabular-nums">
                        {fmtCost(item.currentCost, item.unit)}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-700 dark:text-amber-400">{L("দাম জানা নেই", "Cost unknown")}</span>
                    )}
                  </td>

                  {/* Alert Threshold */}
                  <td className="px-3 py-3.5 text-right text-xs text-muted-foreground tabular-nums">
                    {item.low_stock_threshold !== null ? (
                      <span>
                        {item.low_stock_threshold}{" "}
                        <span className="text-[10px] uppercase">{item.unit}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>

                  {/* Runway / Days Left */}
                  <td className="px-3 py-3.5 text-right">
                    <DaysRemainingBadge
                      stock={item.stock}
                      avgDailyConsumption={item.avgDailyConsumption}
                    />
                  </td>

                  {/* Quick Actions */}
                  <td className="px-4 py-3.5 text-right">
                    <ItemActions
                      item={item}
                      cattle={cattle}
                      onOptimisticConsume={(qty) =>
                        updateOptimistic({ id: item.id, delta: qty })
                      }
                    />
                  </td>

                  {/* Edit / Archive options */}
                  <td className="py-3.5 pr-4 pl-1 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <EditItemDialog item={item} />
                      <ArchiveItemButton
                        id={item.id}
                        name={item.name}
                        isDiscontinued={item.is_discontinued ?? false}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

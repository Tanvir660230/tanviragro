"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { InventoryTable, type InventoryRow } from "./InventoryTable";
import { InventoryCards } from "./InventoryCards";
import type { CattleOption } from "./ItemActions";
import { useTranslation } from "@/i18n/I18nProvider";
import {
  Search,
  X,
  PackageOpen,
  LayoutGrid,
  Table as TableIcon,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";
import { CATEGORY_CONFIG } from "./inventory-ui";

type TabKey = "all" | "feed" | "roughage" | "medicine" | "equipment" | "other";
type HealthFilter = "all" | "low" | "out" | "normal";

function matchesTab(item: InventoryRow, tab: TabKey): boolean {
  if (tab === "all") return true;
  if (tab === "feed") return item.category === "feed";
  if (tab === "roughage") return item.category === "roughage";
  if (tab === "medicine") return item.category === "medicine";
  if (tab === "equipment") return item.category === "equipment";
  return item.category === "other" || item.category === "supplies";
}

export function StockSection({
  items,
  discontinuedItems = [],
  cattle,
}: {
  items: InventoryRow[];
  discontinuedItems?: InventoryRow[];
  cattle: CattleOption[];
}) {
  const { t } = useTranslation();
  const tr = t.inventory.stock;
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [healthFilter, setHealthFilter] = useState<HealthFilter>("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        setSearch("");
        searchInputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "all", label: "All Items" },
    { key: "feed", label: "Concentrate Feed" },
    { key: "roughage", label: "Roughage & Fodder" },
    { key: "medicine", label: "Medicine & Health" },
    { key: "equipment", label: "Equipment" },
    { key: "other", label: "Supplies & Other" },
  ];

  const lowStockCount = items.filter(
    (i) => i.stock > 0 && i.low_stock_threshold !== null && i.stock <= i.low_stock_threshold
  ).length;
  const outOfStockCount = items.filter((i) => i.stock <= 0).length;

  const filtered = useMemo(() => {
    return items
      .filter((i) => matchesTab(i, activeTab))
      .filter((i) => {
        if (healthFilter === "all") return true;
        if (healthFilter === "out") return i.stock <= 0;
        if (healthFilter === "low") {
          return i.stock > 0 && i.low_stock_threshold !== null && i.stock <= i.low_stock_threshold;
        }
        if (healthFilter === "normal") {
          return i.stock > 0 && (i.low_stock_threshold === null || i.stock > i.low_stock_threshold);
        }
        return true;
      })
      .filter(
        (i) =>
          !search ||
          i.name.toLowerCase().includes(search.toLowerCase()) ||
          i.category.toLowerCase().includes(search.toLowerCase())
      );
  }, [items, activeTab, healthFilter, search]);

  const totalFilteredValue = filtered.reduce(
    (sum, item) => sum + item.stock * (item.currentCost ?? 0),
    0
  );

  return (
    <div className="space-y-4">
      {/* Control Bar: Categories, Filters, Search & View Mode */}
      <div className="flex flex-col gap-3">
        {/* Row 1: Category tabs & Desktop View Switcher */}
        <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 scrollbar-none">
          <div className="flex gap-1.5 items-center p-1 rounded-2xl bg-muted/40 border border-border/50">
            {tabs.map((tab) => {
              const count =
                tab.key === "all"
                  ? items.length
                  : items.filter((i) => matchesTab(i, tab.key)).length;
              if (count === 0 && tab.key !== "all") return null;

              const conf = tab.key !== "all" ? CATEGORY_CONFIG[tab.key] : null;
              const Icon = conf?.icon;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5",
                    activeTab === tab.key
                      ? "bg-card text-foreground shadow-sm border border-border/80"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  {Icon && <Icon className="h-3.5 w-3.5 opacity-70" />}
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      "text-[10px] rounded-md px-1.5 py-0.2 font-mono tabular-nums",
                      activeTab === tab.key
                        ? "bg-primary/10 text-primary font-bold"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Desktop View toggle buttons */}
          <div className="hidden sm:flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border/50">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Table View"
              className={cn(
                "p-1.5 rounded-lg text-xs font-medium transition-colors",
                viewMode === "table"
                  ? "bg-card text-foreground shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TableIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              title="Cards Grid View"
              className={cn(
                "p-1.5 rounded-lg text-xs font-medium transition-colors",
                viewMode === "cards"
                  ? "bg-card text-foreground shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Row 2: Search Box + Stock Status Filter Pills */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Stock Health filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            <button
              type="button"
              onClick={() => setHealthFilter("all")}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap",
                healthFilter === "all"
                  ? "bg-card text-foreground border-border font-semibold shadow-xs"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              All Status
            </button>
            {lowStockCount > 0 && (
              <button
                type="button"
                onClick={() => setHealthFilter(healthFilter === "low" ? "all" : "low")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap",
                  healthFilter === "low"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 font-semibold"
                    : "border-amber-500/20 text-amber-600/90 hover:bg-amber-500/10"
                )}
              >
                <AlertTriangle className="h-3 w-3" />
                <span>Low Stock ({lowStockCount})</span>
              </button>
            )}
            {outOfStockCount > 0 && (
              <button
                type="button"
                onClick={() => setHealthFilter(healthFilter === "out" ? "all" : "out")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap",
                  healthFilter === "out"
                    ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40 font-semibold"
                    : "border-rose-500/20 text-rose-600/90 hover:bg-rose-500/10"
                )}
              >
                <ShieldAlert className="h-3 w-3" />
                <span>Depleted ({outOfStockCount})</span>
              </button>
            )}
          </div>

          {/* Inline search bar */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items (/ to focus)…"
              className="w-full rounded-xl border border-border/80 bg-card pl-9 pr-8 py-1.5 text-sm placeholder:text-muted-foreground/60 shadow-xs focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/60 font-mono bg-muted px-1.5 py-0.5 rounded border border-border/60 pointer-events-none">
                /
              </kbd>
            )}
          </div>
        </div>
      </div>

      {/* Summary Meta Bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          Showing <span className="font-semibold text-foreground font-mono">{filtered.length}</span> of{" "}
          <span className="font-mono">{items.length}</span> items
        </span>
        {totalFilteredValue > 0 && (
          <span>
            Valuation:{" "}
            <span className="font-semibold text-foreground font-mono">
              ৳{Math.round(totalFilteredValue).toLocaleString("en-IN")}
            </span>
          </span>
        )}
      </div>

      {/* Active stock list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-border/80 bg-muted/10">
          <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground mb-3">
            <PackageOpen className="h-6 w-6" />
          </div>
          <p className="font-semibold text-foreground text-sm">{tr.empty_filter}</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {search ? `No items found matching "${search}". Try resetting your search filter.` : "No items available in this category yet."}
          </p>
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="mt-3 text-xs font-semibold text-primary hover:underline"
            >
              Clear Search Query
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile view */}
          <div className="sm:hidden">
            <InventoryCards items={filtered} cattle={cattle} />
          </div>

          {/* Desktop view */}
          <div className="hidden sm:block">
            {viewMode === "table" ? (
              <InventoryTable items={filtered} cattle={cattle} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                <InventoryCards items={filtered} cattle={cattle} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}


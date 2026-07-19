"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { InventoryTable, type InventoryRow } from "./InventoryTable";
import { InventoryCards } from "./InventoryCards";
import { ArchiveItemButton } from "./ArchiveItemButton";
import type { CattleOption } from "./ItemActions";
import { useTranslation } from "@/i18n/I18nProvider";
import { Archive, ChevronDown, Search, X } from "lucide-react";

type TabKey = "all" | "feed" | "supplement" | "medicine" | "other";

function matchesTab(item: InventoryRow, tab: TabKey): boolean {
  if (tab === "all") return true;
  if (tab === "feed") return item.category === "feed" || item.category === "roughage";
  if (tab === "supplement") return item.category === "supplement";
  if (tab === "medicine") return item.category === "medicine";
  return item.category === "equipment" || item.category === "other";
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
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [search, setSearch] = useState("");

  const tabs: { key: TabKey; label: string }[] = [
    { key: "all", label: tr.filter_all },
    { key: "feed", label: tr.filter_feed },
    { key: "supplement", label: tr.filter_supplement },
    { key: "medicine", label: tr.filter_medicine },
    { key: "other", label: tr.filter_other },
  ];

  const filtered = items
    .filter((i) => matchesTab(i, activeTab))
    .filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        {tabs.map((tab) => {
          const count = tab.key === "all"
            ? items.length
            : items.filter((i) => matchesTab(i, tab.key)).length;
          if (count === 0 && tab.key !== "all") return null;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                activeTab === tab.key
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/60"
              )}
            >
              {tab.label}
              <span className={cn("ml-1.5 tabular-nums", activeTab === tab.key ? "opacity-70" : "opacity-50")}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Inline search — only shows when enough items */}
      {items.length > 5 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items…"
            className="w-full rounded-xl border border-border bg-muted/30 pl-9 pr-8 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Active stock list */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">{tr.empty_filter}</p>
      ) : (
        <>
          <div className="md:hidden">
            <InventoryCards items={filtered} cattle={cattle} />
          </div>
          <div className="hidden md:block">
            <InventoryTable items={filtered} cattle={cattle} />
          </div>
        </>
      )}

      {/* Archived (discontinued) section hidden as per user request */}
    </div>
  );
}

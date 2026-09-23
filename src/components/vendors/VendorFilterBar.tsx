"use client";

import { Search, X, LayoutGrid, Table as TableIcon, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/i18n/getDictionary";
import { CreateVendorDialog } from "./CreateVendorDialog";
import type { SortKey } from "./vendor-types";

export function VendorFilterBar({
  search,
  setSearch,
  selectedType,
  setSelectedType,
  sortBy,
  setSortBy,
  viewMode,
  setViewMode,
  onExport,
  open,
  setOpen,
  t,
}: {
  search: string;
  setSearch: (s: string) => void;
  selectedType: string;
  setSelectedType: (s: string) => void;
  sortBy: SortKey;
  setSortBy: (s: SortKey) => void;
  viewMode: "grid" | "table";
  setViewMode: (m: "grid" | "table") => void;
  onExport: () => void;
  open: boolean;
  setOpen: (o: boolean) => void;
  t: Dictionary;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors by name, phone, address or notes..."
            className="pl-9 pr-8 h-9 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
          <div className="flex items-center rounded-lg border border-border/80 bg-muted/30 p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1",
                viewMode === "grid"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Cards</span>
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "p-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1",
                viewMode === "table"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Table view"
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Table</span>
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            className="h-9 gap-1.5 text-xs font-medium"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>

          <CreateVendorDialog open={open} setOpen={setOpen} t={t} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "all", label: "All Vendors" },
            { id: "cattle", label: "Cattle" },
            { id: "feed", label: "Feed" },
            { id: "medicine", label: "Medicine" },
            { id: "other", label: "Other" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedType(cat.id)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                selectedType === cat.id
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">Sort:</span>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="h-8 text-xs w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="spend-desc">Highest Spend</SelectItem>
              <SelectItem value="cattle-desc">Most Cattle Sourced</SelectItem>
              <SelectItem value="name-asc">Name (A-Z)</SelectItem>
              <SelectItem value="newest">Newest Added</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

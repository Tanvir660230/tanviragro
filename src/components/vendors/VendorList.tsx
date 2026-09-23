"use client";

import { useState, useMemo } from "react";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/I18nProvider";
import { toast } from "sonner";
import { VendorStatCards } from "./VendorStatCards";
import { VendorFilterBar } from "./VendorFilterBar";
import { VendorCard } from "./VendorCard";
import { VendorTable } from "./VendorTable";
import type { EnrichedVendor, SortKey } from "./vendor-types";

export type { EnrichedVendor };

export function VendorList({ vendors }: { vendors: EnrichedVendor[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("spend-desc");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const totalVendors = vendors.length;
  const totalSpend = vendors.reduce((s, v) => s + (v.totalPurchase || 0), 0);
  const totalCattleSourced = vendors.reduce((s, v) => s + (v.cattleCount || 0), 0);
  const totalInventorySuppliers = vendors.filter(
    (v) => v.itemCount > 0 || v.type === "feed" || v.type === "medicine"
  ).length;

  const filteredAndSortedVendors = useMemo(() => {
    const result = vendors.filter((v) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        v.name.toLowerCase().includes(q) ||
        v.phone?.toLowerCase().includes(q) ||
        v.address?.toLowerCase().includes(q) ||
        v.notes?.toLowerCase().includes(q) ||
        v.type.toLowerCase().includes(q);

      const matchesType = selectedType === "all" || v.type === selectedType;
      return matchesSearch && matchesType;
    });

    result.sort((a, b) => {
      if (sortBy === "spend-desc") return (b.totalPurchase || 0) - (a.totalPurchase || 0);
      if (sortBy === "cattle-desc") return (b.cattleCount || 0) - (a.cattleCount || 0);
      if (sortBy === "name-asc") return a.name.localeCompare(b.name);
      if (sortBy === "newest")
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return 0;
    });

    return result;
  }, [vendors, search, selectedType, sortBy]);

  function exportToCsv() {
    if (filteredAndSortedVendors.length === 0) {
      toast.error("No vendors to export");
      return;
    }
    const headers = [
      "Name",
      "Type",
      "Phone",
      "Address",
      "Cattle Supplied",
      "Inventory Items",
      "Total Purchase (BDT)",
      "Notes",
    ];
    const rows = filteredAndSortedVendors.map((v) => [
      `"${v.name.replace(/"/g, '""')}"`,
      `"${v.type}"`,
      `"${v.phone ?? ""}"`,
      `"${(v.address ?? "").replace(/"/g, '""')}"`,
      v.cattleCount || 0,
      v.itemCount || 0,
      v.totalPurchase || 0,
      `"${(v.notes ?? "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `vendor_directory_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Vendor directory exported to CSV");
  }

  return (
    <div className="space-y-5">
      <VendorStatCards
        totalVendors={totalVendors}
        totalSpend={totalSpend}
        totalCattleSourced={totalCattleSourced}
        totalInventorySuppliers={totalInventorySuppliers}
      />

      <VendorFilterBar
        search={search}
        setSearch={setSearch}
        selectedType={selectedType}
        setSelectedType={setSelectedType}
        sortBy={sortBy}
        setSortBy={setSortBy}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onExport={exportToCsv}
        open={open}
        setOpen={setOpen}
        t={t}
      />

      {filteredAndSortedVendors.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 py-12 text-center bg-card/40">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/80">
            <Store className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold">{t.vendors.no_vendors}</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            {search || selectedType !== "all"
              ? "No vendors match your search and filter criteria."
              : t.vendors.no_vendors_desc}
          </p>
          {(search || selectedType !== "all") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setSelectedType("all");
              }}
              className="mt-4 text-xs"
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAndSortedVendors.map((v) => (
            <VendorCard key={v.id} vendor={v} t={t} />
          ))}
        </div>
      ) : (
        <VendorTable vendors={filteredAndSortedVendors} t={t} />
      )}
    </div>
  );
}

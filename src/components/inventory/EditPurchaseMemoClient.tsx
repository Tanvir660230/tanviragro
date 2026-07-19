"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Search, Check, AlertTriangle, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { updatePurchaseMemo, deletePurchaseMemo } from "@/app/dashboard/(app)/inventory/purchase/history/actions";

type InventoryItem = { id: string; name: string; category: string; unit: string };
type RowMode = "bags" | "loose";
type RowData = {
  id?: string; // missing if new row
  uiId: string;
  isNew: boolean;
  itemId: string;
  newItemName: string;
  newItemCategory: string;
  newItemUnit: string;
  mode: RowMode;
  bags: string;
  kgPerBag: string;
  looseQty: string;
  totalCost: string;
  costMode: "total" | "unit";
  unitCostInput: string;
  searchQuery: string;
  showDropdown: boolean;
};

const CATEGORIES = [
  { value: "feed", label: "Feed" },
  { value: "roughage", label: "Roughage" },
  { value: "medicine", label: "Medicine" },
  { value: "equipment", label: "Equipment" },
  { value: "supplies", label: "General Supplies" },
];

const UNITS = [
  { value: "kg", label: "KG" },
  { value: "pcs", label: "Pieces" },
  { value: "ml", label: "ML" },
  { value: "L", label: "Liters" },
  { value: "feed-kg", label: "Feed-KG (Supplement)" },
];

let _rowIdCounter = 0;
function genRowId() { return `row-${++_rowIdCounter}`; }

export function EditPurchaseMemoClient({ 
  date, 
  supplierName, 
  existingTxns, 
  extraNotes,
  initialTransportCost = 0,
  items 
}: { 
  date: string, 
  supplierName: string, 
  existingTxns: any[], 
  extraNotes: string,
  initialTransportCost?: number,
  items: InventoryItem[] 
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);

  const [notes, setNotes] = useState(extraNotes || "");
  const [transportCost, setTransportCost] = useState(initialTransportCost.toString() || "");

  // Convert existing txns to rows
  const initialRows: RowData[] = existingTxns.map(tx => {
    const matchedItem = items.find(i => i.id === tx.item_id);
    return {
      id: tx.id,
      uiId: genRowId(),
      isNew: false,
      itemId: tx.item_id,
      newItemName: "",
      newItemCategory: "feed",
      newItemUnit: "kg",
      mode: tx.mode || "loose",
      bags: tx.bags || "",
      kgPerBag: tx.kgPerBag || "",
      looseQty: tx.qty.toString(),
      totalCost: (tx.raw_total_cost || (tx.qty * (tx.unit_cost || 0))).toFixed(2),
      costMode: "total",
      unitCostInput: "",
      searchQuery: matchedItem?.name || "",
      showDropdown: false,
    };
  });

  const [rows, setRows] = useState<RowData[]>(initialRows.length ? initialRows : [createEmptyRow()]);

  function createEmptyRow(): RowData {
    return {
      uiId: genRowId(),
      isNew: false,
      itemId: "",
      newItemName: "",
      newItemCategory: "feed",
      newItemUnit: "kg",
      mode: "bags",
      bags: "",
      kgPerBag: "",
      looseQty: "",
      totalCost: "",
      costMode: "total",
      unitCostInput: "",
      searchQuery: "",
      showDropdown: false,
    };
  }

  function addRow() {
    setRows([...rows, createEmptyRow()]);
  }

  function updateRow(uiId: string, field: keyof RowData, value: any) {
    setRows(prevRows => prevRows.map(r => r.uiId === uiId ? { ...r, [field]: value } : r));
  }

  function removeRow(uiId: string) {
    if (rows.length === 1) return;
    setRows(rows.filter(r => r.uiId !== uiId));
  }

  const rawItemsTotal = rows.reduce((sum, r) => sum + (parseFloat(r.totalCost) || 0), 0);
  const parsedTransport = parseFloat(transportCost) || 0;
  const totalBill = rawItemsTotal + parsedTransport;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (rows.length === 0) {
      toast.error("Please add at least one item.");
      return;
    }

    const formattedItems = rows.map((r) => {
      let qty = 0;
      if (r.mode === "bags") {
        qty = (parseFloat(r.bags) || 0) * (parseFloat(r.kgPerBag) || 0);
      } else {
        qty = parseFloat(r.looseQty) || 0;
      }
      return {
        id: r.id,
        isNew: r.isNew,
        itemId: r.itemId,
        newItemName: r.newItemName,
        newItemCategory: r.newItemCategory,
        newItemUnit: r.newItemUnit,
        qty: qty,
        itemTotalCost: parseFloat(r.totalCost) || 0,
        mode: r.mode,
        bags: r.bags,
        kgPerBag: r.kgPerBag,
      };
    });

    for (const item of formattedItems) {
      if (item.qty <= 0) {
        toast.error("Quantity must be greater than 0 for all items.");
        return;
      }
      if (item.isNew && !item.newItemName.trim()) {
        toast.error("New items must have a name.");
        return;
      }
      if (!item.isNew && !item.itemId) {
        toast.error("Please select an item or create a new one.");
        return;
      }
    }

    const existingIds = existingTxns.map(t => t.id);

    startTransition(async () => {
      const result = await updatePurchaseMemo(date, supplierName, notes, parsedTransport, formattedItems, existingIds);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Purchase memo updated successfully!");
        router.push("/dashboard/inventory/purchase/history");
      }
    });
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this memo? This will remove all associated inventory items.")) return;
    
    setIsDeleting(true);
    const existingIds = existingTxns.map(t => t.id);
    const result = await deletePurchaseMemo(date, supplierName, existingIds);
    if (result.error) {
      toast.error(result.error);
      setIsDeleting(false);
    } else {
      toast.success("Purchase memo deleted successfully!");
      router.push("/dashboard/inventory/purchase/history");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 0. Real-time Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-card border border-border shadow-card rounded-xl p-4 flex flex-col justify-center items-center text-center">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Items</span>
          <span className="text-2xl font-bold text-primary">{rows.filter(r => r.itemId || r.isNew).length}</span>
        </div>
        <div className="bg-card border border-border shadow-card rounded-xl p-4 flex flex-col justify-center items-center text-center">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Total Bill</span>
          <span className="text-2xl font-bold text-foreground">{totalBill.toLocaleString()} ৳</span>
        </div>
      </div>

      {/* 1. Memo Details */}
      <div className="glass-panel p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div className="space-y-1.5">
             <Label>Date</Label>
             <Input value={date} disabled />
           </div>
           <div className="space-y-1.5">
             <Label>Supplier Name</Label>
             <Input value={supplierName} disabled />
           </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
           <div className="space-y-1.5">
             <Label>Transport / Loading Cost (৳)</Label>
             <Input type="number" min="0" step="0.01" value={transportCost} onChange={e => setTransportCost(e.target.value)} placeholder="0" />
             <p className="text-xs text-muted-foreground">Automatically distributed to item unit costs.</p>
           </div>
           <div className="space-y-1.5">
             <Label>Extra Notes</Label>
             <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
           </div>
        </div>
      </div>

      {/* 2. Items List */}
      <div className="glass-panel border-primary/10 shadow-md">
        <div className="border-b border-border bg-muted/30 px-5 py-4 rounded-t-2xl">
          <h2 className="text-sm font-semibold text-foreground">Purchased Items</h2>
        </div>
        <div className="divide-y divide-border bg-background">
          {rows.map((row, idx) => (
            <ItemRow
              key={row.uiId}
              row={row}
              idx={idx}
              items={items}
              updateRow={updateRow}
              removeRow={removeRow}
              canRemove={rows.length > 1}
            />
          ))}
        </div>
        <div className="p-4 bg-muted/20 border-t border-border flex justify-between items-center rounded-b-2xl">
          <Button type="button" variant="outline" onClick={addRow} className="border-dashed border-primary/30 text-primary hover:bg-primary/5 hover:text-primary rounded-full px-6 transition-all shadow-card">
            <Plus className="mr-2 h-4 w-4" /> Add Another Item
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting || isPending} className="rounded-full shadow-card">
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />} Delete Memo
          </Button>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" size="lg" className="w-full md:w-auto px-10 shadow-md" disabled={isPending || totalBill <= 0}>
            {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Check className="mr-2 h-4 w-4" /> Save Changes</>}
        </Button>
      </div>
    </form>
  );
}

// ── Item Row Component ────────────────────────────────────────────────────────

function ItemRow({ row, idx, items, updateRow, removeRow, canRemove }: {
  row: RowData;
  idx: number;
  items: InventoryItem[];
  updateRow: (uiId: string, field: keyof RowData, value: any) => void;
  removeRow: (uiId: string) => void;
  canRemove: boolean;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        updateRow(row.uiId, "showDropdown", false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [row.uiId, updateRow]);

  // Auto-calculate Total Cost if in "unit" mode
  useEffect(() => {
    if (row.costMode === "unit") {
      let qty = 0;
      if (row.mode === "bags") {
        qty = parseFloat(row.bags) || 0; // if per bag, multiply by bags
      } else {
        qty = parseFloat(row.looseQty) || 0; // if loose, multiply by total units
      }
      const unitCost = parseFloat(row.unitCostInput) || 0;
      const calculatedTotal = (qty * unitCost).toFixed(2);
      if (calculatedTotal !== row.totalCost) {
        updateRow(row.uiId, "totalCost", calculatedTotal);
      }
    }
  }, [row.costMode, row.mode, row.bags, row.looseQty, row.unitCostInput, row.uiId, updateRow, row.totalCost]);

  const filteredItems = items.filter(i => i.name.toLowerCase().includes(row.searchQuery.toLowerCase()));
  const exactMatch = row.searchQuery.trim().length > 0 && items.find(i => i.name.toLowerCase() === row.searchQuery.trim().toLowerCase());
  const showCreateOption = !exactMatch;

  const selectedItem = items.find(i => i.id === row.itemId);
  const displayLabel = row.isNew ? row.newItemName : (selectedItem ? selectedItem.name : "");

  let totalKg = 0;
  if (row.mode === "bags") {
     totalKg = (parseFloat(row.bags) || 0) * (parseFloat(row.kgPerBag) || 0);
  } else {
     totalKg = parseFloat(row.looseQty) || 0;
  }
  let currentUnitCost = 0;
  const totalCostVal = parseFloat(row.totalCost) || 0;
  if (totalKg > 0) {
     currentUnitCost = totalCostVal / totalKg;
  }

  return (
    <div className="p-5 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr_1fr_40px] gap-6 items-start relative hover:bg-muted/10 transition-colors group">
      {/* 1. Item Selection */}
      <div className="space-y-1.5" ref={wrapperRef}>
        <Label>Item {idx + 1}</Label>
        {!row.isNew && row.itemId ? (
          <div className="flex items-center gap-2 bg-muted/50 border border-input rounded-xl px-3 py-2 text-sm">
            <span className="flex-1 truncate">{displayLabel}</span>
            <span className="text-xs text-muted-foreground uppercase">{selectedItem?.unit}</span>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 ml-1" onClick={() => {
              updateRow(row.uiId, "itemId", "");
              updateRow(row.uiId, "searchQuery", "");
            }}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ) : row.isNew ? (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 flex-1">
                <Label className="text-xs text-primary uppercase flex items-center gap-1"><PlusCircle className="h-3 w-3" /> New Item Name *</Label>
                <Input 
                  value={row.newItemName} 
                  onChange={e => updateRow(row.uiId, "newItemName", e.target.value)}
                  className="h-8 text-sm"
                  placeholder="Enter item name..."
                  required
                />
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => updateRow(row.uiId, "isNew", false)}>
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs uppercase">Category</Label>
                <Select value={row.newItemCategory} onValueChange={v => updateRow(row.uiId, "newItemCategory", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase">Unit</Label>
                <Select value={row.newItemUnit} onValueChange={v => updateRow(row.uiId, "newItemUnit", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map(c => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                value={row.searchQuery}
                onChange={e => {
                  updateRow(row.uiId, "searchQuery", e.target.value);
                  updateRow(row.uiId, "showDropdown", true);
                }}
                onFocus={() => updateRow(row.uiId, "showDropdown", true)}
                placeholder="Search items..."
                className="pl-9"
              />
            </div>
            {row.showDropdown && (
              <div className="absolute top-full mt-1 w-full z-10 bg-background border border-border rounded-xl shadow-lg overflow-hidden flex flex-col max-h-60">
                <div className="overflow-y-auto p-1">
                  {filteredItems.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-lg flex items-center justify-between"
                      onClick={() => {
                        updateRow(row.uiId, "itemId", item.id);
                        updateRow(row.uiId, "showDropdown", false);
                        if (item.unit !== "kg" && item.unit !== "L") {
                          updateRow(row.uiId, "mode", "loose");
                        }
                      }}
                    >
                      <span>{item.name}</span>
                      <span className="text-xs text-muted-foreground uppercase">{item.unit}</span>
                    </button>
                  ))}
                  {filteredItems.length === 0 && !showCreateOption && (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">No items found</div>
                  )}
                  {showCreateOption && (
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm bg-primary/10 text-primary hover:bg-primary/20 rounded-lg flex items-center mt-1 border border-primary/20"
                      onClick={() => {
                        updateRow(row.uiId, "isNew", true);
                        updateRow(row.uiId, "newItemName", row.searchQuery.trim() || "New Item");
                        updateRow(row.uiId, "showDropdown", false);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" /> 
                      {row.searchQuery.trim() ? `Create "${row.searchQuery}"` : "Add New Item"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Quantity Input */}
      <div className="space-y-1.5 min-w-[280px]">
        <div className="flex items-center justify-between">
          <Label>Quantity</Label>
          <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
            <button
              type="button"
              className={`px-2 py-0.5 text-xs font-medium rounded-sm transition-colors ${row.mode === "bags" ? "bg-background shadow-card" : "text-muted-foreground"}`}
              onClick={() => updateRow(row.uiId, "mode", "bags")}
            >
              Bags/Batches
            </button>
            <button
              type="button"
              className={`px-2 py-0.5 text-xs font-medium rounded-sm transition-colors ${row.mode === "loose" ? "bg-background shadow-card" : "text-muted-foreground"}`}
              onClick={() => updateRow(row.uiId, "mode", "loose")}
            >
              Total Loose
            </button>
          </div>
        </div>
        
        {row.mode === "bags" ? (
          <div className="flex items-center">
            <div className="relative flex-1">
              <Input type="number" min="0" step="0.01" value={row.bags} onChange={e => updateRow(row.uiId, "bags", e.target.value)} placeholder="0" className="pr-12 rounded-r-none focus:z-10" required />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">Bags</span>
            </div>
            <div className="bg-muted border-y border-input px-3 h-9 flex items-center justify-center text-xs text-muted-foreground">
              ×
            </div>
            <div className="relative flex-1">
              <Input type="number" min="0" step="0.01" value={row.kgPerBag} onChange={e => updateRow(row.uiId, "kgPerBag", e.target.value)} placeholder="0" className="pr-10 rounded-l-none focus:z-10" required />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">KG</span>
            </div>
          </div>
        ) : (
          <div className="relative">
            <Input type="number" min="0" step="0.01" value={row.looseQty} onChange={e => updateRow(row.uiId, "looseQty", e.target.value)} placeholder="e.g. 500" required />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground uppercase">
              {row.isNew ? row.newItemUnit : (selectedItem?.unit || "Unit")}
            </span>
          </div>
        )}
      </div>

      {/* 3. Item Total Cost & Analytics */}
      <div className="space-y-1.5 min-w-[200px] flex-1">
        <div className="flex items-center justify-between">
          <Label>Price (৳) *</Label>
          <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
            <button
              type="button"
              className={`px-2 py-0.5 text-xs font-medium rounded-sm transition-colors ${row.costMode === "total" ? "bg-background shadow-card" : "text-muted-foreground"}`}
              onClick={() => updateRow(row.uiId, "costMode", "total")}
            >
              Total Cost
            </button>
            <button
              type="button"
              className={`px-2 py-0.5 text-xs font-medium rounded-sm transition-colors ${row.costMode === "unit" ? "bg-background shadow-card" : "text-muted-foreground"}`}
              onClick={() => updateRow(row.uiId, "costMode", "unit")}
            >
              {row.mode === "bags" ? "Per Bag" : "Per Unit"}
            </button>
          </div>
        </div>

        <div className="flex items-center">
          {row.costMode === "total" ? (
            <div className="relative flex-1">
              <Input type="number" min="0" step="0.01" value={row.totalCost} onChange={e => updateRow(row.uiId, "totalCost", e.target.value)} placeholder="e.g. 15000" required />
            </div>
          ) : (
            <>
              <Input type="number" min="0" step="0.01" value={row.unitCostInput} onChange={e => updateRow(row.uiId, "unitCostInput", e.target.value)} placeholder="e.g. 1500" className="rounded-r-none focus:z-10 w-[120px]" required />
              <div className="bg-muted border border-l-0 border-input px-3 h-9 flex items-center justify-center text-xs text-muted-foreground rounded-r-md min-w-[80px] whitespace-nowrap">
                = {parseFloat(row.totalCost) ? parseFloat(row.totalCost).toLocaleString() : "0"} ৳
              </div>
            </>
          )}
        </div>
        <div className="mt-2 text-xs leading-tight text-muted-foreground">
          {currentUnitCost > 0 ? `Unit cost: ${currentUnitCost.toFixed(2)} ৳ / ${selectedItem?.unit || "unit"}` : " "}
        </div>
      </div>

      {/* 4. Actions */}
      <div className="flex lg:flex-col justify-end lg:justify-center items-center h-full pt-4 lg:pt-0 border-t lg:border-t-0 border-border/50">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => removeRow(row.uiId)}
          disabled={!canRemove}
          className={`h-9 w-9 rounded-full ${canRemove ? "text-destructive hover:bg-destructive/10 hover:text-destructive" : "opacity-30"}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function XIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
  );
}

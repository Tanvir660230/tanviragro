"use client";

import { useState, useTransition, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Search, Check, Calculator, Receipt, Truck, PlusCircle, AlertTriangle, Banknote, Wallet, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { submitBulkPurchase } from "@/app/dashboard/(app)/inventory/purchase/actions";

type InventoryItem = { id: string; name: string; category: string; unit: string };
type RowMode = "bags" | "loose";
type RowData = {
  id: string;
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

export function BulkPurchaseClient({ items, lastPrices = {} }: { items: InventoryItem[], lastPrices?: Record<string, number> }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [supplierName, setSupplierName] = useState("");
  const [transportCost, setTransportCost] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash"); // "cash", "due", "partial"
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");

  const [rows, setRows] = useState<RowData[]>([createEmptyRow()]);

  function createEmptyRow(): RowData {
    return {
      id: typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36).slice(2),
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

  function updateRow(id: string, field: keyof RowData, value: any) {
    setRows(prevRows => prevRows.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  function removeRow(id: string) {
    if (rows.length === 1) return;
    setRows(rows.filter(r => r.id !== id));
  }

  const rawItemsTotal = rows.reduce((sum, r) => sum + (parseFloat(r.totalCost) || 0), 0);
  const parsedTransport = parseFloat(transportCost) || 0;
  const totalBill = rawItemsTotal + parsedTransport;
  let dueAmount = 0;
  if (paymentMethod === "due") dueAmount = totalBill;
  else if (paymentMethod === "partial") dueAmount = Math.max(0, totalBill - (parseFloat(paidAmount) || 0));

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

    const fd = new FormData();
    fd.set("date", date);
    fd.set("supplierName", supplierName);
    fd.set("transportCost", transportCost);
    fd.set("paymentMethod", paymentMethod);
    fd.set("paidAmount", paidAmount);
    fd.set("notes", notes);

    startTransition(async () => {
      const result = await submitBulkPurchase(fd, formattedItems);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Purchase memo saved successfully!");
        router.push("/dashboard/inventory");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 0. Real-time Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-card border border-border shadow-card rounded-xl p-4 flex flex-col justify-center items-center text-center">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Items</span>
          <span className="text-2xl font-bold text-primary">{rows.filter(r => r.itemId || r.isNew).length}</span>
        </div>
        <div className="bg-card border border-border shadow-card rounded-xl p-4 flex flex-col justify-center items-center text-center">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Total Bill</span>
          <span className="text-2xl font-bold text-foreground">{totalBill.toLocaleString()} ৳</span>
        </div>
        <div className={`shadow-card rounded-xl p-4 flex flex-col justify-center items-center text-center transition-colors border ${
          paymentMethod === "cash" 
            ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400" 
            : paymentMethod === "due" || (paymentMethod === "partial" && dueAmount > 0)
              ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-400"
              : "bg-card border-border text-foreground"
        }`}>
          <span className="text-xs font-medium uppercase tracking-wider mb-1 opacity-80">Due Amount</span>
          <span className="text-2xl font-bold">{dueAmount.toLocaleString()} ৳</span>
        </div>
      </div>

      {/* 1. Memo Details */}
      <div className="glass-panel p-5 space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2 border-b border-border pb-3">
          <Receipt className="h-4 w-4 text-primary" /> Invoice Details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Date *</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Supplier Name *</Label>
            <Input value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="e.g. Molla Feed" required className="font-medium" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <Label>Transport / Loading Cost (৳)</Label>
            <div className="relative">
              <Truck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="number" min="0" step="0.01" value={transportCost} onChange={e => setTransportCost(e.target.value)} placeholder="0" className="pl-9" />
            </div>
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
              key={row.id}
              row={row}
              idx={idx}
              items={items}
              lastPrices={lastPrices}
              updateRow={updateRow}
              removeRow={removeRow}
              canRemove={rows.length > 1}
            />
          ))}
        </div>
        <div className="p-4 bg-muted/20 border-t border-border flex justify-center rounded-b-2xl">
          <Button type="button" variant="outline" onClick={addRow} className="border-dashed border-primary/30 text-primary hover:bg-primary/5 hover:text-primary rounded-full px-6 transition-all shadow-card">
            <Plus className="mr-2 h-4 w-4" /> Add Another Item
          </Button>
        </div>
      </div>

      {/* 3. Payment & Totals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Payment Box */}
        <div className={`p-6 rounded-xl border transition-colors duration-300 shadow-card ${
          paymentMethod === "cash" 
            ? "bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-200/50 dark:border-emerald-900/30" 
            : paymentMethod === "due" 
              ? "bg-amber-50/30 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-900/30"
              : "bg-card border-border glass-panel"
        }`}>
          <h2 className="text-sm font-semibold border-b border-border/50 pb-3 mb-4">Payment Setup</h2>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v || "cash")}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash"><div className="flex items-center gap-2"><Banknote className="h-4 w-4 text-emerald-500" /> Cash (Paid in full)</div></SelectItem>
                  <SelectItem value="partial"><div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> Partial Payment</div></SelectItem>
                  <SelectItem value="due"><div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-amber-500" /> Full Due (Unpaid)</div></SelectItem>
                </SelectContent>
              </Select>
            </div>
            {paymentMethod === "partial" && (
              <div className="space-y-1.5 animate-in slide-in-from-top-2 fade-in duration-200">
                <Label>Amount Paid Now (৳) *</Label>
                <Input type="number" min="0" max={totalBill} step="0.01" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} className="bg-background font-semibold text-lg" required />
              </div>
            )}
            {paymentMethod !== "cash" && (
              <div className="animate-in fade-in duration-300 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-950/50 p-3 rounded-lg border border-amber-200 dark:border-amber-900/50">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>A Liability record of <strong>{dueAmount.toLocaleString()} ৳</strong> will be automatically added to the Supplier Ledger for {supplierName || "this supplier"}.</p>
              </div>
            )}
          </div>
        </div>

        {/* Summary Box */}
        <div className="glass-panel p-6 flex flex-col">
          <h2 className="text-sm font-semibold border-b border-border pb-3 mb-4">Final Summary</h2>
          <div className="space-y-3 text-sm flex-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Items Total:</span>
              <span>{rawItemsTotal.toLocaleString()} ৳</span>
            </div>
            {parsedTransport > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Transport / Loading:</span>
                <span>+ {parsedTransport.toLocaleString()} ৳</span>
              </div>
            )}
            <div className="flex justify-between font-medium text-base pt-3 border-t border-border/50">
              <span>Total Bill:</span>
              <span>{totalBill.toLocaleString()} ৳</span>
            </div>
            {paymentMethod !== "cash" && (
              <div className="flex justify-between text-amber-600 dark:text-amber-400 font-bold pt-1">
                <span>Due Amount:</span>
                <span>{dueAmount.toLocaleString()} ৳</span>
              </div>
            )}
          </div>
          <Button type="submit" className="w-full mt-6 shadow-md" disabled={isPending || totalBill <= 0 || !supplierName} size="lg">
            {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : <><Check className="mr-2 h-4 w-4" /> Save Purchase Memo</>}
          </Button>
        </div>
      </div>
    </form>
  );
}

// ── Item Row Component ────────────────────────────────────────────────────────

function ItemRow({ row, idx, items, lastPrices, updateRow, removeRow, canRemove }: {
  row: RowData;
  idx: number;
  items: InventoryItem[];
  lastPrices: Record<string, number>;
  updateRow: (id: string, field: keyof RowData, value: any) => void;
  removeRow: (id: string) => void;
  canRemove: boolean;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        updateRow(row.id, "showDropdown", false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [row.id, updateRow]);

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
        updateRow(row.id, "totalCost", calculatedTotal);
      }
    }
  }, [row.costMode, row.mode, row.bags, row.looseQty, row.unitCostInput, row.id, updateRow, row.totalCost]);

  const filteredItems = items.filter(i => i.name.toLowerCase().includes(row.searchQuery.toLowerCase()));
  const exactMatch = row.searchQuery.trim().length > 0 && items.find(i => i.name.toLowerCase() === row.searchQuery.trim().toLowerCase());
  const showCreateOption = !exactMatch;

  const selectedItem = items.find(i => i.id === row.itemId);
  const displayLabel = row.isNew ? row.newItemName : (selectedItem ? selectedItem.name : "");

  // Analytics
  const lastPrice = row.itemId && !row.isNew ? lastPrices[row.itemId] : null;
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
    <div className="p-5 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr_1fr_40px] xl:grid-cols-[2fr_1.5fr_1.5fr_40px] gap-6 items-start relative hover:bg-muted/10 transition-colors group">
      {/* 1. Item Selection */}
      <div className="space-y-1.5" ref={wrapperRef}>
        <Label>Item {idx + 1}</Label>
        {!row.isNew && row.itemId ? (
          <div className="flex items-center gap-2 bg-muted/50 border border-input rounded-xl px-3 py-2 text-sm">
            <span className="flex-1 truncate">{displayLabel}</span>
            <span className="text-xs text-muted-foreground uppercase">{selectedItem?.unit}</span>
            <Button type="button" variant="ghost" size="icon" aria-label="Clear item selection" className="h-6 w-6 ml-1" onClick={() => {
              updateRow(row.id, "itemId", "");
              updateRow(row.id, "searchQuery", "");
            }}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ) : row.isNew ? (
          <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl p-3 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 flex-1">
                <Label className="text-xs text-primary uppercase flex items-center gap-1"><PlusCircle className="h-3 w-3" /> New Item Name *</Label>
                <Input 
                  value={row.newItemName} 
                  onChange={e => updateRow(row.id, "newItemName", e.target.value)}
                  className="h-8 text-sm"
                  placeholder="Enter item name..."
                  required
                />
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label="Cancel new item" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => updateRow(row.id, "isNew", false)}>
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs uppercase">Category</Label>
                <Select value={row.newItemCategory} onValueChange={v => updateRow(row.id, "newItemCategory", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase">Unit</Label>
                <Select value={row.newItemUnit} onValueChange={v => updateRow(row.id, "newItemUnit", v)}>
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
                  updateRow(row.id, "searchQuery", e.target.value);
                  updateRow(row.id, "showDropdown", true);
                }}
                onFocus={() => updateRow(row.id, "showDropdown", true)}
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
                        updateRow(row.id, "itemId", item.id);
                        updateRow(row.id, "showDropdown", false);
                        // Auto-set mode based on unit
                        if (item.unit !== "kg" && item.unit !== "L") {
                          updateRow(row.id, "mode", "loose");
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
                        updateRow(row.id, "isNew", true);
                        updateRow(row.id, "newItemName", row.searchQuery.trim() || "New Item");
                        updateRow(row.id, "showDropdown", false);
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
              onClick={() => updateRow(row.id, "mode", "bags")}
            >
              Bags/Batches
            </button>
            <button
              type="button"
              className={`px-2 py-0.5 text-xs font-medium rounded-sm transition-colors ${row.mode === "loose" ? "bg-background shadow-card" : "text-muted-foreground"}`}
              onClick={() => updateRow(row.id, "mode", "loose")}
            >
              Total Loose
            </button>
          </div>
        </div>
        
        {row.mode === "bags" ? (
          <div className="flex items-center">
            <div className="relative flex-1">
              <Input type="number" min="0" step="0.01" value={row.bags} onChange={e => updateRow(row.id, "bags", e.target.value)} placeholder="0" className="pr-12 rounded-r-none focus:z-10" required />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">Bags</span>
            </div>
            <div className="bg-muted border-y border-input px-3 h-9 flex items-center justify-center text-xs text-muted-foreground">
              ×
            </div>
            <div className="relative flex-1">
              <Input type="number" min="0" step="0.01" value={row.kgPerBag} onChange={e => updateRow(row.id, "kgPerBag", e.target.value)} placeholder="0" className="pr-10 rounded-l-none focus:z-10" required />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">KG</span>
            </div>
          </div>
        ) : (
          <div className="relative">
            <Input type="number" min="0" step="0.01" value={row.looseQty} onChange={e => updateRow(row.id, "looseQty", e.target.value)} placeholder="e.g. 500" required />
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
              onClick={() => updateRow(row.id, "costMode", "total")}
            >
              Total Cost
            </button>
            <button
              type="button"
              className={`px-2 py-0.5 text-xs font-medium rounded-sm transition-colors ${row.costMode === "unit" ? "bg-background shadow-card" : "text-muted-foreground"}`}
              onClick={() => updateRow(row.id, "costMode", "unit")}
            >
              {row.mode === "bags" ? "Per Bag" : "Per Unit"}
            </button>
          </div>
        </div>

        <div className="flex items-center">
          {row.costMode === "total" ? (
            <div className="relative flex-1">
              <Input type="number" min="0" step="0.01" value={row.totalCost} onChange={e => updateRow(row.id, "totalCost", e.target.value)} placeholder="e.g. 15000" required />
            </div>
          ) : (
            <>
              <Input type="number" min="0" step="0.01" value={row.unitCostInput} onChange={e => updateRow(row.id, "unitCostInput", e.target.value)} placeholder="e.g. 1500" className="rounded-r-none focus:z-10 w-[120px]" required />
              <div className="bg-muted border border-l-0 border-input px-3 h-9 flex items-center justify-center text-xs text-muted-foreground rounded-r-md min-w-[80px] whitespace-nowrap">
                = {parseFloat(row.totalCost) ? parseFloat(row.totalCost).toLocaleString() : "0"} ৳
              </div>
            </>
          )}
        </div>

        {lastPrice !== null && lastPrice !== undefined && currentUnitCost > 0 && (
          <div className="mt-2 text-xs leading-tight">
            <span className="text-muted-foreground block mb-0.5">Last bought at: <span className="font-semibold">{lastPrice.toFixed(2)} ৳</span> /{selectedItem?.unit || "unit"}</span>
            {currentUnitCost > lastPrice && (
              <span className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900/50 flex items-center gap-1 mt-1">
                <AlertTriangle className="h-3 w-3" />
                Price increased by {(currentUnitCost - lastPrice).toFixed(2)} ৳!
              </span>
            )}
            {currentUnitCost < lastPrice && (
              <span className="text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded flex items-center gap-1 mt-1">
                Price decreased!
              </span>
            )}
          </div>
        )}
      </div>

      {/* 4. Actions */}
      <div className="flex lg:flex-col justify-end lg:justify-center items-center h-full pt-4 lg:pt-0 border-t lg:border-t-0 border-border/50">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Remove purchase row"
          onClick={() => removeRow(row.id)}
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

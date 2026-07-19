"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createInventoryItem,
  type InventoryFormState,
} from "@/app/dashboard/(app)/inventory/actions";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "feed", label: "Feed" },
  { value: "medicine", label: "Medicine" },
  { value: "equipment", label: "Equipment" },
  { value: "roughage", label: "Roughage" },
  { value: "other", label: "Other" },
];

const COMMON_UNITS = ["kg", "litre", "piece", "bag", "packet", "bottle"];

const SUGGESTIONS = {
  feed: [
    { name: "Wheat Bran (ভুসি)", unit: "kg" },
    { name: "Corn (ভুট্টা)", unit: "kg" },
    { name: "Straw (খড়)", unit: "kg" },
    { name: "Napier Grass", unit: "kg" },
    { name: "Mustard Cake (খৈল)", unit: "kg" },
  ],
  medicine: [
    { name: "Renamycin", unit: "bottle" },
    { name: "Vitamin AD3E", unit: "ml" },
    { name: "Worm Tablet", unit: "piece" },
  ]
};

function AddItemForm({
  formKey,
  onSuccess,
}: {
  formKey: number;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  
  // Smart Calculator states
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [totalPrice, setTotalPrice] = useState("");

  const [state, formAction, isPending] = useActionState<
    InventoryFormState,
    FormData
  >(createInventoryItem, undefined);

  useEffect(() => {
    if (state?.success) {
      if (state.warning) toast.warning(state.warning);
      else toast.success("Item and initial stock added!");
      onSuccess();
      router.refresh();
    }
    if (state?.error) toast.error(state.error);
  }, [state?.success, state?.error, state?.warning, onSuccess, router]);

  // Handlers for Smart Calculator
  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQty(q);
    const qNum = parseFloat(q);
    const tpNum = parseFloat(totalPrice);
    if (!isNaN(qNum) && qNum > 0 && !isNaN(tpNum)) {
      setUnitCost((tpNum / qNum).toFixed(2));
    } else if (!isNaN(qNum) && qNum > 0 && parseFloat(unitCost) > 0) {
      setTotalPrice((qNum * parseFloat(unitCost)).toFixed(2));
    }
  };

  const handleUnitCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uc = e.target.value;
    setUnitCost(uc);
    const ucNum = parseFloat(uc);
    const qNum = parseFloat(qty);
    if (!isNaN(ucNum) && !isNaN(qNum) && qNum > 0) {
      setTotalPrice((ucNum * qNum).toFixed(2));
    }
  };

  const handleTotalPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tp = e.target.value;
    setTotalPrice(tp);
    const tpNum = parseFloat(tp);
    const qNum = parseFloat(qty);
    if (!isNaN(tpNum) && !isNaN(qNum) && qNum > 0) {
      setUnitCost((tpNum / qNum).toFixed(2));
    }
  };

  const applySuggestion = (sugName: string, sugUnit: string) => {
    setName(sugName);
    setUnit(sugUnit);
  };

  return (
    <form key={formKey} action={formAction} className="space-y-4 pt-1 flex flex-col max-h-[80vh] overflow-y-auto px-1 scrollbar-thin">
      <input type="hidden" name="category" value={category} />
      
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="inv_category">Category *</Label>
          <Select
            value={category}
            onValueChange={(v) => { setCategory(v ?? ""); setUnit(""); setName(""); }}
          >
            <SelectTrigger id="inv_category">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="inv_unit">Unit *</Label>
          <Input
            id="inv_unit"
            name="unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            list="unit-suggestions"
            placeholder="kg, litre, piece…"
            required
          />
          <datalist id="unit-suggestions">
            {COMMON_UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="inv_name">Item Name *</Label>
        <Input
          id="inv_name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Bulls Protein 55%, Hay"
          required
        />
        
        {/* Suggestion Chips */}
        {category && SUGGESTIONS[category as keyof typeof SUGGESTIONS] && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {SUGGESTIONS[category as keyof typeof SUGGESTIONS].map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => applySuggestion(s.name, s.unit)}
                className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="inv_threshold">Low Stock Alert Threshold</Label>
        <Input
          id="inv_threshold"
          name="low_stock_threshold"
          type="number"
          min="0"
          step="0.1"
          placeholder={`e.g. 50 ${unit ? unit : ''} (optional)`}
        />
      </div>

      {/* ── Initial Stock Section ── */}
      <div className="mt-6 pt-4 border-t border-border space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Initial Stock (Optional)</h3>
          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">Smart Calc</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="initial_qty">Quantity Added</Label>
            <Input
              id="initial_qty"
              name="initial_qty"
              type="number"
              min="0"
              step="0.01"
              placeholder={`e.g. 100`}
              value={qty}
              onChange={handleQtyChange}
            />
          </div>
          
          <div className="space-y-1.5">
            <Label htmlFor="purchase_date">Purchase Date</Label>
            <Input
              id="purchase_date"
              name="purchase_date"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              defaultValue={new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3 border border-border/60 border-l-2 border-l-primary">
          <div className="space-y-1.5">
            <Label htmlFor="total_price" className="text-xs text-muted-foreground font-medium">Total Price (৳)</Label>
            <Input
              id="total_price"
              type="number"
              min="0"
              step="0.01"
              placeholder="Total amount"
              value={totalPrice}
              onChange={handleTotalPriceChange}
              className="bg-background"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="unit_cost" className="text-xs text-muted-foreground font-medium">Unit Cost (৳/{unit || 'unit'})</Label>
            <Input
              id="unit_cost"
              name="unit_cost"
              type="number"
              min="0"
              step="0.01"
              placeholder="Auto-calculated"
              value={unitCost}
              onChange={handleUnitCostChange}
              className="bg-background"
            />
          </div>
        </div>
      </div>

      {state?.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive mt-2">
          {state.error}
        </p>
      )}

      <DialogFooter className="pt-2 pb-2">
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Add Item & Stock"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AddItemDialog({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [formKey, setFormKey] = useState(0);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setFormKey((k) => k + 1);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        className={buttonVariants({ size: "sm" })}
        aria-label="Add inventory item"
      >
        <Plus className="mr-1.5 h-4 w-4" />
        Add Item
      </DialogTrigger>

      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader>
          <DialogTitle>New Inventory Item</DialogTitle>
        </DialogHeader>
        <AddItemForm formKey={formKey} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

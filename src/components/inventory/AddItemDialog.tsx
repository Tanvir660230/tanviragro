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
import { KgPerUnitField, ZeroPriceConfirm } from "./ledger-fields";
import { todayDhaka } from "@/lib/dates";
import { useL } from "@/i18n/text";
import { costCategoryLabel } from "@/lib/expenses/labels";
import { useTranslation } from "@/i18n/I18nProvider";

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
  const L = useL();
  const { locale } = useTranslation();
  const router = useRouter();
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  
  // Smart Calculator states
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [stockSource, setStockSource] = useState<"opening_balance" | "purchase" | "own_production">("opening_balance");

  const [state, formAction, isPending] = useActionState<
    InventoryFormState,
    FormData
  >(createInventoryItem, undefined);

  useEffect(() => {
    if (state?.success) {
      if (state.warning) toast.warning(state.warning);
      else toast.success(L("জিনিস ও শুরুর স্টক যোগ হলো!", "Item and initial stock added!"));
      onSuccess();
      router.refresh();
    }
    if (state?.error) toast.error(state.error);
  }, [state?.success, state?.error, state?.warning, onSuccess, router, L]);

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
          <Label htmlFor="inv_category">{L("ধরন *", "Category *")}</Label>
          <Select
            value={category}
            onValueChange={(v) => { setCategory(v ?? ""); setUnit(""); setName(""); }}
          >
            <SelectTrigger id="inv_category">
              <SelectValue placeholder={L("বাছুন…", "Select…")} />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {costCategoryLabel(c.value, locale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="inv_unit">{L("একক *", "Unit *")}</Label>
          <Input
            id="inv_unit"
            name="unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            list="unit-suggestions"
            placeholder={L("kg, লিটার, পিস…", "kg, litre, piece…")}
            required
          />
          <datalist id="unit-suggestions">
            {COMMON_UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>
      </div>

      <KgPerUnitField unit={unit} idPrefix="add" />

      <div className="space-y-1.5">
        <Label htmlFor="inv_name">{L("নাম *", "Item Name *")}</Label>
        <Input
          id="inv_name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={L("যেমন বুলস প্রোটিন ৫৫%, খড়", "e.g. Bulls Protein 55%, Hay")}
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
        <Label htmlFor="inv_threshold">{L("কত কমলে সতর্ক করবে", "Low Stock Alert Threshold")}</Label>
        <Input
          id="inv_threshold"
          name="low_stock_threshold"
          type="number"
          min="0"
          step="0.1"
          placeholder={L(`যেমন 50 ${unit ? unit : ""} (ঐচ্ছিক)`, `e.g. 50 ${unit ? unit : ""} (optional)`)}
        />
      </div>

      {/* ── Initial Stock Section ── */}
      <div className="mt-6 pt-4 border-t border-border space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{L("শুরুর স্টক (ঐচ্ছিক)", "Initial Stock (Optional)")}</h3>
          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">{L("হিসাব", "Smart Calc")}</span>
        </div>

        <input type="hidden" name="stock_source" value={stockSource} />
        <div className="space-y-1.5">
          <Label>{L("এই স্টক", "This stock is")}</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setStockSource("opening_balance")}
              className={`rounded-lg border px-3 py-2 text-left text-xs ${stockSource === "opening_balance" ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <span className="block font-semibold">{L("আগে থেকেই খামারে আছে", "Already on the farm")}</span>
              <span className="text-muted-foreground">{L("শুরুর স্টক — এখন টাকা দেওয়া হয়নি", "Opening balance — not a cash payment now")}</span>
            </button>
            <button
              type="button"
              onClick={() => setStockSource("purchase")}
              className={`rounded-lg border px-3 py-2 text-left text-xs ${stockSource === "purchase" ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <span className="block font-semibold">{L("এখন কেনা", "Bought now")}</span>
              <span className="text-muted-foreground">{L("কেনা — নগদ কমে", "Purchase — reduces cash")}</span>
            </button>
            <button
              type="button"
              onClick={() => setStockSource("own_production")}
              className={`rounded-lg border px-3 py-2 text-left text-xs ${stockSource === "own_production" ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <span className="block font-semibold">{L("নিজের জমি থেকে", "Harvested from own land")}</span>
              <span className="text-muted-foreground">{L("যেমন ঘাস — ৳0; জমির ভাড়া আলাদা খরচ", "e.g. grass — ৳0; land rent is an expense")}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="initial_qty">{L("পরিমাণ", "Quantity Added")}</Label>
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
            <Label htmlFor="purchase_date">{L("কেনার তারিখ", "Purchase Date")}</Label>
            <Input
              id="purchase_date"
              name="purchase_date"
              type="date"
              max={todayDhaka()}
              defaultValue={new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3 border border-border/60 border-l-2 border-l-primary">
          <div className="space-y-1.5">
            <Label htmlFor="total_price" className="text-xs text-muted-foreground font-medium">{L("মোট দাম (৳)", "Total Price (৳)")}</Label>
            <Input
              id="total_price"
              type="number"
              min="0"
              step="0.01"
              placeholder={L("মোট টাকা", "Total amount")}
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
              placeholder={L("নিজে হিসাব হবে", "Auto-calculated")}
              value={unitCost}
              onChange={handleUnitCostChange}
              className="bg-background"
            />
          </div>
        </div>
        <ZeroPriceConfirm unitCost={unitCost} idPrefix="add" />
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
              {L("সেভ হচ্ছে…", "Saving…")}
            </>
          ) : (
            L("জিনিস ও স্টক যোগ করুন", "Add item & stock")
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AddItemDialog({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const L = useL();
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
        aria-label={L("জিনিস যোগ", "Add inventory item")}
      >
        <Plus className="mr-1.5 h-4 w-4" />
        {L("জিনিস যোগ", "Add item")}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader>
          <DialogTitle>{L("নতুন জিনিস", "New Inventory Item")}</DialogTitle>
        </DialogHeader>
        <AddItemForm formKey={formKey} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Pencil } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateInventoryItem,
  type InventoryFormState,
} from "@/app/dashboard/(app)/inventory/actions";
import { toast } from "sonner";
import type { InventoryRow } from "./InventoryTable";
import { KgPerUnitField } from "./ledger-fields";
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

function EditItemForm({
  item,
  formKey,
  onSuccess,
}: {
  item: InventoryRow;
  formKey: number;
  onSuccess: () => void;
}) {
  const { locale } = useTranslation();
  const L = useL();
  const router = useRouter();
  const [category, setCategory] = useState(item.category);
  const [name, setName] = useState(item.name);
  const [unit, setUnit] = useState(item.unit);
  const [threshold, setThreshold] = useState(item.low_stock_threshold?.toString() || "");

  const [state, formAction, isPending] = useActionState<
    InventoryFormState,
    FormData
  >(updateInventoryItem, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success(L("আপডেট হলো", "Item updated successfully"));
      onSuccess();
      router.refresh();
    }
    if (state?.error) toast.error(state.error);
  }, [state?.success, state?.error, onSuccess, router, L]);

  return (
    <form key={formKey} action={formAction} className="space-y-4 pt-1">
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="category" value={category} />

      <div className="space-y-1.5">
        <Label htmlFor="inv_name">{L("নাম *", "Item Name *")}</Label>
        <Input
          id="inv_name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={L("যেমন বুলস প্রোটিন ৫৫%", "e.g. Bulls Protein 55%")}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="inv_category">{L("ধরন *", "Category *")}</Label>
          <Select
            value={category}
            onValueChange={(v) => setCategory(v ?? "")}
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
            list="edit-unit-suggestions"
            placeholder={L("kg, লিটার, পিস…", "kg, litre, piece…")}
            required
          />
          <datalist id="edit-unit-suggestions">
            {COMMON_UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>
      </div>

      <KgPerUnitField unit={unit} defaultValue={item.kg_per_unit} idPrefix="edit" />

      <div className="space-y-1.5">
        <Label htmlFor="inv_threshold">{L("কত কমলে সতর্ক করবে", "Low Stock Alert Threshold")}</Label>
        <Input
          id="inv_threshold"
          name="low_stock_threshold"
          type="number"
          min="0"
          step="0.1"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          placeholder={L(`যেমন 50 ${unit ? unit : ""} (ঐচ্ছিক)`, `e.g. 50 ${unit ? unit : ""} (optional)`)}
        />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive mt-2">
          {state.error}
        </p>
      )}

      <DialogFooter className="pt-4">
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {L("আপডেট হচ্ছে…", "Updating…")}
            </>
          ) : (
            L("সেভ করুন", "Save changes")
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditItemDialog({ item }: { item: InventoryRow }) {
  const L = useL();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setFormKey((k) => k + 1);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-foreground h-8 w-8 text-muted-foreground"
        aria-label={L("বদলান", "Edit item")}
      >
        <Pencil className="h-3.5 w-3.5" />
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm p-6">
        <DialogHeader>
          <DialogTitle>{L("জিনিস বদলান", "Edit Inventory Item")}</DialogTitle>
        </DialogHeader>
        <EditItemForm item={item} formKey={formKey} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

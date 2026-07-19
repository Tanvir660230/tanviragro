"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, FlaskConical } from "lucide-react";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createRecipe, type RecipeFormState } from "@/app/dashboard/(app)/inventory/recipe-actions";

type InventoryItem = { id: string; name: string; unit: string };
type Ingredient = { item_id: string; item_name: string; item_unit: string; qty_per_batch: number };

const COMMON_UNITS = ["kg", "g", "litre", "ml", "piece", "bag", "packet"];

function RecipeForm({
  formKey,
  items,
  onSuccess,
}: {
  formKey: number;
  items: InventoryItem[];
  onSuccess: () => void;
}) {
  const router = useRouter();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [ingQty, setIngQty] = useState("");
  const [outputUnit, setOutputUnit] = useState("kg");
  const ingQtyRef = useRef<HTMLInputElement>(null);

  const [state, formAction, isPending] = useActionState<RecipeFormState, FormData>(
    createRecipe,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      onSuccess();
      router.refresh();
    }
  }, [state?.success, onSuccess, router]);

  function addIngredient() {
    if (!selectedItemId || !ingQty || parseFloat(ingQty) <= 0) return;
    const item = items.find((i) => i.id === selectedItemId);
    if (!item) return;
    if (ingredients.some((i) => i.item_id === selectedItemId)) {
      setIngredients((prev) =>
        prev.map((i) =>
          i.item_id === selectedItemId
            ? { ...i, qty_per_batch: parseFloat(ingQty) }
            : i
        )
      );
    } else {
      setIngredients((prev) => [
        ...prev,
        { item_id: item.id, item_name: item.name, item_unit: item.unit, qty_per_batch: parseFloat(ingQty) },
      ]);
    }
    setSelectedItemId("");
    setIngQty("");
    ingQtyRef.current?.focus();
  }

  function removeIngredient(item_id: string) {
    setIngredients((prev) => prev.filter((i) => i.item_id !== item_id));
  }

  const totalWeight = ingredients.reduce((s, i) => s + i.qty_per_batch, 0);

  return (
    <form key={formKey} action={formAction} className="space-y-4 pt-1">
      {/* Hidden: serialized ingredients + outputUnit */}
      <input type="hidden" name="ingredients" value={JSON.stringify(
        ingredients.map((i) => ({ item_id: i.item_id, qty_per_batch: i.qty_per_batch }))
      )} />
      <input type="hidden" name="output_unit" value={outputUnit} />

      {/* Recipe name */}
      <div className="space-y-1.5">
        <Label htmlFor="recipe_name">Recipe Name *</Label>
        <Input
          id="recipe_name"
          name="name"
          placeholder="e.g. Fattening Mix, Starter Feed"
          required
        />
      </div>

      {/* Output qty + unit */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="recipe_output_qty">Batch Output Qty *</Label>
          <Input
            id="recipe_output_qty"
            name="output_qty"
            type="number"
            min="0.001"
            step="0.001"
            placeholder="100"
            required
          />
          <p className="text-xs text-muted-foreground">Total produced per batch</p>
        </div>
        <div className="space-y-1.5">
          <Label>Output Unit</Label>
          <Select value={outputUnit} onValueChange={(v) => setOutputUnit(v ?? "kg")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON_UNITS.map((u) => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Divider */}
      <div className="!my-5 border-t border-border" />

      {/* Add ingredient row */}
      <div className="space-y-2">
        <Label>Ingredients</Label>
        <div className="flex gap-2">
          <div className="flex-1 min-w-0">
            <Select value={selectedItemId} onValueChange={(v) => setSelectedItemId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select item…">
                  {selectedItemId ? items.find(i => i.id === selectedItemId)?.name : "Select item…"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} ({item.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            ref={ingQtyRef}
            className="w-24 shrink-0"
            type="number"
            min="0.001"
            step="0.001"
            placeholder="Qty"
            value={ingQty}
            onChange={(e) => setIngQty(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addIngredient(); }
            }}
          />
          <Button type="button" variant="secondary" size="icon" className="shrink-0" onClick={addIngredient}
            disabled={!selectedItemId || !ingQty}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Press <kbd className="rounded border px-1 font-mono text-xs">Enter</kbd> or
          {" "}click + to add each ingredient
        </p>
      </div>

      {/* Ingredient list */}
      {ingredients.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border">
          {ingredients.map((ing) => (
            <div key={ing.item_id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="font-medium">{ing.item_name}</span>
              <div className="flex items-center gap-2 ml-auto shrink-0">
                <span className="tabular-nums text-muted-foreground">
                  {ing.qty_per_batch} {ing.item_unit}
                </span>
                <button
                  type="button"
                  onClick={() => removeIngredient(ing.item_id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground bg-muted/50">
            <span>Total ingredients weight</span>
            <span className="font-medium tabular-nums">{totalWeight.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Optional notes */}
      <div className="space-y-1.5">
        <Label htmlFor="recipe_notes">Notes</Label>
        <Input
          id="recipe_notes"
          name="notes"
          placeholder="Optional instructions or ratios…"
        />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <DialogFooter>
        <Button type="submit" disabled={isPending || ingredients.length === 0} className="w-full">
          {isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
          ) : (
            "Save Recipe"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function RecipeBuilderDialog({ items }: { items: InventoryItem[] }) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setFormKey((k) => k + 1);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className={buttonVariants({ variant: "secondary", size: "sm" })}>
        <FlaskConical className="mr-1.5 h-4 w-4" />
        New Recipe
      </DialogTrigger>

      <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Build Feed Recipe</DialogTitle>
        </DialogHeader>
        <RecipeForm formKey={formKey} items={items} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

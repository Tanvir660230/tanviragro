"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Play, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { produceBatch, type ProduceBatchState } from "@/app/dashboard/(app)/inventory/recipe-actions";

type Recipe = {
  id: string;
  name: string;
  output_qty: number;
  output_unit: string;
  notes: string | null;
  recipe_ingredients: { item_id: string; qty_per_batch: number }[];
};
type StockItem = { id: string; name: string; unit: string; stock: number };

function ProduceBatchForm({
  formKey,
  recipes,
  allItems,
  onSuccess,
}: {
  formKey: number;
  recipes: Recipe[];
  allItems: StockItem[];
  onSuccess: () => void;
}) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  const [recipeId, setRecipeId]     = useState("");
  const [qtyToProduce, setQty]      = useState("");
  const [outputItemId, setOutputId] = useState("");

  const [state, formAction, isPending] = useActionState<ProduceBatchState, FormData>(
    produceBatch, undefined
  );

  useEffect(() => {
    if (state?.success) {
      onSuccess();
      router.refresh();
    }
  }, [state?.success, onSuccess, router]);

  const selectedRecipe = recipes.find((r) => r.id === recipeId) ?? null;
  const scale = selectedRecipe && parseFloat(qtyToProduce) > 0
    ? parseFloat(qtyToProduce) / selectedRecipe.output_qty
    : 0;

  const ingredientChecks = useMemo(() => {
    if (!selectedRecipe || scale <= 0) return [];
    return selectedRecipe.recipe_ingredients.map((ing) => {
      const need = ing.qty_per_batch * scale;
      const item = allItems.find((i) => i.id === ing.item_id);
      const have = item?.stock ?? 0;
      return {
        item_id: ing.item_id,
        name: item?.name ?? ing.item_id,
        unit: item?.unit ?? "",
        need,
        have,
        ok: have >= need - 0.001,
      };
    });
  }, [selectedRecipe, scale, allItems]);

  const canProduce = ingredientChecks.length > 0 && ingredientChecks.every((c) => c.ok);

  return (
    <form key={formKey} action={formAction} className="space-y-4 pt-1">
      <input type="hidden" name="recipe_id"     value={recipeId} />
      <input type="hidden" name="qty_to_produce" value={qtyToProduce} />
      <input type="hidden" name="output_item_id" value={outputItemId === "skip" ? "" : outputItemId} />

      {/* Recipe picker */}
      <div className="space-y-1.5">
        <Label>Select Recipe *</Label>
        <Select value={recipeId} onValueChange={(v) => { setRecipeId(v ?? ""); setOutputId(""); }}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a recipe…" />
          </SelectTrigger>
          <SelectContent>
            {recipes.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
                <span className="ml-1.5 text-muted-foreground text-xs">
                  (batch = {r.output_qty} {r.output_unit})
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Quantity to produce */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="prod_qty">Quantity to Produce *</Label>
          <Input
            id="prod_qty"
            type="number"
            min="0.001"
            step="0.001"
            placeholder={selectedRecipe?.output_qty?.toString() ?? "100"}
            value={qtyToProduce}
            onChange={(e) => setQty(e.target.value)}
          />
          {selectedRecipe && (
            <p className="text-xs text-muted-foreground">
              {selectedRecipe.output_unit} · {scale > 0 ? `${scale.toFixed(2)}× batch` : ""}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prod_date">Date *</Label>
          <Input
            id="prod_date"
            name="recorded_at"
            type="date"
            max={today}
            defaultValue={today}
            required
          />
        </div>
      </div>

      {/* Ingredient requirements table */}
      {ingredientChecks.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ingredient Requirements
          </div>
          <div className="divide-y divide-border">
            {ingredientChecks.map((c) => (
              <div
                key={c.item_id}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm",
                  c.ok ? "" : "bg-destructive/5"
                )}
              >
                {c.ok
                  ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  : <AlertCircle  className="h-3.5 w-3.5 shrink-0 text-destructive" />}
                <span className="flex-1 font-medium">{c.name}</span>
                <span className={cn("tabular-nums text-xs", c.ok ? "text-muted-foreground" : "text-destructive font-medium")}>
                  need {c.need.toFixed(2)}
                </span>
                <span className="text-xs text-muted-foreground">/ have {c.have.toFixed(2)} {c.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Optional: credit output to a stock item */}
      <div className="space-y-1.5">
        <Label>Add to Inventory Item (optional)</Label>
        <Select value={outputItemId} onValueChange={(v) => setOutputId(v ?? "")}>
          <SelectTrigger>
            <SelectValue placeholder="Skip — just deduct ingredients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="skip">Skip — just deduct ingredients</SelectItem>
            {allItems
              .filter((i) => !selectedRecipe?.recipe_ingredients.some((ri) => ri.item_id === i.id))
              .map((i) => (
                <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>
              ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          The produced qty will be added as a purchase transaction for the selected item.
        </p>
      </div>

      {state?.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      {state?.success && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
          Produced {state.produced} {selectedRecipe?.output_unit}. Ingredients deducted.
        </p>
      )}

      <DialogFooter>
        <Button
          type="submit"
          disabled={isPending || !canProduce || !recipeId || !qtyToProduce}
          className="w-full"
        >
          {isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing…</>
          ) : (
            <><Play className="mr-2 h-4 w-4" />Produce Batch</>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ProduceBatchDialog({
  recipes,
  allItems,
}: {
  recipes: Recipe[];
  allItems: StockItem[];
}) {
  const [open, setOpen]   = useState(false);
  const [formKey, setKey] = useState(0);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setKey((k) => k + 1);
  };

  if (!recipes.length) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className={buttonVariants({ variant: "outline", size: "sm" })}>
        <Play className="mr-1.5 h-4 w-4" />
        Produce Batch
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Produce a Batch</DialogTitle>
        </DialogHeader>
        <ProduceBatchForm
          formKey={formKey}
          recipes={recipes}
          allItems={allItems}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

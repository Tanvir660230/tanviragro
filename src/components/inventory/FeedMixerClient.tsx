"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, FlaskConical, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { produceMixedBatch } from "@/app/dashboard/(app)/inventory/mix-feed/actions";
import { cn } from "@/lib/utils";

export type RecipeOption = {
  id: string;
  name: string;
  output_qty: number;
  output_unit: string;
  notes: string | null;
  ingredients: {
    item_id: string;
    qty_per_batch: number;
    item_name: string;
    item_unit: string;
    stock: number;
  }[];
};

export type StockItem = {
  id: string;
  name: string;
  unit: string;
  stock: number;
  category: string;
};

interface Props {
  recipes: RecipeOption[];
  allItems: StockItem[];
}

function StatusBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
      <CheckCircle2 className="h-3.5 w-3.5" /> OK
    </span>
  ) : (
    <span className="flex items-center gap-1 text-red-500 text-xs font-medium">
      <XCircle className="h-3.5 w-3.5" /> Low
    </span>
  );
}

export function FeedMixerClient({ recipes, allItems }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const today = new Date().toISOString().split("T")[0];
  const [selectedRecipeId, setSelectedRecipeId] = useState(recipes[0]?.id ?? "");
  const [targetAmount, setTargetAmount] = useState<string>("");
  const [outputItemId, setOutputItemId] = useState("");
  const [date, setDate] = useState(today);
  const [batchResult, setBatchResult] = useState<{ produced?: number; error?: string; success?: boolean } | null>(null);

  const selectedRecipe = recipes.find((r) => r.id === selectedRecipeId) ?? recipes[0] ?? null;
  const target = parseFloat(targetAmount) || 0;
  const scale = selectedRecipe && target > 0 && selectedRecipe.output_qty > 0
    ? target / selectedRecipe.output_qty
    : 0;



  // Real-time ingredient requirements
  type IngredientStatus = {
    item_id: string;
    name: string;
    unit: string;
    base_qty: number;
    required: number;
    stock: number;
    sufficient: boolean;
  };

  const ingredientStatuses: IngredientStatus[] = selectedRecipe
    ? selectedRecipe.ingredients.map((ing) => {
        const required = parseFloat((ing.qty_per_batch * scale).toFixed(3));
        return {
          item_id: ing.item_id,
          name: ing.item_name,
          unit: ing.item_unit,
          base_qty: ing.qty_per_batch,
          required,
          stock: ing.stock,
          sufficient: required <= 0 || ing.stock >= required - 0.001,
        };
      })
    : [];

  const anyIngredientShort = ingredientStatuses.some((i) => !i.sufficient);
  const canProduce =
    !!selectedRecipe &&
    target > 0 &&
    !!date &&
    !anyIngredientShort;

  function handleProduce(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRecipe || !canProduce) return;

    const fd = new FormData();
    fd.set("recipe_id", selectedRecipe.id);
    fd.set("target_amount", String(target));
    fd.set("recorded_at", date);
    fd.set("output_item_id", outputItemId);

    setBatchResult(null);

    startTransition(async () => {
      const result = await produceMixedBatch(undefined, fd);
      setBatchResult(result ?? null);
      if (result?.error) {
        toast.error(result.error);
      } else if (result?.success) {
        toast.success(`Produced ${result.produced} kg of ${selectedRecipe.name}`);
        setTargetAmount("");
        router.refresh();
      }
    });
  }

  if (recipes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 py-16 text-center">
        <FlaskConical className="h-10 w-10 text-muted-foreground/40" />
        <div>
          <p className="font-medium">No Recipes Found</p>
          <p className="text-sm text-muted-foreground">Create a feed recipe in Inventory first to use the Feed Mixer.</p>
        </div>
        <a href="/dashboard/inventory" className="text-sm text-primary underline underline-offset-4">
          Go to Inventory →
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleProduce} className="space-y-6">
      {/* Recipe selector + target amount */}
      <div className="glass-panel overflow-hidden">
        <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="p-5 space-y-2">
            <label className="text-sm font-semibold">Recipe</label>
            <select
              value={selectedRecipeId}
              onChange={(e) => {
                setSelectedRecipeId(e.target.value);
                setTargetAmount("");
              }}
              className="w-full rounded-xl border border-input bg-background/50 backdrop-blur-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} (base: {r.output_qty} {r.output_unit})
                </option>
              ))}
            </select>
            {selectedRecipe?.notes && (
              <p className="text-xs text-muted-foreground">{selectedRecipe.notes}</p>
            )}
          </div>

          <div className="p-5 space-y-2">
            <label className="text-sm font-semibold">Target Amount</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                step="0.1"
                placeholder={selectedRecipe ? `e.g. ${selectedRecipe.output_qty}` : "0"}
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                required
                className="flex-1"
              />
              <span className="shrink-0 text-sm text-muted-foreground">
                {selectedRecipe?.output_unit ?? "kg"}
              </span>
            </div>
            {selectedRecipe && target > 0 && (
              <p className="text-xs text-muted-foreground">
                Scale: ×{scale.toFixed(3)} of base recipe ({selectedRecipe.output_qty} {selectedRecipe.output_unit})
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Ingredient table */}
      {selectedRecipe && (
        <div className="glass-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-4 py-3">
            <h3 className="text-sm font-semibold">Ingredients</h3>
            {target > 0 && anyIngredientShort && (
              <span className="text-xs font-medium text-red-500">⚠ Insufficient stock</span>
            )}
          </div>
          <div className="divide-y divide-border">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Ingredient</span>
              <span className="text-right">Base</span>
              <span className="text-right">Required</span>
              <span className="text-right">In Stock</span>
              <span className="text-right">Status</span>
            </div>
            {ingredientStatuses.map((ing) => (
              <div
                key={ing.item_id}
                className={cn(
                  "grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 px-4 py-3 text-sm transition-colors",
                  target > 0 && !ing.sufficient && "bg-red-50/70 dark:bg-red-950/30"
                )}
              >
                <div>
                  <p className="font-medium">{ing.name}</p>
                  <p className="text-xs text-muted-foreground">{ing.unit}</p>
                </div>
                <span className="tabular-nums text-right text-muted-foreground">
                  {ing.base_qty} {ing.unit}
                </span>
                <span className={cn("tabular-nums text-right font-medium", target > 0 && !ing.sufficient && "text-red-600 dark:text-red-400")}>
                  {target > 0 ? `${ing.required} ${ing.unit}` : <span className="text-xs text-muted-foreground italic">enter target</span>}
                </span>
                <span className="tabular-nums text-right">
                  {ing.stock.toFixed(2)} {ing.unit}
                </span>
                <div className="flex justify-end">
                  {target > 0 ? <StatusBadge ok={ing.sufficient} /> : <span className="text-xs text-muted-foreground italic">—</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Output item + date */}
      <div className="glass-panel overflow-hidden">
        <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="p-5 space-y-2">
            <label className="text-sm font-semibold">
              Add to Inventory Item{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <select
              value={outputItemId}
              onChange={(e) => setOutputItemId(e.target.value)}
              className="w-full rounded-xl border border-input bg-background/50 backdrop-blur-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Don&apos;t add to stock —</option>
              {allItems
                .filter((i) => i.category === "feed")
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.stock.toFixed(1)} {i.unit} in stock)
                  </option>
                ))}
            </select>
            <p className="text-xs text-muted-foreground">
              If selected, the produced amount will be added as a purchase to this feed item with a FIFO-weighted cost.
            </p>
          </div>

          <div className="p-5 space-y-2">
            <label className="text-sm font-semibold">Production Date</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
        </div>
      </div>

      {/* Produce button + status */}
      <div className="flex items-center justify-between gap-4">
        {batchResult?.error && (
          <p className="text-sm text-red-500">{batchResult.error}</p>
        )}
        {batchResult?.success && (
          <p className="text-sm text-emerald-600 font-medium">
            ✓ Produced {batchResult.produced} {selectedRecipe?.output_unit}
          </p>
        )}
        {!batchResult && <div />}

        <Button
          type="submit"
          disabled={!canProduce || isPending}
          size="lg"
          className="shrink-0"
        >
          {isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Producing…</>
          ) : (
            <>
              <FlaskConical className="mr-2 h-4 w-4" />
              Produce {target > 0 ? `${target} ${selectedRecipe?.output_unit ?? "kg"}` : "Batch"}
              <ChevronRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </div>

      {/* Disabled reason hint */}
      {!canProduce && target > 0 && anyIngredientShort && (
        <p className="text-xs text-red-500 text-center">
          Cannot produce — resolve insufficient stock items highlighted in red above.
        </p>
      )}
    </form>
  );
}

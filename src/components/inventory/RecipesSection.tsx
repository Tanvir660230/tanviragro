"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FlaskConical, ChevronDown, ChevronUp, Archive, ArchiveRestore, Trash2, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { RecipeBuilderDialog } from "./RecipeBuilderDialog";
import { ProduceBatchDialog } from "./ProduceBatchDialog";
import { deleteRecipe, restoreRecipe, permanentlyDeleteRecipe, setActiveRecipe } from "@/app/dashboard/(app)/inventory/recipe-actions";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/i18n/I18nProvider";

type Ingredient = {
  item_id: string;
  qty_per_batch: number;
  item_name: string;
  item_unit: string;
};

type Recipe = {
  id: string;
  name: string;
  output_qty: number;
  output_unit: string;
  is_active: boolean | null;
  active_from: string | null;
  active_until: string | null;
  notes: string | null;
  recipe_ingredients: { item_id: string; qty_per_batch: number }[];
  ingredients: Ingredient[];
};

type StockItem = { id: string; name: string; unit: string; stock: number };

export function RecipesSection({
  recipes,
  deletedRecipes = [],
  allItems,
}: {
  recipes: Recipe[];
  deletedRecipes?: Recipe[];
  allItems: StockItem[];
}) {
  const { t } = useTranslation();
  const tr = t.inventory.recipes;
  const today = new Date().toISOString().slice(0, 10);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmPermanentId, setConfirmPermanentId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [pendingFromDate, setPendingFromDate] = useState(today);
  const [pendingUntilDate, setPendingUntilDate] = useState("");
  const router = useRouter();

  function handleSetActive(recipeId: string, currentlyActive: boolean) {
    if (currentlyActive) {
      startTransition(async () => {
        await setActiveRecipe(null);
        router.refresh();
      });
    } else {
      setActivatingId(recipeId);
      setPendingFromDate(today);
      setPendingUntilDate("");
    }
  }

  function confirmActivate(recipeId: string) {
    startTransition(async () => {
      await setActiveRecipe(recipeId, pendingUntilDate || null, pendingFromDate || today);
      setActivatingId(null);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    startTransition(async () => {
      const result = await deleteRecipe(id);
      if (result.error) {
        alert(result.error);
      }
      router.refresh();
    });
  }

  function handleRestore(id: string) {
    startTransition(async () => {
      await restoreRecipe(id);
      router.refresh();
    });
  }

  function handlePermanentDelete() {
    if (!confirmPermanentId) return;
    const id = confirmPermanentId;
    setConfirmPermanentId(null);
    startTransition(async () => {
      await permanentlyDeleteRecipe(id);
      router.refresh();
    });
  }

  const recipesForDialog = recipes.map((r) => ({
    id: r.id,
    name: r.name,
    output_qty: r.output_qty,
    output_unit: r.output_unit,
    notes: r.notes,
    recipe_ingredients: r.recipe_ingredients,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{tr.title}</h2>
          {recipes.length > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {recipes.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ProduceBatchDialog recipes={recipesForDialog} allItems={allItems} />
          <RecipeBuilderDialog items={allItems} />
        </div>
      </div>

      {recipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 py-10 text-center">
          <FlaskConical className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">{tr.no_recipes}</p>
          <p className="text-xs text-muted-foreground">{tr.no_recipes_hint}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {recipes.map((recipe) => {
            const expanded = expandedId === recipe.id;
            const totalIngWeight = recipe.ingredients.reduce((s, i) => s + i.qty_per_batch, 0);

            // Find the bottleneck (ingredient with fewest batches possible from stock)
            const batchCounts = recipe.ingredients.map((ing) => {
              const stock = allItems.find((i) => i.id === ing.item_id)?.stock ?? 0;
              return ing.qty_per_batch > 0 ? Math.floor(stock / ing.qty_per_batch) : Infinity;
            });
            const minBatches = batchCounts.length > 0 ? Math.min(...batchCounts) : Infinity;

            return (
              <div
                key={recipe.id}
                className="overflow-hidden rounded-xl border border-border bg-card"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(expanded ? null : recipe.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950">
                      <FlaskConical className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-medium">{recipe.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {tr.ingredients_summary
                          .replace("{{n}}", String(recipe.ingredients.length))
                          .replace("{{qty}}", String(recipe.output_qty))
                          .replace("{{unit}}", recipe.output_unit)}
                      </p>
                    </div>
                  </div>
                  {expanded
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>

                {expanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                    <div className="rounded-lg border border-border overflow-hidden">
                      <div className="bg-muted/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {tr.per_batch
                          .replace("{{qty}}", String(recipe.output_qty))
                          .replace("{{unit}}", recipe.output_unit)}
                      </div>
                      <div className="divide-y divide-border">
                        {recipe.ingredients.map((ing, idx) => {
                          const pct = totalIngWeight > 0
                            ? ((ing.qty_per_batch / totalIngWeight) * 100).toFixed(1)
                            : "—";
                          const stock = allItems.find((i) => i.id === ing.item_id)?.stock ?? 0;
                          const batches = stock > 0 && ing.qty_per_batch > 0
                            ? Math.floor(stock / ing.qty_per_batch)
                            : 0;
                          const isBottleneck = isFinite(minBatches) && batchCounts[idx] === minBatches && minBatches < 5;

                          return (
                            <div key={ing.item_id} className={cn(
                              "flex items-center gap-3 px-3 py-2 text-sm",
                              isBottleneck && "bg-amber-50/60 dark:bg-amber-950/20"
                            )}>
                              <span className="flex-1 font-medium">
                                {ing.item_name}
                                {isBottleneck && (
                                  <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                                    {tr.bottleneck}
                                  </span>
                                )}
                              </span>
                              <span className="tabular-nums text-muted-foreground">
                                {ing.qty_per_batch} {ing.item_unit}
                              </span>
                              <span className="w-10 text-right text-xs text-muted-foreground">{pct}%</span>
                              <span className={cn(
                                "text-xs rounded px-1.5 py-0.5",
                                batches === 0
                                  ? "bg-destructive/10 text-destructive"
                                  : batches < 3
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                              )}>
                                {tr.batches_left.replace("{{n}}", String(batches))}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {recipe.notes && (
                      <p className="text-xs text-muted-foreground">{recipe.notes}</p>
                    )}

                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleSetActive(recipe.id, !!recipe.is_active)}
                          disabled={isPending}
                          className={cn(
                            "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md transition-colors",
                            recipe.is_active
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          )}
                        >
                          <div className={cn("h-2 w-2 rounded-full", recipe.is_active ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                          {recipe.is_active ? tr.active_recipe : tr.set_active}
                          {recipe.is_active && recipe.active_from && (
                            <span className="text-xs opacity-60">
                              {new Date(recipe.active_from + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}–
                              {recipe.active_until
                                ? new Date(recipe.active_until + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                                : "?"}
                            </span>
                          )}
                        </button>
                        {activatingId === recipe.id && (
                          <div className="mt-3 rounded-xl border border-primary/25 bg-primary/5 dark:bg-primary/10 p-4 space-y-4 w-full">
                            {/* Header */}
                            <div className="flex items-center gap-2">
                              <CalendarDays className="h-4 w-4 text-primary" />
                              <p className="text-xs font-semibold text-primary">Recipe-এর সময়কাল নির্ধারণ করুন</p>
                            </div>
                            {/* Date pickers */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  শুরুর তারিখ
                                </label>
                                <input
                                  type="date"
                                  value={pendingFromDate}
                                  onChange={(e) => setPendingFromDate(e.target.value)}
                                  max={today}
                                  className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
                                />
                                <p className="text-xs text-muted-foreground leading-tight">
                                  পুরানো তারিখ দিলে সেই দিন থেকে auto-deduction হবে
                                </p>
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                  শেষের তারিখ
                                  <span className="font-normal opacity-50 normal-case">(ঐচ্ছিক)</span>
                                </label>
                                <input
                                  type="date"
                                  value={pendingUntilDate}
                                  onChange={(e) => setPendingUntilDate(e.target.value)}
                                  min={pendingFromDate || today}
                                  className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
                                />
                                <p className="text-xs text-muted-foreground leading-tight">
                                  Feed কতদিন চলবে আনুমানিক
                                </p>
                              </div>
                            </div>
                            {/* Action buttons */}
                            <div className="flex items-center justify-end gap-2 pt-1 border-t border-primary/10">
                              <button
                                type="button"
                                onClick={() => setActivatingId(null)}
                                className="text-xs px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              >
                                বাতিল
                              </button>
                              <button
                                type="button"
                                onClick={() => confirmActivate(recipe.id)}
                                disabled={isPending}
                                className="flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                              >
                                {isPending ? "…" : "✓ চালু করুন"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(recipe.id)}
                        disabled={isPending}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                        title="Delete this recipe (history is preserved)"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete Recipe?"
        description="The recipe will be deleted from your active list, but all previous batch production history and ingredient costs remain intact in the background."
        confirmLabel="Delete"
        destructive={true}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}

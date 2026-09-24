/**
 * Recipe arithmetic shared by the UI and server actions.
 *
 * A recipe's batch size must equal the sum of its ingredients (mass balance). Scaling
 * always uses the ingredient total — never `output_qty` — so a mis-entered batch size can
 * never make a mix consume more or less than it produces. The database enforces the same
 * rule (assert_recipe_balanced / produce_feed_batch).
 */

export type RecipeIngredientQty = { item_id: string; qty_per_batch: number };

/** Allowed rounding difference between Σ ingredients and the batch size, in kg. */
export const RECIPE_BALANCE_TOLERANCE = 0.01;

export function recipeIngredientTotal(ingredients: RecipeIngredientQty[]): number {
  return ingredients.reduce((sum, i) => sum + (Number(i.qty_per_batch) || 0), 0);
}

export function isRecipeBalanced(ingredients: RecipeIngredientQty[], outputQty: number): boolean {
  return Math.abs(recipeIngredientTotal(ingredients) - outputQty) <= RECIPE_BALANCE_TOLERANCE;
}

/** Validation message for a recipe form, or null when the recipe is valid. */
export function recipeValidationError(ingredients: RecipeIngredientQty[], outputQty: number): string | null {
  if (!(outputQty > 0)) return "Batch size must be greater than 0";
  if (!ingredients.length) return "Add at least one ingredient";
  for (const i of ingredients) {
    if (!i.item_id) return "Each ingredient must have an item";
    if (!(i.qty_per_batch > 0)) return "Each ingredient quantity must be greater than 0";
  }
  if (new Set(ingredients.map((i) => i.item_id)).size !== ingredients.length) {
    return "An ingredient is listed twice";
  }
  const total = recipeIngredientTotal(ingredients);
  if (!isRecipeBalanced(ingredients, outputQty)) {
    return `Ingredients add up to ${round(total, 3)} kg but the batch size is ${outputQty} kg. They must be equal.`;
  }
  return null;
}

/** Ingredient quantities needed to produce `targetQty` of output: qty_i / Σ × target. */
export function scaleRecipe(ingredients: RecipeIngredientQty[], targetQty: number): { item_id: string; qty: number }[] {
  const total = recipeIngredientTotal(ingredients);
  if (!(total > 0) || !(targetQty > 0)) return ingredients.map((i) => ({ item_id: i.item_id, qty: 0 }));
  return ingredients.map((i) => ({ item_id: i.item_id, qty: round((i.qty_per_batch / total) * targetQty, 4) }));
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

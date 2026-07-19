import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { FeedMixerClient, type RecipeOption, type StockItem } from "@/components/inventory/FeedMixerClient";

export const metadata: Metadata = { title: "Feed Mixer" };

export default async function FeedMixerPage() {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);

  const [
    { data: recipesData },
    { data: itemsData },
    { data: txnsData },
  ] = await Promise.all([
    businessId
      ? supabase
          .from("feed_recipes")
          .select("id, name, output_qty, output_unit, notes, recipe_ingredients(item_id, qty_per_batch)")
          .eq("business_id", businessId)
          .order("name", { ascending: true })
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase
          .from("inventory_items")
          .select("id, name, category, unit")
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .order("category", { ascending: true })
          .order("name", { ascending: true })
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase
          .from("inventory_transactions")
          .select("item_id, type, qty, inventory_items!inner(business_id)")
          .eq("inventory_items.business_id", businessId)
      : Promise.resolve({ data: [] }),
  ]);

  type TxnRow = { item_id: string; type: string; qty: number };
  const txns = (txnsData ?? []) as TxnRow[];

  // Compute current stock per item
  const stockMap: Record<string, number> = {};
  for (const t of txns) {
    stockMap[t.item_id] = (stockMap[t.item_id] ?? 0) + (t.type === "purchase" ? t.qty : -t.qty);
  }

  type RawItem = { id: string; name: string; category: string; unit: string };
  const items = (itemsData ?? []) as RawItem[];

  const itemsLookup: Record<string, { name: string; unit: string; stock: number }> = {};
  for (const item of items) {
    itemsLookup[item.id] = {
      name: item.name,
      unit: item.unit,
      stock: Math.max(0, parseFloat((stockMap[item.id] ?? 0).toFixed(3))),
    };
  }

  const recipes: RecipeOption[] = (recipesData ?? []).map((r: {
    id: string; name: string; output_qty: number; output_unit: string; notes: string | null;
    recipe_ingredients: { item_id: string; qty_per_batch: number }[];
  }) => ({
    id: r.id,
    name: r.name,
    output_qty: r.output_qty,
    output_unit: r.output_unit,
    notes: r.notes,
    ingredients: (r.recipe_ingredients ?? []).map((ri) => ({
      item_id: ri.item_id,
      qty_per_batch: ri.qty_per_batch,
      item_name: itemsLookup[ri.item_id]?.name ?? ri.item_id,
      item_unit: itemsLookup[ri.item_id]?.unit ?? "",
      stock: itemsLookup[ri.item_id]?.stock ?? 0,
    })),
  }));

  const allItems: StockItem[] = items.map((item) => ({
    id: item.id,
    name: item.name,
    unit: item.unit,
    stock: Math.max(0, parseFloat((stockMap[item.id] ?? 0).toFixed(3))),
    category: item.category,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Feed Mixer"
        subtitle="Scale any recipe to a target amount with real-time stock validation."
        icon={FlaskConical}
        back="/dashboard/inventory"
      />

      {/* Mixer client */}
      <FeedMixerClient recipes={recipes} allItems={allItems} />
    </div>
  );
}

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * item_id → current unit cost, from the database (view v_inventory_unit_cost →
 * inventory_unit_cost_as_of: perpetual moving average of the stock on hand).
 * This is the ONLY source of unit cost for pages; nothing averages prices in the app.
 */
export async function loadUnitCostMap(supabase: SupabaseClient<any>, businessId: string): Promise<Record<string, number>> {
  const { data } = await supabase.from("v_inventory_unit_cost").select("item_id, unit_cost").eq("business_id", businessId);
  const out: Record<string, number> = {};
  for (const r of (data ?? []) as { item_id: string; unit_cost: number | string | null }[]) {
    if (r.unit_cost != null) out[r.item_id] = Number(r.unit_cost);
  }
  return out;
}

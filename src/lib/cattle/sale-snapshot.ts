import type { SupabaseClient } from "@supabase/supabase-js";
import { loadFarm } from "@/lib/home/home-data";

/**
 * Each sale keeps the animal's full cost on the day it was recorded (sales.cost_at_sale).
 *
 * The cost itself stays live (the farm position — the same figure as the Money and partners
 * pages), so a cost dated on or before the sale but recorded later still lands on the animal.
 * The kept figure lets its page say so instead of the profit changing silently.
 *
 * Both helpers are safe before the column exists (migration 20260929090000): nothing is kept
 * or read, and the sale itself is never affected.
 */

const missingColumn = (msg?: string) => !!msg && /cost_at_sale/.test(msg) && /(does not exist|could not find|schema cache)/i.test(msg);

/** After a sale: keep each sold animal's full cost as of now (its sale day ends its share of the running costs). */
export async function keepCostAtSale(supabase: SupabaseClient<any>, businessId: string, groupId: string, cattleIds: string[]): Promise<void> {
  try {
    const farm = await loadFarm(supabase, businessId);
    if (!farm) return;
    const byId = new Map(farm.animals.map((a) => [a.id, a.fullCost]));
    for (const id of cattleIds) {
      const cost = byId.get(id);
      if (cost == null) continue;
      const { error } = await supabase.from("sales").update({ cost_at_sale: Math.round(cost * 100) / 100 })
        .eq("sale_group_id", groupId).eq("cattle_id", id).is("deleted_at", null);
      if (error) {
        if (!missingColumn(error.message)) console.error("cost at sale not kept", error.message);
        return;
      }
    }
  } catch (e) {
    console.error("cost at sale not kept", e);
  }
}

/** cattle id → full cost when its (current) sale was recorded. */
export async function loadCostAtSale(supabase: SupabaseClient<any>, businessId: string, cattleId?: string): Promise<Record<string, number>> {
  let q = supabase.from("sales").select("cattle_id, cost_at_sale, cattle!inner(business_id)")
    .eq("cattle.business_id", businessId).is("deleted_at", null).not("cost_at_sale", "is", null);
  if (cattleId) q = q.eq("cattle_id", cattleId);
  const { data, error } = await q;
  if (error) {
    if (!missingColumn(error.message)) console.error("cost at sale not read", error.message);
    return {};
  }
  const out: Record<string, number> = {};
  for (const r of (data ?? []) as { cattle_id: string; cost_at_sale: number | string }[]) out[r.cattle_id] = Number(r.cost_at_sale);
  return out;
}

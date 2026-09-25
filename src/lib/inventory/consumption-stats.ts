import type { SupabaseClient } from "@supabase/supabase-js";
import { selectAll } from "@/lib/supabase/select-all";

/**
 * Consumption figures from the ledger's MEANING (movement_type), not its direction.
 *
 * The old SQL helpers (get_monthly_consumptions, get_inventory_stats) summed every OUT row
 * (type = 'consumption'): stock-count losses, wastage and purchase undos were counted as
 * "consumed", and audited undos of consumption (consumption_reversal) were ignored. On the
 * production ledger that overstated monthly feed cost by ৳28,776.
 *
 * Feed eaten = consumption − consumption_reversal. Nothing else.
 */
export type LedgerRow = {
  item_id: string;
  movement_type: string;
  type?: string;
  qty: number | string;
  unit_cost: number | string | null;
  recorded_at: string;
};

export type MonthlyConsumption = { month_yr: string; category: string; total_cost: number };
export type InventoryStat = { item_id: string; total_stock: number; total_consumed: number; consumed_last_30d: number };

const IN_TYPES = new Set(["purchase", "opening_balance", "own_production", "feed_mix_output", "adjustment_in", "return", "consumption_reversal"]);

/** +qty for consumption, −qty for its audited undo, 0 for everything else. */
function eatenSign(movementType: string): number {
  return movementType === "consumption" ? 1 : movementType === "consumption_reversal" ? -1 : 0;
}

export function monthlyConsumptionRows(rows: LedgerRow[], categoryByItem: Record<string, string>): MonthlyConsumption[] {
  const acc = new Map<string, MonthlyConsumption>();
  for (const r of rows) {
    const sign = eatenSign(r.movement_type);
    if (!sign || r.unit_cost == null) continue;
    const month_yr = String(r.recorded_at).slice(0, 7);
    const category = categoryByItem[r.item_id] ?? "other";
    const key = `${month_yr}|${category}`;
    const e = acc.get(key) ?? { month_yr, category, total_cost: 0 };
    e.total_cost += sign * Number(r.qty) * Number(r.unit_cost);
    acc.set(key, e);
  }
  // not rounded here: the page adds these buckets up, and rounding each first lost poisha
  return [...acc.values()]
    .sort((a, b) => a.month_yr.localeCompare(b.month_yr) || a.category.localeCompare(b.category));
}

export function inventoryStatsRows(rows: LedgerRow[], since: string): InventoryStat[] {
  const acc = new Map<string, InventoryStat>();
  for (const r of rows) {
    const e = acc.get(r.item_id) ?? { item_id: r.item_id, total_stock: 0, total_consumed: 0, consumed_last_30d: 0 };
    const qty = Number(r.qty);
    e.total_stock += IN_TYPES.has(r.movement_type) ? qty : -qty;
    const sign = eatenSign(r.movement_type);
    e.total_consumed += sign * qty;
    if (String(r.recorded_at).slice(0, 10) >= since) e.consumed_last_30d += sign * qty;
    acc.set(r.item_id, e);
  }
  const r4 = (x: number) => Math.round((x + Number.EPSILON) * 10000) / 10000;
  return [...acc.values()].map((e) => ({ ...e, total_stock: r4(e.total_stock), total_consumed: r4(e.total_consumed), consumed_last_30d: r4(e.consumed_last_30d) }));
}

async function loadRows(supabase: SupabaseClient<any>, businessId: string) {
  // every row: a total over the first 1000 rows only would be silently wrong
  const rows = (await selectAll(() => supabase
    .from("inventory_transactions")
    .select("id, item_id, movement_type, qty, unit_cost, recorded_at, inventory_items!inner(business_id, category)")
    .eq("inventory_items.business_id", businessId)
    .order("id"))) as unknown as (LedgerRow & { inventory_items: { category: string } | null })[];
  const categoryByItem: Record<string, string> = {};
  for (const r of rows) if (r.inventory_items?.category) categoryByItem[r.item_id] = r.inventory_items.category;
  return { rows, categoryByItem };
}

/** Feed/stock eaten per month and item category (Finance page, reports). */
export async function loadMonthlyConsumptions(supabase: SupabaseClient<any>, businessId: string): Promise<MonthlyConsumption[]> {
  const { rows, categoryByItem } = await loadRows(supabase, businessId);
  return monthlyConsumptionRows(rows, categoryByItem);
}

/** Stock on hand, total eaten and eaten since a date, per item (Inventory page, AI query). */
export async function loadInventoryStats(supabase: SupabaseClient<any>, businessId: string, since: string): Promise<InventoryStat[]> {
  const { rows } = await loadRows(supabase, businessId);
  return inventoryStatsRows(rows, since);
}

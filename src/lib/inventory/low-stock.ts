import type { SupabaseClient } from "@supabase/supabase-js";
import { selectAll } from "@/lib/supabase/select-all";

export type LowStockItem = { id: string; name: string; unit: string; stock: number; daysLeft: number | null; threshold: number | null };

/**
 * Items running out, for the daily alerts. Stock on hand is the ledger's own balance view
 * (v_inventory_balance — the same number the Stock page shows), not a re-sum of rows, and the
 * last 30 days of use is read page by page, so neither stops at 1,000 rows.
 * With no business id (the service-role job), every business.
 */
export async function loadLowStock(supabase: SupabaseClient, businessId: string | null, now = new Date()): Promise<LowStockItem[]> {
  const since = new Date(now);
  since.setDate(since.getDate() - 30);
  const [balances, items, used] = await Promise.all([
    selectAll<{ item_id: string; qty_on_hand: number | string }>(() => {
      const q = supabase.from("v_inventory_balance").select("item_id, qty_on_hand");
      return (businessId ? q.eq("business_id", businessId) : q).order("item_id");
    }),
    selectAll<{ id: string; name: string; unit: string; low_stock_threshold: number | null; is_discontinued: boolean | null }>(() => {
      const q = supabase.from("inventory_items").select("id, name, unit, low_stock_threshold, is_discontinued").is("deleted_at", null);
      return (businessId ? q.eq("business_id", businessId) : q).order("id");
    }),
    selectAll<{ item_id: string; qty: number | string }>(() => {
      const q = supabase.from("inventory_transactions").select("item_id, qty, inventory_items!inner(business_id)")
        .eq("type", "consumption").gte("recorded_at", since.toISOString().slice(0, 10));
      return (businessId ? q.eq("inventory_items.business_id", businessId) : q).order("id");
    }),
  ]);

  const stockOf = new Map(balances.map((b) => [b.item_id, Number(b.qty_on_hand) || 0]));
  const used30 = new Map<string, number>();
  for (const u of used) used30.set(u.item_id, (used30.get(u.item_id) ?? 0) + (Number(u.qty) || 0));

  const out: LowStockItem[] = [];
  for (const item of items) {
    if (item.is_discontinued) continue;
    const stock = Math.max(0, stockOf.get(item.id) ?? 0);
    const daily = (used30.get(item.id) ?? 0) / 30;
    const daysLeft = daily > 0 ? Math.floor(stock / daily) : null;
    const threshold = item.low_stock_threshold;
    if ((daysLeft !== null && daysLeft < 10) || (threshold !== null && stock < threshold)) {
      out.push({ id: item.id, name: item.name, unit: item.unit, stock, daysLeft, threshold });
    }
  }
  return out;
}

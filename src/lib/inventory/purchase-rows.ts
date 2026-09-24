import type { ServerClient } from "@/lib/supabase/server";

/**
 * Ids (among `ids`) of purchase rows that were undone by a purchase_reversal. Purchase
 * history is never deleted; lists hide the undone rows and show the corrected ones.
 */
export async function undonePurchaseIds(supabase: ServerClient, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { data } = await supabase
    .from("inventory_transactions")
    .select("reverses_id")
    .eq("movement_type", "purchase_reversal")
    .in("reverses_id", ids);
  return new Set((data ?? []).map((r: { reverses_id: string | null }) => r.reverses_id).filter((x): x is string => !!x));
}

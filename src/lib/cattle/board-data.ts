import type { SupabaseClient } from "@supabase/supabase-js";
import { loadHomeInputs } from "@/lib/home/home-data";
import { todayDhaka } from "@/lib/dates";
import { buildBoard, type Board, type BoardRow } from "@/lib/cattle/board";

/** Cattle list data: the homepage calculation for active animals + history for sold/dead ones. */
export async function loadCattleBoard(supabase: SupabaseClient<any>, businessId: string, today = todayDhaka()): Promise<Board> {
  const [inputs, rowsRes, healthRes, salesRes] = await Promise.all([
    loadHomeInputs(supabase, businessId, today, { money: false }),
    supabase.from("cattle")
      .select("id, tag_id, breed, gender, status, purchase_date, purchase_price, target_weight_kg, is_quarantined, is_qurbani_marked, initial_weight_kg, initial_weight_type")
      .eq("business_id", businessId).is("deleted_at", null),
    supabase.from("health_events").select("cattle_id, title, scheduled_at")
      .eq("business_id", businessId).is("deleted_at", null).is("completed_at", null).not("cattle_id", "is", null)
      .order("scheduled_at", { ascending: true }),
    supabase.from("sales").select("cattle_id, sold_at, sale_price_total, cattle!inner(business_id)")
      .eq("cattle.business_id", businessId).is("deleted_at", null),
  ]);

  const logs: Record<string, { date: string; kg: number; type: "measured" | "estimated" }[]> = {};
  for (const a of inputs.feed.animals) logs[a.id] = a.logs;
  const feedByAnimal: Record<string, number> = {};
  for (const [id, f] of Object.entries(inputs.feed.snapshot.perAnimal)) feedByAnimal[id] = f.actual;

  return buildBoard({
    home: inputs.input,
    rows: ((rowsRes.data ?? []) as (BoardRow & { purchase_price: number | string; target_weight_kg: number | string | null })[])
      .map((r) => ({ ...r, purchase_price: Number(r.purchase_price ?? 0), target_weight_kg: r.target_weight_kg == null ? null : Number(r.target_weight_kg), purchase_date: String(r.purchase_date).slice(0, 10),
        initial_weight_kg: r.initial_weight_kg == null ? null : Number(r.initial_weight_kg) })),
    logs,
    feedByAnimal,
    directCostByCattle: inputs.directCostByCattle,
    health: ((healthRes.data ?? []) as { cattle_id: string; title: string; scheduled_at: string }[])
      .map((h) => ({ cattle_id: h.cattle_id, title: h.title, date: String(h.scheduled_at).slice(0, 10) })),
    sales: ((salesRes.data ?? []) as { cattle_id: string; sold_at: string; sale_price_total: number | string }[])
      .map((s) => ({ cattle_id: s.cattle_id, sold_at: String(s.sold_at).slice(0, 10), price: Number(s.sale_price_total) })),
  });
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { weightOn, type Animal } from "@/lib/feed/usage-engine";
import { todayDhaka } from "@/lib/dates";

export type HerdWeight = { kg: number; basis: "measured" | "estimated" | "none" };

/**
 * Each animal's weight today, by the same rule the feed engine allocates with:
 * latest measured weighing → purchase weight (unless estimated) → first later weighing →
 * estimated purchase weight (basis "estimated"). No weight at all → basis "none", kg 0.
 * Never a default such as 250 kg.
 */
export async function loadHerdWeights(
  supabase: SupabaseClient<any>,
  cattle: { id: string; purchase_date: string | null; initial_weight_kg: number | null; initial_weight_type?: string | null }[],
  asOf = todayDhaka()
): Promise<Record<string, HerdWeight>> {
  const ids = cattle.map((c) => c.id);
  const { data } = ids.length
    ? await supabase.from("weight_logs").select("cattle_id, weight_kg, recorded_at, weight_type").in("cattle_id", ids).is("deleted_at", null)
    : { data: [] };
  const logs = (data ?? []) as { cattle_id: string; weight_kg: number; recorded_at: string; weight_type: "measured" | "estimated" | null }[];
  const out: Record<string, HerdWeight> = {};
  for (const c of cattle) {
    const a: Animal = {
      id: c.id, tag: c.id, from: String(c.purchase_date ?? asOf).slice(0, 10), to: null,
      initialWeightKg: c.initial_weight_kg == null ? null : Number(c.initial_weight_kg),
      initialWeightType: (c.initial_weight_type as Animal["initialWeightType"]) ?? "unknown",
      logs: logs.filter((l) => l.cattle_id === c.id).map((l) => ({ date: l.recorded_at.slice(0, 10), kg: Number(l.weight_kg), type: l.weight_type ?? "measured" })),
    };
    const w = weightOn(a, asOf);
    out[c.id] = { kg: w.kg, basis: w.basis };
  }
  return out;
}

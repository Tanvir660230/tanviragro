import type { SupabaseClient } from "@supabase/supabase-js";
import { selectAll } from "@/lib/supabase/select-all";
import { bestBasis, weighInDays, purchaseWeights, type MemberEvidence, type Basis } from "@/lib/cattle/cost-split";

/** One animal of a group bought together, with what its share rests on. */
export type GroupMember = {
  id: string;
  tag: string;
  status: string;
  share: number;
  initialWeightKg: number | null;
  initialWeightType: "measured" | "estimated" | "unknown";
  sale: { date: string; price: number; weightKg: number | null; groupId: string | null } | null;
};

export type PurchaseGroupView = {
  id: string | null;
  purchasedOn: string;
  total: number;
  seller: string | null;
  method: string | null;
  /** stored basis: purchase_weight | purchase_weight_estimated | weigh_in:YYYY-MM-DD | equal | manual */
  basis: string | null;
  history: { at: string; event: string; method: string; basis: string }[];
  members: GroupMember[];
  evidence: MemberEvidence[];
  /** the best basis the evidence allows now */
  best: Basis;
  /** days on which every animal was weighed */
  weighIns: string[];
  hasPurchaseWeights: boolean;
  /** true when the stored split is equal only for lack of evidence */
  provisional: boolean;
  /** a better basis than the stored one is available */
  better: boolean;
};

const db = (s: unknown) => s as SupabaseClient<any>;

/**
 * A purchase group with its members and their weighings: by group id, or (to link animals
 * already on record) by a list of animal ids.
 */
export async function loadPurchaseGroupMembers(
  supabase: unknown, businessId: string, by: { groupId: string } | { cattleIds: string[] },
): Promise<PurchaseGroupView | null> {
  let group: { id: string; purchased_on: string; total_price: number | string; seller: string | null; method: string; basis: string; history: PurchaseGroupView["history"] } | null = null;
  if ("groupId" in by) {
    const { data } = await db(supabase).from("cattle_purchase_groups")
      .select("id, purchased_on, total_price, seller, method, basis, history")
      .eq("id", by.groupId).eq("business_id", businessId).is("deleted_at", null).maybeSingle();
    if (!data) return null;
    group = data;
  }
  const q = db(supabase).from("cattle")
    .select("id, tag_id, status, purchase_date, purchase_price, initial_weight_kg, initial_weight_type")
    .eq("business_id", businessId).is("deleted_at", null);
  const { data: rows } = await ("groupId" in by ? q.eq("purchase_group_id", by.groupId) : q.in("id", by.cattleIds)).order("tag_id");
  const cattle = (rows ?? []) as { id: string; tag_id: string; status: string; purchase_date: string; purchase_price: number | string; initial_weight_kg: number | string | null; initial_weight_type: string | null }[];
  if (!cattle.length) return null;
  const ids = cattle.map((c) => c.id);

  const [logs, sales] = await Promise.all([
    selectAll<{ id: string; cattle_id: string; weight_kg: number | string; recorded_at: string; weight_type: string | null }>(() =>
      db(supabase).from("weight_logs").select("id, cattle_id, weight_kg, recorded_at, weight_type")
        .in("cattle_id", ids).is("deleted_at", null).order("recorded_at").order("id")),
    selectAll<{ id: string; cattle_id: string; sold_at: string; sale_price_total: number | string; weight_at_sale_kg: number | string | null; sale_group_id: string | null }>(() =>
      db(supabase).from("sales").select("id, cattle_id, sold_at, sale_price_total, weight_at_sale_kg, sale_group_id")
        .in("cattle_id", ids).is("deleted_at", null).order("id")),
  ]);

  const purchasedOn = String(group?.purchased_on ?? cattle[0].purchase_date).slice(0, 10);
  const members: GroupMember[] = cattle.map((c) => {
    const s = sales.find((x) => x.cattle_id === c.id);
    return {
      id: c.id, tag: c.tag_id, status: c.status, share: Number(c.purchase_price ?? 0),
      initialWeightKg: Number(c.initial_weight_kg) > 0 ? Number(c.initial_weight_kg) : null,
      initialWeightType: (c.initial_weight_type ?? "unknown") as GroupMember["initialWeightType"],
      sale: s ? { date: String(s.sold_at).slice(0, 10), price: Number(s.sale_price_total), weightKg: s.weight_at_sale_kg == null ? null : Number(s.weight_at_sale_kg), groupId: s.sale_group_id } : null,
    };
  });
  const evidence: MemberEvidence[] = members.map((m) => ({
    id: m.id, initialWeightKg: m.initialWeightKg, initialWeightType: m.initialWeightType,
    logs: logs.filter((l) => l.cattle_id === m.id).map((l) => ({ date: String(l.recorded_at).slice(0, 10), kg: Number(l.weight_kg), type: l.weight_type === "estimated" ? "estimated" : "measured" })),
  }));
  const best = bestBasis(evidence, purchasedOn);
  const weighIns = weighInDays(evidence).filter((d) => d.date >= purchasedOn).map((d) => d.date);
  const basis = group?.basis ?? null;
  const rank = (b: string | null) => !b ? 0 : b === "equal" ? 1 : b === "purchase_weight_estimated" ? 2 : b.startsWith("weigh_in") ? 3 : b === "purchase_weight" ? 4 : 5;
  const bestKey = best.kind === "weigh_in" ? `weigh_in:${best.date}` : best.kind === "purchase_weight" ? (best.estimated ? "purchase_weight_estimated" : "purchase_weight") : "equal";

  return {
    id: group?.id ?? null,
    purchasedOn,
    total: group ? Number(group.total_price) : members.reduce((s, m) => s + m.share, 0),
    seller: group?.seller ?? null,
    method: group?.method ?? null,
    basis,
    history: Array.isArray(group?.history) ? group!.history : [],
    members,
    evidence,
    best,
    weighIns,
    hasPurchaseWeights: !!purchaseWeights(evidence),
    provisional: basis === "equal",
    // "manual" is the owner's own decision; never suggest replacing it
    better: basis !== "manual" && rank(bestKey) > rank(basis),
  };
}

/** The purchase group an animal belongs to (for its page), or null. */
export async function loadAnimalPurchaseGroup(supabase: unknown, businessId: string, cattleId: string): Promise<PurchaseGroupView | null> {
  const { data } = await db(supabase).from("cattle").select("purchase_group_id").eq("id", cattleId).eq("business_id", businessId).maybeSingle();
  const gid = (data as { purchase_group_id?: string | null } | null)?.purchase_group_id;
  return gid ? loadPurchaseGroupMembers(supabase, businessId, { groupId: gid }) : null;
}

export type SaleGroupView = {
  id: string; soldOn: string; total: number; buyer: string | null; method: string;
  lines: { cattleId: string; tag: string; price: number; weightKg: number | null }[];
};

/** The group sale an animal was part of, or null. */
export async function loadAnimalSaleGroup(supabase: unknown, businessId: string, cattleId: string): Promise<SaleGroupView | null> {
  const { data: sale } = await db(supabase).from("sales").select("sale_group_id").eq("cattle_id", cattleId).is("deleted_at", null).maybeSingle();
  const gid = (sale as { sale_group_id?: string | null } | null)?.sale_group_id;
  if (!gid) return null;
  const [{ data: g }, { data: lines }] = await Promise.all([
    db(supabase).from("cattle_sale_groups").select("id, sold_on, total_price, buyer, method").eq("id", gid).eq("business_id", businessId).maybeSingle(),
    db(supabase).from("sales").select("cattle_id, sale_price_total, weight_at_sale_kg, cattle!inner(tag_id)").eq("sale_group_id", gid).is("deleted_at", null),
  ]);
  if (!g) return null;
  return {
    id: g.id, soldOn: String(g.sold_on).slice(0, 10), total: Number(g.total_price), buyer: g.buyer, method: g.method,
    lines: ((lines ?? []) as { cattle_id: string; sale_price_total: number | string; weight_at_sale_kg: number | string | null; cattle: { tag_id: string } | { tag_id: string }[] }[])
      .map((l) => ({ cattleId: l.cattle_id, tag: (Array.isArray(l.cattle) ? l.cattle[0]?.tag_id : l.cattle?.tag_id) ?? "?", price: Number(l.sale_price_total), weightKg: l.weight_at_sale_kg == null ? null : Number(l.weight_at_sale_kg) }))
      .sort((a, b) => a.tag.localeCompare(b.tag)),
  };
}

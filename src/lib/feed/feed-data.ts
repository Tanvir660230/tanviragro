import type { SupabaseClient } from "@supabase/supabase-js";
import { todayDhaka } from "@/lib/dates";
import { loadUnitCostMap } from "@/lib/inventory/unit-cost";
import {
  computeFeedSnapshot, dayList, forecastDepletion,
  type Animal, type FeedSnapshot, type Period, type RecordedRow, type RuleType,
} from "./usage-engine";

/**
 * Loads a business's feed data and runs THE feed engine once (usage-engine.ts).
 * Every page that shows feed cost/usage uses this — no page computes feed cost itself.
 */

export type FeedItemStatus = {
  id: string;
  name: string;
  unit: string;
  category: string;
  kgPerUnit: number | null;
  stockQty: number;
  stockValue: number;
  wac: number | null;
  learnedDaily: number | null;
  openPeriodId: string | null;
  daysLeft: number | null;
  depletionDate: string | null;
};

export type FeedData = {
  asOf: string;
  snapshot: FeedSnapshot;
  periods: Period[];
  animals: Animal[];
  items: FeedItemStatus[];
  /** direct (cattle-linked) recorded feed value per animal — already inside snapshot.perAnimal */
  directByAnimal: Record<string, number>;
  /** days on which some feeding is on record: a usage period covers it, or a recorded row with net quantity > 0 */
  coveredDays: Set<string>;
};

type LineRow = {
  line_id: string; period_id: string; target_type: "item" | "recipe"; recipe_id: string | null;
  start_date: string; end_date: string | null; status: Period["status"] | "cancelled";
  rule_type: RuleType; rule_value: number | string | null;
  item_id: string; item_name: string; unit: string; kg_per_unit: number | string | null; share: number | string;
  closing_qty: number | string | null; consumed_qty: number | string | null; gap_qty: number | string | null;
  consumed_value: number | string | null; cost_missing: boolean;
};
const n = (v: number | string | null | undefined) => (v == null ? null : Number(v));

export async function loadFeedData(supabase: SupabaseClient<any>, businessId: string, asOf = todayDhaka()): Promise<FeedData> {
  const [linesRes, recipesRes, cattleRes, salesRes, itemsRes, balanceRes] = await Promise.all([
    supabase.from("v_feed_usage_lines").select("*").eq("business_id", businessId).order("start_date", { ascending: true }),
    supabase.from("feed_recipes").select("id, name").eq("business_id", businessId),
    supabase.from("cattle").select("id, tag_id, purchase_date, status, updated_at, initial_weight_kg, initial_weight_type").eq("business_id", businessId).is("deleted_at", null),
    supabase.from("sales").select("cattle_id, sold_at, cattle!inner(business_id)").eq("cattle.business_id", businessId).is("deleted_at", null),
    supabase.from("inventory_items").select("id, name, unit, category, kg_per_unit").eq("business_id", businessId).in("category", ["feed", "roughage"]).is("deleted_at", null),
    supabase.from("v_inventory_balance").select("item_id, qty_on_hand, value_on_hand").eq("business_id", businessId),
  ]);
  const items = (itemsRes.data ?? []) as { id: string; name: string; unit: string; category: string; kg_per_unit: number | null }[];
  const itemIds = items.map((i) => i.id);
  const cattle = (cattleRes.data ?? []) as { id: string; tag_id: string; purchase_date: string | null; status: string; updated_at: string | null; initial_weight_kg: number | null; initial_weight_type: Animal["initialWeightType"] | null }[];
  const cattleIds = cattle.map((c) => c.id);

  const [logsRes, unitCosts, recRes] = await Promise.all([
    cattleIds.length
      ? supabase.from("weight_logs").select("cattle_id, weight_kg, recorded_at, weight_type").in("cattle_id", cattleIds).is("deleted_at", null)
      : Promise.resolve({ data: [] }),
    loadUnitCostMap(supabase, businessId),
    itemIds.length
      ? supabase.from("inventory_transactions").select("item_id, qty, unit_cost, recorded_at, covers_from, cattle_id, movement_type")
          .in("item_id", itemIds).in("movement_type", ["consumption", "consumption_reversal"]).is("period_line_id", null)
      : Promise.resolve({ data: [] }),
  ]);

  // periods
  const recipeName = new Map(((recipesRes.data ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name]));
  const itemName = new Map(items.map((i) => [i.id, i]));
  const byPeriod = new Map<string, Period>();
  for (const r of (linesRes.data ?? []) as LineRow[]) {
    if (r.status === "cancelled") continue;
    let p = byPeriod.get(r.period_id);
    if (!p) {
      p = {
        id: r.period_id, targetType: r.target_type,
        targetName: r.target_type === "recipe" ? (recipeName.get(r.recipe_id ?? "") ?? "Recipe") : r.item_name,
        status: r.status, startDate: r.start_date, endDate: r.end_date,
        ruleType: r.rule_type, ruleValue: n(r.rule_value), lines: [],
      };
      byPeriod.set(r.period_id, p);
    }
    p.lines.push({
      itemId: r.item_id, itemName: r.item_name, unit: r.unit, kgPerUnit: n(r.kg_per_unit), share: Number(r.share),
      consumedQty: n(r.consumed_qty), consumedValue: n(r.consumed_value), gapQty: n(r.gap_qty),
      costMissing: r.cost_missing, closingQty: n(r.closing_qty),
    });
  }
  const periods = [...byPeriod.values()];

  // animals (presence = purchase → sale / exit)
  const soldAt = new Map(((salesRes.data ?? []) as { cattle_id: string; sold_at: string }[]).map((s) => [s.cattle_id, s.sold_at.slice(0, 10)]));
  const logsBy = new Map<string, Animal["logs"]>();
  for (const l of (logsRes.data ?? []) as { cattle_id: string; weight_kg: number; recorded_at: string; weight_type: "measured" | "estimated" | null }[]) {
    const arr = logsBy.get(l.cattle_id) ?? [];
    arr.push({ date: l.recorded_at.slice(0, 10), kg: Number(l.weight_kg), type: l.weight_type ?? "measured" });
    logsBy.set(l.cattle_id, arr);
  }
  const animals: Animal[] = cattle.filter((c) => c.purchase_date).map((c) => ({
    id: c.id, tag: c.tag_id, from: String(c.purchase_date).slice(0, 10),
    to: soldAt.get(c.id) ?? (c.status === "active" ? null : c.updated_at ? c.updated_at.slice(0, 10) : null),
    initialWeightKg: c.initial_weight_kg == null ? null : Number(c.initial_weight_kg),
    initialWeightType: c.initial_weight_type ?? "unknown",
    logs: logsBy.get(c.id) ?? [],
  }));

  // costing: the database's unit cost (moving average of stock on hand) — one source for all pages
  const wac: Record<string, number | null> = unitCosts;

  // recorded rows outside periods (manual / legacy / animal logs); reversals negative
  const directByAnimal: Record<string, number> = {};
  const recorded: RecordedRow[] = ((recRes.data ?? []) as { item_id: string; qty: number; unit_cost: number | null; recorded_at: string; covers_from: string | null; cattle_id: string | null; movement_type: string }[])
    .map((r) => {
      const qty = r.movement_type === "consumption_reversal" ? -Number(r.qty) : Number(r.qty);
      const unitCost = r.unit_cost == null ? null : Number(r.unit_cost);
      if (r.cattle_id && unitCost != null) directByAnimal[r.cattle_id] = (directByAnimal[r.cattle_id] ?? 0) + qty * unitCost;
      const it = itemName.get(r.item_id);
      return { date: r.recorded_at.slice(0, 10), coversFrom: r.covers_from ? r.covers_from.slice(0, 10) : null, itemId: r.item_id, itemName: it?.name, unit: it?.unit, qty, unitCost, cattleId: r.cattle_id };
    });

  const snapshot = computeFeedSnapshot({ asOf, periods, animals, recorded, wac });

  const balance = new Map(((balanceRes.data ?? []) as { item_id: string; qty_on_hand: number; value_on_hand: number }[]).map((b) => [b.item_id, b]));
  const openByItem = new Map<string, string>();
  for (const p of periods) if (p.status === "open") for (const l of p.lines) openByItem.set(l.itemId, p.id);
  const itemStatus: FeedItemStatus[] = items.map((i) => {
    const b = balance.get(i.id);
    const stockQty = Number(b?.qty_on_hand ?? 0);
    const learned = snapshot.learnedDaily[i.id] ?? null;
    // running estimate since the open period started reduces the stock expected on hand today
    const openLine = snapshot.lines.find((l) => l.itemId === i.id && l.status === "estimated");
    const expectedLeft = openLine?.qty != null ? stockQty - openLine.qty : stockQty;
    const f = forecastDepletion(expectedLeft, openLine?.dailyQty ?? learned, asOf);
    return {
      id: i.id, name: i.name, unit: i.unit, category: i.category, kgPerUnit: i.kg_per_unit,
      stockQty, stockValue: Number(b?.value_on_hand ?? 0), wac: wac[i.id] ?? null, learnedDaily: learned,
      openPeriodId: openByItem.get(i.id) ?? null, daysLeft: f.daysLeft, depletionDate: f.date,
    };
  });

  const coveredDays = new Set<string>();
  for (const p of periods) for (const d of dayList(p.startDate, p.endDate ?? asOf)) coveredDays.add(d);
  const net = new Map<string, number>();
  for (const r of recorded) {
    for (const d of r.coversFrom && r.coversFrom < r.date ? dayList(r.coversFrom, r.date) : [r.date]) net.set(d, (net.get(d) ?? 0) + r.qty);
  }
  for (const [d, q] of net) if (q > 0.0001) coveredDays.add(d);

  return { asOf, snapshot, periods, animals, items: itemStatus, directByAnimal, coveredDays };
}

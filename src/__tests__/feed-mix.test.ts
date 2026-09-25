/**
 * Dated feed mixes (mix-history.ts), feed roles (feed-data.ts) and topping up a day that was
 * short of stock (usage-engine.ts). Database side: supabase/tests/feed_mix.sql.
 */
import { buildMixHistory, kgOf, mixBatchIdOf, type MixBatchRow, type MixInputRow } from "@/lib/inventory/mix-history";
import { feedRoles } from "@/lib/feed/feed-data";
import { autoRowsDue, type Animal, type Period } from "@/lib/feed/usage-engine";

const B1 = "11111111-1111-4111-8111-111111111111";
const B2 = "22222222-2222-4222-8222-222222222222";
const B3 = "33333333-3333-4333-8333-333333333333";
const batch = (id: string, date: string, out: number, cost: number | null, undone = false): MixBatchRow => ({
  id, mix_date: date, output_item_id: "mix", output_qty: out, input_qty: out, total_cost: cost, note: null,
  created_at: `${date}T09:00:00Z`, undone_at: undone ? `${date}T10:00:00Z` : null, undo_reason: undone ? "twice" : null,
});
const input = (b: string, item: string, qty: number, cost: number): MixInputRow => ({ item_id: item, qty, unit_cost: cost, idempotency_key: `feed-mix:${b}:in:${item}` });
const items = {
  corn: { name: "ভুট্টা", unit: "kg", kgPerUnit: null },
  dorb: { name: "DORB", unit: "kg", kgPerUnit: null },
  molasses: { name: "Molasses", unit: "can", kgPerUnit: 20 },
};

describe("mix history = recipe by date", () => {
  const h = buildMixHistory(
    [batch(B1, "2026-09-01", 150, 6000), batch(B2, "2026-09-10", 100, 4200), batch(B3, "2026-09-12", 100, 4200, true)],
    [input(B1, "corn", 100, 40), input(B1, "dorb", 50, 40), input(B2, "corn", 30, 40), input(B2, "dorb", 50, 45), input(B2, "molasses", 1, 20), input(B3, "corn", 100, 40)],
    items,
  );
  test("newest first; each mix keeps its own shares", () => {
    expect(h.map((x) => x.date)).toEqual(["2026-09-12", "2026-09-10", "2026-09-01"]);
    const first = h[2];
    expect(first.lines.find((l) => l.itemId === "corn")?.pct).toBeCloseTo(66.67, 1);
    expect(first.perKg).toBeCloseTo(40, 6);
  });
  test("a unit other than kg counts by its kg (1 can = 20 kg)", () => {
    const second = h[1];
    expect(second.lines.find((l) => l.itemId === "molasses")).toMatchObject({ qty: 1, kg: 20 });
    expect(second.lines.find((l) => l.itemId === "corn")?.pct).toBeCloseTo(30, 6);   // 30 of 100 kg
  });
  test("change against the mix before, in percentage points (a new ingredient counts from 0)", () => {
    const second = h[1];
    expect(second.change.corn).toBeCloseTo(30 - 66.667, 1);
    expect(second.change.molasses).toBeCloseTo(20, 6);
  });
  test("an undone mix is kept, marked, and never the base of a comparison", () => {
    expect(h[0]).toMatchObject({ undone: true, undoReason: "twice", change: {} });
  });
  test("batch id is read from the row key only", () => {
    expect(mixBatchIdOf(`feed-mix:${B1}:in:corn`)).toBe(B1);
    expect(mixBatchIdOf(`feed-batch:${B1}:in:corn`)).toBeNull();
    expect(kgOf(2, items.molasses)).toBe(40);
  });
});

describe("feed roles", () => {
  const list = [
    { id: "mix", name: "Mix Feed", unit: "kg", category: "feed" },
    { id: "mix2", name: "দানাদার মিক্স", unit: "kg", category: "feed" },
    { id: "corn", name: "ভুট্টা", unit: "kg", category: "feed" },
    { id: "straw", name: "Straw (খড়)", unit: "piece", category: "roughage" },
    { id: "salt", name: "লবণ", unit: "kg", category: "feed" },
  ];
  test("mix by name or by being a mix output; ingredients from recipes/mixes; the rest fed directly", () => {
    const r = feedRoles({ items: list, mixOutputIds: [], ingredientIds: ["corn", "mix", "salt"] });
    expect(r).toEqual({ mix: "mix", mix2: "mix", corn: "ingredient", straw: "direct", salt: "ingredient" });
  });
  test("a word merely containing 'mix' is not a mix", () => {
    const r = feedRoles({ items: [{ id: "x", name: "Mixed grass hay", unit: "kg", category: "roughage" }], mixOutputIds: [], ingredientIds: [] });
    expect(r.x).toBe("direct");
  });
});

describe("a day short of stock is completed later", () => {
  const cow = (id: string): Animal => ({ id, tag: id, from: "2026-09-01", to: null, initialWeightKg: 300, initialWeightType: "measured", logs: [] });
  const p = (posted: Record<string, { qty: number; value: number }>): Period => ({
    id: "p", targetType: "item", targetId: "mix", targetName: "Mix", status: "open", startDate: "2026-09-01", endDate: null,
    ruleType: "per_head", ruleValue: 5, autoPostedThrough: null,
    lines: [{ lineId: "L", itemId: "mix", itemName: "Mix", unit: "kg", kgPerUnit: 1, share: 1, consumedQty: null, consumedValue: null, gapQty: null, costMissing: false, closingQty: null, posted }],
  });
  test("full days are skipped, a short day is sent with its planned amount", () => {
    const due = autoRowsDue({ asOf: "2026-09-04", periods: [p({ "2026-09-01": { qty: 10, value: 1 }, "2026-09-02": { qty: 4, value: 1 } })], animals: [cow("A"), cow("B")] });
    expect(due.rows).toEqual([{ lineId: "L", date: "2026-09-02", qty: 10 }, { lineId: "L", date: "2026-09-03", qty: 10 }]);
  });
});

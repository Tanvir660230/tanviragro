import { buildTodo, hasQty, isEmptyQty, isNegativeQty, lastMixByItem, lowItemIds, stockGroup, STOCK_EPS } from "@/lib/inventory/stock-view";
import { isRetired } from "@/lib/feed/feed-data";

const feed = (over: Partial<Parameters<typeof buildTodo>[0]["feed"][number]> = {}) => ({
  id: "f", name: "Mix", unit: "kg", role: "mix" as const, discontinued: false, stockQty: 100,
  openPeriodId: null as string | null, daysLeft: null as number | null, suggestedStart: null as string | null, ...over,
});
const item = (over: Partial<Parameters<typeof buildTodo>[0]["items"][number]> = {}) => ({
  id: "i", name: "Medicine", unit: "ml", category: "medicine", stock: 50, low_stock_threshold: null as number | null, ...over,
});

describe("one rule for empty", () => {
  it("a rounding crumb is empty, a real amount is not", () => {
    expect(isEmptyQty(0.004)).toBe(true);        // what "fill from stock" rounded to 2 decimals used to leave
    expect(hasQty(0.004)).toBe(false);
    expect(hasQty(STOCK_EPS)).toBe(true);
    expect(isEmptyQty(-0.004)).toBe(true);
    expect(isNegativeQty(-0.5)).toBe(true);
    expect(isNegativeQty(-0.004)).toBe(false);
  });
  it("a retired item with a crumb left is retired (not a live 0 kg row)", () => {
    expect(isRetired(true, 0.004)).toBe(true);
    expect(isRetired(true, 0.5)).toBe(false);
  });
});

describe("stock tabs", () => {
  it("feed, ingredient, other", () => {
    expect(stockGroup("feed", "mix")).toBe("feed");
    expect(stockGroup("roughage", "direct")).toBe("feed");
    expect(stockGroup("feed", "ingredient")).toBe("ingredient");
    expect(stockGroup("medicine", undefined)).toBe("other");
    expect(stockGroup("medicine", "ingredient")).toBe("other");
  });
});

describe("where an ingredient went", () => {
  it("keeps the latest mix, adds two mixes on one day, reads the mix name", () => {
    const m = lastMixByItem([
      { item_id: "corn", qty: 40, recorded_at: "2026-09-10", notes: "Feed mix 2026-09-10 → দানাদার মিক্স" },
      { item_id: "corn", qty: 30, recorded_at: "2026-09-21", notes: "Feed mix 2026-09-21 · morning → দানাদার মিক্স" },
      { item_id: "corn", qty: 20, recorded_at: "2026-09-21T00:00:00", notes: "Feed mix 2026-09-21 → দানাদার মিক্স" },
      { item_id: "bran", qty: "12.5", recorded_at: "2026-09-18", notes: null },
    ]);
    expect(m.corn).toEqual({ date: "2026-09-21", qty: 50, mixName: "দানাদার মিক্স" });
    expect(m.bran).toEqual({ date: "2026-09-18", qty: 12.5, mixName: null });
  });
});

describe("what needs doing", () => {
  const asOf = "2026-09-27";

  it("urgent first: out of stock, below zero, low, idle, not started, waiting", () => {
    const todo = buildTodo({
      asOf,
      feed: [
        feed({ id: "a", name: "A", role: "direct", stockQty: 0, openPeriodId: "p1" }),                       // in use, ran out
        feed({ id: "b", name: "B", role: "direct", stockQty: 40, openPeriodId: "p2", daysLeft: 3.6 }),        // in use, 3 days
        feed({ id: "c", name: "C", role: "direct", stockQty: 40, openPeriodId: "p3", daysLeft: 20 }),         // fine
        feed({ id: "d", name: "D", role: "mix", stockQty: 200, suggestedStart: "2026-09-20" }),               // idle 7 days
        feed({ id: "e", name: "E", role: "direct", stockQty: 10, suggestedStart: "2026-09-27" }),             // bought today
        feed({ id: "g", name: "Corn", role: "ingredient", stockQty: 80 }),
        feed({ id: "h", name: "Bran", role: "ingredient", stockQty: 0.004 }),                                 // a crumb: not waiting
      ],
      items: [item({ id: "x", name: "Salt", stock: -2 }), item({ id: "y", name: "Vitamin", stock: 3, low_stock_threshold: 5 })],
    });
    expect(todo.map((r) => `${r.kind}:${r.itemId}`)).toEqual([
      "out:a", "negative:x", "low:b", "low:y", "idle:d", "not_started:e", "waiting:g",
    ]);
    expect(todo.find((r) => r.kind === "low" && r.itemId === "b")?.days).toBe(3);
    expect(todo.find((r) => r.kind === "waiting")?.itemIds).toEqual(["g"]);
    expect(lowItemIds(todo)).toEqual(["a", "b", "y"]);
  });

  it("nothing for retired, finished or healthy items; one row per item", () => {
    const todo = buildTodo({
      asOf,
      feed: [
        feed({ id: "r", discontinued: true, stockQty: 5 }),
        feed({ id: "z", stockQty: 0 }),
        feed({ id: "k", role: "direct", stockQty: 5, openPeriodId: "p", daysLeft: 30 }),
      ],
      // a feed in use is judged by days left, never by its alert level too
      items: [item({ id: "k", category: "feed", stock: 5, low_stock_threshold: 10 }), item({ id: "m", stock: 50, low_stock_threshold: 5 })],
    });
    expect(todo).toEqual([]);
  });
});

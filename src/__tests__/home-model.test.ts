/** Homepage model (src/lib/home/home-model.ts): numbers from verified sources, estimates labelled, nothing invented. */
import { buildHomeModel, type HomeInput } from "@/lib/home/home-model";
import { computeFeedSnapshot, type Animal } from "@/lib/feed/usage-engine";
import { nextEidDate } from "@/lib/home/eid";

const animal = (id: string, from: string, kg: number, logs: Animal["logs"] = []): Animal =>
  ({ id, tag: id, from, to: null, initialWeightKg: kg, initialWeightType: "measured", logs });

function input(over: Partial<HomeInput> = {}): HomeInput {
  const animals = [
    animal("A", "2026-06-01", 200, [{ date: "2026-09-01", kg: 290, type: "measured" }]),
    animal("B", "2026-08-01", 250, []),
  ];
  const feed = computeFeedSnapshot({
    asOf: "2026-09-24", periods: [], wac: {}, animals,
    recorded: [{ date: "2026-09-10", itemId: "corn", unit: "kg", qty: 90, unitCost: 40, cattleId: null }],
  });
  return {
    today: "2026-09-24", nextEid: "2026-12-01",
    cattle: [
      { id: "A", tag: "A", purchaseDate: "2026-06-01", purchasePrice: 80000, initialWeightKg: 200, initialWeightType: "measured", targetWeightKg: null,
        logs: [{ date: "2026-09-01", kg: 290, type: "measured" }] },
      { id: "B", tag: "B", purchaseDate: "2026-08-01", purchasePrice: 90000, initialWeightKg: 250, initialWeightType: "estimated", targetWeightKg: null, logs: [] },
    ],
    feed,
    feedItems: [
      { id: "corn", name: "Corn", unit: "kg", stockQty: 40, daysLeft: 2, inUse: true },
      { id: "hay", name: "Hay", unit: "piece", stockQty: 100, daysLeft: null, inUse: false },
    ],
    directCostByCattle: { A: 1000 },
    marketPricePerKg: 400,
    cash: 5000, monthOperatingExpenses: 3000,
    healthDue: [
      { cattleTag: "A", title: "FMD", date: "2026-09-01" },
      { cattleTag: "B", title: "FMD", date: "2026-09-02" },
      { cattleTag: "A", title: "Deworm", date: "2026-09-25" },
    ],
    ...over,
  };
}

describe("cattle", () => {
  const m = buildHomeModel(input());
  const A = m.cattle.find((c) => c.id === "A")!;
  const B = m.cattle.find((c) => c.id === "B")!;
  test("measured growth: 200 → 290 kg over 92 days; today's weight is projected and labelled", () => {
    expect(A.adgKg).toBeCloseTo(90 / 92, 6);
    expect(A.weightBasis).toBe("projected");
    expect(A.weightKg).toBeCloseTo(290 + (90 / 92) * 23, 6);
  });
  test("an estimated purchase weight is shown as estimated and gives no daily gain", () => {
    expect(B.weightBasis).toBe("estimated");
    expect(B.adgKg).toBeNull();
  });
  test("cost so far = purchase + actual feed + direct costs; profit = weight × price − cost", () => {
    expect(A.costSoFar).toBeCloseTo(80000 + A.feedCost + 1000, 6);
    expect(A.profitToday).toBeCloseTo(A.weightKg! * 400 - A.costSoFar, 6);
    expect(A.feedCost + B.feedCost).toBeCloseTo(3600, 6);   // the whole recorded feed is allocated
  });
  test("no market price → no value or profit (never invented)", () => {
    const n = buildHomeModel(input({ marketPricePerKg: null }));
    expect(n.cattle.every((c) => c.valueToday == null && c.profitToday == null)).toBe(true);
    expect(n.money.herdValue).toBeNull();
    expect(n.attention.some((a) => a.kind === "price")).toBe(true);
  });
});

describe("what needs doing", () => {
  const m = buildHomeModel(input());
  test("health is one line per state, not one row per event; urgent first", () => {
    const h = m.attention.filter((a) => a.kind.startsWith("health"));
    expect(h.map((a) => [a.kind, a.detail])).toEqual([["health_overdue", "2"], ["health_due", "1"]]);
    expect(m.attention[0].severity).toBe("urgent");
  });
  test("feed about to run out, feed in stock not started, cattle to weigh", () => {
    expect(m.attention.find((a) => a.kind === "feed_low")).toMatchObject({ title: "Corn", detail: "2", severity: "urgent" });
    expect(m.attention.find((a) => a.kind === "feed_not_started")).toMatchObject({ title: "Hay", detail: "1" });
    expect(m.attention.find((a) => a.kind === "weigh")).toMatchObject({ title: "A, B" });   // A: 23 days, B: never
  });
});

describe("Eid", () => {
  test("projection only when every animal has a measured daily gain", () => {
    expect(buildHomeModel(input()).eid).toMatchObject({ daysLeft: 68, tooFar: false, projectedValue: null });
  });
  test("more than 120 days away → no projection (a straight line that far is not reliable)", () => {
    const e = buildHomeModel(input({ nextEid: "2027-05-16" })).eid!;
    expect(e.tooFar).toBe(true);
    expect(buildHomeModel(input({ nextEid: "2027-05-16" })).cattle.every((c) => c.eid == null)).toBe(true);
  });
  test("next Eid date comes from the shared list", () => {
    expect(nextEidDate("2026-09-24")).toBe("2027-05-16");
    expect(nextEidDate("2026-05-27")).toBe("2027-05-16");
    expect(nextEidDate("2033-01-01") > "2033-01-01").toBe(true);
  });
});

describe("money and feed", () => {
  const m = buildHomeModel(input());
  test("herd totals are the sums of the animals", () => {
    expect(m.money.herdCost).toBeCloseTo(m.cattle.reduce((s, c) => s + c.costSoFar, 0), 6);
    expect(m.money.herdProfit).toBeCloseTo(m.money.herdValue! - m.money.herdCost, 6);
  });
  test("month's actual feed and cost per head per day (last 30 days)", () => {
    expect(m.feed.monthActual).toBeCloseTo(3600, 6);
    expect(m.feed.dailyPerHead).toBeCloseTo(3600 / 2 / 30, 6);
    expect(m.feed.items.map((i) => i.id)).toEqual(["corn", "hay"]);   // in use first
  });
});

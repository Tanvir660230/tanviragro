/** Cattle list model (src/lib/cattle/board.ts): same figures as the homepage; filters, sort, sold/dead results. */
import { buildBoard, matchesFilter, sortAnimals, type BoardRow } from "@/lib/cattle/board";
import { buildHomeModel, type HomeInput } from "@/lib/home/home-model";
import { computeFeedSnapshot, type Animal } from "@/lib/feed/usage-engine";

const TODAY = "2026-09-24";
const logsA = [{ date: "2026-09-01", kg: 290, type: "measured" as const }];
const animals: Animal[] = [
  { id: "A", tag: "A", from: "2026-06-01", to: null, initialWeightKg: 200, initialWeightType: "measured", logs: logsA },
  { id: "B", tag: "B", from: "2026-08-01", to: null, initialWeightKg: 250, initialWeightType: "estimated", logs: [] },
  { id: "S", tag: "S", from: "2026-06-01", to: "2026-07-01", initialWeightKg: 180, initialWeightType: "measured", logs: [] },
];
const feed = computeFeedSnapshot({
  asOf: TODAY, periods: [], wac: {}, animals,
  recorded: [
    { date: "2026-06-15", itemId: "corn", unit: "kg", qty: 30, unitCost: 40, cattleId: null },
    { date: "2026-09-10", itemId: "corn", unit: "kg", qty: 90, unitCost: 40, cattleId: null },
  ],
});
const home: HomeInput = {
  today: TODAY, nextEid: "2027-05-16",
  cattle: [
    { id: "A", tag: "A", purchaseDate: "2026-06-01", purchasePrice: 80000, initialWeightKg: 200, initialWeightType: "measured", targetWeightKg: 300, logs: logsA },
    { id: "B", tag: "B", purchaseDate: "2026-08-01", purchasePrice: 90000, initialWeightKg: 250, initialWeightType: "estimated", targetWeightKg: null, logs: [] },
  ],
  feed, feedItems: [], directCostByCattle: { A: 1000, S: 500 }, marketPricePerKg: 400, cash: null, monthOperatingExpenses: null, healthDue: [],
};
const row = (id: string, status: string, over: Partial<BoardRow> = {}): BoardRow => ({
  id, tag_id: id, breed: "Sahiwal", gender: "male", status, purchase_date: "2026-06-01", purchase_price: 80000,
  target_weight_kg: null, is_quarantined: false, is_qurbani_marked: false, initial_weight_kg: 200, initial_weight_type: "measured", ...over,
});
const board = buildBoard({
  home,
  rows: [row("A", "active", { target_weight_kg: 300 }), row("B", "active", { purchase_date: "2026-08-01", purchase_price: 90000, initial_weight_kg: 250, initial_weight_type: "estimated", is_quarantined: true }),
         row("S", "sold", { purchase_price: 70000, initial_weight_kg: 180 })],
  logs: { A: logsA },
  feedByAnimal: Object.fromEntries(Object.entries(feed.perAnimal).map(([k, v]) => [k, v.actual])),
  directCostByCattle: { A: 1000, S: 500 },
  health: [{ cattle_id: "B", title: "FMD", date: "2026-09-20" }, { cattle_id: "B", title: "Deworm", date: "2026-10-01" }],
  sales: [{ cattle_id: "S", sold_at: "2026-07-01", price: 95000 }],
});
const A = board.animals.find((a) => a.id === "A")!;
const B = board.animals.find((a) => a.id === "B")!;
const S = board.animals.find((a) => a.id === "S")!;

test("active animals carry exactly the homepage figures", () => {
  const h = buildHomeModel(home).cattle;
  expect(A.metrics).toEqual(h.find((c) => c.id === "A"));
  expect(B.metrics).toEqual(h.find((c) => c.id === "B"));
});

test("weight history starts at the purchase weight; an estimated purchase weight is marked estimated", () => {
  expect(A.series.map((p) => [p.date, p.kg, p.type])).toEqual([["2026-06-01", 200, "measured"], ["2026-09-01", 290, "measured"]]);
  expect(B.series).toEqual([{ date: "2026-06-01", kg: 250, type: "estimated" }].map((p) => ({ ...p, date: "2026-08-01" })));
});

test("next health task is the earliest open one, flagged overdue", () => {
  expect(B.nextHealth).toEqual({ title: "FMD", date: "2026-09-20", overdue: true });
  expect(A.nextHealth).toBeNull();
});

test("a sold animal shows its realised result: sale price − purchase − feed − direct costs", () => {
  expect(S.metrics).toBeNull();
  expect(S.realised!.kind).toBe("sold");
  expect(S.realised!.cost).toBeCloseTo(70000 + (feed.perAnimal.S?.actual ?? 0) + 500, 6);
  expect(S.realised!.result).toBeCloseTo(95000 - S.realised!.cost, 6);
});

test("filters", () => {
  const ids = (f: Parameters<typeof matchesFilter>[1]) => board.animals.filter((a) => matchesFilter(a, f, TODAY)).map((a) => a.id);
  expect(ids("all")).toEqual(["A", "B"]);
  expect(ids("past")).toEqual(["S"]);
  expect(ids("quarantine")).toEqual(["B"]);
  expect(ids("health")).toEqual(["B"]);
  expect(ids("weigh")).toEqual(["A", "B"]);          // A 23 days, B never weighed
  expect(ids("losing")).toEqual(board.animals.filter((a) => (a.metrics?.profitToday ?? 0) < 0).map((a) => a.id));
});

test("sorting puts animals without the figure last", () => {
  expect(sortAnimals(board.animals, "adg").map((a) => a.id)).toEqual(["A", "B", "S"]);   // only A has a measured daily gain
  expect(sortAnimals(board.animals, "tag").map((a) => a.id)).toEqual(["A", "B", "S"]);
});

test("summary = sums over active animals; herd cost equals the homepage", () => {
  const m = buildHomeModel(home).money;
  expect(board.summary.active).toBe(2);
  expect(board.summary.herdCost).toBeCloseTo(m.herdCost, 6);
  expect(board.summary.weighedCount).toBe(1);
  expect(board.summary.estimatedCount).toBe(1);
  expect(board.summary.avgAdgKg).toBeCloseTo(A.metrics!.adgKg!, 6);
});

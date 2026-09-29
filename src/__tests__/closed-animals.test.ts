/** Animals that have left the farm (src/lib/cattle/closed.ts): the sale report, the list totals, one way to sell. */
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { closedSummary, daysOnFarm, saleReport } from "@/lib/cattle/closed";
import { buildBoard, matchesFilter, type BoardRow } from "@/lib/cattle/board";
import type { HomeInput } from "@/lib/home/home-model";
import { computeFeedSnapshot } from "@/lib/feed/usage-engine";

test("days on the farm run from purchase to the day it left", () => {
  expect(daysOnFarm("2026-07-31", "2026-09-29")).toBe(60);
  expect(daysOnFarm("2026-07-31", "2026-07-31T18:00:00Z")).toBe(0);
  expect(daysOnFarm("2026-09-30", "2026-09-29")).toBe(0);   // never negative
});

describe("sale report", () => {
  // C006: bought 31 Jul with a GUESSED 250 kg, weighed once (210 kg), sold 29 Sep for ৳106,000
  const c006 = { initial_weight_kg: 250, initial_weight_type: "estimated" as const, purchase_date: "2026-07-31" };
  const logs = [{ weight_kg: 210, recorded_at: "2026-09-14T08:00:00Z", weight_type: "measured" as const }];

  test("result, return on cost and profit per day", () => {
    const r = saleReport({ salePrice: 106000, cost: 105200, purchaseDate: "2026-07-31", soldOn: "2026-09-29", animal: c006, logs });
    expect(r.result).toBe(800);
    expect(r.roiPct).toBeCloseTo((800 / 105200) * 100, 6);
    expect(r.days).toBe(60);
    expect(r.perDay).toBeCloseTo(800 / 60, 6);
  });

  test("no sale weight: no price per kg, and one weighing after a guess is not growth", () => {
    const r = saleReport({ salePrice: 106000, cost: 105200, purchaseDate: "2026-07-31", soldOn: "2026-09-29", animal: c006, logs });
    expect(r.saleWeightKg).toBeNull();
    expect(r.pricePerKg).toBeNull();
    expect(r.growth).toBeNull();
  });

  test("the sale weight ends the growth and gives the price per kg", () => {
    const r = saleReport({ salePrice: 106000, cost: 105200, purchaseDate: "2026-07-31", soldOn: "2026-09-29", saleWeightKg: 222, animal: c006, logs });
    expect(r.pricePerKg).toBeCloseTo(106000 / 222, 6);
    expect(r.growth).toMatchObject({ fromKg: 210, fromDate: "2026-09-14", fromPurchase: false, toKg: 222, toDate: "2026-09-29", atSale: true, days: 15 });
    expect(r.growth!.adg).toBeCloseTo(12 / 15, 6);
  });

  test("a measured purchase weight is the start; weighings after the sale are ignored", () => {
    const r = saleReport({
      salePrice: 90000, cost: 95000, purchaseDate: "2026-06-01", soldOn: "2026-08-01",
      animal: { initial_weight_kg: 200, initial_weight_type: "measured", purchase_date: "2026-06-01" },
      logs: [{ weight_kg: 240, recorded_at: "2026-07-01T00:00:00Z" }, { weight_kg: 999, recorded_at: "2026-08-05T00:00:00Z" }],
    });
    expect(r.growth).toMatchObject({ fromKg: 200, fromPurchase: true, toKg: 240, atSale: false, days: 30 });
    expect(r.result).toBe(-5000);
  });

  test("a cost recorded after the sale is reported, not hidden", () => {
    const base = { salePrice: 106000, purchaseDate: "2026-07-31", soldOn: "2026-09-29", animal: c006, logs };
    expect(saleReport({ ...base, cost: 105200, costAtSale: 104700 }).changedBy).toBe(500);
    expect(saleReport({ ...base, cost: 104700, costAtSale: 105200 }).changedBy).toBe(-500);
    expect(saleReport({ ...base, cost: 105200, costAtSale: 105199.6 }).changedBy).toBeNull();   // rounding
    expect(saleReport({ ...base, cost: 105200, costAtSale: null }).changedBy).toBeNull();        // sold before it was kept
  });
});

describe("the cattle list's sold and died / stolen views", () => {
  const feed = computeFeedSnapshot({ asOf: "2026-09-29", periods: [], wac: {}, animals: [], recorded: [] });
  const home: HomeInput = {
    today: "2026-09-29", nextEid: "2027-05-16", cattle: [], feed, feedItems: [], directCostByCattle: {},
    marketPricePerKg: 400, cash: null, monthOperatingExpenses: null, healthDue: [],
  };
  const row = (id: string, status: string, price: number): BoardRow => ({ id, tag_id: id, breed: null, gender: null, status, purchase_date: "2026-07-01",
    purchase_price: price, target_weight_kg: null, is_quarantined: false, is_qurbani_marked: false });
  const board = buildBoard({
    home, logs: {}, feedByAnimal: {}, directCostByCattle: {}, health: [],
    rows: [row("S1", "sold", 80000), row("S2", "sold", 90000), row("D", "dead", 50000), row("A", "active", 70000)],
    sales: [
      { cattle_id: "S1", sold_at: "2026-09-01", price: 100000, weightKg: 250, buyer: "Karim", costAtSale: 79000 },
      { cattle_id: "S2", sold_at: "2026-09-29", price: 85000 },
    ],
    deaths: [{ cattle_id: "D", date: "2026-08-10", cause: "Bloat" }],
  });
  const by = (id: string) => board.animals.find((a) => a.id === id)!;

  test("a sold animal carries its days, sale weight, buyer and the cost when sold", () => {
    expect(by("S1").realised).toMatchObject({ kind: "sold", days: 62, weightKg: 250, buyer: "Karim", costAtSale: 79000, result: 20000 });
    expect(by("D").realised).toMatchObject({ kind: "dead", days: 40, result: -50000 });
  });

  test("sold and died / stolen are separate views", () => {
    const ids = (f: "sold" | "lost") => board.animals.filter((a) => matchesFilter(a, f, "2026-09-29")).map((a) => a.id);
    expect(ids("sold")).toEqual(["S1", "S2"]);
    expect(ids("lost")).toEqual(["D"]);
  });

  test("totals: revenue, cost, profit, average per animal and days", () => {
    const s = closedSummary(board.animals);
    expect(s.sold).toMatchObject({ count: 2, revenue: 185000, cost: 170000, result: 15000, avgResult: 7500 });
    expect(s.sold.avgDays).toBeCloseTo((62 + 90) / 2, 6);
    expect(s.sold.roiPct).toBeCloseTo((15000 / 170000) * 100, 6);
    expect(s.lost).toEqual({ count: 1, cost: 50000 });
  });
});

test("every sale goes through sell_cattle_group: no code writes a sale row directly", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) { if (f !== "__tests__") walk(p); }
      else if (/\.(ts|tsx)$/.test(f)) files.push(p);
    }
  };
  walk(join(__dirname, ".."));
  const direct = files.filter((f) => /from\(\s*["']sales["']\s*\)\s*\.insert\(/.test(readFileSync(f, "utf8").replace(/\s+/g, " ")));
  expect(direct).toEqual([]);
});

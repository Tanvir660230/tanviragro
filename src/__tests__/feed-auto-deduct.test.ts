/**
 * Daily automatic deduction and the weight-based feeding chart (usage-engine.ts).
 * Database side (posting, cap at stock, count adjustment, count & continue) is tested in
 * supabase/tests/feed_auto_deduct.sql.
 */
import {
  autoRowsDue, bandFor, chartOn, computeFeedSnapshot, need,
  type Animal, type ChartVersion, type Period,
} from "@/lib/feed/usage-engine";

const cow = (id: string, kg: number | null, from = "2026-09-01"): Animal =>
  ({ id, tag: id, from, to: null, initialWeightKg: kg, initialWeightType: "measured", logs: [] });

const chart = (over: Partial<ChartVersion> = {}): ChartVersion => ({
  id: "c1", targetType: "item", targetId: "hay", effectiveFrom: "2026-09-01",
  bands: [
    { minKg: 0, maxKg: 180, amount: 3, basis: "per_head" },
    { minKg: 180, maxKg: 300, amount: 2, basis: "pct_bw" },
    { minKg: 300, maxKg: null, amount: 8, basis: "per_head" },
  ],
  ...over,
});

const openPeriod = (over: Partial<Period> = {}): Period => ({
  id: "p1", targetType: "item", targetId: "hay", targetName: "Hay", status: "open", startDate: "2026-09-01", endDate: null,
  ruleType: "chart", ruleValue: null,
  lines: [{ lineId: "L1", itemId: "hay", itemName: "Hay", unit: "kg", kgPerUnit: 1, share: 1, consumedQty: null, consumedValue: null, gapQty: null, costMissing: false, closingQty: null }],
  ...over,
});

describe("feeding chart", () => {
  test("band by weight: lower bound inclusive, upper exclusive, last open-ended; no weight → lightest band", () => {
    const c = chart();
    expect(bandFor(c, 179.9)?.minKg).toBe(0);
    expect(bandFor(c, 180)?.minKg).toBe(180);
    expect(bandFor(c, 650)?.minKg).toBe(300);
    expect(bandFor(c, 0)?.minKg).toBe(0);
  });
  test("the version in force on a day is the latest one that has started", () => {
    const v1 = chart({ id: "v1", effectiveFrom: "2026-09-01" });
    const v2 = chart({ id: "v2", effectiveFrom: "2026-09-10" });
    expect(chartOn([v1, v2], "item", "hay", "2026-09-09")?.id).toBe("v1");
    expect(chartOn([v1, v2], "item", "hay", "2026-09-10")?.id).toBe("v2");
    expect(chartOn([v1, v2], "item", "hay", "2026-08-31")).toBeNull();
    expect(chartOn([v1, v2], "recipe", "hay", "2026-09-10")).toBeNull();
  });
  test("per head and % of weight, in the item's unit", () => {
    const c = { version: chart(), targetType: "item" as const };
    const line = { unit: "kg", kgPerUnit: 1, share: 1 };
    expect(need(cow("a", 150), "2026-09-02", "chart", null, line, c).qty).toBe(3);          // 3 kg per head
    expect(need(cow("b", 250), "2026-09-02", "chart", null, line, c).qty).toBeCloseTo(5, 9); // 2 % of 250 kg
    expect(need(cow("c", 400), "2026-09-02", "chart", null, line, c).qty).toBe(8);
  });
  test("an item counted in pieces: % of weight converts with kg per piece, else unknown", () => {
    const c = { version: chart({ bands: [{ minKg: 0, maxKg: null, amount: 2, basis: "pct_bw" }] }), targetType: "item" as const };
    expect(need(cow("a", 300), "2026-09-02", "chart", null, { unit: "piece", kgPerUnit: 4, share: 1 }, c).qty).toBeCloseTo(1.5, 9);
    expect(need(cow("a", 300), "2026-09-02", "chart", null, { unit: "piece", kgPerUnit: null, share: 1 }, c).qty).toBeNull();
  });
  test("a recipe chart is kg of mix, split by each ingredient's share", () => {
    const c = { version: chart({ targetType: "recipe", targetId: "mix", bands: [{ minKg: 0, maxKg: null, amount: 4, basis: "per_head" }] }), targetType: "recipe" as const };
    expect(need(cow("a", 300), "2026-09-02", "chart", null, { unit: "kg", kgPerUnit: 1, share: 0.25 }, c).qty).toBeCloseTo(1, 9);
  });
});

describe("automatic daily rows", () => {
  const herd = [cow("A", 150), cow("B", 250), cow("C", 400, "2026-09-03")];
  test("one row per line per completed day by the chart (today is not posted)", () => {
    const due = autoRowsDue({ asOf: "2026-09-05", periods: [openPeriod()], animals: herd, charts: [chart()] });
    expect(due.through).toBe("2026-09-04");
    expect(due.periodIds).toEqual(["p1"]);
    expect(due.rows.map((r) => r.date)).toEqual(["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"]);
    expect(due.rows[0].qty).toBeCloseTo(3 + 5, 9);            // A + B
    expect(due.rows[2].qty).toBeCloseTo(3 + 5 + 8, 9);        // C arrives on the 3rd
  });
  test("resumes after the last posted day and skips days already posted", () => {
    const p = openPeriod({ autoPostedThrough: "2026-09-02" });
    p.lines[0].posted = { "2026-09-03": { qty: 16, value: 320 } };
    const due = autoRowsDue({ asOf: "2026-09-05", periods: [p], animals: herd, charts: [chart()] });
    expect(due.rows.map((r) => r.date)).toEqual(["2026-09-04"]);
  });
  test("nothing due once posted through yesterday; closed periods never post", () => {
    expect(autoRowsDue({ asOf: "2026-09-05", periods: [openPeriod({ autoPostedThrough: "2026-09-04" })], animals: herd, charts: [chart()] }).periodIds).toEqual([]);
    expect(autoRowsDue({ asOf: "2026-09-05", periods: [openPeriod({ status: "closed", endDate: "2026-09-04" })], animals: herd, charts: [chart()] }).rows).toEqual([]);
  });
  test("no chart and no history: the period advances with no rows (the count settles it)", () => {
    const due = autoRowsDue({ asOf: "2026-09-05", periods: [openPeriod({ ruleType: "weight_share" })], animals: herd, charts: [] });
    expect(due.periodIds).toEqual(["p1"]);
    expect(due.rows).toEqual([]);
  });
});

describe("snapshot of an open period with automatic rows", () => {
  test("posted days are actual (on the books), only the days not posted yet are estimated", () => {
    const p = openPeriod({ autoPostedThrough: "2026-09-02" });
    p.lines[0].posted = { "2026-09-01": { qty: 8, value: 160 }, "2026-09-02": { qty: 8, value: 160 } };
    const s = computeFeedSnapshot({ asOf: "2026-09-03", periods: [p], animals: [cow("A", 150), cow("B", 250)], recorded: [], wac: { hay: 20 }, charts: [chart()] });
    const l = s.lines[0];
    expect(l).toMatchObject({ status: "estimated", postedQty: 16, postedValue: 320, pendingQty: 8, lastPosted: "2026-09-02", estimateBasis: "rule" });
    expect(l.qty).toBe(24);
    expect(l.dailyQty).toBeCloseTo(8, 9);
    expect(s.totals.actual).toBe(320);
    expect(s.totals.estimated).toBe(160);
    // allocation by the chart: A (3 kg) and B (5 kg) share each posted day 3 : 5
    expect(s.perAnimal.A.actual).toBeCloseTo(320 * 3 / 8, 6);
    expect(s.perAnimal.B.actual).toBeCloseTo(320 * 5 / 8, 6);
  });
  test("a day inside the posted range with no row (stock had run out) is not estimated again", () => {
    const p = openPeriod({ autoPostedThrough: "2026-09-02" });
    p.lines[0].posted = { "2026-09-01": { qty: 8, value: 160 } };
    const s = computeFeedSnapshot({ asOf: "2026-09-03", periods: [p], animals: [cow("A", 150), cow("B", 250)], recorded: [], wac: { hay: 20 }, charts: [chart()] });
    expect(s.lines[0]).toMatchObject({ postedQty: 8, pendingQty: 8, qty: 16 });
  });
});

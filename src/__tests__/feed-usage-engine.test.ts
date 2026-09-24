/**
 * The authoritative feed usage engine (src/lib/feed/usage-engine.ts).
 * Database side (closing, late-entry re-reconciliation, gaps, locks) is tested in
 * supabase/tests/feed_usage.sql.
 */
import {
  computeFeedSnapshot, dayList, forecastDepletion, learnedDailyUsage, need, variance, weightOn,
  type Animal, type Period,
} from "@/lib/feed/usage-engine";

const cow = (id: string, kg: number, from = "2026-09-01", to: string | null = null, type: Animal["initialWeightType"] = "measured"): Animal =>
  ({ id, tag: id, from, to, initialWeightKg: kg, initialWeightType: type, logs: [] });

const closed = (over: Partial<Period> = {}, qty = 700, value = 7000): Period => ({
  id: "p1", targetType: "item", targetName: "Hay", status: "closed", startDate: "2026-09-01", endDate: "2026-09-07",
  ruleType: "weight_share", ruleValue: null,
  lines: [{ itemId: "hay", itemName: "Hay", unit: "kg", kgPerUnit: 1, share: 1, consumedQty: qty, consumedValue: value, gapQty: 0, costMissing: false, closingQty: 0 }],
  ...over,
});

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("allocation", () => {
  test("weight-based, never equal: a 500 kg animal gets 2.5× a 200 kg animal", () => {
    const s = computeFeedSnapshot({ asOf: "2026-09-30", periods: [closed()], animals: [cow("big", 500), cow("small", 200)], recorded: [], wac: {} });
    expect(s.perAnimal.big.actual).toBeCloseTo(5000, 6);
    expect(s.perAnimal.small.actual).toBeCloseTo(2000, 6);
    expect(s.perAnimal.big.actual / s.perAnimal.small.actual).toBeCloseTo(2.5, 6);
  });

  test("feed is allocated only while an animal is in the herd", () => {
    // A all 7 days; B arrives on the 5th (3 days). Equal weights → head-days 7 : 3
    const s = computeFeedSnapshot({ asOf: "2026-09-30", periods: [closed()], animals: [cow("A", 300), cow("B", 300, "2026-09-05")], recorded: [], wac: {} });
    expect(s.perAnimal.A.actual).toBeCloseTo(7000 * 7 / 10, 6);
    expect(s.perAnimal.B.actual).toBeCloseTo(7000 * 3 / 10, 6);
    const left = computeFeedSnapshot({ asOf: "2026-09-30", periods: [closed()], animals: [cow("A", 300), cow("C", 300, "2026-09-01", "2026-09-02")], recorded: [], wac: {} });
    expect(left.perAnimal.C.actual).toBeCloseTo(7000 * 2 / 9, 6); // sold after day 2
  });

  test("the whole actual cost is allocated — nothing lost, nothing added", () => {
    const s = computeFeedSnapshot({ asOf: "2026-09-30", periods: [closed()], animals: [cow("A", 310), cow("B", 190), cow("C", 420)], recorded: [], wac: {} });
    expect(sum(Object.values(s.perAnimal).map((a) => a.actual)) + s.unallocated).toBeCloseTo(7000, 6);
    expect(s.totals.actual).toBe(7000);
  });

  test("5-cattle acceptance: allocation follows weight and covers every day of 01–08 Sep", () => {
    const animals = [cow("c1", 200), cow("c2", 250), cow("c3", 300), cow("c4", 350), cow("c5", 400)];
    const p = closed({ endDate: "2026-09-08" }, 800, 8000);
    const s = computeFeedSnapshot({ asOf: "2026-09-08", periods: [p], animals, recorded: [], wac: {} });
    expect(s.perAnimal.c5.actual / s.perAnimal.c1.actual).toBeCloseTo(2, 6);
    expect(sum(Object.values(s.perAnimal).map((a) => a.actual))).toBeCloseTo(8000, 6);
    expect(s.lines[0]).toMatchObject({ status: "actual", days: 8, dailyQty: 100 });
  });
});

describe("weights", () => {
  const a: Animal = {
    id: "c6", tag: "C006", from: "2026-07-31", to: null, initialWeightKg: 250, initialWeightType: "estimated",
    logs: [{ date: "2026-09-14", kg: 210, type: "measured" }, { date: "2026-09-20", kg: 400, type: "estimated" }],
  };
  test("an estimated purchase weight is not used when a measurement exists", () => {
    expect(weightOn(a, "2026-08-10")).toEqual({ kg: 210, basis: "measured" }); // first measurement after
    expect(weightOn(a, "2026-09-25")).toEqual({ kg: 210, basis: "measured" }); // estimated log ignored
  });
  test("with no measurement at all the estimate is used and labelled", () => {
    expect(weightOn(cow("x", 180, "2026-09-01", null, "estimated"), "2026-09-05")).toEqual({ kg: 180, basis: "estimated" });
  });
});

describe("rules, recipes, estimates", () => {
  test("1.5% of live weight: 300 kg → 4.5 kg/day", () => {
    expect(need(cow("a", 300), "2026-09-02", "pct_live_weight", 1.5, { unit: "kg", kgPerUnit: 1, share: 1 }).qty).toBeCloseTo(4.5, 9);
  });
  test("recipe: 10 kg of mix → corn 4 kg (40%), soybean cake 1.5 kg (15%)", () => {
    const pct = (share: number) => need(cow("a", 1000), "2026-09-02", "pct_live_weight", 1, { unit: "kg", kgPerUnit: 1, share }).qty;
    expect(pct(0.4)).toBeCloseTo(4, 9);
    expect(pct(0.15)).toBeCloseTo(1.5, 9);
  });
  test("straw by the piece: a kg rule is not converted without kg per piece", () => {
    expect(need(cow("a", 300), "2026-09-02", "pct_live_weight", 1.5, { unit: "piece", kgPerUnit: null, share: 1 }).qty).toBeNull();
    expect(need(cow("a", 300), "2026-09-02", "per_head", 0.5, { unit: "piece", kgPerUnit: null, share: 1 }).qty).toBe(0.5);
  });
  test("an open period is ESTIMATED from the rule and never counted as actual", () => {
    const open: Period = { ...closed(), status: "open", endDate: null, ruleType: "per_head", ruleValue: 5 };
    const s = computeFeedSnapshot({ asOf: "2026-09-10", periods: [open], animals: [cow("A", 300), cow("B", 300)], recorded: [], wac: { hay: 20 } });
    expect(s.lines[0]).toMatchObject({ status: "estimated", estimateBasis: "rule", days: 10, qty: 100, value: 2000 });
    expect(s.totals).toMatchObject({ actual: 0, estimated: 2000 });
    expect(s.perAnimal.A).toMatchObject({ actual: 0, estimated: 1000 });
  });
  test("without a rule, the running estimate uses usage learned from closed periods", () => {
    const history = closed({ id: "old", startDate: "2026-08-01", endDate: "2026-08-10" }, 100, 2000); // 10/day
    const open: Period = { ...closed({ id: "now" }), status: "open", startDate: "2026-09-01", endDate: null };
    const s = computeFeedSnapshot({ asOf: "2026-09-05", periods: [history, open], animals: [cow("A", 300, "2026-07-01")], recorded: [], wac: { hay: 20 } });
    expect(s.lines.find((l) => l.periodId === "now")).toMatchObject({ estimateBasis: "learned", qty: 50, value: 1000 });
  });
  test("no rule and no history → no estimate (not a guess)", () => {
    const open: Period = { ...closed(), status: "open", endDate: null };
    const s = computeFeedSnapshot({ asOf: "2026-09-05", periods: [open], animals: [cow("A", 300)], recorded: [], wac: { hay: 20 } });
    expect(s.lines[0]).toMatchObject({ estimateBasis: "none", qty: null, value: null });
  });
});

describe("reconciliation, variance, forecast", () => {
  test("a closed period with a stock gap is UNRECONCILED, not actual", () => {
    const p = closed({ status: "unreconciled" });
    p.lines[0] = { ...p.lines[0], consumedQty: 0, consumedValue: 0, gapQty: 30 };
    const s = computeFeedSnapshot({ asOf: "2026-09-30", periods: [p], animals: [cow("A", 300)], recorded: [], wac: {} });
    expect(s.lines[0]).toMatchObject({ status: "unreconciled", gapQty: 30 });
    expect(s.totals.unreconciledLines).toBe(1);
  });
  test("variance: expected 200, actual 230 → +30 (+15%)", () => {
    expect(variance(200, 230)).toEqual({ qty: 30, pct: 15 });
  });
  test("variance of a closed period uses only usage learned from EARLIER periods", () => {
    const p1 = closed({ id: "p1", startDate: "2026-08-01", endDate: "2026-08-10" }, 200, 2000);   // 20/day
    const p2 = closed({ id: "p2", startDate: "2026-09-01", endDate: "2026-09-10" }, 230, 2300);
    const s = computeFeedSnapshot({ asOf: "2026-09-30", periods: [p1, p2], animals: [cow("A", 300, "2026-07-01")], recorded: [], wac: {} });
    expect(s.lines.find((l) => l.periodId === "p2")).toMatchObject({ expectedQty: 200, varianceQty: 30, variancePct: 15 });
  });
  test("forecast: 80 kg at 20 kg/day → 4 days (a forecast, not a transaction)", () => {
    expect(forecastDepletion(80, 20, "2026-09-10")).toEqual({ daysLeft: 4, date: "2026-09-14" });
    expect(forecastDepletion(80, null, "2026-09-10")).toEqual({ daysLeft: null, date: null });
  });
  test("learned usage: recent closed periods only, never open ones", () => {
    const open: Period = { ...closed({ id: "o" }), status: "open", endDate: null };
    expect(learnedDailyUsage([closed({}, 70), open])).toEqual({ hay: 10 });
  });
});

describe("recorded rows and double counting", () => {
  test("an animal's own recorded row stays with it; herd rows split by weight; reversals net out", () => {
    const s = computeFeedSnapshot({
      asOf: "2026-09-30", periods: [], animals: [cow("A", 300), cow("B", 100)], wac: {},
      recorded: [
        { date: "2026-09-02", itemId: "mix", qty: 4, unitCost: 50, cattleId: "B" },
        { date: "2026-09-03", itemId: "mix", qty: 8, unitCost: 50, cattleId: null },
        { date: "2026-09-04", itemId: "mix", qty: 5, unitCost: 50, cattleId: null },
        { date: "2026-09-04", itemId: "mix", qty: -5, unitCost: 50, cattleId: null },     // audited undo
        { date: "2026-09-05", itemId: "mix", qty: 3, unitCost: null, cattleId: null },    // unknown cost
      ],
    });
    expect(s.perAnimal.B.actual).toBeCloseTo(200 + 100, 6);
    expect(s.perAnimal.A.actual).toBeCloseTo(300, 6);
    expect(s.totals).toMatchObject({ actual: 600, recordedMissingCost: 1 });
  });
  test("a stock-finished catch-up covering several days is spread over them; a late arrival pays only its days", () => {
    // 10 days, A (200 kg) all along, B (200 kg) arrives on day 6 → weight-days: days 1–5 = 1000, days 6–10 = 2000
    const s = computeFeedSnapshot({
      asOf: "2026-09-30", periods: [], wac: {},
      animals: [cow("A", 200, "2026-09-01"), cow("B", 200, "2026-09-06")],
      recorded: [{ date: "2026-09-10", coversFrom: "2026-09-01", itemId: "corn", qty: 300, unitCost: 10, cattleId: null }],
    });
    expect(s.perAnimal.A.actual).toBeCloseTo(1000 + 1000, 6);   // days 1–5 alone + half of days 6–10
    expect(s.perAnimal.B.actual).toBeCloseTo(1000, 6);          // only the 5 days it was there
    expect(s.totals.actual).toBeCloseTo(3000, 6);
    expect(s.unallocated).toBe(0);
    // booked on one day instead, B would wrongly carry half of everything
    const oneDay = computeFeedSnapshot({
      asOf: "2026-09-30", periods: [], wac: {},
      animals: [cow("A", 200, "2026-09-01"), cow("B", 200, "2026-09-06")],
      recorded: [{ date: "2026-09-10", itemId: "corn", qty: 300, unitCost: 10, cattleId: null }],
    });
    expect(oneDay.perAnimal.B.actual).toBeCloseTo(1500, 6);
  });
  test("period + recorded never exceed what left the store (the period posts only the remainder)", () => {
    // store: 220 used in total; manual row 10 + period posting 210 (see supabase/tests U3)
    const p = closed({}, 210, 2100);
    const s = computeFeedSnapshot({ asOf: "2026-09-30", periods: [p], animals: [cow("A", 300)], wac: {},
      recorded: [{ date: "2026-09-03", itemId: "hay", qty: 10, unitCost: 10, cattleId: null }] });
    expect(s.byItem.hay.actualQty).toBe(220);
    expect(s.totals.actual).toBe(2200);
  });
  test("monthly totals keep actual and estimated apart", () => {
    const open: Period = { ...closed({ id: "o", startDate: "2026-09-08" }), status: "open", endDate: null, ruleType: "per_head", ruleValue: 1 };
    const s = computeFeedSnapshot({ asOf: "2026-09-09", periods: [closed(), open], animals: [cow("A", 300)], recorded: [], wac: { hay: 10 } });
    expect(s.byMonth["2026-09"]).toEqual({ actual: 7000, estimated: 20 });
  });
  test("day list is inclusive", () => {
    expect(dayList("2026-09-01", "2026-09-03")).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
  });
});

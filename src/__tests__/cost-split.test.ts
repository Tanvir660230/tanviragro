import fs from "fs";
import path from "path";
import { splitTotal, largestRemainder, bestBasis, splitOnBasis, weighInDays, purchaseWeights, basisKey, profitPerAnimal, type MemberEvidence } from "@/lib/cattle/cost-split";

const sum = (r: Record<string, number>) => Math.round(Object.values(r).reduce((s, x) => s + x, 0) * 100) / 100;
const ok = (r: ReturnType<typeof splitTotal>) => { if (!r.ok) throw new Error(r.error); return r.amounts; };

describe("one price over several animals: the shares add up to the price exactly", () => {
  test("1 animal carries the whole price", () => {
    expect(ok(splitTotal(85000, [{ id: "a", weightKg: 200 }], "weight"))).toEqual({ a: 85000 });
    expect(ok(splitTotal(85000, [{ id: "a" }], "equal"))).toEqual({ a: 85000 });
  });
  test("2 animals, 200 kg + 210 kg, ৳171,000 → by weight", () => {
    const r = ok(splitTotal(171000, [{ id: "a", weightKg: 200 }, { id: "b", weightKg: 210 }], "weight"));
    expect(r).toEqual({ a: 83415, b: 87585 });
    expect(sum(r)).toBe(171000);
  });
  test("2 animals of the same weight → the same share", () => {
    expect(ok(splitTotal(171000, [{ id: "a", weightKg: 205 }, { id: "b", weightKg: 205 }], "weight"))).toEqual({ a: 85500, b: 85500 });
  });
  test("3 animals, ৳100,000 equal → no taka lost to rounding", () => {
    const r = ok(splitTotal(100000, [{ id: "a" }, { id: "b" }, { id: "c" }], "equal"));
    expect(Object.values(r).sort()).toEqual([33333, 33333, 33334]);
    expect(sum(r)).toBe(100000);
  });
  test("many animals of mixed weights always add up", () => {
    const lines = Array.from({ length: 17 }, (_, i) => ({ id: `c${i}`, weightKg: 150 + ((i * 37) % 90) + 0.5 }));
    for (const total of [999999, 1234567, 17, 3]) {
      const r = ok(splitTotal(total, lines, "weight"));
      expect(sum(r)).toBe(total);
      expect(Object.values(r).every((x) => Number.isInteger(x) && x >= 0)).toBe(true);
    }
  });
  test("heavier animal never carries less", () => {
    const r = ok(splitTotal(250000, [{ id: "s", weightKg: 180 }, { id: "m", weightKg: 220 }, { id: "l", weightKg: 260 }], "weight"));
    expect(r.s).toBeLessThan(r.m);
    expect(r.m).toBeLessThan(r.l);
  });
  test("a total with paisa is split in paisa", () => {
    const r = ok(splitTotal(1000.5, [{ id: "a" }, { id: "b" }], "equal"));
    expect(sum(r)).toBe(1000.5);
  });
  test("weight split needs every weight", () => {
    expect(splitTotal(1000, [{ id: "a", weightKg: 200 }, { id: "b" }], "weight")).toEqual({ ok: false, error: "missing_weight" });
  });
  test("manual prices must add up to the total; the difference is reported", () => {
    expect(ok(splitTotal(171000, [{ id: "a", amount: 80000 }, { id: "b", amount: 91000 }], "manual"))).toEqual({ a: 80000, b: 91000 });
    expect(splitTotal(171000, [{ id: "a", amount: 80000 }, { id: "b", amount: 90000 }], "manual")).toEqual({ ok: false, error: "sum_mismatch", detail: 1000 });
    expect(splitTotal(1000, [{ id: "a", amount: -1 }, { id: "b", amount: 1001 }], "manual")).toMatchObject({ ok: false, error: "bad_amount" });
  });
  test("no animals, a duplicate or a bad total is refused", () => {
    expect(splitTotal(1000, [], "equal")).toMatchObject({ ok: false, error: "no_animals" });
    expect(splitTotal(1000, [{ id: "a" }, { id: "a" }], "equal")).toMatchObject({ ok: false, error: "duplicate" });
    expect(splitTotal(Number.NaN, [{ id: "a" }], "equal")).toMatchObject({ ok: false, error: "bad_total" });
  });
  test("largest remainder: parts add up, ties go to the earlier line", () => {
    expect(largestRemainder(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(largestRemainder(0, [1, 2])).toEqual([0, 0]);
  });
});

const m = (id: string, kg: number | null, type: MemberEvidence["initialWeightType"], logs: MemberEvidence["logs"] = []): MemberEvidence =>
  ({ id, initialWeightKg: kg, initialWeightType: type, logs });

describe("which basis a purchase group uses, best evidence first", () => {
  test("measured weights at purchase → by those weights", () => {
    const b = bestBasis([m("a", 200, "measured"), m("b", 210, "measured")], "2026-09-01");
    expect(b).toMatchObject({ kind: "purchase_weight", estimated: false });
    expect(ok(splitOnBasis(171000, ["a", "b"], b))).toEqual({ a: 83415, b: 87585 });
  });
  test("no weight at purchase, no weigh-in → equal, marked provisional", () => {
    const b = bestBasis([m("a", 0, "unknown"), m("b", 0, "unknown")], "2026-09-01");
    expect(b).toEqual({ kind: "equal", method: "equal", provisional: true });
    expect(ok(splitOnBasis(171000, ["a", "b"], b))).toEqual({ a: 85500, b: 85500 });
  });
  test("later, the first day both were weighed becomes the basis", () => {
    const members = [
      m("a", 0, "unknown", [{ date: "2026-09-05", kg: 201, type: "measured" }, { date: "2026-09-20", kg: 215, type: "measured" }]),
      m("b", 0, "unknown", [{ date: "2026-09-12", kg: 199, type: "measured" }, { date: "2026-09-20", kg: 224, type: "measured" }]),
    ];
    expect(weighInDays(members).map((d) => d.date)).toEqual(["2026-09-20"]);
    const b = bestBasis(members, "2026-09-01");
    expect(b).toMatchObject({ kind: "weigh_in", date: "2026-09-20", weights: { a: 215, b: 224 } });
    expect(basisKey(b)).toBe("weigh_in:2026-09-20");
    expect(sum(ok(splitOnBasis(171000, ["a", "b"], b)))).toBe(171000);
  });
  test("an estimated weighing is not a weigh-in", () => {
    const members = [m("a", 0, "unknown", [{ date: "2026-09-20", kg: 215, type: "estimated" }]), m("b", 0, "unknown", [{ date: "2026-09-20", kg: 224, type: "measured" }])];
    expect(weighInDays(members)).toEqual([]);
  });
  test("guessed weights at purchase: a weigh-in within 30 days wins, a much later one does not", () => {
    const guess = (logDate: string) => [
      m("a", 200, "estimated", [{ date: logDate, kg: 205, type: "measured" }]),
      m("b", 200, "estimated", [{ date: logDate, kg: 230, type: "measured" }]),
    ];
    expect(bestBasis(guess("2026-09-15"), "2026-09-01").kind).toBe("weigh_in");
    expect(bestBasis(guess("2026-12-15"), "2026-09-01")).toMatchObject({ kind: "purchase_weight", estimated: true });
    expect(purchaseWeights(guess("2026-09-15"))?.estimated).toBe(true);
  });
  test("a weigh-in before the purchase date does not count", () => {
    const members = [m("a", 0, "unknown", [{ date: "2026-08-20", kg: 200, type: "measured" }]), m("b", 0, "unknown", [{ date: "2026-08-20", kg: 210, type: "measured" }])];
    expect(bestBasis(members, "2026-09-01").kind).toBe("equal");
  });
});

describe("the whole flow: bought together, sold apart or together, profit per animal", () => {
  const cost = (share: number, feed: number) => share + feed;
  test("2 bought at ৳171,000 (200 + 210 kg); one sold alone, then the other → each has its own profit", () => {
    const buy = ok(splitTotal(171000, [{ id: "a", weightKg: 200 }, { id: "b", weightKg: 210 }], "weight"));
    const saleA = ok(splitTotal(120000, [{ id: "a" }], "equal"));       // partial sale: only "a"
    const saleB = ok(splitTotal(126000, [{ id: "b" }], "equal"));
    const p = profitPerAnimal([{ id: "a", sale: saleA.a, cost: cost(buy.a, 20000) }, { id: "b", sale: saleB.b, cost: cost(buy.b, 21000) }]);
    expect(p).toEqual([{ id: "a", profit: 120000 - 83415 - 20000 }, { id: "b", profit: 126000 - 87585 - 21000 }]);
  });
  test("3 bought equal (no weights), sold together by sale weight → shares and profits add up to the group's", () => {
    const buy = ok(splitTotal(250000, [{ id: "a" }, { id: "b" }, { id: "c" }], "equal"));
    const sale = ok(splitTotal(400000, [{ id: "a", weightKg: 260 }, { id: "b", weightKg: 280 }, { id: "c", weightKg: 250 }], "weight"));
    const p = profitPerAnimal(["a", "b", "c"].map((id) => ({ id, sale: sale[id], cost: buy[id] })));
    expect(Math.round(p.reduce((s, x) => s + x.profit, 0))).toBe(400000 - 250000);
    expect(p.find((x) => x.id === "b")!.profit).toBeGreaterThan(p.find((x) => x.id === "c")!.profit);
  });
  test("re-splitting a group by a weigh-in changes each cost but never the group's total", () => {
    const members = [
      { id: "a", initialWeightKg: null, initialWeightType: "unknown" as const, logs: [{ date: "2026-09-10", kg: 190, type: "measured" as const }] },
      { id: "b", initialWeightKg: null, initialWeightType: "unknown" as const, logs: [{ date: "2026-09-10", kg: 230, type: "measured" as const }] },
    ];
    const before = ok(splitOnBasis(171000, ["a", "b"], { kind: "equal", method: "equal", provisional: true }));
    const after = ok(splitOnBasis(171000, ["a", "b"], bestBasis(members, "2026-09-01")));
    expect(sum(before)).toBe(171000);
    expect(sum(after)).toBe(171000);
    expect(after.b).toBeGreaterThan(after.a);
  });
});

describe("the database keeps the shares whole", () => {
  const sql = fs.readFileSync(path.join(__dirname, "../../supabase/migrations/20260928110000_cattle_groups.sql"), "utf8");
  test("every group function checks membership, the lock and that the shares add up", () => {
    for (const fn of ["create_cattle_purchase_group", "link_cattle_purchase_group", "allocate_cattle_purchase_group", "sell_cattle_group", "revert_cattle_sale_group"]) {
      const body = sql.slice(sql.indexOf(`function public.${fn}(`), sql.indexOf("end $$;", sql.indexOf(`function public.${fn}(`)));
      expect(body).toMatch(/cattle_group_assert/);
      if (fn !== "revert_cattle_sale_group") expect(body).toMatch(/add up to|cattle_group_check_shares/);
    }
  });
  test("a single animal's share or a group sale cannot be changed outside the group", () => {
    expect(sql).toMatch(/create trigger trg_cattle_group_share_guard before update on public\.cattle/);
    expect(sql).toMatch(/create trigger trg_sale_group_guard before update on public\.sales/);
  });
  test("the server computes the shares; only typed prices come from the browser", () => {
    const actions = fs.readFileSync(path.join(__dirname, "../app/dashboard/(app)/cattle/group-actions.ts"), "utf8");
    expect(actions).toMatch(/splitTotal\(/);
    expect(actions).toMatch(/price: split\.amounts\[l\.cattleId\]/);
  });
});

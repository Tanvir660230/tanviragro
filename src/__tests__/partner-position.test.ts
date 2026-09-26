import {
  buildPartnerPositions, capitalDays, checkRule, splitPercents, termsOn,
  type PositionAnimal, type PositionInput, type PositionPartner, type ShareRule,
} from "@/lib/partners/position";

const P = (id: string, over: Partial<PositionPartner> = {}): PositionPartner => ({
  id, name: id, partnerType: "capital", shareMode: "auto", fixedPct: 0, bearsLoss: true,
  joinedAt: "2026-06-01", leftAt: null, laborValueMonthly: null, cliffMonths: 0, ...over,
});

// the farm: Tanvir and Nanu from June, Omor from late July, Mohiuddin 50% labour (no loss)
const partners = [
  P("tanvir"),
  P("mohiuddin", { partnerType: "labor", shareMode: "manual", fixedPct: 50, bearsLoss: false }),
  P("nanu", { joinedAt: "2026-06-08" }),
  P("omor", { joinedAt: "2026-07-28" }),
];
const txns = [
  { partnerId: "tanvir", type: "investment", amount: 300000, date: "2026-06-01" },
  { partnerId: "nanu", type: "investment", amount: 160000, date: "2026-06-08" },
  { partnerId: "omor", type: "investment", amount: 100000, date: "2026-07-28" },
];
const A = (id: string, over: Partial<PositionAnimal> = {}): PositionAnimal => ({
  id, tag: id, status: "active", purchaseDate: "2026-06-01", endDate: null, purchasePrice: 200000, ownCost: 0, salePrice: null, valueToday: 200000, ...over,
});
/** the same running cost every day from `from` to `to` */
const everyDay = (amount: number, from: string, to: string) => {
  const out: { date: string; amount: number }[] = [];
  for (let d = Date.parse(`${from}T00:00:00Z`); d <= Date.parse(`${to}T00:00:00Z`); d += 86400000) out.push({ date: new Date(d).toISOString().slice(0, 10), amount });
  return out;
};

function input(over: Partial<PositionInput> = {}): PositionInput {
  return {
    asOf: "2026-09-26", partners, txns, rules: [], feeRates: [], marketPricePerKg: 420,
    dailyCosts: everyDay(500, "2026-06-01", "2026-09-26"),
    animals: [A("a", { ownCost: 2000, valueToday: 300000 }), A("b", { ownCost: 2500, valueToday: 250000 })],
    ...over,
  };
}
const byId = (ps: { id: string }[]) => Object.fromEntries(ps.map((p) => [p.id, p])) as Record<string, ReturnType<typeof buildPartnerPositions>["partners"][number]>;

describe("results", () => {
  it("nothing sold: no realized loss — running costs are part of what the cattle cost", () => {
    const { farm, partners: ps } = buildPartnerPositions(input());
    expect(farm.realized).toBe(0);
    // 118 days × ৳500 = 59,000 running; value 550,000 − (400,000 + 4,500 + 59,000) = 86,500
    expect(farm.runningCosts).toBe(59000);
    expect(farm.estimate).toBeCloseTo(86500, 2);
    for (const p of ps) { expect(p.realizedShare).toBe(0); expect(p.distributable).toBe(0); }
  });

  it("each day's running cost goes to the animals on the farm that day", () => {
    const { farm } = buildPartnerPositions(input({
      dailyCosts: everyDay(600, "2026-06-01", "2026-06-10"),
      animals: [A("a"), A("b", { purchaseDate: "2026-06-06" })],
    }));
    const a = farm.animals.find((x) => x.id === "a")!;
    const b = farm.animals.find((x) => x.id === "b")!;
    expect(a.runningShare).toBeCloseTo(5 * 600 + 5 * 300, 6);   // alone 5 days, shared 5 days
    expect(b.runningShare).toBeCloseTo(5 * 300, 6);
  });

  it("a sold animal's result never changes after it left (later costs go to the animals still here)", () => {
    const sold = A("s", { status: "sold", endDate: "2026-07-10", purchasePrice: 100000, salePrice: 150000, valueToday: null });
    const before = buildPartnerPositions(input({ asOf: "2026-07-20", animals: [sold, A("a")], dailyCosts: everyDay(500, "2026-06-01", "2026-07-20") })).farm.realized;
    const after = buildPartnerPositions(input({ asOf: "2026-09-26", animals: [sold, A("a")], dailyCosts: [...everyDay(500, "2026-06-01", "2026-07-20"), ...everyDay(5000, "2026-07-21", "2026-09-26")] })).farm.realized;
    expect(after).toBeCloseTo(before, 6);
  });

  it("running costs on a day with no animal are a realized loss", () => {
    const { farm } = buildPartnerPositions(input({ dailyCosts: [{ date: "2026-05-20", amount: 1000 }], animals: [A("a", { valueToday: 200000 })] }));
    expect(farm.orphanRunning).toBe(1000);
    expect(farm.realized).toBe(-1000);
  });

  it("the parts add up to the total; a dead animal is a realized loss of its full cost", () => {
    const { farm, partners: ps } = buildPartnerPositions(input({
      dailyCosts: [],
      animals: [A("d", { status: "dead", endDate: "2026-07-01", purchasePrice: 50000, ownCost: 1000, salePrice: 0, valueToday: null }), A("a", { valueToday: 260000 })],
    }));
    expect(farm.realized).toBe(-51000);
    const shares = ps.reduce((s, p) => s + p.realizedShare + p.estimateShare, 0);
    expect(shares + farm.fee + farm.unallocated).toBeCloseTo(farm.total, 1);
  });

  it("no market price: the herd counts at cost (no guessed profit or loss)", () => {
    const { farm } = buildPartnerPositions(input({ marketPricePerKg: null, animals: [A("a", { valueToday: null })] }));
    expect(farm.estimate).toBe(0);
    expect(farm.herdValued).toBe(false);
  });
});

describe("split", () => {
  it("profit: labour partner 50%, the rest by taka × days during the animal's time", () => {
    const { partners: ps, farm } = buildPartnerPositions(input());
    const by = byId(ps);
    expect(by.mohiuddin.estimateShare).toBeCloseTo(farm.estimate / 2, 2);
    const w = capitalDays(partners, txns, "2026-06-01", "2026-09-26");
    expect(w.omor).toBe(100000 * 61);        // 28 Jul – 26 Sep
    expect(w.nanu).toBe(160000 * 111);       // 8 Jun – 26 Sep
    const rest = farm.estimate / 2;
    expect(by.omor.estimateShare).toBeCloseTo((rest * w.omor) / (w.tanvir + w.nanu + w.omor), 2);
  });

  it("a fixed share is a share of the NET: a loss on one animal is set against the profit on another", () => {
    const { farm, partners: ps } = buildPartnerPositions(input({ dailyCosts: [], animals: [A("win", { valueToday: 260000 }), A("lose", { valueToday: 180000 })] }));
    expect(farm.estimate).toBeCloseTo(40000, 2);                  // +60,000 − 20,000
    expect(byId(ps).mohiuddin.estimateShare).toBeCloseTo(20000, 2); // 50% of the net, not of the winner alone
    const money = ["tanvir", "nanu", "omor"].reduce((s, k) => s + byId(ps)[k].estimateShare, 0);
    expect(money).toBeCloseTo(20000, 2);
  });

  it("loss: the whole loss goes to the partners who bear it; the labour partner pays nothing", () => {
    const { farm, partners: ps } = buildPartnerPositions(input({ dailyCosts: [], animals: [A("a", { valueToday: 130000 })] }));
    expect(farm.estimate).toBeCloseTo(-70000, 2);
    const by = byId(ps);
    expect(by.mohiuddin.estimateShare).toBe(0);
    expect(by.tanvir.estimateShare + by.nanu.estimateShare + by.omor.estimateShare).toBeCloseTo(-70000, 1);
    expect(farm.unallocated).toBeCloseTo(0, 6);
  });

  it("money withdrawn stops earning: a partner who left before an animal was bought gets none of it", () => {
    const t = [...txns, { partnerId: "nanu", type: "withdrawal", amount: 160000, date: "2026-07-01" }];
    const { partners: ps } = buildPartnerPositions(input({ txns: t, dailyCosts: [], animals: [A("late", { purchaseDate: "2026-08-01", valueToday: 250000 })] }));
    expect(byId(ps).nanu.estimateShare).toBe(0);
    expect(byId(ps).tanvir.estimateShare).toBeGreaterThan(0);
  });

  it("an animal sold before a partner's money came in is not shared with that partner", () => {
    const { partners: ps } = buildPartnerPositions(input({
      dailyCosts: [],
      animals: [A("s", { status: "sold", endDate: "2026-07-10", purchasePrice: 100000, salePrice: 150000, valueToday: null })],
    }));
    const by = byId(ps);
    expect(by.omor.realizedShare).toBe(0);
    expect(by.tanvir.distributable).toBe(by.tanvir.realizedShare);
  });

  it("50% → 40% from 1 Aug: the days before keep 50%, the days after use 40%", () => {
    const rules: ShareRule[] = [
      { partnerId: "mohiuddin", from: "2026-06-01", shareMode: "manual", fixedPct: 50, bearsLoss: false },
      { partnerId: "mohiuddin", from: "2026-08-01", shareMode: "manual", fixedPct: 40, bearsLoss: false },
    ];
    // bought 1 Jun, sold 30 Sep: 61 days at 50%, 61 days at 40% → 45% of the profit
    const sold = A("s", { status: "sold", purchaseDate: "2026-06-01", endDate: "2026-09-30", purchasePrice: 100000, salePrice: 222000, valueToday: null });
    const { partners: ps } = buildPartnerPositions(input({ asOf: "2026-10-05", rules, dailyCosts: [], animals: [sold] }));
    expect(byId(ps).mohiuddin.realizedShare).toBeCloseTo(122000 * (61 * 0.5 + 61 * 0.4) / 122, 1);   // to the paisa
    expect(byId(ps).mohiuddin.terms.fixedPct).toBe(40);
  });

  it("a future rule is listed as the next change and does not touch today", () => {
    const rules: ShareRule[] = [{ partnerId: "mohiuddin", from: "2026-10-01", shareMode: "manual", fixedPct: 40, bearsLoss: false }];
    const { partners: ps } = buildPartnerPositions(input({ rules }));
    expect(byId(ps).mohiuddin.terms.fixedPct).toBe(50);
    expect(byId(ps).mohiuddin.nextChange?.from).toBe("2026-10-01");
  });

  it("the management fee follows its own dates", () => {
    const sold = A("s", { status: "sold", endDate: "2026-06-30", purchasePrice: 100000, salePrice: 130000, valueToday: null });
    const { farm } = buildPartnerPositions(input({ feeRates: [{ from: "2026-06-16", pct: 10 }], dailyCosts: [], animals: [sold] }));
    // 30 days, 15 with a 10% fee: fee = 30,000 × 15/30 × 10%
    expect(farm.fee).toBeCloseTo(1500, 2);
  });

  it("a retired partner shares nothing from the day they left", () => {
    const ps2 = partners.map((p) => (p.id === "mohiuddin" ? { ...p, leftAt: "2026-06-01" } : p));
    const { partners: ps } = buildPartnerPositions(input({ partners: ps2 }));
    expect(byId(ps).mohiuddin.estimateShare).toBe(0);
    expect(byId(ps).mohiuddin.terms.active).toBe(false);
  });

  it("nobody marked as bearing loss: the money partners still carry it", () => {
    const ps = [P("x", { bearsLoss: false }), P("y", { bearsLoss: false })];
    const { loss } = splitPercents(ps, termsOn(ps, [], "2026-06-01"), { x: 1, y: 3 });
    expect(loss.x).toBeCloseTo(25);
    expect(loss.y).toBeCloseTo(75);
  });
});

describe("advances, loans and cycles", () => {
  const sold = (id: string, end: string, price: number) => A(id, { status: "sold", purchaseDate: "2026-06-01", endDate: end, purchasePrice: 100000, salePrice: price, valueToday: null });

  it("a profit advance comes off the partner's settled profit; taken beyond it, it waits for the next profit", () => {
    const t = [...txns, { partnerId: "mohiuddin", type: "advance", amount: 3000, date: "2026-07-01" }];
    const before = byId(buildPartnerPositions(input({ txns: t, dailyCosts: [], animals: [A("a", { valueToday: 260000 })] })).partners).mohiuddin;
    expect(before.distributable).toBe(0);                // nothing sold yet
    expect(before.advanceOutstanding).toBe(3000);
    expect(before.withdrawable).toBe(0);
    const after = byId(buildPartnerPositions(input({ txns: t, dailyCosts: [], animals: [sold("s", "2026-08-01", 120000)] })).partners).mohiuddin;
    expect(after.realizedShare).toBeCloseTo(10000, 2);   // 50% of 20,000
    expect(after.distributable).toBeCloseTo(7000, 2);    // 10,000 − 3,000 advance
    expect(after.advanceOutstanding).toBe(0);
  });

  it("a partner's loan to the farm earns no share and is kept apart from capital", () => {
    const t = [...txns, { partnerId: "nanu", type: "loan_in", amount: 50000, date: "2026-06-10" }, { partnerId: "nanu", type: "loan_repay", amount: 20000, date: "2026-08-01" }];
    const withLoan = byId(buildPartnerPositions(input({ txns: t })).partners).nanu;
    const without = byId(buildPartnerPositions(input()).partners).nanu;
    expect(withLoan.loanBalance).toBe(30000);
    expect(withLoan.estimateShare).toBeCloseTo(without.estimateShare, 6);
    expect(withLoan.netCapital).toBe(160000);
  });

  it("a closed cycle is settled on its own net; the open cycle starts fresh", () => {
    const animals = [sold("s1", "2026-07-10", 130000), sold("s2", "2026-07-20", 90000), sold("s3", "2026-09-10", 115000)];
    const { farm } = buildPartnerPositions(input({ dailyCosts: [], animals, cycles: [{ id: "c1", closedOn: "2026-07-31" }] }));
    expect(farm.cycles).toHaveLength(1);
    expect(farm.cycles[0].net).toBeCloseTo(20000, 2);    // +30,000 − 10,000
    expect(farm.cycles[0].items).toBe(2);
    expect(farm.openRealized).toBeCloseTo(15000, 2);
    expect(farm.openCycleFrom).toBe("2026-08-01");
    // the labour partner's 50% of each cycle's net, not of the winners alone
    expect(farm.cycles[0].shares.mohiuddin).toBeCloseTo(10000, 2);
  });

  it("the open cycle pays out only what the animals still on the farm cannot take back", () => {
    // sold for +20,000 profit, but the herd on the farm is 15,000 down today
    const { partners: ps } = buildPartnerPositions(input({ dailyCosts: [], animals: [sold("s", "2026-08-01", 120000), A("h", { valueToday: 185000 })] }));
    const m = byId(ps).mohiuddin;
    expect(m.realizedShare).toBeCloseTo(10000, 2);       // 50% of the sale alone
    expect(m.distributable).toBeCloseTo(2500, 2);        // 50% of the net 5,000 — the smaller
  });

  it("shares add up to the paisa", () => {
    const { farm, partners: ps } = buildPartnerPositions(input({ dailyCosts: everyDay(333.33, "2026-06-01", "2026-09-26") }));
    const shares = ps.reduce((s, p) => s + p.realizedShare + p.estimateShare, 0);
    expect(Math.abs(shares + farm.fee + farm.unallocated - farm.total)).toBeLessThan(0.011);
  });
});

describe("checking a share rule", () => {
  const two = [P("m", { shareMode: "manual", fixedPct: 50 }), P("k", { shareMode: "manual", fixedPct: 30, joinedAt: "2026-09-01" })];
  it("fixed shares may not pass 100% on any day, including when another partner joins later", () => {
    expect(checkRule(two, [], { partnerId: "m", from: "2026-08-01", shareMode: "manual", fixedPct: 60, bearsLoss: false })).toBeNull();
    expect(checkRule(two, [], { partnerId: "m", from: "2026-08-01", shareMode: "manual", fixedPct: 80, bearsLoss: false })).toMatch(/2026-09-01/);
    expect(checkRule(two, [], { partnerId: "m", from: "2026-08-01", shareMode: "manual", fixedPct: 101, bearsLoss: false })).toMatch(/between/);
  });
  it("a rule stops at the partner's next rule", () => {
    const rules: ShareRule[] = [{ partnerId: "m", from: "2026-08-15", shareMode: "manual", fixedPct: 10, bearsLoss: false }];
    expect(checkRule(two, rules, { partnerId: "m", from: "2026-08-01", shareMode: "manual", fixedPct: 90, bearsLoss: false })).toBeNull();
  });
});

import { buildPartnerPositions, capitalDays, splitPercents, type PositionInput, type PositionPartner } from "@/lib/partners/position";

const P = (id: string, over: Partial<PositionPartner> = {}): PositionPartner => ({
  id, name: id, partnerType: "capital", shareMode: "auto", fixedPct: 0, bearsLoss: true,
  joinedAt: "2026-06-01", laborValueMonthly: null, cliffMonths: 0, ...over,
});

// the farm today: Tanvir and Nanu from June, Omor from late July, Mohiuddin 50% labour (no loss)
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

function input(over: Partial<PositionInput> = {}): PositionInput {
  return {
    asOf: "2026-09-26", partners, txns, feePct: 0, runningCosts: 60000, marketPricePerKg: 420,
    animals: [
      { id: "a", tag: "C001", status: "active", purchaseDate: "2026-06-01", endDate: null, purchasePrice: 200000, ownCost: 2000, salePrice: null, valueToday: 300000 },
      { id: "b", tag: "C002", status: "active", purchaseDate: "2026-06-01", endDate: null, purchasePrice: 200000, ownCost: 2500, salePrice: null, valueToday: 250000 },
    ],
    ...over,
  };
}

describe("partner positions", () => {
  it("nothing sold: no realized loss — running costs are part of what the cattle cost", () => {
    const { farm, partners: ps } = buildPartnerPositions(input());
    expect(farm.realized).toBe(0);
    // value 550,000 − (400,000 bought + 4,500 own + 60,000 running) = 85,500 estimated profit
    expect(farm.estimate).toBeCloseTo(85500, 2);
    for (const p of ps) { expect(p.realizedShare).toBe(0); expect(p.distributable).toBe(0); }
  });

  it("profit: labour partner 50%, the rest by taka × days (a later joiner gets less)", () => {
    const { partners: ps } = buildPartnerPositions(input());
    const by = Object.fromEntries(ps.map((p) => [p.id, p]));
    expect(by.mohiuddin.estimateShare).toBeCloseTo(85500 / 2, 2);
    const rest = 85500 / 2;
    const w = capitalDays(partners, txns, "2026-09-26");
    const total = w.tanvir + w.nanu + w.omor;
    expect(by.tanvir.estimateShare).toBeCloseTo((rest * w.tanvir) / total, 2);
    expect(by.omor.estimateShare).toBeCloseTo((rest * w.omor) / total, 2);
    // Omor put in 100,000 on 28 Jul: 61 days; Nanu 160,000 from 8 Jun: 111 days
    expect(w.omor).toBe(100000 * 61);
    expect(w.nanu).toBe(160000 * 111);
    expect(by.tanvir.profitPct + by.mohiuddin.profitPct + by.nanu.profitPct + by.omor.profitPct).toBeCloseTo(100, 6);
  });

  it("loss: the whole loss goes to the partners who bear it; the labour partner pays nothing", () => {
    const { farm, partners: ps } = buildPartnerPositions(input({ animals: [
      { id: "a", tag: "C001", status: "active", purchaseDate: "2026-06-01", endDate: null, purchasePrice: 200000, ownCost: 0, salePrice: null, valueToday: 190000 },
    ] }));
    expect(farm.estimate).toBeCloseTo(-70000, 2);
    const by = Object.fromEntries(ps.map((p) => [p.id, p]));
    expect(by.mohiuddin.estimateShare).toBe(0);
    expect(by.tanvir.estimateShare + by.nanu.estimateShare + by.omor.estimateShare).toBeCloseTo(-70000, 1);   // nothing lost in the split
    expect(farm.unallocated).toBeCloseTo(0, 6);
  });

  it("an animal sold before a partner's money came in is not shared with that partner", () => {
    const { partners: ps } = buildPartnerPositions(input({
      animals: [
        { id: "s", tag: "S1", status: "sold", purchaseDate: "2026-06-01", endDate: "2026-07-10", purchasePrice: 100000, ownCost: 0, salePrice: 150000, valueToday: null },
        { id: "a", tag: "C001", status: "active", purchaseDate: "2026-06-01", endDate: null, purchasePrice: 200000, ownCost: 0, salePrice: null, valueToday: 200000 },
      ],
    }));
    const omor = ps.find((p) => p.id === "omor")!;
    const tanvir = ps.find((p) => p.id === "tanvir")!;
    expect(omor.realizedShare).toBe(0);
    expect(tanvir.realizedShare).toBeGreaterThan(0);
    expect(tanvir.distributable).toBe(tanvir.realizedShare);
  });

  it("only realized profit not yet paid can be distributed; everything adds up", () => {
    const paid = [...txns, { partnerId: "tanvir", type: "profit", amount: 1000, date: "2026-08-01" }];
    const { farm, partners: ps } = buildPartnerPositions(input({
      txns: paid, feePct: 10,
      animals: [{ id: "s", tag: "S1", status: "sold", purchaseDate: "2026-06-01", endDate: "2026-08-01", purchasePrice: 100000, ownCost: 0, salePrice: 200000, valueToday: null }],
    }));
    const tanvir = ps.find((p) => p.id === "tanvir")!;
    expect(tanvir.distributable).toBeCloseTo(tanvir.realizedShare - 1000, 2);
    const shares = ps.reduce((s, p) => s + p.realizedShare + p.estimateShare, 0);
    expect(shares + farm.fee + farm.unallocated).toBeCloseTo(farm.total, 1);
    expect(tanvir.balance).toBeCloseTo(300000 + tanvir.realizedShare - 1000, 2);
  });

  it("a dead animal is a realized loss of its full cost", () => {
    const { farm } = buildPartnerPositions(input({
      runningCosts: 0,
      animals: [{ id: "d", tag: "D1", status: "dead", purchaseDate: "2026-06-01", endDate: "2026-07-01", purchasePrice: 50000, ownCost: 1000, salePrice: 0, valueToday: null }],
    }));
    expect(farm.realized).toBe(-51000);
  });

  it("no market price: the herd counts at cost (no guessed profit or loss)", () => {
    const { farm } = buildPartnerPositions(input({ marketPricePerKg: null, animals: input().animals.map((a) => ({ ...a, valueToday: null })) }));
    expect(farm.estimate).toBe(0);
    expect(farm.herdValued).toBe(false);
  });
});

describe("split percents", () => {
  it("nobody marked as bearing loss: the money partners still carry it", () => {
    const ps = [P("x", { bearsLoss: false }), P("y", { bearsLoss: false })];
    const { loss } = splitPercents(ps, { x: 1, y: 3 });
    expect(loss.x).toBeCloseTo(25);
    expect(loss.y).toBeCloseTo(75);
  });
});

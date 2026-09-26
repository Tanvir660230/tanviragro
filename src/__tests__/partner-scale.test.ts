/** The partner calculation stays fast and exact when the farm grows (years of entries, hundreds of animals). */
import { buildPartnerPositions, capitalDays, type PositionAnimal, type PositionPartner, type PositionTxn } from "@/lib/partners/position";

const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 86400000).toISOString().slice(0, 10);
const partners: PositionPartner[] = Array.from({ length: 8 }, (_, i) => ({
  id: `p${i}`, name: `P${i}`, partnerType: i === 0 ? "labor" : "capital", joinedAt: day(i * 20), leftAt: null,
  laborValueMonthly: null, cliffMonths: 0, shareMode: i === 0 ? "manual" : "auto", fixedPct: i === 0 ? 40 : 0, bearsLoss: i !== 0,
}));
const txns: PositionTxn[] = Array.from({ length: 2000 }, (_, i) => ({
  partnerId: `p${1 + (i % 7)}`, type: i % 9 === 0 ? "withdrawal" : i % 13 === 0 ? "advance" : "investment",
  amount: 1000 + (i % 50) * 100, date: day(20 * (1 + (i % 7)) + Math.floor(i / 3)),
}));
const asOf = day(730);
const animals: PositionAnimal[] = Array.from({ length: 500 }, (_, i) => {
  const bought = (i * 7) % 600;
  const sold = i % 3 !== 0 && bought + 90 < 730;
  return { id: `a${i}`, tag: `T${i}`, status: sold ? "sold" : "active", purchaseDate: day(bought), endDate: sold ? day(bought + 90) : null,
    purchasePrice: 80000, ownCost: 500, salePrice: sold ? 95000 + (i % 11) * 1000 : null, valueToday: sold ? null : 90000 };
});
const dailyCosts = Array.from({ length: 731 }, (_, i) => ({ date: day(i), amount: 3000 }));
const cycles = [{ id: "c1", closedOn: day(180) }, { id: "c2", closedOn: day(365) }, { id: "c3", closedOn: day(550) }];

test("500 animals, 2,000 entries, 2 years of daily costs, 3 cycles: fast (limit 3 s, about 0.2 s)", () => {
  const t0 = Date.now();
  const { farm, partners: ps } = buildPartnerPositions({ asOf, partners, rules: [{ partnerId: "p0", from: day(400), shareMode: "manual", fixedPct: 35, bearsLoss: false }], feeRates: [], txns, dailyCosts, animals, marketPricePerKg: 420, cycles });
  const ms = Date.now() - t0;
  expect(ms).toBeLessThan(3000);
  const shares = ps.reduce((s, p) => s + p.realizedShare + p.estimateShare, 0);
  expect(Math.abs(shares + farm.fee + farm.unallocated - farm.total)).toBeLessThan(0.05);
  expect(farm.cycles).toHaveLength(3);
});

test("the fast taka × days equals adding every entry by hand", () => {
  const naive = (from: string, to: string) => {
    const w: Record<string, number> = Object.fromEntries(partners.map((p) => [p.id, 0]));
    const a = Date.parse(`${from}T00:00:00Z`) / 86400000, b = Date.parse(`${to}T00:00:00Z`) / 86400000;
    for (const t of txns) {
      const d = Date.parse(`${t.date}T00:00:00Z`) / 86400000;
      if (d > b) continue;
      const days = Math.max(0, b - Math.max(a, d) + 1);
      if (t.type === "investment") w[t.partnerId] += t.amount * days;
      else if (t.type === "withdrawal") w[t.partnerId] -= t.amount * days;
    }
    for (const k of Object.keys(w)) w[k] = Math.max(0, w[k]);
    return w;
  };
  for (const [f, t] of [[day(0), day(730)], [day(100), day(200)], [day(400), day(401)], [day(700), day(730)]]) {
    const fast = capitalDays(partners, txns, f, t, asOf);
    const slow = naive(f, t);
    for (const p of partners) expect(fast[p.id]).toBeCloseTo(slow[p.id], 4);
  }
});

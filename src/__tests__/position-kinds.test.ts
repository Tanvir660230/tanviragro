/** An animal's running share split by kind adds up to its share (lib/partners/position.ts). */
import { buildPartnerPositions, type PositionAnimal } from "@/lib/partners/position";

const A = (id: string, over: Partial<PositionAnimal> = {}): PositionAnimal => ({
  id, tag: id, status: "active", purchaseDate: "2026-06-01", endDate: null, purchasePrice: 1000, ownCost: 0, salePrice: null, valueToday: 1000, ...over,
});

test("each kind is shared among the animals on the farm that day", () => {
  const { farm } = buildPartnerPositions({
    asOf: "2026-06-10", partners: [], rules: [], feeRates: [], txns: [], marketPricePerKg: null,
    dailyCosts: [
      { date: "2026-06-02", amount: 600, kind: "labor" },
      { date: "2026-06-02", amount: 200, kind: "feed" },
      { date: "2026-06-08", amount: 90 },                      // no kind → other
    ],
    animals: [A("a"), A("b", { purchaseDate: "2026-06-05" })],
  });
  const a = farm.animals.find((x) => x.id === "a")!;
  const b = farm.animals.find((x) => x.id === "b")!;
  expect(a.runningByKind).toEqual({ labor: 600, feed: 200, other: 45 });
  expect(b.runningByKind).toEqual({ other: 45 });
  for (const x of [a, b]) expect(Object.values(x.runningByKind).reduce((s, v) => s + (v ?? 0), 0)).toBeCloseTo(x.runningShare, 6);
});

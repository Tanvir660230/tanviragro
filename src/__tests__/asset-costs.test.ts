import { assetDailyCosts } from "@/lib/partners/asset-costs";

const sum = (r: { amount: number }[]) => r.reduce((s, x) => s + x.amount, 0);

describe("what the assets cost the partners", () => {
  it("depreciation is spread over the days it built up", () => {
    const r = assetDailyCosts([{ purchaseDate: "2026-09-01", purchaseCost: 10000, accumulatedDepreciation: 100, isActive: true, disposedAt: null, disposalValue: null }], "2026-09-10");
    expect(r).toHaveLength(10);
    expect(sum(r)).toBeCloseTo(100, 9);
  });

  it("a sold asset: its value then minus the money got, on the day it was sold — the accounts' gain or loss", () => {
    const loss = assetDailyCosts([{ purchaseDate: "2026-09-01", purchaseCost: 10000, accumulatedDepreciation: 100, isActive: false, disposedAt: "2026-09-05", disposalValue: 9000 }], "2026-09-27");
    expect(loss.filter((x) => x.date > "2026-09-05")).toHaveLength(0);          // nothing after it left
    expect(loss.find((x) => x.amount === 900)?.date).toBe("2026-09-05");        // 9,900 value − 9,000 got
    expect(sum(loss)).toBeCloseTo(100 + 900, 9);
    const gain = assetDailyCosts([{ purchaseDate: "2026-09-01", purchaseCost: 10000, accumulatedDepreciation: 100, isActive: false, disposedAt: "2026-09-05", disposalValue: 12000 }], "2026-09-27");
    expect(sum(gain)).toBeCloseTo(100 - 2100, 9);                               // a gain lowers the running costs
  });
});

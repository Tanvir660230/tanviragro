import { computeDepreciation } from "@/lib/accounting/engine";
import { calcAccruedInterest } from "@/lib/loan-utils";

// ── computeDepreciation ───────────────────────────────────────────────────────

describe("computeDepreciation – straight-line", () => {
  const base = {
    purchase_cost: 120_000,
    salvage_value: 0,
    useful_life_years: 10,
    depreciation_method: "straight_line",
    declining_rate: null,
    disposed_at: null,
  };

  it("annual = cost / life", () => {
    const dep = computeDepreciation({ ...base, purchase_date: "2020-01-01" });
    expect(dep.annual).toBe(12_000);
  });

  it("monthly = annual / 12", () => {
    const dep = computeDepreciation({ ...base, purchase_date: "2020-01-01" });
    expect(dep.monthly).toBeCloseTo(1_000, 0);
  });

  it("accumulated does not exceed cost − salvage", () => {
    const dep = computeDepreciation({ ...base, purchase_date: "2000-01-01" }); // >10 years ago
    expect(dep.accumulated).toBeLessThanOrEqual(120_000);
    expect(dep.bookValue).toBeGreaterThanOrEqual(0);
  });

  it("bookValue = salvage when fully depreciated", () => {
    const dep = computeDepreciation({ ...base, purchase_date: "2010-01-01" }); // ~15 years ago
    expect(dep.bookValue).toBe(0);
  });

  it("salvage value respected", () => {
    const dep = computeDepreciation({ ...base, salvage_value: 10_000, purchase_date: "2010-01-01" });
    expect(dep.bookValue).toBe(10_000);
    expect(dep.accumulated).toBe(110_000);
  });

  it("zero cost returns zero depreciation", () => {
    const dep = computeDepreciation({ ...base, purchase_cost: 0, purchase_date: "2020-01-01" });
    expect(dep.annual).toBe(0);
    expect(dep.accumulated).toBe(0);
  });
});

describe("computeDepreciation – declining balance", () => {
  const base = {
    purchase_cost: 100_000,
    salvage_value: 0,
    useful_life_years: 5,
    depreciation_method: "declining_balance",
    declining_rate: 0.4,
    disposed_at: null,
    purchase_date: "2020-01-01",
  };

  it("bookValue decreases each year", () => {
    const dep = computeDepreciation(base);
    expect(dep.bookValue).toBeLessThan(base.purchase_cost);
    expect(dep.bookValue).toBeGreaterThanOrEqual(0);
  });

  it("accumulated = cost − bookValue", () => {
    const dep = computeDepreciation(base);
    expect(dep.accumulated).toBeCloseTo(base.purchase_cost - dep.bookValue, 1);
  });
});

// ── calcAccruedInterest ───────────────────────────────────────────────────────

describe("calcAccruedInterest", () => {
  it("returns 0 for zero rate", () => {
    expect(calcAccruedInterest(100_000, 0, "2024-01-01", "2025-01-01")).toBe(0);
  });

  it("1 year at 12% ≈ 12 000 (±200 for leap year)", () => {
    const interest = calcAccruedInterest(100_000, 12, "2024-01-01", "2025-01-01");
    expect(interest).toBeGreaterThan(11_800);
    expect(interest).toBeLessThan(12_200);
  });

  it("6 months at 12% ≈ 6 000", () => {
    const interest = calcAccruedInterest(100_000, 12, "2024-01-01", "2024-07-01");
    expect(interest).toBeCloseTo(6_000, -2); // within ±100
  });

  it("start === end = 0", () => {
    expect(calcAccruedInterest(100_000, 12, "2024-06-01", "2024-06-01")).toBe(0);
  });

  it("end before start = 0 (no negative interest)", () => {
    const interest = calcAccruedInterest(100_000, 12, "2025-01-01", "2024-01-01");
    expect(interest).toBe(0);
  });

  it("scales linearly with principal", () => {
    const a = calcAccruedInterest(100_000, 10, "2024-01-01", "2025-01-01");
    const b = calcAccruedInterest(200_000, 10, "2024-01-01", "2025-01-01");
    expect(b).toBeCloseTo(a * 2, 1);
  });
});

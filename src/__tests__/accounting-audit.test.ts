/**
 * Regression tests for the defects found by the numerical accounting audit
 * (docs/NUMERICAL_ACCOUNTING_AUDIT.md). Each test reproduces a proven discrepancy.
 */
import * as fs from "fs";
import * as path from "path";
import { summarizeInventoryLedger } from "@/lib/accounting/inventory-ledger";
import { monthlyConsumptionRows, inventoryStatsRows } from "@/lib/inventory/consumption-stats";
import { accountForLegacyCategory } from "@/lib/expenses/categories";
import { computeFeedSnapshot, feedCostBetween, feedKgBetween, type Animal } from "@/lib/feed/usage-engine";
import { CashEngine } from "@/lib/financial/cash-engine";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

describe("A1 inventory value is exact (no per-row rounding)", () => {
  test("300 rows of 0.333 kg × ৳45.005 keep every poisha", () => {
    const rows = Array.from({ length: 300 }, () => ({ type: "purchase", movement_type: "purchase", qty: 0.333, unit_cost: 45.005, cattle_id: null, category: "feed" }));
    // exact: 300 × 0.333 × 45.005 = 4,496.0 (per-row rounding to 14.99 would give 4,497.00)
    expect(summarizeInventoryLedger(rows).inventoryValue).toBeCloseTo(300 * 0.333 * 45.005, 2);
    expect(summarizeInventoryLedger(rows).inventoryValue).not.toBe(4497);
  });
});

describe("A2 feed eaten is consumption − its undo; losses and undos are not feed", () => {
  const cat = { corn: "feed", hay: "roughage" };
  const rows = [
    { item_id: "corn", movement_type: "consumption", qty: 10, unit_cost: 40, recorded_at: "2026-08-01" },
    { item_id: "corn", movement_type: "consumption_reversal", qty: 2, unit_cost: 40, recorded_at: "2026-08-02" },
    { item_id: "corn", movement_type: "adjustment_out", qty: 5, unit_cost: 40, recorded_at: "2026-08-03" },   // count loss
    { item_id: "corn", movement_type: "purchase_reversal", qty: 1, unit_cost: 40, recorded_at: "2026-08-03" }, // purchase undo
    { item_id: "corn", movement_type: "purchase", qty: 100, unit_cost: 40, recorded_at: "2026-08-01" },
    { item_id: "hay", movement_type: "consumption", qty: 3, unit_cost: 25, recorded_at: "2026-09-10" },
  ];
  test("monthly: August feed = (10 − 2) × 40 = 320, not (10 + 5 + 1) × 40 = 640", () => {
    expect(monthlyConsumptionRows(rows, cat)).toEqual([
      { month_yr: "2026-08", category: "feed", total_cost: 320 },
      { month_yr: "2026-09", category: "roughage", total_cost: 75 },
    ]);
  });
  test("stats: stock is signed by meaning; eaten nets the undo", () => {
    const corn = inventoryStatsRows(rows, "2026-08-02").find((s) => s.item_id === "corn")!;
    expect(corn.total_stock).toBe(100 - 10 + 2 - 5 - 1);
    expect(corn.total_consumed).toBe(8);
    expect(corn.consumed_last_30d).toBe(-2);   // only the undo falls in the window
  });
});

describe("A3 cash: partner capital counted; no unknown enum value; purchase undo is not spent", () => {
  test("the query only asks for existing partner transaction types", () => {
    // one cash figure: the separate cash query (a second calculation) was removed; the engine is the source
    expect(fs.existsSync(path.join(__dirname, "..", "lib/supabase/queries/cash.ts"))).toBe(false);
    expect(read("lib/accounting/engine.ts")).not.toMatch(/"draw"\]/);
  });
  test("capital in − cattle − expenses (incl. treatment fees) − net stock bought", () => {
    const pos = CashEngine.calculateCashPosition({
      openingBalance: 0,
      partnerTransactions: [{ amount: 1000, type: "investment" }],
      sales: [], cattle: [{ purchase_price: 500 }],
      inventoryPurchases: [{ qty: 10, unit_cost: 20 }, { qty: -2, unit_cost: 20 }],
      operatingExpenses: [{ amount: 100 }, { amount: 50 }],   // cost entry + treatment fee
      costEntryAssets: [], fixedAssets: [], loans: [], liabilities: [], asOfDate: "2026-09-24",
    });
    expect(pos.balance).toBe(1000 - 500 - 150 - 160);
  });
});

describe("A4 vet fee recorded once", () => {
  test("medical forms no longer write a second 'Medical/Vet Fee' cost entry", () => {
    expect(read("app/dashboard/(app)/cattle/medical-actions.ts")).not.toMatch(/from\("cost_entries"\)\.insert/);
  });
  test("a visit with several medicines carries the fee on the first row only", () => {
    expect(read("app/dashboard/(app)/cattle/medical-actions.ts")).toMatch(/vet_fee: i === 0 \?/);
  });
  test("the cash-flow statement counts treatment fees like the balance sheet", () => {
    expect(read("lib/accounting/engine.ts")).toMatch(/cashPaidCapitalizedCosts = periodAllCostEntries[\s\S]{0,300}treatments/);
  });
});

describe("A5 feed-related cash costs are Feed, not General", () => {
  test.each(["feed", "Khor kata", "খড় কাটা", "grass cutting"])("%s → 5200", (c) => {
    expect(accountForLegacyCategory(c).code).toBe("5200");
  });
  test("other categories unchanged", () => {
    expect(accountForLegacyCategory("infrastructure").code).toBe("6600");
    expect(accountForLegacyCategory("Medical/Vet Fee").code).toBe("6100");
  });
});

describe("A6 cost per kg gain uses feed over the SAME days as the gain", () => {
  const cow = (id: string, kg: number): Animal => ({ id, tag: id, from: "2026-09-01", to: null, initialWeightKg: kg, initialWeightType: "measured", logs: [] });
  const s = computeFeedSnapshot({
    asOf: "2026-09-30", periods: [], wac: {}, animals: [cow("A", 200)],
    recorded: [
      { date: "2026-09-05", itemId: "corn", unit: "kg", qty: 10, unitCost: 40, cattleId: null },
      { date: "2026-09-25", itemId: "corn", unit: "kg", qty: 10, unitCost: 40, cattleId: null },   // after the weighing
      { date: "2026-09-06", itemId: "hay", unit: "piece", kgPerUnit: null, qty: 4, unitCost: 25, cattleId: null },
    ],
  });
  test("window 09-01..09-20 excludes feed after the last weighing", () => {
    expect(s.perAnimal.A.actual).toBe(900);
    expect(feedCostBetween(s.perAnimal.A, "2026-09-01", "2026-09-20")).toBe(500);
  });
  test("kg in the window counts only items with a known kg factor (hay pieces excluded, never guessed)", () => {
    expect(feedKgBetween(s.perAnimal.A, "2026-09-01", "2026-09-20")).toBe(10);
  });
  test("pages divide window cost by the measured gain", () => {
    expect(read("app/dashboard/(app)/inventory/usage/page.tsx")).toMatch(/feedCostBetween\(f, growth\.baseline\.date, growth\.latestDate\)/);
    expect(read("app/dashboard/(app)/cattle/[id]/page.tsx")).toMatch(/gainWindowCost \/ weightGain/);
    // the separate cattle analytics page was removed (docs/SITE_AUDIT_AND_CENTRAL_PLAN.md): one source, the home model
  });
});

describe("A7 no invented weights or prices in finance actions", () => {
  test("the parallel finance engine (its own cash / profit / cost per kg) stays removed", () => {
    // it computed cash as sales − costs (ignoring partner capital) beside the audited engine
    expect(fs.existsSync(path.join(__dirname, "..", "app/dashboard/(app)/finance/financial-engine-actions.ts"))).toBe(false);
    expect(fs.existsSync(path.join(__dirname, "..", "components/finance/EnterpriseLivestockFinancialWorkspace.tsx"))).toBe(false);
  });
});

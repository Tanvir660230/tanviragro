/**
 * Capital assets: cash out ≠ operating expense ≠ asset value.
 * A fixed asset bought through a cost entry (fixed_assets.source_cost_entry_id) is paid by that
 * entry (cash, capital expenditure) and valued/depreciated by the fixed asset — never both.
 * Real-data verification: docs/NUMERICAL_ACCOUNTING_AUDIT.md §20.
 */
import * as fs from "fs";
import * as path from "path";
import { capitalSummary } from "@/lib/money/summary";
import { calculateDepreciation } from "@/lib/financial/calculations";
import type { AccountingData } from "@/lib/accounting/engine";

jest.mock("@/lib/supabase/cached", () => ({ getServerClient: jest.fn() }));

const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

describe("the three figures stay apart", () => {
  const data = {
    incomeStatement: { totalRevenue: 100000, cogs: 60000, directCattleCosts: 0, feedExpenses: 10000, vetMedical: 500, laborWages: 1000,
      utilities: 300, rentLease: 0, transport: 200, repairsMaintenance: 0, generalExpenses: 1000, depreciation: 400 },
    balanceSheet: { cashAndBank: 5000, netFixedAssets: 23600 },
    cashFlow: { cashPaidCattle: 60000, cashPaidCosts: 3000, cashPaidInventory: 12000, fixedAssetPurchases: 24000, partnerWithdrawals: 0 },
  } as unknown as AccountingData;
  const s = capitalSummary(data);
  test("a ৳24,000 machine: capital expenditure, not an operating expense", () => {
    expect(s.capitalExpenditure).toBe(24000);
    expect(s.operatingExpenses).toBe(10000 + 500 + 1000 + 300 + 200 + 1000);
  });
  test("depreciation (not the purchase) reduces operating profit", () => {
    expect(s.operatingProfit).toBe(100000 - 60000 - 13000 - 400);
  });
  test("total cash outflow includes the asset purchase once", () => {
    expect(s.totalCashOutflow).toBe(60000 + 3000 + 12000 + 24000);
  });
  test("asset value is after depreciation", () => {
    expect(s.assetValue).toBe(23600);
  });
});

describe("depreciation on the real assets (straight-line, full months)", () => {
  beforeAll(() => { jest.useFakeTimers(); jest.setSystemTime(new Date("2026-09-24T12:00:00")); });
  afterAll(() => jest.useRealTimers());
  test("shed ৳91,580 over 10 years from 2026-06-01, as of 2026-09-24: 3 months", () => {
    const d = calculateDepreciation(
      { purchase_date: "2026-06-01", purchase_cost: 91580, salvage_value: 0, useful_life_years: 10, depreciation_method: "straight_line", declining_rate: null, disposed_at: null },
    );
    expect(d.monthly).toBeCloseTo(763.17, 2);
    expect(d.accumulated).toBeCloseTo(2289.5, 2);
    expect(d.bookValue).toBeCloseTo(89290.5, 2);
  });
});

describe("no asset purchase is counted twice (source guards)", () => {
  test("engine: linked fixed assets are not cash again; linked payments are not value again", () => {
    const src = read("lib/accounting/engine.ts");
    // cash comes from the one cash ledger (tested in cash-ledger.test.ts)
    expect(src).toMatch(/allTimeNetCashFlow = cashNet\(cashLedger\)/);
    expect(read("lib/accounting/cash-ledger.ts")).toMatch(/if \(!a\.source_cost_entry_id\)\s*push\(\{ id: `fa-\$\{a\.id\}`/);
    expect(src).toMatch(/netFixedAssets = \(totalFixedAssetCost - disposedCost\) - \(totalAccumDep - disposedAccumDep\) \+ unlinkedAssetCostValue/);
    expect(src).toMatch(/dr\("1500", unlinkedFixedAssetCash\)/);
    expect(src).toMatch(/inPeriod\(a\.purchaseDate\) && !a\.sourceCostEntryId/);
  });
  test("the statement reads the same cash ledger as the balance sheet", () => {
    expect(read("app/dashboard/(app)/finance/statement-action.ts")).toMatch(/cashStatement\(acc\.cashLedger, acc\.openingCash/);
    // the old financial repository (a second cash calculation) was removed; the accounting engine is the source
    expect(fs.existsSync(path.join(__dirname, "..", "lib/financial/financial-repository.ts"))).toBe(false);
  });
  test("asset lists show a linked purchase once", () => {
    expect(read("app/dashboard/(app)/finance/page.tsx")).toMatch(/assetCostsRes\.data \?\? \[\]\) as CostEntry\[\]\)\.filter\(\(e\) => !linked\.has\(e\.id\)\)/);
    expect(read("app/dashboard/(app)/accounting/balance-sheet/page.tsx")).toMatch(/!linkedPayments\.has\(e\.id\)/);
  });
  test("the database refuses to orphan or over-link a payment", () => {
    const sql = read("../supabase/migrations/20260925150000_fixed_asset_source.sql");
    expect(sql).toMatch(/would exceed the payment/);
    expect(sql).toMatch(/must be classed as an asset purchase/);
    expect(sql).toMatch(/remove or unlink them on the Fixed Assets page first/);
  });
});

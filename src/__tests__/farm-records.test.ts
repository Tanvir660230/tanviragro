/**
 * Owner decisions of 2026-09-24: estimated vs measured weights, utility expense
 * categories, reversals / own production in the inventory ledger.
 */
import fs from "fs";
import path from "path";
import { growthBaseline, measuredGrowth, measuredLogs } from "@/lib/growth/baseline";
import {
  accountForCostEntry, accountForLegacyCategory, categoryNameError, monthlyExpenseSummary,
} from "@/lib/expenses/categories";
import { summarizeInventoryLedger, unallocatedInventoryCost } from "@/lib/accounting/inventory-ledger";
import { daysNotRecorded, herdFeedCostShares, recordedFeedDays } from "@/lib/inventory/feed-costing";

const SRC = path.join(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8");

describe("weights: estimated vs measured", () => {
  const c006 = { initial_weight_kg: 250, initial_weight_type: "estimated" as const, purchase_date: "2026-07-31" };
  const measured210 = [{ weight_kg: 210, recorded_at: "2026-09-14", weight_type: "measured" as const }];

  test("C006: a 250 kg guess and a 210 kg weighing is NOT a 40 kg loss", () => {
    expect(measuredGrowth(c006, measured210)).toBeNull();
    expect(growthBaseline(c006, measured210)).toEqual({ weightKg: 210, date: "2026-09-14", source: "first_measurement" });
  });

  test("with an estimated start, growth runs from the first weighing", () => {
    const g = measuredGrowth(c006, [...measured210, { weight_kg: 231, recorded_at: "2026-10-14", weight_type: "measured" }]);
    expect(g).toMatchObject({ gainKg: 21, days: 30, baseline: { weightKg: 210 } });
    expect(g!.adg).toBeCloseTo(0.7, 6);
  });

  test("a weighed (or legacy unspecified) purchase weight is the baseline", () => {
    const c001 = { initial_weight_kg: 198, initial_weight_type: "unknown" as const, purchase_date: "2026-06-01" };
    const g = measuredGrowth(c001, [{ weight_kg: 313, recorded_at: "2026-09-14" }]);
    expect(g).toMatchObject({ gainKg: 115, days: 105, baseline: { source: "initial" } });
  });

  test("estimated weight logs are never used as growth points", () => {
    const c = { initial_weight_kg: 200, initial_weight_type: "measured" as const, purchase_date: "2026-01-01" };
    const logs = [
      { weight_kg: 260, recorded_at: "2026-02-01", weight_type: "measured" as const },
      { weight_kg: 400, recorded_at: "2026-03-01", weight_type: "estimated" as const },
    ];
    expect(measuredLogs(logs)).toHaveLength(1);
    expect(measuredGrowth(c, logs)).toMatchObject({ gainKg: 60, latestKg: 260 });
  });
});

describe("utility expense categories", () => {
  test("the account comes from the category KIND, so renaming never moves an expense", () => {
    expect(accountForCostEntry({ category: "utilities", kind: "utility" }).code).toBe("6300");
    expect(accountForCostEntry({ category: "anything renamed", kind: "utility" }).code).toBe("6300");
  });

  test("a utility is never booked as feed; legacy WiFi text maps to Utilities", () => {
    expect(accountForLegacyCategory("Wifi bill").code).toBe("6300");
    expect(accountForLegacyCategory("Internet").code).toBe("6300");
    expect(accountForLegacyCategory("feed").code).not.toBe("6300");
  });

  test("category names are required, ≤ 80 chars and unique (case/space-insensitive)", () => {
    const existing = [{ id: "1", name: "WiFi / Internet" }];
    expect(categoryNameError("  ", existing)).toMatch(/required/);
    expect(categoryNameError(" wifi / internet ", existing)).toMatch(/already exists/);
    expect(categoryNameError("wifi / internet", existing, "1")).toBeNull(); // renaming itself
    expect(categoryNameError("Generator fuel", existing)).toBeNull();
    expect(categoryNameError("x".repeat(81), existing)).toMatch(/80/);
  });

  test("monthly summary groups by utility and month", () => {
    const s = monthlyExpenseSummary(
      [
        { amount: 1050, recorded_at: "2026-06-21", category_id: "wifi" },
        { amount: "900", recorded_at: "2026-09-02", category_id: "elec" },
        { amount: 300, recorded_at: "2026-09-20", category_id: null },
        { amount: 999, recorded_at: "2025-01-01", category_id: "wifi" }, // outside the window
      ],
      "2026-09-24"
    );
    expect(s.months).toHaveLength(12);
    expect(s.months.at(-1)).toBe("2026-09");
    expect(s.byCategory.wifi["2026-06"]).toBe(1050);
    expect(s.totals["2026-09"]).toBe(1200);
    expect(s.byCategory.uncategorised["2026-09"]).toBe(300);
  });
});

describe("ledger: reversals and own production", () => {
  test("a consumption reversal takes the value back out of feed expense (not a gain)", () => {
    const s = summarizeInventoryLedger([
      { type: "purchase", movement_type: "purchase", qty: 100, unit_cost: 40, cattle_id: null },
      { type: "consumption", movement_type: "consumption", qty: 30, unit_cost: 40, cattle_id: null, category: "feed" },
      { type: "purchase", movement_type: "consumption_reversal", qty: 10, unit_cost: 40, cattle_id: null, category: "feed" },
    ]);
    expect(s.feedExpense).toBe(800);
    expect(s.otherNet).toBe(0);
    expect(s.cashPurchases).toBe(4000);
    expect(s.inventoryValue).toBe(3200);
    expect(unallocatedInventoryCost(s)).toBe(800);
  });

  test("grass harvested from own land is stock-in at ৳0 and never cash", () => {
    const s = summarizeInventoryLedger([
      { type: "purchase", movement_type: "own_production", qty: 500, unit_cost: 0, cattle_id: null },
    ]);
    expect(s.cashPurchases).toBe(0);
    expect(s.inventoryValue).toBe(0);
  });

  test("a fully reversed day is NOT RECORDED again; herd cost nets to zero", () => {
    const rows = [
      { recorded_at: "2026-09-20", qty: 5, unit_cost: 40, cattle_id: null },
      { recorded_at: "2026-09-20", qty: -5, unit_cost: 40, cattle_id: null },
      { recorded_at: "2026-09-19", qty: 4, unit_cost: 40, cattle_id: null },
    ];
    expect(recordedFeedDays(rows)).toEqual(["2026-09-19"]);
    expect(daysNotRecorded("2026-09-19", "2026-09-20", recordedFeedDays(rows))).toEqual(["2026-09-20"]);
    const shares = herdFeedCostShares(rows, [{ id: "A", from: "2026-01-01", to: null }]);
    expect(shares.A).toBe(160);
  });
});

describe("source guards", () => {
  test("utility expenses are saved against a utility category and edits are audited by the DB", () => {
    const actions = read("app/dashboard/(app)/finance/utilities/actions.ts");
    expect(actions).toMatch(/cat\.kind !== "utility"/);
    const mig = fs.readFileSync(path.join(SRC, "..", "supabase/migrations/20260925110000_expense_categories.sql"), "utf8");
    expect(mig).toMatch(/create trigger trg_cost_entries_audit after insert or update on public\.cost_entries/);
    expect(mig).not.toMatch(/for delete/i); // categories are disabled, never deleted
  });

  test("weight forms ask whether a weight was measured or estimated", () => {
    expect(read("components/cattle/AddWeightDialog.tsx")).toMatch(/name="weight_type"/);
    // add and edit both use the animal wizard; its origin step asks it and the save action stores it
    expect(read("components/livestock/wizard/steps/Step5Origin.tsx")).toMatch(/name="initial_weight_type"/);
    expect(read("app/dashboard/(app)/cattle/wizard-actions.ts")).toMatch(/initial_weight_type: payload\.origin\.initialWeightType/);
    expect(read("components/cattle/EditCattleDialog.tsx")).toMatch(/initialWeightType: \(cattle\.initial_weight_type/);
  });

  test("kg per piece is optional — never required for straw", () => {
    const f = read("components/inventory/ledger-fields.tsx");
    expect(f).toMatch(/\(optional\)/);
    const start = f.indexOf('name="kg_per_unit"');
    expect(f.slice(start, f.indexOf("/>", start))).not.toMatch(/required/);
  });
});

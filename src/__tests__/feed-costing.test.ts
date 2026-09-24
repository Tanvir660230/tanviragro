/**
 * Feed costing & inventory rules (docs/FEED_SYSTEM_ARCHITECTURE.md).
 * Database-level rules (idempotency, concurrency, WAC at insert, recipe balance) are
 * tested against Postgres in supabase/tests/feed_ledger.sql.
 */
import fs from "fs";
import path from "path";
import {
  isRecipeBalanced,
  recipeValidationError,
  scaleRecipe,
} from "@/lib/inventory/recipe-math";
import {
  allocateActualFeedCost,
  buildWacUnitCostMap,
  costPerKg,
  daysNotRecorded,
  estimateFeedCost,
  herdFeedCostShares,
  kgToItemUnits,
  weightedAverageUnitCost,
} from "@/lib/inventory/feed-costing";
import { summarizeInventoryLedger, unallocatedInventoryCost } from "@/lib/accounting/inventory-ledger";
import { StockLedgerEngine } from "@/lib/inventory/stock-ledger";
import { calculateAlgorithmicFeedCost } from "@/utils/feed-calculator";

const SRC = path.join(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8");

// ── Recipes (Rule 3/4, F-01) ────────────────────────────────────────────────
describe("recipe mass balance", () => {
  const ings = [
    { item_id: "corn", qty_per_batch: 60 },
    { item_id: "dorb", qty_per_batch: 40 },
  ];

  test("batch size must equal the ingredient total", () => {
    expect(isRecipeBalanced(ings, 100)).toBe(true);
    expect(isRecipeBalanced(ings, 50)).toBe(false);
    expect(recipeValidationError(ings, 50)).toMatch(/must be equal/);
    expect(recipeValidationError(ings, 100)).toBeNull();
  });

  test("zero, negative and duplicate ingredients are rejected", () => {
    expect(recipeValidationError([{ item_id: "a", qty_per_batch: 0 }], 0)).not.toBeNull();
    expect(recipeValidationError([{ item_id: "a", qty_per_batch: -5 }, { item_id: "b", qty_per_batch: 10 }], 5)).toMatch(/greater than 0/);
    expect(recipeValidationError([{ item_id: "a", qty_per_batch: 5 }, { item_id: "a", qty_per_batch: 5 }], 10)).toMatch(/twice/);
  });

  test("scaling uses the ingredient total, never the stored batch size", () => {
    // even if a recipe claimed output_qty = 50, 20 kg of mix needs 12 + 8 kg
    expect(scaleRecipe(ings, 20)).toEqual([
      { item_id: "corn", qty: 12 },
      { item_id: "dorb", qty: 8 },
    ]);
  });
});

// ── Costing (P-04, Phase 10/11) ───────────────────────────────────────────────
describe("weighted-average cost", () => {
  test("a missing price is not ৳0", () => {
    expect(weightedAverageUnitCost([{ qty: 100, unit_cost: 30 }, { qty: 100, unit_cost: null }])).toBe(30);
    expect(weightedAverageUnitCost([{ qty: 10, unit_cost: null }])).toBeNull();
  });

  test("an explicit ৳0 price is included (it is a known price)", () => {
    expect(weightedAverageUnitCost([{ qty: 50, unit_cost: 0 }, { qty: 50, unit_cost: 40 }])).toBe(20);
  });

  test("price map is the weighted average, not the latest purchase price", () => {
    const map = buildWacUnitCostMap([
      { item_id: "bran", qty: 100, unit_cost: 60 }, // latest (rows arrive newest first)
      { item_id: "bran", qty: 300, unit_cost: 40 },
    ]);
    expect(map.bran).toBe(45);
  });
});

// ── Units (P-03, Phase 9) ────────────────────────────────────────────────────
describe("explicit units", () => {
  test("a piece item is never converted without kg_per_unit", () => {
    expect(kgToItemUnits(100, "piece", null)).toBeNull();
    expect(costPerKg(150, "piece", null)).toBeNull();
    expect(kgToItemUnits(100, "piece", 20)).toBe(5);
    expect(costPerKg(150, "piece", 20)).toBe(7.5);
    expect(costPerKg(42, "kg", null)).toBe(42);
  });

  test("hay priced per piece is never multiplied by kilograms", () => {
    const est = estimateFeedCost(
      [{ item_id: "mix", kg: 10 }, { item_id: "hay", kg: 20 }],
      { mix: { unit: "kg", kgPerUnit: 1, unitCost: 40 }, hay: { unit: "piece", kgPerUnit: null, unitCost: 150, name: "Hay" } }
    );
    expect(est.total).toBe(400);             // not 400 + 20 × 150
    expect(est.complete).toBe(false);
    expect(est.unknownItems).toEqual(["Hay"]);
  });

  test("ration estimate reports unknown roughage cost instead of ৳/piece × kg", () => {
    const base = {
      daysInPen: 10,
      startMs: new Date("2026-06-01T00:00:00Z").getTime(),
      recipes: [{ active_from: "2026-01-01", active_until: null, recipe_ingredients: [{ item_id: "mix", qty_per_batch: 100 }] }],
      unitCostMap: { mix: 40, hay: 150 },
      feedData: { initialWeightKg: 250, latestLoggedWeightKg: 250, lastWeighedAt: null, purchaseDate: "2026-06-01", expectedDailyGainKg: 0.8 },
      overrideRoughage: null,
    };
    const unknown = calculateAlgorithmicFeedCost({
      ...base,
      roughages: [{ id: "hay", roughage_active_from: "2026-01-01", roughage_active_until: null, unit: "piece", kg_per_unit: null }],
    });
    const known = calculateAlgorithmicFeedCost({
      ...base,
      roughages: [{ id: "hay", roughage_active_from: "2026-01-01", roughage_active_until: null, unit: "piece", kg_per_unit: 15 }],
    });
    expect(unknown.roughageCostUnknown).toBe(true);
    expect(unknown.costComplete).toBe(false);
    expect(unknown.allocatedFeedCost).toBeCloseTo(unknown.allocatedConcentrateKg * 40, 6);
    expect(known.roughageCostUnknown).toBe(false);
    expect(known.allocatedFeedCost).toBeCloseTo(known.allocatedConcentrateKg * 40 + known.allocatedRoughageKg * 10, 6);
  });
});

// ── Actual vs estimated animal cost (Phase 14) ─────────────────────────────────
describe("actual feed cost per animal", () => {
  const animals = [
    { id: "A", from: "2026-06-01", to: null },
    { id: "B", from: "2026-06-03", to: null },
  ];
  const rows = [
    { recorded_at: "2026-06-02", qty: 10, unit_cost: 40, cattle_id: null }, // only A present → A 400
    { recorded_at: "2026-06-03", qty: 10, unit_cost: 40, cattle_id: null }, // A and B → 200 each
    { recorded_at: "2026-06-04", qty: 2, unit_cost: 50, cattle_id: "B" },   // B only → 100
    { recorded_at: "2026-06-05", qty: 5, unit_cost: null, cattle_id: null }, // unknown cost
  ];

  test("herd rows are shared by head-days, own rows count in full", () => {
    expect(allocateActualFeedCost(rows, animals, "A")).toEqual({ cost: 600, rowsMissingCost: 1, rowsCounted: 3 });
    expect(allocateActualFeedCost(rows, animals, "B")).toEqual({ cost: 300, rowsMissingCost: 1, rowsCounted: 3 });
  });

  test("herd shares add up to the herd cost exactly (no double count)", () => {
    const shares = herdFeedCostShares(rows, animals);
    expect(shares.A + shares.B).toBe(800);
  });

  test("days without any feeding stay NOT RECORDED (never back-filled)", () => {
    expect(daysNotRecorded("2026-09-01", "2026-09-05", ["2026-09-01", "2026-09-04"])).toEqual([
      "2026-09-02", "2026-09-03", "2026-09-05",
    ]);
  });
});

// ── Accounting: one path, cash = purchases only (P-07, P-08, Phase 12/13) ──────
describe("inventory ledger accounting", () => {
  const ledger = summarizeInventoryLedger([
    { type: "purchase", movement_type: "purchase", qty: 100, unit_cost: 30, cattle_id: null },
    { type: "purchase", movement_type: "opening_balance", qty: 10, unit_cost: 329.9, cattle_id: null },
    { type: "consumption", movement_type: "feed_mix_input", qty: 20, unit_cost: 30, cattle_id: null },
    { type: "purchase", movement_type: "feed_mix_output", qty: 20, unit_cost: 30, cattle_id: null },
    { type: "consumption", movement_type: "consumption", qty: 50, unit_cost: 30, cattle_id: null, category: "feed" },
    { type: "consumption", movement_type: "consumption", qty: 5, unit_cost: 30, cattle_id: "cow-1", category: "feed" },
    { type: "consumption", movement_type: "wastage", qty: 2, unit_cost: 30, cattle_id: null },
    { type: "purchase", movement_type: "adjustment_in", qty: 1, unit_cost: 30, cattle_id: null },
  ]);

  test("only supplier purchases are cash; opening stock is not", () => {
    expect(ledger.cashPurchases).toBe(3000);
    expect(ledger.openingBalance).toBe(3299);
  });

  test("mixing is an internal transformation (nets to zero)", () => {
    // 600 in, 600 out → only wastage 60 − gain 30 remain in otherNet
    expect(ledger.otherNet).toBe(30);
  });

  test("herd feed is expensed once, animal feed capitalised once", () => {
    expect(ledger.feedExpense).toBe(1500);
    expect(ledger.outCapitalized).toBe(150);
    expect(unallocatedInventoryCost(ledger)).toBe(ledger.outTotal - ledger.outCapitalized - ledger.otherIn);
  });

  test("inventory value = all IN − all OUT, signed", () => {
    expect(ledger.inventoryValue).toBe(3000 + 3299 + 600 + 30 - (600 + 1500 + 150 + 60));
    const negative = summarizeInventoryLedger([
      { type: "purchase", movement_type: "purchase", qty: 10, unit_cost: 10, cattle_id: null },
      { type: "consumption", movement_type: "consumption", qty: 15, unit_cost: 10, cattle_id: null },
    ]);
    expect(negative.inventoryValue).toBe(-50);
  });
});

// ── Negative stock is visible (P-05, Phase 8) ─────────────────────────────────
describe("stock balances are never clamped", () => {
  test("stock on hand can be negative", () => {
    expect(StockLedgerEngine.calculateItemStockOnHand([
      { type: "purchase", qty: 10 },
      { type: "consumption", qty: 44.38 },
    ])).toBeCloseTo(-34.38, 4);
  });

  test("portfolio keeps the sign and ignores unpriced rows in the average cost", () => {
    const [row] = StockLedgerEngine.compileInventoryPortfolio(
      [{ id: "mix", business_id: "b", name: "Mix Feed", unit: "kg", category: "feed", low_stock_threshold: null, is_active_roughage: false, is_discontinued: false, deleted_at: null }],
      [
        { id: "1", item_id: "mix", type: "purchase", movement_type: "purchase", qty: 100, unit_cost: 40, recorded_at: "2026-06-01" },
        { id: "2", item_id: "mix", type: "purchase", movement_type: "purchase", qty: 20, unit_cost: null, recorded_at: "2026-06-02" },
        { id: "3", item_id: "mix", type: "consumption", qty: 150, unit_cost: 40, recorded_at: "2026-06-03" },
      ]
    );
    expect(row.currentStock).toBe(-30);
    expect(row.averageUnitCost).toBe(40);
  });
});

// ── No automatic deduction, no fake data, no parallel cost path (static) ────────
describe("source guards", () => {
  test("rendering the inventory page never triggers a deduction", () => {
    const page = read("app/dashboard/(app)/inventory/page.tsx");
    expect(page).not.toMatch(/AutoEngineRunner|runAutoFeedDeductions/);
    expect(fs.existsSync(path.join(SRC, "components/inventory/AutoEngineRunner.tsx"))).toBe(false);
  });

  test("configuration changes never create consumption", () => {
    const actions = read("app/dashboard/(app)/inventory/actions.ts");
    const recipes = read("app/dashboard/(app)/inventory/recipe-actions.ts");
    expect(actions).not.toMatch(/export async function runAutoFeedDeductions/);
    expect(actions + recipes).not.toMatch(/runAutoFeedDeductions\(/);
    // setActiveRoughage / setActiveRecipe / updateRecipeActiveFrom only update configuration
    for (const [src, fn] of [[actions, "setActiveRoughage"], [recipes, "setActiveRecipe"], [recipes, "updateRecipeActiveFrom"]] as const) {
      const body = src.slice(src.indexOf(`export async function ${fn}`), src.indexOf("\nexport ", src.indexOf(`export async function ${fn}`) + 10));
      expect(body).not.toMatch(/inventory_transactions/);
    }
  });

  test("the feed page shows real inventory, not placeholder feeds", () => {
    const feed = read("app/dashboard/(app)/cattle/feed/page.tsx");
    expect(feed).not.toMatch(/feed-mix-01|currentStockKg: 850|: 42\.0|: 8\.5,/);
  });

  test("feeding writes the ledger only (no parallel cost_entries for the same feed)", () => {
    expect(read("app/dashboard/(app)/cattle/feed-session-actions.ts")).not.toMatch(/from\("cost_entries"\)/);
    expect(read("app/dashboard/(app)/cattle/feed-waste-actions.ts")).not.toMatch(/from\("cost_entries"\)/);
  });

  test("cash views count supplier purchases only", () => {
    // supplier purchases, net of audited purchase undos — never every IN row
    expect(read("lib/supabase/queries/cash.ts")).toMatch(/\.in\("movement_type", \["purchase", "purchase_reversal"\]\)/);
    // only enum values that exist: an unknown value ("draw") made PostgREST drop all partner capital
    expect(read("lib/supabase/queries/cash.ts")).not.toMatch(/"draw"\]/);
    expect(read("lib/accounting/engine.ts")).not.toMatch(/Math\.max\(0, allTimePurchaseValue/);
  });

  test("per-animal views no longer fall back to the ration estimate", () => {
    for (const f of [
      "app/dashboard/(app)/finance/page.tsx",
      "app/dashboard/(app)/partners/page.tsx",
      "app/dashboard/(app)/global-actions.ts",
      "lib/supabase/queries/valuation.ts",
      "lib/supabase/queries/dashboard.ts",
      "lib/accounting/engine.ts",
    ]) {
      expect(read(f)).not.toMatch(/calculateAlgorithmicFeedCost\(/);
    }
  });
});

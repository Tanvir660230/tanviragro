import { CostingEngine } from "@/lib/inventory/costing-engine";
import { StockLedgerEngine } from "@/lib/inventory/stock-ledger";
import { AdjustmentEngine } from "@/lib/inventory/adjustment-engine";
import { InventoryEventBus } from "@/lib/inventory/events";
import { InsufficientStockError } from "@/lib/inventory/errors";

describe("Phase 4: Costing & Valuation Engine", () => {
  test("Computes exact FIFO consumption cost across multiple purchase batches", () => {
    const purchases = [
      { qty: 100, unitCost: 10, recordedAt: "2026-01-01" }, // batch 1: 100 @ 10
      { qty: 100, unitCost: 20, recordedAt: "2026-01-10" }, // batch 2: 100 @ 20
    ];

    // Consume 50 when 0 were previously consumed -> 50 @ 10 = 10/unit
    expect(CostingEngine.computeFIFOCost(purchases, 0, 50)).toBe(10);

    // Consume 80 when 50 were previously consumed:
    // Takes remaining 50 from batch 1 (@ 10 = 500) and 30 from batch 2 (@ 20 = 600)
    // Total cost = 1100 / 80 = 13.75
    expect(CostingEngine.computeFIFOCost(purchases, 50, 80)).toBe(13.75);
  });

  test("Distributes Landed Transport Costs pro-rata across items", () => {
    const rawItems = [
      { itemId: "wheat-bran", qty: 10, itemTotalCost: 3000 },
      { itemId: "mustard-cake", qty: 10, itemTotalCost: 7000 },
    ];
    // Total raw cost = 10,000. Transport = 1,000.
    // wheat-bran gets 30% of transport (300) -> total 3300 / 10 = 330/unit
    // mustard-cake gets 70% of transport (700) -> total 7700 / 10 = 770/unit
    const allocated = CostingEngine.distributeLandedCost(rawItems, 1000);

    expect(allocated[0].unitCost).toBe(330);
    expect(allocated[1].unitCost).toBe(770);
    expect(allocated[0].landedTotalCost + allocated[1].landedTotalCost).toBe(11000);
  });

  test("Calculates stock valuation breakdown with active batch layers", () => {
    const txns = [
      { id: "tx-1", itemId: "item-1", type: "purchase" as const, qty: 100, unitCost: 10, recordedAt: "2026-01-01" },
      { id: "tx-2", itemId: "item-1", type: "purchase" as const, qty: 100, unitCost: 15, recordedAt: "2026-01-05" },
      { id: "tx-3", itemId: "item-1", type: "consumption" as const, qty: 120, unitCost: null, recordedAt: "2026-01-10" },
    ];

    const val = CostingEngine.calculateInventoryValuation("item-1", "Corn Silage", "kg", txns, "FIFO");

    // Total bought: 200. Consumed: 120. Stock on hand: 80.
    // 80 remaining are from batch 2 (@ 15) -> Total valuation = 80 * 15 = 1200
    expect(val.stockOnHand).toBe(80);
    expect(val.totalValue).toBe(1200);
    expect(val.unitCost).toBe(15);
    expect(val.activeBatches.length).toBe(1);
    expect(val.activeBatches[0].remainingQty).toBe(80);
  });
});

describe("Phase 4: Stock Ledger & Portfolio Compiler", () => {
  test("Compiles chronological running balances correctly", () => {
    const item = {
      id: "i-1",
      business_id: "biz-1",
      name: "Wheat Bran",
      unit: "kg",
      category: "feed",
      low_stock_threshold: 50,
      is_active_roughage: false,
      is_discontinued: false,
      deleted_at: null,
    };

    const txns = [
      { id: "t1", item_id: "i-1", type: "purchase" as const, qty: 100, unit_cost: 35, recorded_at: "2026-01-01" },
      { id: "t2", item_id: "i-1", type: "consumption" as const, qty: 30, unit_cost: 35, recorded_at: "2026-01-02" },
      { id: "t3", item_id: "i-1", type: "purchase" as const, qty: 50, unit_cost: 40, recorded_at: "2026-01-03" },
      { id: "t4", item_id: "i-1", type: "consumption" as const, qty: 40, unit_cost: 35, recorded_at: "2026-01-04" },
    ];

    const ledger = StockLedgerEngine.compileStockLedger(item, txns);

    expect(ledger.length).toBe(4);
    expect(ledger[0].runningBalance).toBe(100);
    expect(ledger[1].runningBalance).toBe(70);
    expect(ledger[2].runningBalance).toBe(120);
    expect(ledger[3].runningBalance).toBe(80);
  });

  test("Compiles inventory portfolio with low-stock flags", () => {
    const items = [
      {
        id: "i-1",
        business_id: "biz-1",
        name: "Wheat Bran",
        unit: "kg",
        category: "feed",
        low_stock_threshold: 100,
        is_active_roughage: false,
        is_discontinued: false,
        deleted_at: null,
      },
    ];

    const txns = [
      { id: "t1", item_id: "i-1", type: "purchase" as const, qty: 80, unit_cost: 30, recorded_at: "2026-01-01" },
    ];

    const portfolio = StockLedgerEngine.compileInventoryPortfolio(items, txns);

    expect(portfolio[0].currentStock).toBe(80);
    expect(portfolio[0].isLowStock).toBe(true);
    expect(portfolio[0].totalValuation).toBe(2400);
  });

  test("Throws InsufficientStockError when requested quantity exceeds available", () => {
    expect(() => {
      StockLedgerEngine.assertStockAvailability("Wheat Bran", 100, 50, "kg");
    }).toThrow(InsufficientStockError);
  });
});

describe("Phase 4: Adjustment Engine", () => {
  test("AdjustmentEngine correctly calculates count reconciliation deltas", () => {
    // Current stock: 100. Physical count shows 90 (-10 spoilage)
    const adjOut = AdjustmentEngine.processAdjustment(
      { itemId: "i-1", adjustedQty: 90, reason: "spoilage", recordedAt: "2026-02-01" },
      100,
      30
    );
    expect(adjOut.direction).toBe("OUT");
    expect(adjOut.adjustmentQty).toBe(10);
    expect(adjOut.transactionType).toBe("consumption");
    expect(adjOut.totalCost).toBe(300);

    // Current stock: 80. Physical count shows 95 (+15 found)
    const adjIn = AdjustmentEngine.processAdjustment(
      { itemId: "i-1", adjustedQty: 95, reason: "physical_count", recordedAt: "2026-02-01" },
      80,
      30
    );
    expect(adjIn.direction).toBe("IN");
    expect(adjIn.adjustmentQty).toBe(15);
    expect(adjIn.transactionType).toBe("purchase");
  });
});

describe("Phase 4: Inventory Event Bus", () => {
  test("Dispatches and subscribes to inventory events cleanly", async () => {
    const received: any[] = [];
    const unsubscribe = InventoryEventBus.subscribe("StockReceived", (evt) => {
      received.push(evt);
    });

    await InventoryEventBus.publish(
      "StockReceived",
      "biz-1",
      { supplierName: "National Feed", totalBill: 50_000 },
      "user-1"
    );

    expect(received.length).toBe(1);
    expect(received[0].payload.supplierName).toBe("National Feed");

    unsubscribe();

    await InventoryEventBus.publish("StockReceived", "biz-1", { supplierName: "Other" });
    expect(received.length).toBe(1);
  });
});
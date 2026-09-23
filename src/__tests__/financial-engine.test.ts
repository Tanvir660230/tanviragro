import {
  CHART_OF_ACCOUNTS,
  getAccountByCode,
  mapExpenseCategoryToAccount,
} from "@/lib/financial/chart-of-accounts";
import {
  calculateDepreciation,
  calculateAccruedInterest,
  calculateProfitMetrics,
} from "@/lib/financial/calculations";
import { CashEngine } from "@/lib/financial/cash-engine";
import { JournalEngine } from "@/lib/financial/journal";
import { GeneralLedgerEngine } from "@/lib/financial/ledger";
import { LoanEngine } from "@/lib/financial/loan-engine";
import { AssetEngine } from "@/lib/financial/asset-engine";
import { ExpenseEngine } from "@/lib/financial/expense-engine";
import { RevenueEngine } from "@/lib/financial/revenue-engine";
import { FinancialEventBus } from "@/lib/financial/events";
import { PeriodClosedError, JournalImbalanceError } from "@/lib/financial/errors";

describe("Phase 3: Chart of Accounts & Categorization", () => {
  test("Standard accounts are properly initialized with normal balance conventions", () => {
    expect(CHART_OF_ACCOUNTS["1010"].normalBalance).toBe("debit");
    expect(CHART_OF_ACCOUNTS["1010"].section).toBe("assets");

    expect(CHART_OF_ACCOUNTS["2100"].normalBalance).toBe("credit");
    expect(CHART_OF_ACCOUNTS["2100"].section).toBe("liabilities");

    expect(CHART_OF_ACCOUNTS["3010"].normalBalance).toBe("credit");
    expect(CHART_OF_ACCOUNTS["3010"].section).toBe("equity");

    expect(CHART_OF_ACCOUNTS["4010"].normalBalance).toBe("credit");
    expect(CHART_OF_ACCOUNTS["4010"].section).toBe("revenue");

    expect(CHART_OF_ACCOUNTS["6100"].normalBalance).toBe("debit");
    expect(CHART_OF_ACCOUNTS["6100"].section).toBe("expenses");
  });

  test("mapExpenseCategoryToAccount accurately maps freeform Bengali/English categories", () => {
    expect(mapExpenseCategoryToAccount("Veterinary Doctor Fee").code).toBe("6100");
    expect(mapExpenseCategoryToAccount("Worker Salary (kormi)").code).toBe("6200");
    expect(mapExpenseCategoryToAccount("Electricity & Diesel (Current)").code).toBe("6300");
    expect(mapExpenseCategoryToAccount("Land Lease Bhara").code).toBe("6400");
    expect(mapExpenseCategoryToAccount("Truck Transport Shipping").code).toBe("6700");
    expect(mapExpenseCategoryToAccount("Shed Repair Meramot").code).toBe("6800");
    expect(mapExpenseCategoryToAccount("Silage & Feed Khail").code).toBe("5030");
    expect(mapExpenseCategoryToAccount("Miscellaneous general").code).toBe("6600");
  });
});

describe("Phase 3: Central Cash Engine", () => {
  test("Calculates exact cash reconciliation formula", () => {
    const rawData = {
      openingBalance: 50_000,
      partnerTransactions: [
        { amount: 100_000, type: "investment" },
        { amount: 20_000, type: "withdrawal" },
      ],
      sales: [{ sale_price_total: 80_000 }, { sale_price_total: 40_000 }],
      cattle: [{ purchase_price: 60_000 }, { purchase_price: 30_000 }],
      inventoryPurchases: [
        { qty: 10, unit_cost: 1000 }, // 10,000
      ],
      operatingExpenses: [{ amount: 5000 }, { amount: 3000 }], // 8000
      costEntryAssets: [{ amount: 15_000 }],
      fixedAssets: [{ purchase_cost: 25_000 }], // total fixed assets = 40,000
      loans: [
        {
          principal_amount: 50_000,
          interest_rate_pct: 10,
          loan_date: "2026-01-01",
          status: "active",
          loan_payments: [{ amount: 10_000 }],
        }, // net proceeds = 40,000
      ],
      liabilities: [{ outstanding: 12_000, settled_at: null }],
    };

    const cash = CashEngine.calculateCashPosition(rawData);

    // Inflows: 50,000 (opening) + 100,000 (capital) + 120,000 (sales) + 40,000 (loan net) + 12,000 (liabilities) = 322,000
    // Outflows: 20,000 (draw) + 90,000 (cattle) + 10,000 (inv) + 8,000 (op) + 40,000 (assets) = 168,000
    // Balance: 322,000 - 168,000 = 154,000
    expect(cash.totalInflow).toBe(322_000);
    expect(cash.totalOutflow).toBe(168_000);
    expect(cash.balance).toBe(154_000);
    expect(cash.inflows.salesRevenue).toBe(120_000);
    expect(cash.outflows.cattlePurchases).toBe(90_000);
  });
});

describe("Phase 3: Journal & General Ledger Engine", () => {
  test("Cattle purchase journal creates balanced double-entry lines", () => {
    const journal = JournalEngine.createCattlePurchaseJournal({
      businessId: "biz-1",
      cattleId: "cow-101",
      amount: 45_000,
      date: "2026-02-01",
      tagId: "TAG-101",
    });

    expect(journal.isBalanced).toBe(true);
    expect(journal.totalDebit).toBe(45_000);
    expect(journal.totalCredit).toBe(45_000);
    expect(journal.lines[0].accountCode).toBe("1200"); // Livestock Inventory Debit
    expect(journal.lines[1].accountCode).toBe("1010"); // Cash Credit
  });

  test("Cattle sale journal creates balanced double-entry lines", () => {
    const journal = JournalEngine.createCattleSaleJournal({
      businessId: "biz-1",
      saleId: "sale-202",
      cattleId: "cow-101",
      salePrice: 75_000,
      purchaseCost: 45_000,
      date: "2026-03-01",
      tagId: "TAG-101",
    });

    expect(journal.isBalanced).toBe(true);
    expect(journal.totalDebit).toBe(75_000);
    expect(journal.totalCredit).toBe(75_000);
    expect(journal.lines[0].accountCode).toBe("1010"); // Cash Debit
    expect(journal.lines[1].accountCode).toBe("4010"); // Revenue Credit
  });

  test("Rejects imbalanced journal entries", () => {
    expect(() => {
      JournalEngine.validateJournalEntry({
        id: "test",
        businessId: "biz-1",
        referenceNumber: "REF-1",
        sourceModule: "manual_journal",
        transactionDate: "2026-01-01",
        description: "Imbalanced test",
        lines: [
          { accountCode: "1010", accountName: "Cash", debit: 500, credit: 0 },
          { accountCode: "4010", accountName: "Revenue", debit: 0, credit: 400 },
        ],
        createdAt: "2026-01-01",
      });
    }).toThrow(JournalImbalanceError);
  });

  test("General Ledger engine compiles multiple journals into balanced trial balance", () => {
    const j1 = JournalEngine.createCattlePurchaseJournal({
      businessId: "biz-1",
      cattleId: "c1",
      amount: 50_000,
      date: "2026-01-01",
    });
    const j2 = JournalEngine.createCattleSaleJournal({
      businessId: "biz-1",
      saleId: "s1",
      cattleId: "c1",
      salePrice: 80_000,
      purchaseCost: 50_000,
      date: "2026-02-01",
    });

    const ledger = GeneralLedgerEngine.compileLedger("biz-1", [j1, j2]);

    expect(ledger.isBalanced).toBe(true);
    expect(ledger.totalDebits).toBe(130_000);
    expect(ledger.totalCredits).toBe(130_000);
    expect(ledger.accounts["1010"].netBalance).toBe(30_000); // 80k in - 50k out = +30k debit
    expect(ledger.accounts["4010"].netBalance).toBe(80_000); // 80k credit
  });
});

describe("Phase 3: Asset & Loan Engines", () => {
  test("AssetEngine aggregates portfolio with accumulated depreciation", () => {
    const portfolio = AssetEngine.aggregateAssetPortfolio([
      {
        id: "fa-1",
        businessId: "biz-1",
        name: "Silage Harvester",
        category: "Machinery",
        purchaseDate: "2025-01-01",
        purchaseCost: 120_000,
        salvageValue: 0,
        usefulLifeYears: 10,
        depreciationMethod: "straight_line",
        isActive: true,
      },
    ]);

    expect(portfolio.totalCost).toBe(120_000);
    expect(portfolio.totalMonthlyDepreciation).toBe(1000);
    expect(portfolio.totalAnnualDepreciation).toBe(12_000);
    expect(portfolio.netBookValue).toBeLessThanOrEqual(120_000);
  });

  test("LoanEngine calculates settlement dues and interest accurately", () => {
    const summary = LoanEngine.summarizeLoan(
      {
        id: "l-1",
        businessId: "biz-1",
        lenderName: "Krishi Bank",
        principalAmount: 100_000,
        interestRatePct: 12,
        loanDate: "2025-01-01",
        status: "active",
        payments: [{ id: "p1", amount: 40_000, paymentDate: "2025-06-01" }],
      },
      "2026-01-01"
    );

    expect(summary.principalOutstanding).toBe(60_000);
    expect(summary.totalPaid).toBe(40_000);
    expect(summary.accruedInterest).toBeGreaterThan(7000); // 60,000 * 12% for ~1 year = 7,200
    expect(summary.isFullyPaid).toBe(false);
  });
});

describe("Phase 3: Financial Event Bus", () => {
  test("FinancialEventBus dispatches and receives events cleanly", async () => {
    const received: any[] = [];
    const unsubscribe = FinancialEventBus.subscribe("ExpenseCreated", (evt) => {
      received.push(evt);
    });

    await FinancialEventBus.publish(
      "ExpenseCreated",
      "biz-123",
      { costId: "c-100", amount: 5000, category: "Feed" },
      "user-1"
    );

    expect(received.length).toBe(1);
    expect(received[0].payload.amount).toBe(5000);
    expect(received[0].businessId).toBe("biz-123");

    unsubscribe();

    await FinancialEventBus.publish("ExpenseCreated", "biz-123", { costId: "c-101" });
    expect(received.length).toBe(1);
  });
});
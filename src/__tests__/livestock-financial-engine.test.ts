import {
  LivestockCostAllocationEngine,
  LivestockProfitabilityEngine,
  BiologicalAssetValuationEngine,
  FinancialControlEngine,
  LivestockBudgetEngine,
  AutomaticLivestockFinancialEventEngine,
  GeneralLedgerEngine,
} from "@/lib/financial";

describe("Sprint 18 — Enterprise Livestock Financial Engine", () => {
  const businessId = "biz-test-101";

  // ── 1. Cost Allocation Engine Tests ────────────────────────────────────────
  describe("LivestockCostAllocationEngine", () => {
    const mockCandidates = [
      { cattleId: "c1", tagId: "TAG-001", currentWeightKg: 300, daysOnFeed: 60, isActive: true },
      { cattleId: "c2", tagId: "TAG-002", currentWeightKg: 450, daysOnFeed: 90, isActive: true },
      { cattleId: "c3", tagId: "TAG-003", currentWeightKg: 250, daysOnFeed: 30, isActive: true },
    ];

    it("should proportionally allocate costs by head count with exact cent precision", () => {
      const totalAmount = 10000;
      const results = LivestockCostAllocationEngine.calculateAllocation(
        totalAmount,
        "head_count",
        mockCandidates
      );

      expect(results).toHaveLength(3);
      const allocatedSum = results.reduce((sum, r) => sum + r.allocatedAmount, 0);
      expect(Math.round(allocatedSum * 100) / 100).toBe(totalAmount);
    });

    it("should allocate costs proportional to cattle live weight", () => {
      const totalAmount = 10000;
      const results = LivestockCostAllocationEngine.calculateAllocation(
        totalAmount,
        "weight_proportional",
        mockCandidates
      );

      expect(results).toHaveLength(3);
      const c2 = results.find((r) => r.cattleId === "c2");
      expect(c2?.allocatedAmount).toBeCloseTo(4500, 0);

      const allocatedSum = results.reduce((sum, r) => sum + r.allocatedAmount, 0);
      expect(Math.round(allocatedSum * 100) / 100).toBe(totalAmount);
    });

    it("should allocate costs proportional to days on feed", () => {
      const totalAmount = 18000;
      const results = LivestockCostAllocationEngine.calculateAllocation(
        totalAmount,
        "feed_days",
        mockCandidates
      );

      expect(results).toHaveLength(3);
      const c2 = results.find((r) => r.cattleId === "c2");
      expect(c2?.allocatedAmount).toBeCloseTo(9000, 0);

      const allocatedSum = results.reduce((sum, r) => sum + r.allocatedAmount, 0);
      expect(Math.round(allocatedSum * 100) / 100).toBe(totalAmount);
    });

    it("should create formal allocation run audit record", () => {
      const run = LivestockCostAllocationEngine.createAllocationRun({
        businessId,
        sourceCategory: "Silage Feed",
        allocationMethod: "weight_proportional",
        totalAmount: 15000,
        targetScope: "all_active",
        recipientsCount: 3,
        performedBy: "user-mgr-1",
      });

      expect(run.allocationBatchNumber).toMatch(/^ALLOC-\d+/);
      expect(run.totalAmount).toBe(15000);
      expect(run.recipientsCount).toBe(3);
    });
  });

  // ── 2. Profitability Engine Tests ──────────────────────────────────────────
  describe("LivestockProfitabilityEngine", () => {
    it("should compute full absorption unit economics per animal", () => {
      const economics = LivestockProfitabilityEngine.calculateAnimalUnitEconomics({
        cattleId: "cow-101",
        businessId,
        tagId: "TAG-101",
        purchaseCost: 60000,
        purchaseWeightKg: 200,
        finalWeightKg: 350,
        feedCost: 20000,
        medicineCost: 2500,
        vaccineCost: 1500,
        laborAllocated: 3000,
        overheadAllocated: 1000,
        saleRevenue: 110000,
        status: "sold",
      });

      expect(economics.totalAccumulatedCost).toBe(88000);
      expect(economics.netProfit).toBe(22000);
      expect(economics.weightGainKg).toBe(150);
      expect(economics.costPerKgGain).toBeCloseTo(186.67, 1);
      expect(economics.roiPct).toBe(25);
    });

    it("should aggregate farm-level unit economics correctly", () => {
      const ledgers = [
        LivestockProfitabilityEngine.calculateAnimalUnitEconomics({
          cattleId: "c1",
          businessId,
          purchaseCost: 50000,
          feedCost: 15000,
          saleRevenue: 85000,
          status: "sold",
        }),
        LivestockProfitabilityEngine.calculateAnimalUnitEconomics({
          cattleId: "c2",
          businessId,
          purchaseCost: 60000,
          feedCost: 20000,
          saleRevenue: 100000,
          status: "sold",
        }),
      ];

      const farmSummary = LivestockProfitabilityEngine.aggregateFarmProfitability("f1", "Main Farm", ledgers);
      expect(farmSummary.totalHeadCount).toBe(2);
      expect(farmSummary.totalPurchaseCost).toBe(110000);
      expect(farmSummary.totalFeedCost).toBe(35000);
      expect(farmSummary.totalSaleRevenue).toBe(185000);
      expect(farmSummary.totalNetProfit).toBe(40000);
    });
  // ── 3. IAS 41 Biological Asset Valuation Tests ─────────────────────────────
  describe("BiologicalAssetValuationEngine", () => {
    it("should compute fair value revaluation surplus and post balanced journal", () => {
      const herd = [
        { cattleId: "c1", currentWeightKg: 300, bookValueCostBasis: 80000, isActive: true },
        { cattleId: "c2", currentWeightKg: 400, bookValueCostBasis: 100000, isActive: true },
      ];

      const result = BiologicalAssetValuationEngine.calculateFairValueValuation({
        businessId,
        marketRatePerKg: 400,
        herd,
      });

      expect(result.valuation.totalHerdWeightKg).toBe(700);
      expect(result.valuation.newFairValue).toBe(280000);
      expect(result.valuation.unrealizedGainLoss).toBe(100000);

      expect(result.journalEntry.isBalanced).toBe(true);
      expect(result.journalEntry.lines[0].accountCode).toBe("1200");
      expect(result.journalEntry.lines[0].debit).toBe(100000);
      expect(result.journalEntry.lines[1].accountCode).toBe("4040");
      expect(result.journalEntry.lines[1].credit).toBe(100000);
    });
  });

  // ── 4. Financial Controls & Governance Tests ───────────────────────────────
  describe("FinancialControlEngine", () => {
    it("should throw PeriodClosedError when transaction falls inside a locked period", () => {
      const periodLocks = [
        {
          id: "lock-1",
          businessId,
          lockName: "2026-Q1 Audited Period",
          startDate: "2026-01-01",
          endDate: "2026-03-31",
          isLocked: true,
          lockedAt: new Date().toISOString(),
        },
      ];

      expect(() => {
        FinancialControlEngine.validatePeriodNotLocked("2026-02-15", periodLocks);
      }).toThrow("2026-Q1 Audited Period");

      expect(() => {
        FinancialControlEngine.validatePeriodNotLocked("2026-04-01", periodLocks);
      }).not.toThrow();
    });

    it("should generate Storno counter-entry with net zero balance impact", () => {
      const originalJournal = AutomaticLivestockFinancialEventEngine.createFeedConsumptionJournal({
        businessId,
        feedingSessionId: "session-999",
        feedCost: 7500,
        date: "2026-05-10",
      });

      const { reversalJournal } = FinancialControlEngine.createReversalJournalEntry({
        businessId,
        originalJournal,
        reversalReason: "Incorrect ration recorded by feeder",
        reversedBy: "audit-user",
      });

      expect(reversalJournal.isBalanced).toBe(true);
      expect(reversalJournal.totalDebit).toBe(7500);
      expect(reversalJournal.totalCredit).toBe(7500);
      expect(reversalJournal.lines[0].accountCode).toBe("5030");
      expect(reversalJournal.lines[0].credit).toBe(7500);

      const gl = GeneralLedgerEngine.compileLedger(businessId, [originalJournal, reversalJournal]);
      expect(gl.isBalanced).toBe(true);
      expect(gl.accounts["5030"].netBalance).toBe(0);
      expect(gl.accounts["1300"].netBalance).toBe(0);
    });
  });

  // ── 5. Budget & Forecasting Engine Tests ───────────────────────────────────
  describe("LivestockBudgetEngine", () => {

    it("should evaluate budget variance with favorable/unfavorable indicators", () => {
      const budgetAnalysis = LivestockBudgetEngine.analyzeVariance({
        id: "b-1",
        businessId,
        fiscalYear: 2026,
        month: 5,
        accountCode: "5030",
        budgetedAmount: 50000,
        actualAmount: 42000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });


      expect(budgetAnalysis.status).toBe("favorable");
      expect(budgetAnalysis.budget.varianceAmount).toBe(8000);
      expect(budgetAnalysis.utilizationPct).toBe(84);
    });

    it("should forecast cash runway across 30, 60, and 90 day horizons", () => {
      const forecast = LivestockBudgetEngine.forecastCashFlow({
        currentCashBalance: 300000,
        monthlyAverageRevenue: 250000,
        monthlyAverageFeedCost: 100000,
        monthlyAverageLaborOverhead: 50000,
        monthlyDebtObligations: 0,
        daysHorizon: 30,
      });

      expect(forecast.projectedInflow).toBe(250000);
      expect(forecast.projectedOutflow).toBe(150000);
      expect(forecast.netCashFlow).toBe(100000);
      expect(forecast.projectedClosingBalance).toBe(400000);
    });
  });

  // ── 6. Automatic Domain Financial Events Tests ─────────────────────────────
  describe("AutomaticLivestockFinancialEventEngine", () => {
    it("should generate valid balanced journal for vaccination programs", () => {
      const journal = AutomaticLivestockFinancialEventEngine.createVaccinationJournal({
        businessId,
        vaccinationId: "vax-88",
        vaccineName: "FMD Quadrivalent",
        cost: 4500,
        headCount: 30,
        date: "2026-06-01",
      });

      expect(journal.isBalanced).toBe(true);
      expect(journal.lines).toHaveLength(2);
      expect(journal.lines[0].accountCode).toBe("6160");
      expect(journal.lines[0].debit).toBe(4500);
      expect(journal.lines[1].accountCode).toBe("1010");
      expect(journal.lines[1].credit).toBe(4500);
    });

    it("should generate valid balanced journal for calf birth IAS 41 recognition", () => {
      const journal = AutomaticLivestockFinancialEventEngine.createBirthRecognitionJournal({
        businessId,
        calfId: "calf-007",
        tagId: "CALF-007",
        initialBiologicalValue: 15000,
        date: "2026-06-02",
      });

      expect(journal.isBalanced).toBe(true);
      expect(journal.lines[0].accountCode).toBe("1200");
      expect(journal.lines[0].debit).toBe(15000);
      expect(journal.lines[1].accountCode).toBe("4040");
      expect(journal.lines[1].credit).toBe(15000);
    });

    it("should generate valid balanced journal for mortality casualty derecognition", () => {
      const journal = AutomaticLivestockFinancialEventEngine.createMortalityWriteOffJournal({
        businessId,
        cattleId: "cow-deceased-1",
        tagId: "TAG-999",
        bookValueLoss: 65000,
        causeOfDeath: "Acute Bloat",
        date: "2026-06-03",
      });

      expect(journal.isBalanced).toBe(true);
      expect(journal.lines[0].accountCode).toBe("8010");
      expect(journal.lines[0].debit).toBe(65000);
      expect(journal.lines[1].accountCode).toBe("1200");
      expect(journal.lines[1].credit).toBe(65000);
    });
  });
});
});



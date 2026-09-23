import { CommerceEngine } from "@/lib/commerce/CommerceEngine";
import { CommercialValuationEngine } from "@/lib/commerce/CommercialValuationEngine";
import { TransferLogisticsEngine } from "@/lib/commerce/TransferLogisticsEngine";
import { OwnershipEngine } from "@/lib/commerce/OwnershipEngine";
import type { CommerceOrderItem, OwnershipRecord } from "@/lib/commerce/types";

describe("Sprint 17: Enterprise Commerce & Trading Platform Engines", () => {
  describe("CommerceEngine", () => {
    test("calculates order totals accurately with weights and rate per kg", () => {
      const items: CommerceOrderItem[] = [
        {
          id: "item-1",
          orderId: "ord-1",
          itemType: "livestock",
          description: "Brahman Bull #TAG-01",
          quantity: 1,
          unitPrice: 180000,
          ratePerKg: 450,
          finalWeightKg: 400,
          totalPrice: 0,
        },
        {
          id: "item-2",
          orderId: "ord-1",
          itemType: "livestock",
          description: "Sahiwal Bull #TAG-02",
          quantity: 1,
          unitPrice: 147000,
          ratePerKg: 420,
          finalWeightKg: 350,
          totalPrice: 0,
        },
      ];

      const totals = CommerceEngine.calculateOrderTotals(items, {
        discountAmount: 5000,
        transportCost: 3000,
        commissionAmount: 1500,
        taxRatePercent: 0,
      });

      // Item 1: 450 * 400 = 180,000
      // Item 2: 420 * 350 = 147,000
      // Subtotal = 327,000
      expect(totals.subtotalAmount).toBe(327000);
      expect(totals.totalWeightKg).toBe(750);
      expect(totals.itemCount).toBe(2);
      expect(totals.discountAmount).toBe(5000);
      expect(totals.transportCost).toBe(3000);
      expect(totals.commissionAmount).toBe(1500);
      // Net: 327000 - 5000 + 3000 + 1500 = 326500
      expect(totals.netTotalAmount).toBe(326500);
    });

    test("generates installment schedules correctly", () => {
      const schedule = CommerceEngine.generateInstallmentSchedule(100000, 4, "2026-09-01T00:00:00.000Z", 30);
      expect(schedule.length).toBe(4);
      expect(schedule[0].amount).toBe(25000);
      expect(schedule[3].amount).toBe(25000);
      expect(schedule[0].status).toBe("pending");
      const sum = schedule.reduce((s, i) => s + i.amount, 0);
      expect(sum).toBe(100000);
    });
  });

  describe("CommercialValuationEngine", () => {
    test("calculates animal P&L, gross margin, and annualized ROI", () => {
      const result = CommercialValuationEngine.calculateAnimalProfitLoss({
        cattleId: "c-101",
        tagId: "TAG-101",
        purchasePrice: 120000,
        purchaseDateISO: "2026-01-01T00:00:00.000Z",
        soldDateISO: "2026-07-01T00:00:00.000Z", // ~181 days
        salePrice: 180000,
        feedCost: 25000,
        medicalCost: 3000,
        logisticsCost: 2000,
      });

      expect(result.purchasePrice).toBe(120000);
      expect(result.totalCostBasis).toBe(150000); // 120k + 25k + 3k + 2k
      expect(result.salePrice).toBe(180000);
      expect(result.grossMarginBdt).toBe(30000);
      expect(result.netMarginPercentage).toBe(16.67); // 30000/180000
      expect(result.holdingDays).toBeGreaterThan(150);
      expect(result.annualizedRoi).toBeGreaterThan(0);
    });

    test("aggregates batch valuation accurately", () => {
      const animal1 = CommercialValuationEngine.calculateAnimalProfitLoss({
        cattleId: "c-1",
        tagId: "TAG-1",
        purchasePrice: 100000,
        purchaseDateISO: "2026-01-01",
        soldDateISO: "2026-06-01",
        salePrice: 140000,
        feedCost: 15000,
        medicalCost: 2000,
        logisticsCost: 1000,
      });

      const animal2 = CommercialValuationEngine.calculateAnimalProfitLoss({
        cattleId: "c-2",
        tagId: "TAG-2",
        purchasePrice: 90000,
        purchaseDateISO: "2026-01-01",
        soldDateISO: "2026-06-01",
        salePrice: 130000,
        feedCost: 12000,
        medicalCost: 1000,
        logisticsCost: 1000,
      });

      const batch = CommercialValuationEngine.aggregateBatchValuation([animal1, animal2]);
      expect(batch.totalAnimals).toBe(2);
      expect(batch.totalPurchaseCost).toBe(190000);
      expect(batch.totalRealizedRevenue).toBe(270000);
      expect(batch.totalNetProfitBdt).toBe(batch.totalRealizedRevenue - batch.totalCostBasis);
      expect(batch.overallNetMarginPct).toBeGreaterThan(0);
    });
  });

  describe("TransferLogisticsEngine", () => {
    test("validates dispatch params properly", () => {
      const valid = TransferLogisticsEngine.validateTransferDispatch({
        transferType: "sale_delivery",
        originName: "Farm Unit 1",
        destinationName: "Customer Site",
        cattleCount: 3,
        vehicleNumber: "DHAKA-METRO-1234",
        driverName: "Karim Uddin",
      });
      expect(valid.isValid).toBe(true);

      const invalid = TransferLogisticsEngine.validateTransferDispatch({
        transferType: "sale_delivery",
        originName: "Farm Unit 1",
        destinationName: "Farm Unit 1",
        cattleCount: 0,
      });
      expect(invalid.isValid).toBe(false);
      expect(invalid.errors.length).toBeGreaterThan(0);
    });

    test("evaluates arrival inspection and quarantine requirements", () => {
      const safe = TransferLogisticsEngine.validateArrivalInspection({
        health_ok: true,
        injuries: false,
        feed_provided: true,
        water_provided: true,
      });
      expect(safe.requiresQuarantine).toBe(false);

      const alert = TransferLogisticsEngine.validateArrivalInspection({
        health_ok: false,
        injuries: true,
        feed_provided: false,
        water_provided: true,
      });
      expect(alert.requiresQuarantine).toBe(true);
      expect(alert.warnings.length).toBeGreaterThan(0);
    });

    test("validates transit state progression", () => {
      expect(TransferLogisticsEngine.isValidTransitStatusTransition("scheduled", "dispatched")).toBe(true);
      expect(TransferLogisticsEngine.isValidTransitStatusTransition("dispatched", "in_transit")).toBe(true);
      expect(TransferLogisticsEngine.isValidTransitStatusTransition("completed", "dispatched")).toBe(false);
    });
  });

  describe("OwnershipEngine", () => {
    test("generates cryptographic deterministic ownership hashes", () => {
      const hash1 = OwnershipEngine.generateOwnershipHash({
        cattleId: "c-101",
        tagId: "TAG-101",
        previousOwner: "Tanvir Agro Enterprise",
        newOwner: "Rahim Chowdhury",
        transferDate: "2026-09-09",
        price: 185000,
        witness: "Dr. Hassan",
      });

      const hash2 = OwnershipEngine.generateOwnershipHash({
        cattleId: "c-101",
        tagId: "TAG-101",
        previousOwner: "Tanvir Agro Enterprise",
        newOwner: "Rahim Chowdhury",
        transferDate: "2026-09-09",
        price: 185000,
        witness: "Dr. Hassan",
      });

      expect(hash1).toMatch(/^OWN-/);
      expect(hash1).toBe(hash2);
    });

    test("verifies ownership chain continuity", () => {
      const validChain: OwnershipRecord[] = [
        {
          id: "rec-1",
          businessId: "biz-1",
          cattleId: "c-1",
          tagId: "TAG-1",
          previousOwnerName: "Breeder Farm",
          newOwnerName: "Tanvir Agro Enterprise",
          transferDate: "2025-01-01",
          transferReason: "purchase",
          transferPrice: 80000,
          approvalStatus: "verified",
          digitalSignatureHash: "HASH1",
          createdAt: "2025-01-01",
        },
        {
          id: "rec-2",
          businessId: "biz-1",
          cattleId: "c-1",
          tagId: "TAG-1",
          previousOwnerName: "Tanvir Agro Enterprise",
          newOwnerName: "Buyer Ahmed",
          transferDate: "2026-05-01",
          transferReason: "sale",
          transferPrice: 150000,
          approvalStatus: "verified",
          digitalSignatureHash: "HASH2",
          createdAt: "2026-05-01",
        },
      ];

      const check = OwnershipEngine.verifyOwnershipChain(validChain);
      expect(check.isValid).toBe(true);
    });

    test("generates standard bill of sale text", () => {
      const text = OwnershipEngine.generateBillOfSaleText({
        cattleId: "c-12345678-uuid",
        tagId: "TAG-99",
        breed: "Sindhi",
        transferReason: "sale",
        previousOwnerName: "Tanvir Agro Enterprise",
        newOwnerName: "Faridul Islam",
        transferDate: "2026-09-09",
        transferPrice: 195000,
      });

      expect(text).toContain("OFFICIAL LIVESTOCK OWNERSHIP CERTIFICATE");
      expect(text).toContain("TAG-99");
      expect(text).toContain("Tanvir Agro Enterprise");
      expect(text).toContain("Faridul Islam");
    });
  });
});

import { SnapshotVerifier } from "@/lib/governance/snapshot-verifier";
import { ReconciliationEngine } from "@/lib/governance/reconciliation-engine";
import { isDateLocked, validateFinancialLockDate } from "@/lib/financial/financial-lock";

describe("Phase 1: Foundation, Data Governance & Financial Lockout Suite", () => {
  describe("SnapshotVerifier Engine", () => {
    it("computes deterministic checksums for arbitrary states", () => {
      const stateA = { id: "c-101", tag_number: "TAG-001", weight: 350 };
      const stateB = { weight: 350, id: "c-101", tag_number: "TAG-001" }; // different key order

      const hashA = SnapshotVerifier.computeChecksum(stateA);
      const hashB = SnapshotVerifier.computeChecksum(stateB);

      expect(hashA).toBeDefined();
      expect(hashA).toBe(hashB);
    });

    it("accurately detects modified fields and ignores specified transient keys", () => {
      const previous = {
        id: "c-101",
        status: "active",
        purchase_price: 85000,
        notes: "Healthy bull",
        updated_at: "2026-01-01T00:00:00Z",
      };

      const current = {
        id: "c-101",
        status: "sold",
        purchase_price: 85000,
        notes: "Sold to buyer A",
        updated_at: "2026-02-01T00:00:00Z",
      };

      const diffs = SnapshotVerifier.computeDiff(previous, current);

      expect(diffs).toHaveLength(2);
      expect(diffs.find((d) => d.field === "status")).toEqual({
        field: "status",
        previousValue: "active",
        currentValue: "sold",
      });
      expect(diffs.find((d) => d.field === "notes")).toEqual({
        field: "notes",
        previousValue: "Healthy bull",
        currentValue: "Sold to buyer A",
      });
      // updated_at should have been ignored
      expect(diffs.find((d) => d.field === "updated_at")).toBeUndefined();
    });

    it("creates a complete audit snapshot object with checksum", () => {
      const snapshot = SnapshotVerifier.createAuditSnapshot(
        "cattle",
        "c-202",
        { weight: 300 },
        { weight: 325 }
      );

      expect(snapshot.entityType).toBe("cattle");
      expect(snapshot.entityId).toBe("c-202");
      expect(snapshot.hasChanges).toBe(true);
      expect(snapshot.diffs).toHaveLength(1);
      expect(snapshot.checksum).toBeDefined();
    });
  });

  describe("ReconciliationEngine", () => {
    const engine = ReconciliationEngine.getInstance();

    it("reconciles balanced double-entry accounting numbers without discrepancies", () => {
      const result = engine.reconcileAccountingEquation("biz_001", {
        totalDebit: 500000,
        totalCredit: 500000,
        totalAssets: 600000,
        totalLiabilities: 200000,
        totalEquity: 400000,
      });

      expect(result.isConsistent).toBe(true);
      expect(result.discrepanciesCount).toBe(0);
      expect(result.checks.every((c) => c.passed)).toBe(true);
    });

    it("detects unbalanced Trial Balance and flags discrepancy", () => {
      const result = engine.reconcileAccountingEquation("biz_001", {
        totalDebit: 500000,
        totalCredit: 495000, // unbalanced
        totalAssets: 600000,
        totalLiabilities: 200000,
        totalEquity: 400000,
      });

      expect(result.isConsistent).toBe(false);
      expect(result.discrepanciesCount).toBe(1);
      const tbCheck = result.checks.find((c) => c.name.includes("Trial Balance"));
      expect(tbCheck?.passed).toBe(false);
      expect(tbCheck?.difference).toBe(5000);
    });

    it("reconciles partner unit share valuation against net partner equity", () => {
      const result = engine.reconcilePartnerShares("biz_001", {
        totalUnitSharesIssued: 100,
        pricePerUnit: 10000,
        totalPartnerEquityBalance: 1000000,
      });

      expect(result.isConsistent).toBe(true);
      expect(result.discrepanciesCount).toBe(0);
    });

    it("flags discrepancy when partner share valuation differs from allocated equity", () => {
      const result = engine.reconcilePartnerShares("biz_001", {
        totalUnitSharesIssued: 100,
        pricePerUnit: 10000,
        totalPartnerEquityBalance: 950000, // 50,000 difference
      });

      expect(result.isConsistent).toBe(false);
      expect(result.discrepanciesCount).toBe(1);
      expect(result.checks[0].difference).toBe(50000);
    });
  });

  describe("Financial Lockout Enforcer", () => {
    it("correctly identifies whether a date is locked", () => {
      const lockDate = "2026-06-30";

      // On or before lock date -> locked
      expect(isDateLocked("2026-06-30", lockDate)).toBe(true);
      expect(isDateLocked("2026-06-15", lockDate)).toBe(true);
      expect(isDateLocked("2026-01-01", lockDate)).toBe(true);

      // After lock date -> open
      expect(isDateLocked("2026-07-01", lockDate)).toBe(false);
      expect(isDateLocked("2026-12-31", lockDate)).toBe(false);

      // Null lock date -> open
      expect(isDateLocked("2026-05-01", null)).toBe(false);
    });

    it("validates financial lock date and returns descriptive error response", () => {
      const lockDate = "2026-06-30";

      const lockedValidation = validateFinancialLockDate("2026-05-20", lockDate, "cattle sale");
      expect(lockedValidation.isLocked).toBe(true);
      expect(lockedValidation.lockDate).toBe("2026-06-30");
      expect(lockedValidation.errorMessage).toContain("Cannot modify cattle sale dated 2026-05-20");

      const allowedValidation = validateFinancialLockDate("2026-07-15", lockDate, "cattle sale");
      expect(allowedValidation.isLocked).toBe(false);
      expect(allowedValidation.errorMessage).toBeUndefined();
    });
  });
});

import { computeDataQualityReport, RawQualityData } from "@/lib/governance/data-quality-auditor";
import { generateBackupManifest, verifyBackup } from "@/lib/governance/backup-verifier";

describe("Phase 3.3: Data Quality & Backup Verification Suite", () => {
  const BIZ = "biz-100";

  const healthyData: RawQualityData = {
    cattle: [
      { id: "c-1", tag_id: "TAG-001", business_id: BIZ, purchase_date: "2026-01-01", purchase_price: 85000, deleted_at: null },
      { id: "c-2", tag_id: "TAG-002", business_id: BIZ, purchase_date: "2026-02-01", purchase_price: 90000, deleted_at: null },
    ],
    weightLogs: [
      { id: "w-1", cattle_id: "c-1" },
      { id: "w-2", cattle_id: "c-2" },
    ],
    inventoryItems: [{ id: "i-1", name: "Cow Feed", business_id: BIZ }],
    inventoryTransactions: [
      { item_id: "i-1", type: "purchase", qty: 100 },
      { item_id: "i-1", type: "consumption", qty: 40 },
    ],
    costEntries: [{ id: "e-1", business_id: BIZ }],
  };

  describe("computeDataQualityReport", () => {
    it("reports a healthy dataset with zero issues", () => {
      const report = computeDataQualityReport(BIZ, healthyData);

      expect(report.businessId).toBe(BIZ);
      expect(report.overallHealthy).toBe(true);
      expect(report.totalIssueCount).toBe(0);
      expect(report.checks).toHaveLength(5);
      expect(report.checks.every((c) => c.passed)).toBe(true);
    });

    it("detects duplicate cattle tags", () => {
      const data: RawQualityData = {
        ...healthyData,
        cattle: [
          { ...healthyData.cattle[0] },
          { id: "c-3", tag_id: "TAG-001", business_id: BIZ, purchase_date: "2026-03-01", purchase_price: 80000, deleted_at: null },
        ],
      };

      const report = computeDataQualityReport(BIZ, data);
      const duplicates = report.checks.find((c) => c.check === "duplicate_cattle_tags")!;

      expect(duplicates.passed).toBe(false);
      expect(duplicates.issueCount).toBe(1);
      expect((duplicates.details as { tag_id: string; count: number }[])[0]).toMatchObject({
        tag_id: "TAG-001",
        count: 2,
      });
      expect(report.overallHealthy).toBe(false);
    });

    it("ignores soft-deleted cattle when counting duplicates and required fields", () => {
      const data: RawQualityData = {
        ...healthyData,
        cattle: [
          { ...healthyData.cattle[0], deleted_at: "2026-05-01T00:00:00Z" },
          { ...healthyData.cattle[1] },
          { id: "c-3", tag_id: "TAG-001", business_id: BIZ, purchase_date: "2026-03-01", purchase_price: 80000, deleted_at: null },
        ],
      };

      const report = computeDataQualityReport(BIZ, data);
      expect(report.overallHealthy).toBe(true);
    });

    it("detects orphaned weight logs", () => {
      const data: RawQualityData = {
        ...healthyData,
        weightLogs: [...healthyData.weightLogs, { id: "w-orphan", cattle_id: "c-gone" }],
      };

      const report = computeDataQualityReport(BIZ, data);
      const orphans = report.checks.find((c) => c.check === "orphaned_weight_logs")!;

      expect(orphans.passed).toBe(false);
      expect(orphans.issueCount).toBe(1);
      expect((orphans.details as { weight_log_id: string }[])[0].weight_log_id).toBe("w-orphan");
    });

    it("detects negative computed stock", () => {
      const data: RawQualityData = {
        ...healthyData,
        inventoryTransactions: [
          { item_id: "i-1", type: "purchase", qty: 30 },
          { item_id: "i-1", type: "consumption", qty: 50 },
        ],
      };

      const report = computeDataQualityReport(BIZ, data);
      const neg = report.checks.find((c) => c.check === "negative_stock_items")!;

      expect(neg.passed).toBe(false);
      expect(neg.issueCount).toBe(1);
      expect((neg.details as { item_id: string; net_stock: number }[])[0].net_stock).toBe(-20);
    });

    it("detects cross-tenant anomalies", () => {
      const data: RawQualityData = {
        ...healthyData,
        costEntries: [{ id: "e-100", business_id: "biz-OTHER" }],
      };

      const report = computeDataQualityReport(BIZ, data);
      const cross = report.checks.find((c) => c.check === "cross_tenant_anomalies")!;

      expect(cross.passed).toBe(false);
      expect(cross.issueCount).toBe(1);
      expect(cross.details).toEqual([{ table: "cost_entries", record_id: "e-100" }]);
    });

    it("flags cattle missing required fields", () => {
      const data: RawQualityData = {
        ...healthyData,
        cattle: [{ id: "c-bad", tag_id: "   ", business_id: BIZ, purchase_date: null, purchase_price: 0, deleted_at: null }],
      };

      const report = computeDataQualityReport(BIZ, data);
      const missing = report.checks.find((c) => c.check === "cattle_missing_required_fields")!;

      expect(missing.passed).toBe(false);
      expect(missing.issueCount).toBe(1);
      expect((missing.details as { missing_fields: string[] }[])[0].missing_fields).toEqual(
        expect.arrayContaining(["tag_id", "purchase_date", "purchase_price"])
      );
    });
  });
describe("backup manifest & verification", () => {
    it("generates a deterministic manifest and verifies an identical restore", () => {
      const tables = {
        cattle: [{ id: "c-1", tag_id: "TAG-001", purchase_price: 85000 }],
        sales: [{ id: "s-1", cattle_id: "c-1", sale_price_total: 110000 }],
      };

      const manifest = generateBackupManifest(BIZ, tables);
      const result = verifyBackup(manifest, tables);

      expect(manifest.businessId).toBe(BIZ);
      expect(manifest.tables).toHaveLength(2);
      expect(manifest.tables.map((t) => t.table).sort()).toEqual(["cattle", "sales"]);
      expect(result.allPassed).toBe(true);
      expect(result.tables.every((t) => t.passed)).toBe(true);
    });

    it("is deterministic — same data produces the same checksums", () => {
      const tables = { cattle: [{ id: "c-9", tag_id: "TAG-009" }] };
      const a = generateBackupManifest(BIZ, tables);
      const b = generateBackupManifest(BIZ, tables);

      expect(a.tables[0].checksum).toBe(b.tables[0].checksum);
      expect(a.overallChecksum).toBe(b.overallChecksum);
    });

    it("flags checksum drift caused by modified row values", () => {
      const tables = {
        cattle: [{ id: "c-1", tag_id: "TAG-001", purchase_price: 85000 }],
      };

      const manifest = generateBackupManifest(BIZ, tables);
      const drifted = {
        cattle: [{ id: "c-1", tag_id: "TAG-001", purchase_price: 86000 }],
      };

      const result = verifyBackup(manifest, drifted);
      expect(result.allPassed).toBe(false);
      expect(result.tables[0].mismatchReason).toBe("checksum");
    });

    it("flags missing rows between backup and restore", () => {
      const tables = {
        sales: [
          { id: "s-1", sale_price_total: 100 },
          { id: "s-2", sale_price_total: 200 },
        ],
      };

      const manifest = generateBackupManifest(BIZ, tables);
      const partialRestore = {
        sales: [{ id: "s-1", sale_price_total: 100 }],
      };

      const result = verifyBackup(manifest, partialRestore);
      expect(result.allPassed).toBe(false);
      expect(result.tables[0].mismatchReason).toBe("row_count");
    });
  });
});
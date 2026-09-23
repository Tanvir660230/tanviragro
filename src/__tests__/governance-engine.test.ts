import { dataGovernanceEngine } from "@/lib/governance/engine";

describe("Enterprise Data Governance & Integrity Engine (Phase 14)", () => {
  it("passes cleanly on healthy, well-formed tenant datasets", () => {
    const records = [
      { id: "c_1", business_id: "biz_alpha", status: "active" },
      { id: "c_2", business_id: "biz_alpha", status: "quarantined" },
    ];

    const report = dataGovernanceEngine.auditDatasetIntegrity("biz_alpha", records);
    expect(report.isHealthy).toBe(true);
    expect(report.issuesFound).toBe(0);
  });

  it("detects cross-tenant data leakage and orphaned records", () => {
    const records = [
      { id: "c_1", business_id: "biz_alpha", status: "active" },
      { id: "c_2", business_id: "biz_OTHER_INTRUDER", status: "active" },
      { id: "", business_id: "biz_alpha" },
    ];

    const report = dataGovernanceEngine.auditDatasetIntegrity("biz_alpha", records);
    expect(report.isHealthy).toBe(false);
    expect(report.issuesFound).toBe(2);
    expect(report.details.crossTenantAnomaliesCount).toBe(1);
    expect(report.details.orphanedRecordsCount).toBe(1);
  });
});

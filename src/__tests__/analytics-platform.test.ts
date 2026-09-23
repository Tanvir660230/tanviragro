import { KpiEngine } from "../lib/analytics/kpi-engine";
import { AlertEngine } from "../lib/analytics/alert-engine";
import { TrendEngine } from "../lib/analytics/trend-engine";
import { BiEngine } from "../lib/analytics/bi-engine";
import { ForecastEngine } from "../lib/analytics/forecast-engine";
import { CustomReportEngine } from "../lib/analytics/custom-report-engine";
import { RoleDashboardService } from "../lib/analytics/role-dashboard-service";

describe("Sprint 19: Enterprise Analytics & BI Platform", () => {
  describe("BiEngine & Pivot Analysis Tests", () => {
    it("should compute a 2D pivot table with row, col, and grand totals", () => {
      const data = [
        { breed: "Brahman", batch: "Batch-1", weight: 300 },
        { breed: "Brahman", batch: "Batch-2", weight: 320 },
        { breed: "Holstein", batch: "Batch-1", weight: 400 },
        { breed: "Holstein", batch: "Batch-2", weight: 420 },
      ];

      const pivot = BiEngine.computePivotTable(data, "breed", "batch", "weight", "sum");
      expect(pivot.rowHeaders).toEqual(["Brahman", "Holstein"]);
      expect(pivot.colHeaders).toEqual(["Batch-1", "Batch-2"]);
      expect(pivot.matrix).toEqual([
        [300, 320],
        [400, 420],
      ]);
      expect(pivot.rowTotals).toEqual([620, 820]);
      expect(pivot.colTotals).toEqual([700, 740]);
      expect(pivot.grandTotal).toBe(1440);
    });

    it("should execute multidimensional cross filtering", () => {
      const records = [
        { breed: "Brahman", status: "active", pen: "A" },
        { breed: "Brahman", status: "sold", pen: "B" },
        { breed: "Sahiwal", status: "active", pen: "A" },
      ];

      const filtered = BiEngine.computeCrossFilter(records, { breed: "Brahman", status: "active" });
      expect(filtered.length).toBe(1);
      expect(filtered[0].pen).toBe("A");
    });
  });

  describe("ForecastEngine Predictive Linear Regression Tests", () => {
    it("should project future time series points with upper and lower bounds", () => {
      const history = [
        { timestamp: "2026-01", label: "Jan", value: 100 },
        { timestamp: "2026-02", label: "Feb", value: 200 },
        { timestamp: "2026-03", label: "Mar", value: 300 },
      ];

      const result = ForecastEngine.linearRegressionForecast(history, 2);
      expect(result.slope).toBe(100);
      expect(result.forecast.length).toBe(2);
      expect(result.forecast[0].value).toBe(400);
      expect(result.forecast[1].value).toBe(500);
      expect(result.forecast[0].lowerBound).toBeLessThan(400);
      expect(result.forecast[0].upperBound).toBeGreaterThan(400);
    });
  });

  describe("CustomReportEngine Execution Tests", () => {
    it("should filter, group, aggregate, and sort arbitrary datasets without code", () => {
      const rawCattle = [
        { breed: "Brahman", gender: "male", weight: 300 },
        { breed: "Brahman", gender: "male", weight: 350 },
        { breed: "Sahiwal", gender: "female", weight: 280 },
        { breed: "Sahiwal", gender: "female", weight: 320 },
      ];

      const config = {
        fields: ["breed", "weight"],
        filters: [{ field: "gender", operator: "equals" as const, value: "male" }],
        groups: ["breed"],
        aggregations: [
          { field: "weight", func: "sum" as const, alias: "total_weight" },
          { field: "weight", func: "avg" as const, alias: "avg_weight" },
        ],
        sorting: [{ field: "total_weight", direction: "desc" as const }],
      };

      const result = CustomReportEngine.executeReport(rawCattle, config);
      expect(result.totalCount).toBe(2);
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].total_weight).toBe(650);
      expect(result.rows[0].avg_weight).toBe(325);
    });
  });

  describe("RoleDashboardService Configuration Tests", () => {
    it("should retrieve role-specific KPIs and widgets for all 8 executive personas", () => {
      const roles = RoleDashboardService.getAllRoles();
      expect(roles.length).toBeGreaterThanOrEqual(8);

      const ceoDash = RoleDashboardService.getDashboardForRole("ceo");
      expect(ceoDash.roleSlug).toBe("ceo");
      expect(ceoDash.primaryKpis).toContain("netFarmProfit");

      const vetDash = RoleDashboardService.getDashboardForRole("veterinarian");
      expect(vetDash.roleSlug).toBe("veterinarian");
      expect(vetDash.primaryKpis).toContain("vaccinationComplianceRate");
    });
  });
});

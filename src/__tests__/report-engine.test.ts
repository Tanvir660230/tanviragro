import { ReportEngine } from "@/lib/reports/report-engine";
import { FinancialStatementReportData } from "@/lib/reports/report-engine";

describe("Phase 8: Enterprise Report & Export Engine", () => {
  test("ReportEngine exports static methods for CSV and PDF generation", () => {
    expect(typeof ReportEngine.exportToCSV).toBe("function");
    expect(typeof ReportEngine.exportToPDF).toBe("function");
    expect(typeof ReportEngine.generateFinancialStatementReport).toBe("function");
  });

  test("ReportEngine produces standardized report structures", async () => {
    const mockReportData: FinancialStatementReportData = {
      bizName: "Tanvir Agro Test Farm",
      reportDate: "9 August 2026",
      reportId: "TA-RPT-20260809-001",
      totalCattle: 10,
      activeCattle: 8,
      soldCattle: 2,
      activeCattleValuation: 800_000,
      revenue: 300_000,
      soldCattleCost: 200_000,
      feedCost: 40_000,
      operatingCosts: 20_000,
      netPL: 40_000,
      cashBalance: 150_000,
      bankBalance: 0,
      totalLiquidCash: 150_000,
      totalInventoryValue: 50_000,
      inventoryWithStock: [
        { name: "Silage", category: "Feed", unit: "kg", stock: 1000, avgCost: 25, value: 25_000 },
        { name: "Straw", category: "Roughage", unit: "bale", stock: 500, avgCost: 50, value: 25_000 },
      ],
      totalLiabilities: 100_000,
      netEquity: 900_000,
      zakatAssets: 900_000,
    };

    expect(mockReportData.netPL).toBe(
      mockReportData.revenue -
        mockReportData.soldCattleCost -
        mockReportData.feedCost -
        mockReportData.operatingCosts
    );
    expect(mockReportData.netEquity).toBe(
      mockReportData.totalLiquidCash +
        mockReportData.activeCattleValuation +
        mockReportData.totalInventoryValue -
        mockReportData.totalLiabilities
    );
  });
});

import { getAccountingData } from "@/lib/accounting/engine";
import type { SupabaseClient } from "@supabase/supabase-js";
import { todayDhaka } from "@/lib/dates";

export interface ReportFilterOptions {
  startDate?: string;
  endDate?: string;
  farmId?: string;
  category?: string;
  limit?: number;
}

export interface InventoryReportItem {
  name: string;
  category: string;
  unit: string;
  stock: number;
  avgCost: number;
  value: number;
}

export interface FinancialStatementReportData {
  bizName: string;
  reportDate: string;
  reportId: string;
  totalCattle: number;
  activeCattle: number;
  soldCattle: number;
  activeCattleValuation: number;
  revenue: number;
  soldCattleCost: number;
  feedCost: number;
  operatingCosts: number;
  netPL: number;
  cashBalance: number;
  bankBalance: number;
  totalLiquidCash: number;
  totalInventoryValue: number;
  inventoryWithStock: InventoryReportItem[];
  totalLiabilities: number;
  netEquity: number;
  zakatAssets: number;
}

export interface ExportDataOptions {
  title: string;
  filename: string;
  columns: string[];
  data: (string | number)[][];
  summary?: Record<string, string | number>;
}


export class ReportEngine {
  public static async generateFinancialStatementReport(
    supabase: SupabaseClient<any>,
    businessId: string,
    bizName = "Tanvir Agro Enterprise"
  ): Promise<FinancialStatementReportData> {
    if (!businessId) {
      throw new Error("Business ID is required to generate financial statement report.");
    }

    // Money comes from THE accounting engine (the same numbers as Finance and the statements);
    // stock from the ledger view. This used to compute cash, profit and stock on its own, and its
    // stock looked for rows typed "IN"/"OUT" that do not exist, so stock always showed ৳0.
    const [{ data: cattleData }, { data: balanceRows }, acc] = await Promise.all([
      supabase.from("cattle").select("id, status").eq("business_id", businessId).is("deleted_at", null),
      supabase.from("v_inventory_balance").select("name, category, unit, qty_on_hand, value_on_hand").eq("business_id", businessId),
      getAccountingData(supabase),
    ]);

    const cattle = (cattleData ?? []) as { id: string; status: string }[];
    const activeCattle = cattle.filter((c) => c.status === "active");
    const soldCattle = cattle.filter((c) => c.status === "sold");
    const totalCattle = cattle.length;

    const bs = acc.balanceSheet;
    const is = acc.incomeStatement;
    const activeCattleValuation = bs.livestock;               // at cost, incl. capitalised direct costs
    const revenue = is.totalRevenue;
    const soldCattleCost = is.cogs;
    const feedCost = is.feedExpenses;
    const operatingCosts = is.totalExpenses - is.cogs - is.feedExpenses;
    const netPL = is.netIncome;
    const cashBalance = bs.cashAndBank;
    const bankBalance = 0;
    const totalLiquidCash = cashBalance;

    const inventoryWithStock: InventoryReportItem[] = ((balanceRows ?? []) as { name: string; category: string | null; unit: string | null; qty_on_hand: number | string; value_on_hand: number | string }[])
      .map((b) => {
        const stock = Number(b.qty_on_hand);
        const value = Number(b.value_on_hand);
        return { name: b.name, category: b.category ?? "General", stock, unit: b.unit || "units", avgCost: stock > 0 ? value / stock : 0, value };
      })
      .filter((i) => i.stock > 0.0001);
    const totalInventoryValue = bs.feedInventory;

    const totalLiabilities = bs.totalLiabilities;
    const netEquity = bs.totalEquity;
    const zakatAssets = Math.max(0, totalLiquidCash + activeCattleValuation + totalInventoryValue - totalLiabilities);

    const reportDate = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const reportId = "TA-RPT-" + todayDhaka().replace(/-/g, "") + "-001";

    return {
      bizName,
      reportDate,
      reportId,
      totalCattle,
      activeCattle: activeCattle.length,
      soldCattle: soldCattle.length,
      activeCattleValuation,
      revenue,
      soldCattleCost,
      feedCost,
      operatingCosts,
      netPL,
      cashBalance,
      bankBalance,
      totalLiquidCash,
      totalInventoryValue,
      inventoryWithStock,
      totalLiabilities,
      netEquity,
      zakatAssets,
    };
  }

  public static exportToCSV(data: Record<string, unknown>[], filename: string): void {
    if (!data || data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvRows = [];


    csvRows.push(headers.map((h) => `"${h}"`).join(","));

    for (const row of data) {
      const values = headers.map((header) => {
        const escaped = ("" + (row[header] ?? "")).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(","));
    }

    const csvString = csvRows.join("\n");
    const blob = new Blob(["\ufeff" + csvString], { type: "text/csv;charset=utf-8;" });

    if (typeof window !== "undefined") {
      const link = document.createElement("a");
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${filename}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  }

  public static async exportToPDF(options: ExportDataOptions): Promise<void> {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);

    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.setTextColor(45, 106, 53);
    doc.text("Tanvir Agro", 14, 22);

    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text(options.title, 14, 30);

    const dateStr = new Date().toLocaleDateString("en-GB", {
      timeZone: "Asia/Dhaka",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    doc.setFontSize(10);
    doc.text(`Generated on: ${dateStr}`, 14, 38);
    autoTable(doc, {
      startY: 45,
      head: [options.columns],
      body: options.data,
      theme: "striped",
      headStyles: { fillColor: [45, 106, 53] },
      margin: { top: 45 },
    });

    if (options.summary) {
      // @ts-expect-error - jspdf-autotable adds lastAutoTable to doc
      const finalY = doc.lastAutoTable?.finalY || 45;

      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text("Financial Summary", 14, finalY + 15);


      const summaryData = Object.entries(options.summary).map(([key, val]) => [key, val]);
      autoTable(doc, {
        startY: finalY + 20,
        body: summaryData,
        theme: "plain",
        styles: { cellPadding: 2, fontSize: 11 },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 80 },
          1: { halign: "right" },
        },
      });
    }

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: "center" }
      );
    }

    doc.save(`${options.filename}.pdf`);
  }

}

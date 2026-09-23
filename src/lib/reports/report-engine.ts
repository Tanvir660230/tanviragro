import type { SupabaseClient } from "@supabase/supabase-js";
import { getCashBalance } from "@/lib/supabase/queries/cash";

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

    const [
      { data: cattleData },
      { data: costsData },
      { data: salesData },
      { data: inventoryData },
      { data: loansData },
      { data: monthlyConsumptionsData },
      cashBalanceResult,
    ] = await Promise.all([
      supabase
        .from("cattle")
        .select("id, status, purchase_price")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .limit(1000),
      supabase
        .from("cost_entries")
        .select("amount, type, cattle_id")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .eq("entry_class", "expense")
        .limit(5000),
      supabase
        .from("sales")
        .select("cattle_id, sale_price_total, cattle!inner(business_id, purchase_price)")
        .eq("cattle.business_id", businessId)
        .is("deleted_at", null)
        .limit(2000),
      supabase
        .from("inventory_items")
        .select("name, category, unit, inventory_transactions(qty, type, unit_cost)")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .limit(500),
      supabase
        .from("loans")
        .select("principal_amount, status, loan_payments(amount)")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .limit(500),
      Promise.resolve(supabase.rpc("get_monthly_consumptions", { p_business_id: businessId })).catch(() => ({ data: [] })),
      getCashBalance(supabase, businessId).catch(() => ({ balance: 0, bankBalance: 0 })),
    ]);

    const cattle = cattleData ?? [];
    const activeCattle = cattle.filter((c: any) => c.status === "active");
    const soldCattle = cattle.filter((c: any) => c.status === "sold");
    const totalCattle = cattle.length;

    const activeCattleValuation = activeCattle.reduce(
      (acc: number, c: any) => acc + (c.purchase_price || 0),
      0
    );

    const sales = salesData ?? [];
    const revenue = sales.reduce((acc: number, s: any) => acc + (s.sale_price_total || 0), 0);
    const soldCattleCost = sales.reduce((acc: number, s: any) => {
      const cp = (s.cattle as { purchase_price?: number } | null)?.purchase_price || 0;
      return acc + cp;
    }, 0);

    const consumptions = (monthlyConsumptionsData ?? []) as { total_cost: number }[];
    const feedCost = consumptions.reduce((acc: number, row: any) => acc + (Number(row.total_cost) || 0), 0);
    const operatingCosts = (costsData ?? []).reduce(
      (acc: number, c: any) => acc + (c.amount || 0),
      0
    );

    const netPL = revenue - soldCattleCost - feedCost - operatingCosts;
    const cashBalance = Math.max(0, cashBalanceResult.balance ?? 0);
    const bankBalance = 0;
    const totalLiquidCash = cashBalance;

    const inventoryItems = inventoryData ?? [];
    const inventoryWithStock: InventoryReportItem[] = inventoryItems
      .map((item: any) => {
        const txs = (item.inventory_transactions as { qty: number; type: string; unit_cost: number | null }[]) ?? [];
        const inTxs = txs.filter((t) => t.type === "IN");
        const inQty = inTxs.reduce((acc, t) => acc + (t.qty || 0), 0);
        const outQty = txs.filter((t) => t.type === "OUT").reduce((acc, t) => acc + (t.qty || 0), 0);
        const stock = Math.max(0, inQty - outQty);

        const totalInCost = inTxs.reduce((acc, t) => acc + (t.qty || 0) * (t.unit_cost || 0), 0);
        const avgCost = inQty > 0 ? totalInCost / inQty : 0;
        const value = stock * avgCost;

        return {
          name: item.name,
          category: item.category ?? "General",
          stock,
          unit: item.unit || "units",
          avgCost,
          value,
        };
      })
      .filter((i: InventoryReportItem) => i.stock > 0);

    const totalInventoryValue = inventoryWithStock.reduce((acc, i) => acc + i.value, 0);

    const loans = loansData ?? [];
    const totalLiabilities = loans
      .filter((l: any) => l.status === "active")
      .reduce((acc: number, l: any) => {
        const payments = (l.loan_payments as { amount: number }[]) ?? [];
        const repaid = payments.reduce((pAcc: number, p: any) => pAcc + (p.amount || 0), 0);
        return acc + Math.max(0, (l.principal_amount || 0) - repaid);
      }, 0);

    const totalAssets = totalLiquidCash + activeCattleValuation + totalInventoryValue;
    const netEquity = totalAssets - totalLiabilities;
    const zakatAssets = Math.max(0, totalLiquidCash + activeCattleValuation + totalInventoryValue - totalLiabilities);

    const reportDate = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const reportId = "TA-RPT-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-001";

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

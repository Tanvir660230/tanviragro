export interface SaleRecord {
  id: string;
  cattleId: string;
  salePriceTotal: number;
  soldAt: string;
  buyerName?: string | null;
  buyerPhone?: string | null;
  purchasePrice?: number;
  directCosts?: number;
}

export class RevenueEngine {
  /**
   * Evaluates individual sale performance and margin
   */
  public static evaluateSale(sale: SaleRecord) {
    const salePrice = Number(sale.salePriceTotal) || 0;
    const purchaseCost = Number(sale.purchasePrice) || 0;
    const directCosts = Number(sale.directCosts) || 0;
    const totalCostBasis = purchaseCost + directCosts;
    const grossProfit = salePrice - totalCostBasis;
    const marginPct = salePrice > 0 ? (grossProfit / salePrice) * 100 : 0;

    return {
      ...sale,
      salePriceTotal: Math.round(salePrice * 100) / 100,
      purchasePrice: Math.round(purchaseCost * 100) / 100,
      directCosts: Math.round(directCosts * 100) / 100,
      totalCostBasis: Math.round(totalCostBasis * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      marginPct: Math.round(marginPct * 100) / 100,
    };
  }

  /**
   * Aggregates total sales revenue, cost basis, and gross profits
   */
  public static aggregateSales(sales: SaleRecord[]) {
    const evaluated = sales.map((s) => this.evaluateSale(s));
    const totalRevenue = evaluated.reduce((s, r) => s + r.salePriceTotal, 0);
    const totalCostBasis = evaluated.reduce((s, r) => s + r.totalCostBasis, 0);
    const totalGrossProfit = evaluated.reduce((s, r) => s + r.grossProfit, 0);
    const overallMarginPct = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalCostBasis: Math.round(totalCostBasis * 100) / 100,
      totalGrossProfit: Math.round(totalGrossProfit * 100) / 100,
      overallMarginPct: Math.round(overallMarginPct * 100) / 100,
      totalSalesCount: sales.length,
      evaluatedSales: evaluated,
    };
  }
}
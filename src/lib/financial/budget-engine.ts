import type { FinancialBudget } from "./types";

export interface BudgetVarianceAnalysis {
  budget: FinancialBudget;
  status: "favorable" | "unfavorable" | "on_track";
  utilizationPct: number;
}

export interface CashFlowForecastHorizon {
  days: number;
  projectedInflow: number;
  projectedOutflow: number;
  netCashFlow: number;
  projectedClosingBalance: number;
  burnRatePerDay: number;
  runwayDays: number;
}

export class LivestockBudgetEngine {
  /**
   * Computes variance analysis for a given budget item against actual expenses.
   */
  public static analyzeVariance(budget: Omit<FinancialBudget, "varianceAmount" | "variancePct">): BudgetVarianceAnalysis {
    const budgeted = Math.max(0, Number(budget.budgetedAmount) || 0);
    const actual = Math.max(0, Number(budget.actualAmount) || 0);
    const varianceAmount = Math.round((budgeted - actual) * 100) / 100;
    const variancePct = budgeted > 0 ? Math.round(((budgeted - actual) / budgeted) * 10000) / 100 : 0;
    const utilizationPct = budgeted > 0 ? Math.round((actual / budgeted) * 10000) / 100 : 0;

    let status: "favorable" | "unfavorable" | "on_track" = "on_track";
    if (actual > budgeted) {
      status = "unfavorable";
    } else if (actual < budgeted * 0.9) {
      status = "favorable";
    }

    const completedBudget: FinancialBudget = {
      ...budget,
      varianceAmount,
      variancePct,
    };

    return {
      budget: completedBudget,
      status,
      utilizationPct,
    };
  }

  /**
   * Projects operational cash flow and liquidity runway for 30, 60, and 90 day horizons.
   */
  public static forecastCashFlow(params: {
    currentCashBalance: number;
    monthlyAverageRevenue: number;
    monthlyAverageFeedCost: number;
    monthlyAverageLaborOverhead: number;
    monthlyDebtObligations: number;
    daysHorizon?: number;
  }): CashFlowForecastHorizon {
    const days = params.daysHorizon || 30;
    const months = days / 30;

    const projectedInflow = Math.round(params.monthlyAverageRevenue * months * 100) / 100;
    const totalMonthlyOutflow = params.monthlyAverageFeedCost + params.monthlyAverageLaborOverhead + params.monthlyDebtObligations;
    const projectedOutflow = Math.round(totalMonthlyOutflow * months * 100) / 100;
    
    const netCashFlow = Math.round((projectedInflow - projectedOutflow) * 100) / 100;
    const projectedClosingBalance = Math.round((params.currentCashBalance + netCashFlow) * 100) / 100;
    
    const burnRatePerDay = days > 0 ? Math.round((projectedOutflow / days) * 100) / 100 : 0;
    const runwayDays = burnRatePerDay > 0
      ? Math.round(Math.max(0, params.currentCashBalance / burnRatePerDay))
      : 999;

    return {
      days,
      projectedInflow,
      projectedOutflow,
      netCashFlow,
      projectedClosingBalance,
      burnRatePerDay,
      runwayDays,
    };
  }
}

export interface DepreciationInput {
  purchase_cost: number;
  salvage_value: number;
  useful_life_years: number;
  depreciation_method: string;
  declining_rate: number | null;
  purchase_date: string;
  disposed_at?: string | null;
}

export interface DepreciationResult {
  monthly: number;
  annual: number;
  accumulated: number;
  bookValue: number;
}

export function monthsBetweenDates(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  const lastDayOfToMonth = new Date(to.getFullYear(), to.getMonth() + 1, 0).getDate();
  const effectiveFromDay = Math.min(from.getDate(), lastDayOfToMonth);
  if (to.getDate() < effectiveFromDay) months--;
  return Math.max(0, months);
}

/**
 * Authoritative Depreciation Engine Calculation (Straight Line & Declining Balance)
 */
export function calculateDepreciation(asset: DepreciationInput): DepreciationResult {
  const cost = Number(asset.purchase_cost) || 0;
  const salvage = Math.min(Number(asset.salvage_value) || 0, cost);
  const lifeYears = Number(asset.useful_life_years) || 0;

  if (lifeYears <= 0 || cost <= 0) {
    return { monthly: 0, annual: 0, accumulated: 0, bookValue: cost };
  }

  const startDate = new Date(asset.purchase_date);
  const endDate = asset.disposed_at ? new Date(asset.disposed_at) : new Date();
  const ageMonths = monthsBetweenDates(startDate, endDate);

  if (asset.depreciation_method === "straight_line") {
    const annualDep = (cost - salvage) / lifeYears;
    const monthlyDep = annualDep / 12;
    const maxDep = cost - salvage;
    const accumulated = Math.min(monthlyDep * ageMonths, maxDep);
    const rounded = Math.round(accumulated * 100) / 100;
    return {
      monthly: Math.round(monthlyDep * 100) / 100,
      annual: Math.round(annualDep * 100) / 100,
      accumulated: rounded,
      bookValue: Math.round(Math.max(salvage, cost - rounded) * 100) / 100,
    };
  } else {
    // Declining Balance
    const annualRate = Math.min(asset.declining_rate ?? 1 / lifeYears, 0.99);
    let bookVal = cost;
    const totalYears = Math.floor(ageMonths / 12);
    const extraMonths = ageMonths % 12;

    for (let y = 0; y < totalYears; y++) {
      const dep = bookVal * annualRate;
      if (bookVal - dep <= salvage) {
        bookVal = salvage;
        break;
      }
      bookVal -= dep;
    }

    if (bookVal > salvage && extraMonths > 0) {
      const dep = bookVal * annualRate * (extraMonths / 12);
      bookVal = Math.max(salvage, bookVal - dep);
    }

    const accumulated = Math.round((cost - bookVal) * 100) / 100;
    const fullyDepreciated = bookVal <= salvage;
    return {
      monthly: fullyDepreciated ? 0 : Math.round(((bookVal * annualRate) / 12) * 100) / 100,
      annual: fullyDepreciated ? 0 : Math.round(bookVal * annualRate * 100) / 100,
      accumulated,
      bookValue: Math.round(bookVal * 100) / 100,
    };
  }
}

/**
 * Authoritative Accrued Interest Calculation on Loans
 */
export function calculateAccruedInterest(
  principal: number,
  annualRatePct: number,
  startDateStr: string,
  endDateStr: string,
  _payments?: { amount: number; paid_at: string }[],
  status = "active"
): number {
  if (status === "paid" || annualRatePct <= 0 || principal <= 0) return 0;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 0;
  const rawInterest = (principal * (annualRatePct / 100) * diffDays) / 365;
  return Math.round(rawInterest * 100) / 100;
}

/**
 * Authoritative Financial Profitability Metrics Calculation
 */
export function calculateProfitMetrics(params: {
  totalRevenue: number;
  cogs: number;
  directCosts: number;
  operatingExpenses: number;
  depreciation: number;
  interestExpense: number;
  livestockLosses?: number;
}) {
  const {
    totalRevenue,
    cogs,
    directCosts,
    operatingExpenses,
    depreciation,
    interestExpense,
    livestockLosses = 0,
  } = params;

  const grossProfit = totalRevenue - (cogs + directCosts);
  const totalExpenses = cogs + directCosts + operatingExpenses + depreciation + interestExpense + livestockLosses;
  const netIncome = totalRevenue - (operatingExpenses + directCosts + depreciation + interestExpense + livestockLosses + cogs);
  const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const netMarginPct = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

  return {
    grossProfit: Math.round(grossProfit * 100) / 100,
    netIncome: Math.round(netIncome * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    grossMarginPct: Math.round(grossMarginPct * 100) / 100,
    netMarginPct: Math.round(netMarginPct * 100) / 100,
  };
}
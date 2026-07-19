"use client";

import { PLTrendChart } from "./PLTrendChart";
import { CostBreakdownChart } from "./CostBreakdownChart";
import { PerHeadROITable } from "./PerHeadROITable";
import { BreakEvenCard } from "./BreakEvenCard";
import { CashFlowForecast } from "./CashFlowForecast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MonthlyPoint } from "@/lib/supabase/queries/analytics";
import type { SaleRecord } from "./PLSummary";

interface Props {
  monthlyData: MonthlyPoint[];
  sales: SaleRecord[];
  totalFixedCosts: number;
  totalVariableCosts: number;
  totalFeedCosts: number;
  totalOtherInventoryCosts?: number;
  unrealizedInvestment: number;
  feedCostByCattle?: Record<string, number>;
  directCostByCattle?: Record<string, number>;
}

export function FinanceAnalyticsPanel({
  monthlyData,
  sales,
  totalFixedCosts,
  totalVariableCosts,
  totalFeedCosts,
  totalOtherInventoryCosts = 0,
  unrealizedInvestment,
  feedCostByCattle = {},
  directCostByCattle = {},
}: Props) {
  const safeRev = (r: SaleRecord) => Number.isFinite(r.sale_price_total) ? r.sale_price_total : 0;
  const safeCost = (r: SaleRecord) => Number.isFinite(r.purchase_price) ? r.purchase_price! : 0;
  const safeFeed = (r: SaleRecord) => feedCostByCattle[r.cattle_id] ?? 0;
  const safeDirect = (r: SaleRecord) => directCostByCattle[r.cattle_id] ?? 0;

  const totalRevenue = sales.reduce((s, r) => s + safeRev(r), 0);
  const totalPurchaseCost = sales.reduce((s, r) => s + safeCost(r), 0);
  const totalCosts = totalFixedCosts + totalVariableCosts + totalFeedCosts + totalOtherInventoryCosts + totalPurchaseCost;
  const netPL = totalRevenue - totalCosts;

  const profitableSales = sales.filter((s) => safeRev(s) - safeCost(s) - safeFeed(s) - safeDirect(s) > 0);
  const avgGrossMarginPerHead =
    profitableSales.length > 0
      ? profitableSales.reduce((s, r) => s + safeRev(r) - safeCost(r) - safeFeed(r) - safeDirect(r), 0) / profitableSales.length
      : null;

  return (
    <div className="space-y-6">
      {/* Row 1: Trend + Breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-xl shadow-card ring-1 ring-black/5">
          <CardHeader>
            <CardTitle className="text-sm font-semibold tracking-tight">Revenue vs Cost Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <PLTrendChart data={monthlyData} />
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-card ring-1 ring-black/5">
          <CardHeader>
            <CardTitle className="text-sm font-semibold tracking-tight">Cost Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <CostBreakdownChart
              cattlePurchase={totalPurchaseCost}
              feedCosts={totalFeedCosts}
              fixedCosts={totalFixedCosts}
              variableCosts={totalVariableCosts}
            />
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Break-even */}
      <BreakEvenCard
        netPL={netPL}
        avgGrossMarginPerHead={avgGrossMarginPerHead}
        unrealizedInvestment={unrealizedInvestment}
      />

      {/* Row 3: Cash Flow Forecast */}
      <CashFlowForecast history={monthlyData} />

      {/* Row 4: Per-head ROI */}
      <div>
        <h3 className="text-base font-semibold tracking-tight mb-3">Per-Head ROI Ranking</h3>
        <PerHeadROITable sales={sales} totalFixedCosts={totalFixedCosts} feedCostByCattle={feedCostByCattle} directCostByCattle={directCostByCattle} />
      </div>
    </div>
  );
}

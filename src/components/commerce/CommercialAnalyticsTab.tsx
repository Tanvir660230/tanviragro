"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Scale, Calendar, BarChart3 } from "lucide-react";
import type { CommercialProfitLossSummary } from "@/lib/commerce";

interface Props {
  analytics: CommercialProfitLossSummary[];
}

export function CommercialAnalyticsTab({ analytics }: Props) {
  const totalRevenue = analytics.reduce((s, a) => s + a.salePrice, 0);
  const totalCost = analytics.reduce((s, a) => s + a.totalCostBasis, 0);
  const totalProfit = totalRevenue - totalCost;
  const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* SUMMARY BANNER */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card className="border border-border/70 p-3 bg-card">
          <span className="text-xs text-muted-foreground font-medium">Total Sold / Realized</span>
          <div className="text-lg font-bold mt-1 text-foreground">৳{totalRevenue.toLocaleString()}</div>
          <span className="text-[11px] text-muted-foreground">{analytics.length} livestock units</span>
        </Card>
        <Card className="border border-border/70 p-3 bg-card">
          <span className="text-xs text-muted-foreground font-medium">Total Cost Basis</span>
          <div className="text-lg font-bold mt-1 text-foreground">৳{totalCost.toLocaleString()}</div>
          <span className="text-[11px] text-muted-foreground">Purchase + feed + medical + logistics</span>
        </Card>
        <Card className="border border-border/70 p-3 bg-card">
          <span className="text-xs text-muted-foreground font-medium">Realized Net Profit</span>
          <div className={`text-lg font-bold mt-1 ${totalProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {totalProfit >= 0 ? "+" : ""}৳{totalProfit.toLocaleString()}
          </div>
          <span className="text-[11px] text-muted-foreground">Net margin: {overallMargin.toFixed(1)}%</span>
        </Card>
        <Card className="border border-border/70 p-3 bg-card">
          <span className="text-xs text-muted-foreground font-medium">Avg Holding Duration</span>
          <div className="text-lg font-bold mt-1 text-foreground">
            {analytics.length > 0 ? Math.round(analytics.reduce((s, a) => s + a.holdingDays, 0) / analytics.length) : 0} Days
          </div>
          <span className="text-[11px] text-muted-foreground">Farm fattening cycle</span>
        </Card>
      </div>

      {/* DETAILED TABLE */}
      <Card className="border border-border/70">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Unit Commercial Performance &amp; ROI Ranking
          </CardTitle>
          <CardDescription className="text-xs">
            Individual animal cost basis decomposition and realized commercial margins
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="rounded-lg border border-border/70 overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground font-semibold">
                <tr>
                  <th className="p-2.5">Tag ID</th>
                  <th className="p-2.5">Purchase</th>
                  <th className="p-2.5">Feed Cost</th>
                  <th className="p-2.5">Med &amp; Logistics</th>
                  <th className="p-2.5">Total Basis</th>
                  <th className="p-2.5">Sale Price</th>
                  <th className="p-2.5">Gross Margin</th>
                  <th className="p-2.5">ROI / Day</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {analytics.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      No sold animal data available for commercial valuation.
                    </td>
                  </tr>
                ) : (
                  analytics.map((row) => (
                    <tr key={row.cattleId} className="hover:bg-muted/30 transition-colors">
                      <td className="p-2.5 font-bold text-foreground">#{row.tagId}</td>
                      <td className="p-2.5">৳{row.purchasePrice.toLocaleString()}</td>
                      <td className="p-2.5">৳{row.feedCost.toLocaleString()}</td>
                      <td className="p-2.5">৳{(row.medicalCost + row.logisticsCost).toLocaleString()}</td>
                      <td className="p-2.5 font-semibold">৳{row.totalCostBasis.toLocaleString()}</td>
                      <td className="p-2.5 font-bold">৳{row.salePrice.toLocaleString()}</td>
                      <td className={`p-2.5 font-bold ${row.grossMarginBdt >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {row.grossMarginBdt >= 0 ? "+" : ""}৳{row.grossMarginBdt.toLocaleString()} ({row.netMarginPercentage.toFixed(1)}%)
                      </td>
                      <td className="p-2.5">
                        <Badge variant="outline" className={`text-[10px] py-0 ${row.annualizedRoi >= 20 ? "text-emerald-700 border-emerald-300" : ""}`}>
                          {row.annualizedRoi}% / {row.holdingDays}d
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

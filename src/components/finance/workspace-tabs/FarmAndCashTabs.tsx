"use client";

import React from "react";
import { Building2, Tag, DollarSign } from "lucide-react";

export function FarmPnLTab(props: {
  headCount: number;
  totalDirectCosts: number;
  totalNetProfit: number;
  totalBioValuation: number;
  overallMargin: string;
  avgCostPerKg: string;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" /> Main Farm Unit Performance
        </h3>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-muted-foreground"><span>Active Herd Count:</span><span className="font-bold text-foreground">{props.headCount} head</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Total Direct Cost Basis:</span><span className="font-bold text-foreground">৳{props.totalDirectCosts.toLocaleString()}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Total Net Profit:</span><span className="font-bold text-emerald-600">৳{props.totalNetProfit.toLocaleString()}</span></div>
        </div>
      </div>
      <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Tag className="h-4 w-4 text-indigo-500" /> Commercial Herd Profit Center
        </h3>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-muted-foreground"><span>Total Biological Valuation:</span><span className="font-bold text-emerald-600">৳{props.totalBioValuation.toLocaleString()}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Overall Gross Margin:</span><span className="font-bold text-foreground">{props.overallMargin}%</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Average Cost per kg Gain:</span><span className="font-bold text-foreground">৳{props.avgCostPerKg}/kg</span></div>
        </div>
      </div>
    </div>
  );
}

export function CashFlowTab(props: {
  cashBalance: number;
  totalSaleRevenue: number;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm space-y-4">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-blue-500" /> 30-Day Liquidity & Runway Projections
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="p-4 rounded-xl bg-muted/30 border border-border/60">
          <div className="text-muted-foreground font-medium">Opening Cash</div>
          <div className="text-lg font-bold text-foreground mt-1">৳{props.cashBalance.toLocaleString()}</div>
        </div>
        <div className="p-4 rounded-xl bg-muted/30 border border-border/60">
          <div className="text-muted-foreground font-medium">Projected Revenue</div>
          <div className="text-lg font-bold text-emerald-600 mt-1">৳{(props.totalSaleRevenue || 200000).toLocaleString()}</div>
        </div>
        <div className="p-4 rounded-xl bg-muted/30 border border-border/60">
          <div className="text-muted-foreground font-medium">Projected Feed/Wages</div>
          <div className="text-lg font-bold text-amber-600 mt-1">৳110,000</div>
        </div>
      </div>
    </div>
  );
}

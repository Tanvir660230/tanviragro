"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { MonthlyPoint } from "@/lib/supabase/queries/analytics";
import { fmtBDT } from "@/lib/format";
import { TrendingUp } from "lucide-react";

function fmtCompact(n: number) {
  if (n >= 10_000_000) return `৳${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000) return `৳${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `৳${(n / 1_000).toFixed(0)}K`;
  return `৳${Math.round(n)}`;
}

interface TooltipPayload {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipPayload) {
  if (!active || !payload?.length) return null;
  const revenue = payload.find((p) => p.dataKey === "revenue")?.value ?? 0;
  const cost = payload.find((p) => p.dataKey === "cost")?.value ?? 0;
  const net = revenue - cost;
  return (
    <div className="rounded-xl border border-border/80 bg-card/95 backdrop-blur-md p-3.5 shadow-xl text-xs space-y-1.5 min-w-[150px]">
      <p className="font-bold text-foreground border-b border-border/50 pb-1">{label}</p>
      <div className="flex items-center justify-between gap-3 text-emerald-600 dark:text-emerald-400">
        <span>Revenue:</span>
        <span className="font-bold tabular-nums">{fmtBDT(revenue)}</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-amber-600 dark:text-amber-400">
        <span>Cost:</span>
        <span className="font-bold tabular-nums">{fmtBDT(cost)}</span>
      </div>
      <div className={`flex items-center justify-between gap-3 pt-1 border-t border-border/50 font-bold tabular-nums ${
        net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
      }`}>
        <span>Net Margin:</span>
        <span>{net >= 0 ? "+" : ""}{fmtBDT(net)}</span>
      </div>
    </div>
  );
}

export function RevenueVsCostChart({ data }: { data: MonthlyPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-card/50 px-4 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
          <TrendingUp className="h-5 w-5" />
        </div>
        <p className="text-sm font-semibold text-foreground">No Financial Data Yet</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
          Record cattle sales and operating expenses to view 6-month performance analytics.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="gradRevenueExec" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="gradCostExec" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "currentColor" }}
            className="text-muted-foreground"
            axisLine={false}
            tickLine={false}
            dy={4}
          />
          <YAxis
            tickFormatter={fmtCompact}
            tick={{ fontSize: 11, fill: "currentColor" }}
            className="text-muted-foreground"
            axisLine={false}
            tickLine={false}
            width={54}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) =>
              value === "revenue" ? "Revenue" : "Cost"
            }
            wrapperStyle={{ fontSize: 12, paddingTop: 6 }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#10b981"
            strokeWidth={2.5}
            fill="url(#gradRevenueExec)"
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "#10b981" }}
          />
          <Area
            type="monotone"
            dataKey="cost"
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="4 2"
            fill="url(#gradCostExec)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "#f59e0b" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}


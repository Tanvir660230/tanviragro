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

function fmt(n: number) {
  if (n >= 100_000) return `৳${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `৳${(n / 1_000).toFixed(0)}K`;
  return `৳${n}`;
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
    <div className="rounded-xl border border-border bg-card p-3 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-emerald-600 dark:text-emerald-400">Revenue: {fmt(revenue)}</p>
      <p className="text-red-500 dark:text-red-400">Cost: {fmt(cost)}</p>
      <p className={net >= 0 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-destructive font-semibold"}>
        Net: {net >= 0 ? "+" : ""}{fmt(net)}
      </p>
    </div>
  );
}

export function RevenueVsCostChart({ data }: { data: MonthlyPoint[] }) {
  if (!data.length) {
    return (
      <div className="flex h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-4 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
        </div>
        <p className="text-sm font-medium text-foreground">No Financial Data Yet</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">Add revenue or cost entries to see your profit margins here.</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-chart-4)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-chart-4)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={fmt}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) =>
            value === "revenue" ? "Revenue" : "Cost"
          }
          wrapperStyle={{ fontSize: 12 }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="var(--color-chart-1)"
          strokeWidth={2}
          fill="url(#gradRevenue)"
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Area
          type="monotone"
          dataKey="cost"
          stroke="var(--color-chart-4)"
          strokeWidth={2}
          fill="url(#gradCost)"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

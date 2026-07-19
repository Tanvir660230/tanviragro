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
      <p className={net >= 0 ? "font-semibold text-emerald-600 dark:text-emerald-400" : "font-semibold text-destructive"}>
        Net: {net >= 0 ? "+" : ""}{fmt(net)}
      </p>
    </div>
  );
}

export function PLTrendChart({ data }: { data: MonthlyPoint[] }) {
  if (!data.length) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="plRevGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="plCostGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-chart-4)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-chart-4)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={52} />
        <Tooltip content={<CustomTooltip />} />
        <Legend formatter={(v) => (v === "revenue" ? "Revenue" : "Cost")} wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="revenue" stroke="var(--color-chart-1)" strokeWidth={2} fill="url(#plRevGrad)" dot={false} activeDot={{ r: 4 }} />
        <Area type="monotone" dataKey="cost" stroke="var(--color-chart-4)" strokeWidth={2} fill="url(#plCostGrad)" dot={false} activeDot={{ r: 4 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

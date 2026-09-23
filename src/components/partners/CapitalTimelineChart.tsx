"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Props {
  data: { date: string; balance: number }[];
}

export function CapitalTimelineChart({ data }: Props) {
  const chartData = data.map((d) => ({
    label: new Date(d.date + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "2-digit",
    }),
    balance: Math.round(d.balance),
  }));

  const maxVal = Math.max(...chartData.map((d) => d.balance));
  const isPositive = chartData[chartData.length - 1]?.balance >= 0;
  const strokeColor = isPositive ? "#10b981" : "#ef4444";

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart
        data={chartData}
        margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="capGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={strokeColor} stopOpacity={0.25} />
            <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "currentColor" }}
          tickLine={false}
          axisLine={false}
          className="text-muted-foreground"
        />
        <YAxis hide domain={[0, maxVal * 1.1]} />
        <Tooltip
          formatter={(v) => [
            `৳${Number(v ?? 0).toLocaleString("en-IN")}`,
            "Balance",
          ]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--card))",
            color: "hsl(var(--foreground))",
          }}
          labelStyle={{ fontWeight: 600, marginBottom: 2 }}
        />
        <Area
          type="monotone"
          dataKey="balance"
          stroke={strokeColor}
          strokeWidth={2}
          fill="url(#capGrad)"
          dot={{ r: 4, fill: strokeColor, strokeWidth: 0 }}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

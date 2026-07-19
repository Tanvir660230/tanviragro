"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface EquityEntry {
  id: string;
  name: string;
  equity: number;
  sharePct: number;
  investedNet: number;
}

const CHART_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#06b6d4",
  "#6366f1",
  "#ec4899",
];

interface Props {
  entries: EquityEntry[];
  totalBusinessValue: number;
}

function bdt(n: number) {
  return `৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
}

export function PartnerEquityChart({ entries, totalBusinessValue }: Props) {
  const positiveEntries = entries.filter((e) => e.equity > 0);
  const totalEquity = positiveEntries.reduce((s, e) => s + e.equity, 0);

  if (positiveEntries.length === 0) return null;

  const chartData = positiveEntries.map((e, i) => ({
    name: e.name,
    value: Math.round(e.equity),
    pct: totalEquity > 0 ? (e.equity / totalEquity) * 100 : 0,
    sharePct: e.sharePct,
    investedNet: e.investedNet,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div className="flex flex-col md:flex-row gap-6 items-center">
      {/* Donut chart */}
      <div className="relative flex-shrink-0 w-full md:w-[230px] h-[230px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={74}
              outerRadius={105}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v, _n, props) => [
                `${bdt(Number(v ?? 0))} (${((props?.payload as { sharePct?: number } | undefined)?.sharePct ?? 0).toFixed(1)}% profit share)`,
                "",
              ]}
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
                color: "hsl(var(--foreground))",
              }}
              labelStyle={{ fontWeight: 600, marginBottom: 4 }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Total Equity
          </p>
          <p className="text-base font-bold tabular-nums text-foreground leading-tight">
            {bdt(totalEquity)}
          </p>
          {totalBusinessValue > totalEquity && (
            <p className="text-[10px] text-muted-foreground tabular-nums">
              of {bdt(totalBusinessValue)}
            </p>
          )}
        </div>
      </div>

      {/* Equity bars per partner */}
      <div className="flex-1 w-full space-y-4">
        {chartData.map((entry, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="font-semibold text-foreground truncate">
                  {entry.name}
                </span>
                <span
                  className="text-[11px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: entry.color + "22",
                    color: entry.color,
                  }}
                >
                  {entry.sharePct.toFixed(1)}%
                </span>
              </div>
              <span className="font-bold tabular-nums shrink-0 ml-3">
                {bdt(entry.value)}
              </span>
            </div>

            {/* Equity bar */}
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${entry.pct}%`,
                  backgroundColor: entry.color,
                  opacity: 0.85,
                }}
              />
            </div>

            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Invested: {bdt(entry.investedNet)}</span>
              <span className="tabular-nums">{entry.pct.toFixed(1)}% of equity pool</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

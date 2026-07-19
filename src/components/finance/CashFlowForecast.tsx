"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { useTranslation } from "@/i18n/I18nProvider";

interface MonthPoint {
  month: string;
  label: string;
  revenue: number;
  cost: number;
}

interface Props {
  history: MonthPoint[];
}

// Simple linear regression for a series of values
function forecastNext(values: number[], steps: number): number[] {
  // Sanitize: replace NaN/Infinity (from null DB fields) with 0
  const clean = values.map((v) => (Number.isFinite(v) ? v : 0));
  const n = clean.length;
  if (n < 2) return Array(steps).fill(clean[n - 1] ?? 0);

  const points = clean.map((y, x) => ({ x, y }));
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;

  if (denom === 0) return Array(steps).fill(sumY / n);
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  return Array.from({ length: steps }, (_, i) =>
    Math.max(0, Math.round(intercept + slope * (n + i)))
  );
}

function nextMonthLabels(count: number): string[] {
  const labels: string[] = [];
  const now = new Date();
  for (let i = 1; i <= count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    labels.push(
      d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
    );
  }
  return labels;
}

const FORECAST_MONTHS = 3;

export function CashFlowForecast({ history }: Props) {
  const { t } = useTranslation();

  if (history.length < 2) {
    return (
      <div className="rounded-xl bg-card p-5 border border-border/60 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-5 w-5 text-violet-500" />
          <h3 className="text-base font-semibold">{t.dashboard.forecast.title}</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {t.dashboard.forecast.need_data}
        </p>
      </div>
    );
  }

  const revenues = history.map((h) => h.revenue);
  const costs = history.map((h) => h.cost);

  const forecastRevenues = forecastNext(revenues, FORECAST_MONTHS);
  const forecastCosts = forecastNext(costs, FORECAST_MONTHS);
  const forecastLabels = nextMonthLabels(FORECAST_MONTHS);

  const historicalPoints = history.map((h) => ({
    label: h.label,
    revenue: h.revenue,
    cost: h.cost,
    netPL: h.revenue - h.cost,
    isForecast: false,
  }));

  const forecastPoints = forecastLabels.map((label, i) => ({
    label,
    forecastRevenue: forecastRevenues[i],
    forecastCost: forecastCosts[i],
    forecastNetPL: forecastRevenues[i] - forecastCosts[i],
    isForecast: true,
  }));

  // Bridge: the first forecast label carries both the last historical values (so the
  // historical line visually extends to it) AND the first forecast values (so the
  // forecast line originates there). Using forecastLabels[0] avoids the duplicate
  // x-axis label that caused Recharts to collapse the bridge onto the last history tick.
  const lastHist = historicalPoints[historicalPoints.length - 1];
  const chartData = [
    ...historicalPoints.map((p) => ({ ...p, forecastRevenue: undefined, forecastCost: undefined, forecastNetPL: undefined })),
    {
      label: forecastLabels[0],
      revenue: lastHist.revenue,
      cost: lastHist.cost,
      netPL: lastHist.netPL,
      forecastRevenue: forecastRevenues[0],
      forecastCost: forecastCosts[0],
      forecastNetPL: forecastRevenues[0] - forecastCosts[0],
      isForecast: true,
    },
    ...forecastPoints.slice(1),
  ];

  const projectedProfit = forecastRevenues.reduce((s, r) => s + r, 0) - forecastCosts.reduce((s, c) => s + c, 0);
  const projectedProfitPositive = projectedProfit >= 0;

  return (
    <div className="rounded-xl bg-card p-5 border border-border/60 shadow-card space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-violet-500" />
          <h3 className="text-base font-semibold">{t.dashboard.forecast.title}</h3>
        </div>
        <div
          className={`rounded-lg px-3 py-1 text-sm font-semibold ${
            projectedProfitPositive
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              : "bg-red-100 text-destructive dark:bg-red-950/50"
          }`}
        >
          {projectedProfitPositive ? t.dashboard.forecast.est_profit : t.dashboard.forecast.est_loss}:{" "}
          ৳{Math.abs(projectedProfit).toLocaleString("en-IN")}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fRevGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fCostGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis
            tickFormatter={(v) =>
              v >= 1000 ? `৳${(v / 1000).toFixed(0)}k` : `৳${v}`
            }
            tick={{ fontSize: 11 }}
            width={52}
          />
          <Tooltip
             
            formatter={(val: any, name: any) => [
              `৳${Number(val).toLocaleString("en-IN")}`,
              name === "revenue"
                ? t.dashboard.forecast.rev_actual
                : name === "cost"
                ? t.dashboard.forecast.cost_actual
                : name === "forecastRevenue"
                ? t.dashboard.forecast.rev_forecast
                : t.dashboard.forecast.cost_forecast,
            ]}
          />
          <Legend
            formatter={(v) =>
              v === "revenue"
                ? t.dashboard.forecast.rev_actual
                : v === "cost"
                ? t.dashboard.forecast.cost_actual
                : v === "forecastRevenue"
                ? t.dashboard.forecast.rev_forecast
                : t.dashboard.forecast.cost_forecast
            }
          />
          <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#revGrad)" strokeWidth={2} connectNulls={false} />
          <Area type="monotone" dataKey="cost" stroke="#ef4444" fill="url(#costGrad)" strokeWidth={2} connectNulls={false} />
          <Area type="monotone" dataKey="forecastRevenue" stroke="#6366f1" fill="url(#fRevGrad)" strokeWidth={2} strokeDasharray="5 3" connectNulls={false} />
          <Area type="monotone" dataKey="forecastCost" stroke="#f59e0b" fill="url(#fCostGrad)" strokeWidth={2} strokeDasharray="5 3" connectNulls={false} />
        </AreaChart>
      </ResponsiveContainer>

      <p className="text-xs text-muted-foreground">
        {t.dashboard.forecast.disclaimer}
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp, DollarSign, AlertTriangle } from "lucide-react";

const CHART_COLORS = {
  actual:    "#10b981",
  forecast:  "#6366f1",
  benchmark: "#94a3b8",
  target:    "#f59e0b",
} as const;
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/i18n/I18nProvider";

interface LogPoint {
  recorded_at: string;
  weight_kg: number;
}

interface Props {
  initialWeight: number;
  currentWeight: number;
  /** Weight extrapolated to today using ADG × days since last weigh (passed from server). */
  estimatedWeightToday?: number;
  purchaseDate: string;
  logs: LogPoint[];
  totalConsumed: number;
  totalCost: number;
  purchasePrice: number;
  breedAverageAdg?: number | null;
  breed?: string | null;
  defaultMarketPrice?: number | null;
}

// Bangladesh zebu/crossbred ceiling — peak fattening cattle rarely exceed 1.2 kg/day
const MAX_DAILY_GAIN_KG = 1.2;
// Minimum floor — weight loss trends are real; cap at -0.1 to avoid absurd negative forecasts
const MIN_DAILY_GAIN_KG = -0.1;

function linearRegression(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 2) return null;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-9) return null;
  const rawSlope = (n * sumXY - sumX * sumY) / denom;
  const slope = Math.min(MAX_DAILY_GAIN_KG, Math.max(MIN_DAILY_GAIN_KG, rawSlope));
  // Recalculate intercept through the data centroid after capping
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept, rawSlope };
}

function ProfitBox({
  label,
  weight,
  totalCost,
  marketPrice,
}: {
  label: string;
  weight: number;
  totalCost: number;
  marketPrice: number;
}) {
  const revenue = weight * marketPrice;
  const profit = revenue - totalCost;
  const isProfit = profit >= 0;
  const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;

  return (
    <div className={`rounded-lg p-3 ring-1 ${isProfit ? "ring-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:ring-emerald-800" : "ring-red-200 bg-red-50 dark:bg-red-950/40 dark:ring-red-800"}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{weight.toFixed(1)} kg</p>
      <p className={`mt-1 text-base font-bold ${isProfit ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
        {isProfit ? "+" : ""}৳{profit.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
      </p>
      <p className="text-xs text-muted-foreground">ROI {roi.toFixed(1)}%</p>
    </div>
  );
}

export function GrowthForecastCard({
  initialWeight,
  currentWeight,
  estimatedWeightToday,
  purchaseDate,
  logs,
  totalConsumed,
  totalCost,
  purchasePrice,
  breedAverageAdg,
  breed,
  defaultMarketPrice,
}: Props) {
  const { t } = useTranslation();
  const [targetWeight, setTargetWeight] = useState<number>(
    Math.ceil(currentWeight * 1.2)
  );
  const [feedPerDay, setFeedPerDay] = useState<number>(8);
  const [marketPrice, setMarketPrice] = useState<number>(() => {
    // Prefer server-fetched default; fall back to last value user typed
    if (defaultMarketPrice && defaultMarketPrice > 0) return defaultMarketPrice;
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("tanvir_agro_market_price");
      if (stored) return Number(stored);
    }
    return 0;
  });
  const [today] = useState(() => Date.now());

  // Parse as local midnight (not UTC) so day-count is correct in Bangladesh (UTC+6)
  const purchaseMs = new Date(purchaseDate + "T00:00:00").getTime();
  const daysSincePurchase = Math.floor((today - purchaseMs) / 86400000);

  // Build regression points: [days since purchase, weight]
  const allPoints: { x: number; y: number }[] = [
    { x: 0, y: initialWeight },
    ...logs.map((l) => ({
      x: Math.max(
        0,
        Math.floor((new Date(l.recorded_at).getTime() - purchaseMs) / 86400000)
      ),
      y: l.weight_kg,
    })),
  ];

  const regression = linearRegression(allPoints);
  // Preserve negative slope (weight loss) — clamping to 0 hides health/feeding problems
  const dailyGainKg = regression ? regression.slope : 0;
  const weeklyGainKg = dailyGainKg * 7;

  // Warn if actual ADG diverges significantly from breed benchmark
  const benchmarkAdg = breedAverageAdg ?? 0.6; // default benchmark for Bangladesh crossbred
  const adgVsBenchmark = dailyGainKg > 0
    ? ((dailyGainKg - benchmarkAdg) / benchmarkAdg) * 100
    : null;
  const adgWarning =
    adgVsBenchmark !== null && allPoints.length >= 3
      ? adgVsBenchmark < -30
        ? `ADG (${dailyGainKg.toFixed(2)} kg/d) is ${Math.abs(adgVsBenchmark).toFixed(0)}% below breed average — check feed quality or health`
        : adgVsBenchmark > 50
        ? `ADG (${dailyGainKg.toFixed(2)} kg/d) is ${adgVsBenchmark.toFixed(0)}% above breed average — verify weight entries`
        : null
      : null;

  // Predict days to reach target
  const weightRemaining = Math.max(0, targetWeight - currentWeight);
  const daysToTarget =
    dailyGainKg > 0 ? Math.ceil(weightRemaining / dailyGainKg) : null;
  const targetDate = daysToTarget
    ? new Date(today + daysToTarget * 86400000)
    : null;

  // Feed needed to reach target
  const weightGainSoFar = currentWeight - initialWeight;
  const fcr =
    weightGainSoFar > 0 && totalConsumed >= 10
      ? totalConsumed / weightGainSoFar
      : null;
  const feedNeeded = fcr !== null ? fcr * weightRemaining : null;
  const feedCoverDays =
    feedPerDay > 0 && feedNeeded !== null ? Math.ceil(feedNeeded / feedPerDay) : null;

  // "Sell today" weight: prefer the server-computed ADG extrapolation (same source as
  // SellCashImpactCard) so both cards show identical numbers. Fall back to regression
  // projection if the prop isn't provided.
  const sellTodayWeight = estimatedWeightToday
    ?? (regression
      ? Math.min(650, Math.max(initialWeight, regression.intercept + regression.slope * daysSincePurchase))
      : currentWeight);

  // +30/60/90 projections start from today's estimated weight
  const proj30 = dailyGainKg > 0 ? Math.min(650, sellTodayWeight + dailyGainKg * 30) : null;
  const proj60 = dailyGainKg > 0 ? Math.min(650, sellTodayWeight + dailyGainKg * 60) : null;
  const proj90 = dailyGainKg > 0 ? Math.min(650, sellTodayWeight + dailyGainKg * 90) : null;

  // Project future costs
  const runningCostSoFar = totalCost - purchasePrice;
  const avgDailyRunningCost =
    runningCostSoFar > 0 && daysSincePurchase > 0
      ? runningCostSoFar / daysSincePurchase
      : 0;
  const projCost30 = totalCost + avgDailyRunningCost * 30;
  const projCost60 = totalCost + avgDailyRunningCost * 60;
  const projCost90 = totalCost + avgDailyRunningCost * 90;

  // Chart: actual + projected (60 days beyond current)
  const FORECAST_DAYS = 60;
  const chartDays = daysSincePurchase + FORECAST_DAYS;

  const actualSeries: { day: number; actual?: number; forecast?: number; benchmark?: number }[] =
    allPoints.map((p) => ({ day: p.x, actual: p.y }));

  if (regression && daysSincePurchase > 0) {
    for (let d = daysSincePurchase; d <= chartDays; d += 7) {
      const predictedWeight = parseFloat(
        (regression.intercept + regression.slope * d).toFixed(2)
      );
      // Benchmark line: what breed average ADG would predict from day 0
      const benchWeight = parseFloat((initialWeight + benchmarkAdg * d).toFixed(2));
      actualSeries.push({
        day: d,
        forecast: Math.max(0, predictedWeight), // allow below initialWeight to show weight loss trend
        benchmark: Math.min(benchWeight, initialWeight + MAX_DAILY_GAIN_KG * d),
      });
    }
    actualSeries.push({
      day: chartDays,
      forecast: parseFloat(
        Math.max(0, regression.intercept + regression.slope * chartDays).toFixed(2)
      ),
      benchmark: parseFloat(
        Math.min(initialWeight + benchmarkAdg * chartDays, initialWeight + MAX_DAILY_GAIN_KG * chartDays).toFixed(2)
      ),
    });
  }

  // Sort by day and merge
  const chartData = Array.from(
    new Map(actualSeries.map((p) => [p.day, p])).values()
  ).sort((a, b) => a.day - b.day);

  const hasEnoughData = allPoints.length >= 2;
  const showProfitEstimator = marketPrice > 0 && totalCost > 0;

  return (
    <div className="rounded-xl bg-card border border-border shadow-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 sm:px-5 py-3 border-b border-border bg-emerald-50/50 dark:bg-emerald-950/10">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-sm font-semibold">{t.cattle_details.growth.growth_prediction}</h2>
      </div>
      <div className="p-5 space-y-5">

      {!hasEnoughData ? (
        <p className="text-sm text-muted-foreground">
          {t.cattle_details.growth.prediction_needs_records}
        </p>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBox
              label={t.cattle_details.growth.avg_daily_gain}
              value={`${dailyGainKg.toFixed(2)} ${t.cattle_details.growth.kg_per_day}`}
            />
            <StatBox
              label={t.cattle_details.growth.avg_weekly_gain}
              value={`${weeklyGainKg.toFixed(2)} ${t.cattle_details.growth.kg_per_week}`}
            />
            {fcr !== null && (
              <StatBox label="FCR (current)" value={fcr.toFixed(2)} />
            )}
            {daysToTarget !== null && (
              <StatBox
                label={`${targetWeight} kg`}
                value={`${daysToTarget} ${t.cattle_details.growth.days}`}
                sub={
                  targetDate
                    ? targetDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : undefined
                }
              />
            )}
          </div>

          {/* Inputs */}
          <div className="flex flex-wrap gap-2 sm:gap-4">
            <div className="space-y-1">
              <Label htmlFor="target_wt">Target Weight (kg)</Label>
              <Input
                id="target_wt"
                type="number"
                min={currentWeight + 1}
                step={5}
                value={targetWeight}
                onChange={(e) => setTargetWeight(Number(e.target.value))}
                className="w-36"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="feed_per_day">{t.cattle_details.growth.feed_per_day}</Label>
              <Input
                id="feed_per_day"
                type="number"
                min={0.1}
                step={0.5}
                value={feedPerDay}
                onChange={(e) => setFeedPerDay(Number(e.target.value))}
                className="w-36"
              />
            </div>
          </div>

          {feedNeeded !== null && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                {t.cattle_details.growth.estimated_to_reach_target}{" "}
                <span className="font-bold">{feedNeeded.toFixed(1)} kg</span> {t.cattle_details.growth.feed_needed}
                {feedCoverDays && (
                  <>
                    {" "}— @ {feedPerDay} kg/day {" "}
                    <span className="font-bold">{feedCoverDays} {t.cattle_details.growth.days}</span>
                  </>
                )}
              </p>
            </div>
          )}

          {/* ADG benchmark warning */}
          {adgWarning && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{adgWarning}</span>
            </div>
          )}

          {/* Chart */}
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="day"
                tickFormatter={(d) => `${d}d`}
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={(v) => `${v}kg`}
                tick={{ fontSize: 11 }}
                width={48}
              />
              <Tooltip
                formatter={(val: any, name: any) => [
                  `${Number(val).toFixed(2)} kg`,
                  name === "actual"
                    ? t.cattle_details.growth.actual_weight
                    : name === "forecast"
                    ? t.cattle_details.growth.prediction
                    : `Breed avg (${benchmarkAdg.toFixed(2)} kg/d)`,
                ]}
                labelFormatter={(d) => `${d} ${t.cattle_details.growth.days}`}
              />
              <Legend
                formatter={(value) =>
                  value === "actual"
                    ? t.cattle_details.growth.actual_weight
                    : value === "forecast"
                    ? t.cattle_details.growth.prediction
                    : `Breed avg`
                }
              />
              <ReferenceLine
                y={targetWeight}
                stroke={CHART_COLORS.target}
                strokeDasharray="4 4"
                label={{
                  value: `Target ${targetWeight}kg`,
                  position: "insideTopRight",
                  fontSize: 11,
                  fill: CHART_COLORS.target,
                }}
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke={CHART_COLORS.actual}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="forecast"
                stroke={CHART_COLORS.forecast}
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={false}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="benchmark"
                stroke={CHART_COLORS.benchmark}
                strokeWidth={1}
                strokeDasharray="2 4"
                dot={false}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}

      {/* ── Profit Estimator ── */}
      {totalCost > 0 && (
        <div className="border-t border-border pt-5 space-y-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-indigo-500" />
            <h3 className="font-semibold">{t.cattle_details.smart.profit_estimator}</h3>
          </div>
          <div className="space-y-1">
            <Label htmlFor="market_price">{t.cattle_details.smart.market_price}</Label>
            <Input
              id="market_price"
              type="number"
              min={0}
              step={10}
              value={marketPrice || ""}
              onChange={(e) => {
                const val = Number(e.target.value);
                setMarketPrice(val);
                if (val > 0) localStorage.setItem("tanvir_agro_market_price", String(val));
              }}
              className="w-44"
              placeholder="e.g. 350"
            />
          </div>

          {showProfitEstimator ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ProfitBox
                label={t.cattle_details.smart.if_sold_today}
                weight={sellTodayWeight}
                totalCost={totalCost}
                marketPrice={marketPrice}
              />
              {proj30 !== null && (
                <ProfitBox
                  label="+30 days"
                  weight={proj30}
                  totalCost={projCost30}
                  marketPrice={marketPrice}
                />
              )}
              {proj60 !== null && (
                <ProfitBox
                  label="+60 days"
                  weight={proj60}
                  totalCost={projCost60}
                  marketPrice={marketPrice}
                />
              )}
              {proj90 !== null && (
                <ProfitBox
                  label="+90 days"
                  weight={proj90}
                  totalCost={projCost90}
                  marketPrice={marketPrice}
                />
              )}
            </div>
          ) : (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-4 text-sm flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">Market Price Required</p>
                <p className="text-amber-700 dark:text-amber-300 mt-1">
                  Please enter the current market price per kg (e.g. ৳350) or set it in the Global Settings to see an accurate profit projection for this cattle.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-3 border border-border/60 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-base font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

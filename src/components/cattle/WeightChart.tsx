"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTranslation } from "@/i18n/I18nProvider";
import type { Dictionary } from "@/i18n/getDictionary";
import { cn } from "@/lib/utils";

export interface WeightPoint {
  date: string;
  label: string;
  weight: number;
  isInitial?: boolean;
}

interface Props {
  data: WeightPoint[];
  /** Expected daily weight gain in kg. Default 0.5 kg/day (typical cattle fattening target) */
  targetDailyGainKg?: number;
  /** Purchase date — used to anchor the target trajectory */
  purchaseDate?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: WeightPoint & { target?: number; dailyGain?: number } }>;
  label?: string;
}

function CustomTooltip({ active, payload, label, t }: CustomTooltipProps & { t: Dictionary }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const onTarget = d.dailyGain !== undefined && d.dailyGain >= 0;
  return (
    <div className="rounded-xl border border-border/80 bg-card/95 p-3 shadow-xl backdrop-blur-md space-y-1.5 min-w-[140px]">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <p className="text-base font-bold tabular-nums text-foreground">{payload[0].value} kg</p>
        {d.dailyGain !== undefined && (
          <span className={cn("text-xs font-semibold tabular-nums", onTarget ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
            ({d.dailyGain >= 0 ? "+" : ""}{d.dailyGain.toFixed(2)} kg/d)
          </span>
        )}
      </div>
      {d.target !== undefined && (
        <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/60 pt-1">
          <span>{t.cattle_details.weight.target}:</span>
          <span className="font-semibold tabular-nums text-foreground/80">{d.target.toFixed(1)} kg</span>
        </div>
      )}
    </div>
  );
}

// Custom dot colored per point based on daily gain
interface DotProps {
  cx?: number;
  cy?: number;
  payload?: WeightPoint & { dailyGain?: number };
}

function ColoredDot({ cx = 0, cy = 0, payload }: DotProps) {
  if (!payload) return null;
  const color =
    payload.dailyGain === undefined
      ? "#10b981"
      : payload.dailyGain >= 0
        ? "#10b981"
        : "#ef4444";
  return <circle cx={cx} cy={cy} r={4.5} fill={color} stroke="var(--color-card, #fff)" strokeWidth={2} />;
}

export function WeightChart({ data, targetDailyGainKg = 0.5, purchaseDate }: Props) {
  const { t } = useTranslation();

  // Enrich data with daily gain rate and target weight
  const { enriched, minW, maxW, trendColor } = useMemo(() => {
    if (data.length < 2) {
      return { enriched: [], minW: 0, maxW: 100, lastGain: 0, trendColor: "#10b981" };
    }
    const anchor = purchaseDate ? new Date(purchaseDate + "T00:00:00") : new Date(data[0].date + "T00:00:00");
    const en = data.map((pt, i) => {
      const prev = i > 0 ? data[i - 1] : null;
      let dailyGain: number | undefined;
      if (prev) {
        const days = Math.max(
          1,
          (new Date(pt.date + "T00:00:00").getTime() - new Date(prev.date + "T00:00:00").getTime()) / 86400000
        );
        dailyGain = (pt.weight - prev.weight) / days;
      }
      const daysFromAnchor = Math.max(
        0,
        (new Date(pt.date + "T00:00:00").getTime() - anchor.getTime()) / 86400000
      );
      const target = data[0].weight + targetDailyGainKg * daysFromAnchor;
      return { ...pt, dailyGain, target: Math.round(target * 10) / 10 };
    });

    const weights = en.map((d) => d.weight);
    const targets = en.map((d) => d.target);
    const allValues = [...weights, ...targets];
    const minVal = Math.floor(Math.min(...allValues) * 0.95);
    const maxVal = Math.ceil(Math.max(...allValues) * 1.05);
    const gain = en[en.length - 1].dailyGain ?? 0;
    const color = gain >= targetDailyGainKg ? "#10b981" : gain >= 0 ? "#f59e0b" : "#ef4444";

    return { enriched: en, minW: minVal, maxW: maxVal, lastGain: gain, trendColor: color };
  }, [data, purchaseDate, targetDailyGainKg]);

  if (data.length < 2) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-1.5 text-center">
        <p className="text-sm font-semibold text-foreground">{t.cattle_details.weight.no_entries}</p>
        <p className="text-xs text-muted-foreground">{t.cattle_details.weight.log_first}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pl-1">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="inline-block h-2.5 w-3 rounded-sm" style={{ background: trendColor }} />
          {t.cattle_details.weight.actual}
        </span>
        <span className="flex items-center gap-1.5 font-medium">
          <span className="inline-block h-0.5 w-3 border-t-2 border-dashed border-muted-foreground/60" />
          {t.cattle_details.weight.target} ({targetDailyGainKg} {t.cattle_details.weight.kg_per_day})
        </span>
      </div>

      <ResponsiveContainer width="100%" height={230}>
        <ComposedChart data={enriched} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="weightAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={trendColor} stopOpacity={0.2} />
              <stop offset="95%" stopColor={trendColor} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} opacity={0.6} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minW, maxW]}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}`}
            width={44}
          />
          <Tooltip content={<CustomTooltip t={t} />} />

          {/* Target line — dashed */}
          <Line
            type="monotone"
            dataKey="target"
            stroke="var(--color-muted-foreground)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            activeDot={false}
          />

          {/* Area fill for actual */}
          <Area
            type="monotone"
            dataKey="weight"
            fill="url(#weightAreaGrad)"
            stroke="transparent"
          />

          {/* Actual weight line */}
          <Line
            type="monotone"
            dataKey="weight"
            stroke={trendColor}
            strokeWidth={2.5}
            dot={<ColoredDot />}
            activeDot={{ r: 6, stroke: "var(--color-card, #fff)", strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

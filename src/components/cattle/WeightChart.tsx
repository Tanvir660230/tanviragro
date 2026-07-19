"use client";

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Dot,
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
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{payload[0].value} kg</p>
      {d.dailyGain !== undefined && (
        <p className={cn("text-xs font-medium", onTarget ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
          {d.dailyGain >= 0 ? "+" : ""}{d.dailyGain.toFixed(2)} {t.cattle_details.weight.kg_per_day}
        </p>
      )}
      {d.target !== undefined && (
        <p className="text-xs text-muted-foreground">{t.cattle_details.weight.target}: {d.target.toFixed(1)} kg</p>
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
      ? "var(--color-chart-1)"
      : payload.dailyGain >= 0
        ? "#10b981"
        : "#ef4444";
  return <circle cx={cx} cy={cy} r={4} fill={color} stroke="white" strokeWidth={1.5} />;
}

export function WeightChart({ data, targetDailyGainKg = 0.5, purchaseDate }: Props) {
  const { t } = useTranslation();

  if (data.length < 2) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-1">
        <p className="text-sm font-medium text-muted-foreground">{t.cattle_details.weight.no_entries}</p>
        <p className="text-xs text-muted-foreground">{t.cattle_details.weight.log_first}</p>
      </div>
    );
  }

  // Enrich data with daily gain rate and target weight
  // Enrich data with daily gain rate and target weight
  const anchor = purchaseDate ? new Date(purchaseDate + "T00:00:00") : new Date(data[0].date + "T00:00:00");
  const enriched = data.map((pt, i) => {
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

  const weights = enriched.map((d) => d.weight);
  const targets = enriched.map((d) => d.target);
  const allValues = [...weights, ...targets];
  const minW = Math.floor(Math.min(...allValues) * 0.97);
  const maxW = Math.ceil(Math.max(...allValues) * 1.03);

  // Overall trend color: is the animal gaining weight fast enough?
  const lastGain = enriched[enriched.length - 1].dailyGain ?? 0;
  const trendColor = lastGain >= targetDailyGainKg ? "#10b981" : lastGain >= 0 ? "#f59e0b" : "#ef4444";

  return (
    <div className="space-y-2">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pl-1">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: trendColor }} />
          {t.cattle_details.weight.actual}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-px w-4 border-t-2 border-dashed border-muted-foreground/50" />
          {t.cattle_details.weight.target} ({targetDailyGainKg} {t.cattle_details.weight.kg_per_day})
        </span>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={enriched} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
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
            width={40}
          />
          <Tooltip content={<CustomTooltip t={t} />} />

          {/* Target line — dashed */}
          <Line
            type="monotone"
            dataKey="target"
            stroke="var(--color-muted-foreground)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
            activeDot={false}
          />

          {/* Actual weight line — colored by trend */}
          <Line
            type="monotone"
            dataKey="weight"
            stroke={trendColor}
            strokeWidth={2.5}
            dot={<ColoredDot />}
            activeDot={{ r: 5, stroke: "white", strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

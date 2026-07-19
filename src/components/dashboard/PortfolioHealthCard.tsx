﻿import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HealthScore } from "@/lib/supabase/queries/analytics";
import type { Dictionary } from "@/i18n/getDictionary";

const GAUGE_COLORS = {
  good:  { stroke: "#22c55e", track: "rgba(34,197,94,0.12)"  },
  fair:  { stroke: "#f59e0b", track: "rgba(245,158,11,0.12)" },
  poor:  { stroke: "#ef4444", track: "rgba(239,68,68,0.10)"  },
} as const;

function ScoreGauge({ score }: { score: number }) {
  const pct = Math.min(score, 100);
  const tier = pct >= 70 ? "good" : pct >= 40 ? "fair" : "poor";
  const { stroke: color, track: trackColor } = GAUGE_COLORS[tier];
  const animName = `gauge-${pct}`;

  return (
    <div className="relative flex h-[110px] w-[110px] shrink-0 items-center justify-center">
      <style>{`
        @keyframes ${animName} {
          from { stroke-dasharray: 0 100; }
          to   { stroke-dasharray: ${pct} ${100 - pct}; }
        }
      `}</style>
      <svg viewBox="0 0 36 36" className="h-[110px] w-[110px] -rotate-90">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke={trackColor} strokeWidth="3.2" />
        <circle
          cx="18" cy="18" r="15.9" fill="none"
          stroke={color} strokeWidth="3.2"
          strokeDasharray="0 100"
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 4px ${color}60)`,
            animation: `${animName} 1.2s cubic-bezier(0.4,0,0.2,1) forwards`,
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center gap-0">
        <span className="text-2xl font-bold leading-none text-foreground">{score}</span>
        <span className="text-xs font-medium text-muted-foreground/60 leading-none mt-0.5">/100</span>
      </div>
    </div>
  );
}

interface Props {
  health: HealthScore;
  t: Dictionary;
}

export function PortfolioHealthCard({ health, t }: Props) {
  const ph = t.dashboard.portfolio_health;

  // No active cattle â†' score=0 & all null â€" show empty state instead of misleading "Needs Attention"
  const hasData = health.fcr !== null || health.avgDaysInPen > 0 || health.stockDays !== null;
  if (!hasData) {
    return (
      <div className="rounded-xl bg-card border border-border shadow-card overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-border/60">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground/60">
            {t.dashboard.health_score}
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 py-8 text-center px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50">
            <Activity className="h-5 w-5 text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground leading-snug">{ph.no_data}</p>
        </div>
      </div>
    );
  }

  const tier = health.score >= 70 ? "good" : health.score >= 40 ? "fair" : "poor";
  const label = tier === "good" ? ph.excellent : tier === "fair" ? ph.good : ph.needs_attention;
  const labelColor = tier === "good"
    ? "text-emerald-600 dark:text-emerald-400"
    : tier === "fair"
      ? "text-amber-600 dark:text-amber-400"
      : "text-destructive";

  const chips = [
    {
      label: ph.avg_fcr,
      value: health.fcr !== null ? health.fcr.toFixed(1) : "-",
      good: health.fcr !== null && health.fcr < 6,
      neutral: health.fcr === null,
    },
    {
      label: ph.avg_days_in_pen,
      value: health.avgDaysInPen > 0 ? `${health.avgDaysInPen}d` : "-",
      good: health.avgDaysInPen > 0 && health.avgDaysInPen <= 90,
      neutral: health.avgDaysInPen === 0,
    },
    {
      label: ph.feed_coverage,
      value: health.stockDays !== null ? `~${health.stockDays}d` : "-",
      good: health.stockDays !== null && health.stockDays >= 10,
      neutral: health.stockDays === null,
    },
  ];

  return (
    <div className="rounded-xl bg-card border border-border shadow-card overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-border/60">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground/60">
          {t.dashboard.health_score}
        </p>
      </div>

      <div className="p-5 space-y-4">
        {/* Gauge + label */}
        <div className="flex items-center gap-4">
          <ScoreGauge score={health.score} />
          <div className="flex flex-col gap-1.5 min-w-0">
            <p className={cn("text-xl font-bold leading-none", labelColor)}>{label}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {ph.description}
            </p>
          </div>
        </div>

        {/* Metric chips */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {chips.map(({ label, value, good, neutral }) => (
            <div
              key={label}
              className={cn(
                "rounded-xl border px-2 py-2.5 text-center transition-colors",
                neutral
                  ? "bg-muted/30 border-border/40"
                  : good
                    ? "bg-emerald-50 dark:bg-emerald-950/25 border-emerald-200/50 dark:border-emerald-800/30"
                    : "bg-amber-50 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-800/30"
              )}
            >
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 leading-none truncate">
                {label}
              </p>
              <p
                className={cn(
                  "text-sm font-bold tabular-nums mt-1.5 leading-none",
                  neutral
                    ? "text-muted-foreground"
                    : good
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-amber-700 dark:text-amber-400"
                )}
              >
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

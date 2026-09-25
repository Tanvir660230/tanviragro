"use client";

import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { fmtBDTFull } from "@/lib/format";
import { useL } from "@/i18n/text";

interface Props {
  cattlePurchase: number;
  feedCosts: number;
  fixedCosts: number;
  variableCosts: number;
}


interface PieTooltipPayload {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { total: number } }>;
}

function CustomTooltip({ active, payload }: PieTooltipPayload) {
  const L = useL();
  if (!active || !payload?.length) return null;
  const { name, value, payload: inner } = payload[0];
  const pct = inner.total > 0 ? (value / inner.total) * 100 : 0;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold">{name}</p>
      <p className="text-muted-foreground">{fmtBDTFull(value)}</p>
      <p className="text-muted-foreground">{L(`মোটের ${pct.toFixed(1)}%`, `${pct.toFixed(1)}% of total`)}</p>
    </div>
  );
}

export function CostBreakdownChart({
  cattlePurchase,
  feedCosts,
  fixedCosts,
  variableCosts,
}: Props) {
  const L = useL();
  // Recharts' Pie needs a moment after mount to stabilize its geometry —
  // without this it briefly renders blank. A short skeleton avoids that flash.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 700);
    return () => clearTimeout(t);
  }, []);

  const total = cattlePurchase + feedCosts + fixedCosts + variableCosts;
  if (total === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        {L("এখনো খরচের তথ্য নেই", "No cost data yet")}
      </div>
    );
  }

  const nm = { cattle: L("গরু কেনা", "Cattle purchases"), feed: L("খাবার খাওয়ানো", "Feed consumption"), fixed: L("নির্দিষ্ট খরচ", "Fixed costs"), variable: L("অন্যান্য খরচ", "Variable costs") };
  const data = [
    { name: nm.cattle, value: cattlePurchase, total, color: "#f97316" },
    { name: nm.feed, value: feedCosts, total, color: "#10b981" },
    { name: nm.fixed, value: fixedCosts, total, color: "#3b82f6" },
    { name: nm.variable, value: variableCosts, total, color: "#a855f7" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-4">
      {ready ? (
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              isAnimationActive={false}
            >
              {data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center" style={{ height: 180 }}>
          <div className="h-32 w-32 animate-pulse rounded-full border-[16px] border-muted" />
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-col gap-1.5">
        {[
          { label: nm.cattle, value: cattlePurchase, color: "#f97316" },
          { label: nm.feed, value: feedCosts, color: "#10b981" },
          { label: nm.fixed, value: fixedCosts, color: "#3b82f6" },
          { label: nm.variable, value: variableCosts, color: "#a855f7" },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-muted-foreground">{label}</span>
            </div>
            <span className="font-medium tabular-nums">{fmtBDTFull(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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

interface Props {
  cattlePurchase: number;
  feedCosts: number;
  fixedCosts: number;
  variableCosts: number;
}

const SEGMENTS = [
  { key: "Cattle Purchases", color: "#f97316" },
  { key: "Feed Consumption", color: "#10b981" },
  { key: "Fixed Ops Costs", color: "#3b82f6" },
  { key: "Variable Ops Costs", color: "#a855f7" },
];

interface PieTooltipPayload {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { total: number } }>;
}

function CustomTooltip({ active, payload }: PieTooltipPayload) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: inner } = payload[0];
  const pct = inner.total > 0 ? (value / inner.total) * 100 : 0;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold">{name}</p>
      <p className="text-muted-foreground">{fmtBDTFull(value)}</p>
      <p className="text-muted-foreground">{pct.toFixed(1)}% of total</p>
    </div>
  );
}

export function CostBreakdownChart({
  cattlePurchase,
  feedCosts,
  fixedCosts,
  variableCosts,
}: Props) {
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
        No cost data yet
      </div>
    );
  }

  const data = [
    { name: "Cattle Purchases", value: cattlePurchase, total },
    { name: "Feed Consumption", value: feedCosts, total },
    { name: "Fixed Ops Costs", value: fixedCosts, total },
    { name: "Variable Ops Costs", value: variableCosts, total },
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
              {data.map((entry) => {
                const seg = SEGMENTS.find((s) => s.key === entry.name);
                return <Cell key={entry.name} fill={seg?.color ?? "#888"} />;
              })}
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
          { label: "Cattle Purchases", value: cattlePurchase, color: "#f97316" },
          { label: "Feed Consumption", value: feedCosts, color: "#10b981" },
          { label: "Fixed Ops Costs", value: fixedCosts, color: "#3b82f6" },
          { label: "Variable Ops Costs", value: variableCosts, color: "#a855f7" },
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

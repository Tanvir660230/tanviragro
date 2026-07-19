﻿"use client";

import { useOptimistic, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Scale } from "lucide-react";
import { AddWeightDialog, type WeightLogRow } from "./AddWeightDialog";
import { RecordSaleDialog } from "./RecordSaleDialog";
import { WeightChart } from "./WeightChart";
import { WeightLogTable } from "./WeightLogTable";
import { useTranslation } from "@/i18n/I18nProvider";

interface Props {
  cattleId: string;
  cattleStatus: "active" | "sold" | "dead" | "stolen";
  initialLogs: WeightLogRow[];
  purchaseDate: string;
  initialWeight: number;
  totalConsumed: number;
}

export function WeightSection({
  cattleId,
  cattleStatus,
  initialLogs,
  purchaseDate,
  initialWeight,
  totalConsumed,
}: Props) {
  const { t } = useTranslation();
  const [optimisticLogs, addOptimisticLog] = useOptimistic(
    initialLogs,
    (state, newLog: WeightLogRow) =>
      [...state, newLog].sort(
        (a, b) =>
          new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
      )
  );

  const sortedDesc = useMemo(
    () =>
      [...optimisticLogs].sort(
        (a, b) =>
          new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
      ),
    [optimisticLogs]
  );

  const latestWeight = sortedDesc[0]?.weight_kg ?? initialWeight;
  const weightGain = parseFloat((latestWeight - initialWeight).toFixed(2));
  const isGain = weightGain >= 0;

  const chartData = useMemo(
    () =>
      [
        {
          date: purchaseDate,
          label: t.cattle_details.weight.start,
          weight: initialWeight,
          isInitial: true as const,
        },
        ...optimisticLogs.map((l) => ({
          date: l.recorded_at.slice(0, 10),
          label: new Date(l.recorded_at + "T00:00:00").toLocaleDateString(
            "en-US",
            { month: "short", day: "numeric" }
          ),
          weight: l.weight_kg,
        })),
      ].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      ),
    [optimisticLogs, purchaseDate, initialWeight, t]
  );

  const handleOptimisticAdd = useCallback(
    (entry: WeightLogRow) => addOptimisticLog(entry),
    [addOptimisticLog]
  );

  const fcrValue =
    totalConsumed > 0 && weightGain >= 1 ? totalConsumed / weightGain : null;
  const fcrTier: "good" | "fair" | "poor" | "none" =
    fcrValue === null
      ? "none"
      : fcrValue <= 6
        ? "good"
        : fcrValue <= 8
          ? "fair"
          : "poor";

  const stats: {
    label: string;
    value: string;
    sub?: string;
    positive?: boolean;
    tier?: typeof fcrTier;
  }[] = [
    {
      label: t.cattle_details.weight.current_weight,
      value: `${latestWeight} kg`,
      sub: sortedDesc[0]
        ? t.cattle_details.weight.last_logged.replace(
            "{{date}}",
            new Date(sortedDesc[0].recorded_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })
          )
        : t.cattle_details.weight.no_logs,
    },
    {
      label: t.cattle_details.weight.total_weight_gain,
      value: `${isGain ? "+" : ""}${weightGain} kg`,
      sub: t.cattle_details.weight.from_purchase.replace(
        "{{weight}}",
        initialWeight.toString()
      ),
      positive: isGain,
    },
    {
      label: t.cattle_details.weight.entries_logged,
      value: optimisticLogs.length.toString(),
      sub: t.cattle_details.weight.weight_measurements,
    },
    {
      label: t.cattle_details.weight.fcr,
      value: fcrValue !== null ? fcrValue.toFixed(2) : "-",
      sub:
        totalConsumed > 0
          ? `${totalConsumed.toFixed(1)} kg ${t.cattle_details.weight.consumed}`
          : t.cattle_details.weight.log_feed_help,
      tier: fcrTier,
    },
  ];

  return (
    <>
      {/* Section header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Scale className="h-3.5 w-3.5 text-primary" />
          </div>
          <h2 className="text-base font-semibold">
            {t.cattle_details.weight.weight_tracking}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {cattleStatus === "active" && (
            <>
              <RecordSaleDialog cattleId={cattleId} currentWeight={latestWeight} />
            </>
          )}
          <AddWeightDialog
            cattleId={cattleId}
            onOptimisticAdd={handleOptimisticAdd}
          />
        </div>
      </div>

      {/* Chart + stat tiles */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl bg-card border border-border shadow-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-muted/30">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.cattle_details.weight.weight_trend}
            </p>
          </div>
          <div className="p-4">
            <WeightChart data={chartData} purchaseDate={purchaseDate} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:flex lg:flex-col lg:gap-3">
          {stats.map(({ label, value, sub, positive, tier }) => {
            const isGoodFcr = tier === "good";
            const isFairFcr = tier === "fair";
            const isPoorFcr = tier === "poor";

            const cardCls = cn(
              "rounded-xl p-3 sm:p-4 ring-1",
              positive === true
                ? "bg-emerald-50 dark:bg-emerald-950/20 ring-emerald-200 dark:ring-emerald-800/40"
                : positive === false
                  ? "bg-red-50 dark:bg-red-950/20 ring-red-200 dark:ring-red-800/40"
                  : isGoodFcr
                    ? "bg-emerald-50 dark:bg-emerald-950/20 ring-emerald-200 dark:ring-emerald-800/40"
                    : isFairFcr
                      ? "bg-amber-50 dark:bg-amber-950/20 ring-amber-200 dark:ring-amber-800/40"
                      : isPoorFcr
                        ? "bg-red-50 dark:bg-red-950/20 ring-red-200 dark:ring-red-800/40"
                        : "bg-card ring-foreground/10"
            );

            const valueCls = cn(
              "mt-1 text-xl font-bold",
              positive === true
                ? "text-emerald-600 dark:text-emerald-400"
                : positive === false
                  ? "text-destructive"
                  : isGoodFcr
                    ? "text-emerald-600 dark:text-emerald-400"
                    : isFairFcr
                      ? "text-amber-600 dark:text-amber-400"
                      : isPoorFcr
                        ? "text-red-500 dark:text-red-400"
                        : "text-foreground"
            );

            return (
              <div key={label} className={cardCls}>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
                <p className={valueCls}>{value}</p>
                {sub && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Weight log history */}
      <WeightLogTable
        cattleId={cattleId}
        initialWeight={initialWeight}
        purchaseDate={purchaseDate}
        logs={optimisticLogs}
      />
    </>
  );
}

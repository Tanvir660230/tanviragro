"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  Moon,
  Printer,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleQurbaniMark } from "@/app/dashboard/(app)/cattle/actions";
import type { QurbaniCattle } from "@/app/dashboard/(app)/cattle/qurbani/page";

type Props = {
  cattle: QurbaniCattle[];
  eidLabel: string;
  daysToEid: number;
  stats: { total: number; ready: number; developing: number; atRisk: number };
};

const READINESS_CONFIG = {
  ready: {
    label: "Ready",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    row: "border-l-4 border-l-emerald-400",
  },
  developing: {
    label: "Developing",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    row: "border-l-4 border-l-amber-400",
  },
  at_risk: {
    label: "At Risk",
    icon: <XCircle className="h-3.5 w-3.5" />,
    badge: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
    row: "border-l-4 border-l-red-400",
  },
} as const;

export function QurbaniBoardClient({ cattle, eidLabel, daysToEid, stats }: Props) {
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const visible = cattle.filter((c) => !removedIds.has(c.id));
  const ready      = visible.filter((c) => c.readiness === "ready");
  const developing = visible.filter((c) => c.readiness === "developing");
  const atRisk     = visible.filter((c) => c.readiness === "at_risk");

  function handleUnmark(cattleId: string) {
    setRemovedIds((prev) => new Set([...prev, cattleId]));
    startTransition(async () => {
      const res = await toggleQurbaniMark(cattleId, false);
      if (res?.error) {
        toast.error(res.error);
        setRemovedIds((prev) => {
          const next = new Set(prev);
          next.delete(cattleId);
          return next;
        });
      } else {
        toast.success("Removed from Qurbani list");
      }
    });
  }

  const urgency = daysToEid <= 30 ? "critical" : daysToEid <= 90 ? "warning" : "info";

  return (
    <>
      {/* ── Eid Countdown Banner ── */}
      <div
        className={cn(
          "rounded-xl border px-5 py-4 flex items-center justify-between gap-4",
          urgency === "critical"
            ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
            : urgency === "warning"
            ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
            : "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl shrink-0",
              urgency === "critical"
                ? "bg-red-500/10"
                : urgency === "warning"
                ? "bg-amber-500/10"
                : "bg-emerald-500/10"
            )}
          >
            <Moon
              className={cn(
                "h-5 w-5",
                urgency === "critical"
                  ? "text-red-600 dark:text-red-400"
                  : urgency === "warning"
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400"
              )}
            />
          </div>
          <div>
            <p className="text-sm font-semibold">Eid-ul-Adha {new Date(eidLabel).getFullYear()}</p>
            <p className="text-xs text-muted-foreground">{eidLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p
              className={cn(
                "text-3xl font-bold tabular-nums leading-none",
                urgency === "critical"
                  ? "text-red-600 dark:text-red-400"
                  : urgency === "warning"
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400"
              )}
            >
              {daysToEid}
            </p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">days left</p>
          </div>
          <button
            onClick={() => window.print()}
            className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border bg-background/80 px-3 py-1.5 text-sm font-medium text-foreground shadow-card hover:bg-muted transition-colors print:hidden"
          >
            <Printer className="h-3.5 w-3.5" />
            Print List
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 print:hidden">
        <div className="rounded-xl bg-muted/40 border border-border/60 p-3 sm:p-4 space-y-2">
          <Moon className="h-4 w-4 text-primary" />
          <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Marked</p>
        </div>
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/40 p-3 sm:p-4 space-y-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{stats.ready}</p>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ready</p>
        </div>
        <div className={cn(
          "rounded-xl ring-1 p-3 sm:p-4 space-y-2",
          stats.atRisk > 0
            ? "bg-red-50 dark:bg-red-950/20 ring-red-200 dark:ring-red-800/50"
            : "bg-amber-50 dark:bg-amber-950/20 ring-amber-200 dark:ring-amber-800/50"
        )}>
          <AlertTriangle className={cn("h-4 w-4", stats.atRisk > 0 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")} />
          <p className={cn("text-2xl font-bold tabular-nums", stats.atRisk > 0 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")}>
            {stats.developing + stats.atRisk}
          </p>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Need Attention
          </p>
        </div>
      </div>

      {/* ── Empty state ── */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
            <Moon className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">No cattle marked for Qurbani</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Open a cattle&apos;s profile and tap the Qurbani toggle to mark them.
            </p>
          </div>
          <Link
            href="/dashboard/cattle"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Go to Cattle List
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Print header — only visible when printing */}
          <div className="hidden print:block mb-4">
            <h2 className="text-xl font-bold">Qurbani Cattle List — {eidLabel}</h2>
            <p className="text-sm text-muted-foreground">{cattle.length} cattle marked · {daysToEid} days to Eid</p>
          </div>

          {ready.length > 0 && (
            <CattleGroup
              label="Ready for Qurbani"
              labelColor="text-emerald-600 dark:text-emerald-400"
              cattle={ready}
              daysToEid={daysToEid}
              isPending={isPending}
              onUnmark={handleUnmark}
            />
          )}
          {developing.length > 0 && (
            <CattleGroup
              label="Developing"
              labelColor="text-amber-600 dark:text-amber-400"
              cattle={developing}
              daysToEid={daysToEid}
              isPending={isPending}
              onUnmark={handleUnmark}
            />
          )}
          {atRisk.length > 0 && (
            <CattleGroup
              label="At Risk"
              labelColor="text-destructive"
              cattle={atRisk}
              daysToEid={daysToEid}
              isPending={isPending}
              onUnmark={handleUnmark}
            />
          )}
        </div>
      )}
    </>
  );
}

function CattleGroup({
  label,
  labelColor,
  cattle,
  daysToEid,
  isPending,
  onUnmark,
}: {
  label: string;
  labelColor: string;
  cattle: QurbaniCattle[];
  daysToEid: number;
  isPending: boolean;
  onUnmark: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className={cn("text-xs font-semibold uppercase tracking-wider px-1", labelColor)}>
        {label} ({cattle.length})
      </p>
      {cattle.map((c) => (
        <CattleCard
          key={c.id}
          cattle={c}
          daysToEid={daysToEid}
          isPending={isPending}
          onUnmark={onUnmark}
        />
      ))}
    </div>
  );
}

function CattleCard({
  cattle,
  daysToEid,
  isPending,
  onUnmark,
}: {
  cattle: QurbaniCattle;
  daysToEid: number;
  isPending: boolean;
  onUnmark: (id: string) => void;
}) {
  const cfg = READINESS_CONFIG[cattle.readiness];
  const weightNeeded = Math.max(0, 250 - cattle.projectedWt);
  const adgNeeded = daysToEid > 0 ? weightNeeded / daysToEid : 0;

  return (
    <div
      className={cn(
        "rounded-xl bg-card border border-border shadow-card overflow-hidden",
        cfg.row
      )}
    >
      <div className="px-4 py-3 flex items-start gap-3">
        {/* Identity */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/dashboard/cattle/${cattle.id}`}
                className="text-base font-bold hover:text-primary hover:underline underline-offset-2 transition-colors"
              >
                #{cattle.tagId}
              </Link>
              <span className="text-sm text-muted-foreground">
                {cattle.gender === "male" ? "♂" : "♀"}
                {cattle.breed && ` · ${cattle.breed}`}
              </span>
              {cattle.isQuarantined && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 px-2 py-0.5 text-xs font-semibold">
                  <ShieldAlert className="h-3 w-3" />
                  Quarantined
                </span>
              )}
            </div>
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0", cfg.badge)}>
              {cfg.icon}
              {cfg.label}
            </span>
          </div>

          {/* Weight metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Metric label="Current" value={`${cattle.currentWt.toFixed(0)} kg`} />
            <Metric
              label={`At Eid (${daysToEid}d)`}
              value={`~${cattle.projectedWt.toFixed(0)} kg`}
              valueColor={
                cattle.projectedWt >= 250
                  ? "text-emerald-600 dark:text-emerald-400"
                  : cattle.projectedWt < 180
                  ? "text-red-600 dark:text-red-400"
                  : "text-amber-600 dark:text-amber-400"
              }
            />
            <Metric
              label="Daily Gain (ADG)"
              value={cattle.adg > 0 ? `${cattle.adg.toFixed(2)} kg/d` : "No data"}
              valueColor={cattle.adg >= 0.4 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}
            />
            <Metric
              label="Days in Pen"
              value={`${cattle.daysInPen}d`}
            />
          </div>

          {/* Need-to-gain hint */}
          {cattle.readiness !== "ready" && weightNeeded > 0 && daysToEid > 0 && (
            <p className="text-xs text-muted-foreground">
              Needs{" "}
              <span className="font-semibold text-foreground">
                +{weightNeeded.toFixed(0)} kg
              </span>{" "}
              more by Eid — requires{" "}
              <span className={cn("font-semibold", adgNeeded > (cattle.adg > 0 ? cattle.adg * 1.2 : 0.5) ? "text-red-600 dark:text-red-400" : "text-foreground")}>
                {adgNeeded.toFixed(2)} kg/day
              </span>
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1 print:hidden">
          <Link
            href={`/dashboard/cattle/${cattle.id}`}
            title="View profile"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            onClick={() => onUnmark(cattle.id)}
            disabled={isPending}
            title="Remove from Qurbani list"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-amber-100 dark:hover:bg-amber-950/40 hover:text-amber-700 dark:hover:text-amber-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Moon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide leading-none mb-0.5">
        {label}
      </p>
      <p className={cn("text-sm font-bold tabular-nums", valueColor ?? "text-foreground")}>{value}</p>
    </div>
  );
}

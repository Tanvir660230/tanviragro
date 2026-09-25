"use client";

import { ArrowUpCircle, ArrowDownCircle, Wallet } from "lucide-react";
import { useL } from "@/i18n/text";
import { Tr } from "@/i18n/Tr";

function fmt(n: number) {
  return `৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
}

export function CapitalSummaryCards({
  totalIn,
  totalOut,
  netCapital,
  mgmtFeeRate,
}: {
  totalIn: number;
  totalOut: number;
  netCapital: number;
  mgmtFeeRate: number;
}) {
  const L = useL();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-900/30">
            <ArrowUpCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-xs text-muted-foreground font-medium">{L("মোট জমা", "Total Injected")}</p>
        </div>
        <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
          +{fmt(totalIn)}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{L("সব অংশীদারের জমা", "All partner investments")}</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-red-100 dark:bg-red-900/30">
            <ArrowDownCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <p className="text-xs text-muted-foreground font-medium">{L("মোট তোলা", "Total Withdrawn")}</p>
        </div>
        <p className="text-xl font-bold text-red-600 dark:text-red-400 tabular-nums">
          −{fmt(totalOut)}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{L("সব অংশীদারের তোলা", "All partner withdrawals")}</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground font-medium">{L("নিট মূলধন", "Net Pool Capital")}</p>
        </div>
        <p className="text-xl font-bold text-foreground tabular-nums">
          {netCapital >= 0 ? "" : "−"}{fmt(netCapital)}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {mgmtFeeRate > 0 ? <Tr bn={`${mgmtFeeRate}% ম্যানেজমেন্ট ফিসহ`} en={`Includes ${mgmtFeeRate}% management buffer`} /> : <Tr bn="জমা − তোলা" en="Net active partner pool" />}
        </p>
      </div>
    </div>
  );
}

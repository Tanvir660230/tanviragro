"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { CATTLE_STATUS_STYLE } from "@/constants/cattle-status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteCattleButton } from "./DeleteCattleButton";
import { EditCattleDialog } from "./EditCattleDialog";
import { FCRBadge } from "./FCRBadge";
import { ADGBadge } from "./ADGBadge";
import { InlineWeightEdit } from "./InlineWeightEdit";
import type { CattleRowEnriched } from "@/app/dashboard/(app)/cattle/page";
import type { Cattle } from "@/types/database";
import { useTranslation } from "@/i18n/I18nProvider";
import { AlertTriangle } from "lucide-react";
import { calculateDailyFeedRequirement } from "@/utils/feed-calculator";

const STATUS_STYLE = CATTLE_STATUS_STYLE;

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isUnweighedRecently(lastWeighedAt: string | null, now: number): boolean {
  if (!lastWeighedAt) return true;
  return new Date(lastWeighedAt).getTime() < now - 7 * 86400000;
}

export function CattleTable({ cattle, allTagIds, allBreeds }: { cattle: CattleRowEnriched[]; allTagIds: string[]; allBreeds: string[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [now] = useState(() => Date.now());

  return (
    <div className="rounded-xl border border-border bg-card overflow-x-auto shadow-card">
      <Table className="min-w-[900px]">
        <TableHeader>
          <TableRow className="border-b border-border bg-muted/20 hover:bg-transparent">
            <TableHead className="h-11 text-xs font-medium text-muted-foreground/70">{t.cattle_details.table.tag_id}</TableHead>
            <TableHead className="h-11 text-xs font-medium text-muted-foreground/70">{t.cattle_details.table.breed}</TableHead>
            <TableHead className="h-11 text-xs font-medium text-muted-foreground/70 text-right">{t.cattle_details.table.weight_kg}</TableHead>
            <TableHead className="h-11 text-xs font-medium text-muted-foreground/70">{t.cattle_details.table.feed_per_day}</TableHead>
            <TableHead className="h-11 text-xs font-medium text-muted-foreground/70 text-center">{t.cattle_details.smart.adg}</TableHead>
            <TableHead className="h-11 text-xs font-medium text-muted-foreground/70 text-center">{t.cattle_details.weight.fcr}</TableHead>
            <TableHead className="h-11 text-xs font-medium text-muted-foreground/70 text-center">{t.cattle_details.table.status}</TableHead>
            <TableHead className="h-11 w-20 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {cattle.map((c) => {
            const unweighed = c.status === "active" && isUnweighedRecently(c.lastWeighedAt, now);
            const feedReq = calculateDailyFeedRequirement({
              initialWeightKg: c.initial_weight_kg ?? 0,
              latestLoggedWeightKg: c.latestWeight,
              lastWeighedAt: c.lastWeighedAt,
              purchaseDate: c.purchase_date ?? new Date().toISOString(),
              expectedDailyGainKg: c.expected_daily_gain_kg ?? 0.8,
            });
            return (
              <TableRow
                key={c.id}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest("button, a, [role='button'], input, select, textarea")) return;
                  router.push(`/dashboard/cattle/${c.id}`);
                }}
                className={cn(
                  "group transition-colors hover:bg-muted/40 border-b border-border last:border-0 cursor-pointer",
                  unweighed && "bg-amber-50/20 dark:bg-amber-950/10"
                )}
              >
                <TableCell className="py-3">
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/dashboard/cattle/${c.id}`}
                      className="font-semibold text-foreground hover:text-primary transition-colors"
                    >
                      #{c.tag_id.replace(/^#/, '')}
                    </Link>
                    <span className="text-muted-foreground/50 text-xs">{c.gender === "male" ? "♂" : "♀"}</span>
                    {unweighed && (
                      <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" aria-label="Not weighed in 7+ days" />
                    )}
                  </div>
                  {c.daysInPen !== null && (
                    <p className="text-xs text-muted-foreground mt-0.5">{c.daysInPen}d in pen</p>
                  )}
                </TableCell>
                <TableCell className="text-foreground/80 font-medium text-sm">
                  {c.breed ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {c.status === "active" ? (
                    <InlineWeightEdit
                      cattleId={c.id}
                      currentWeight={c.latestWeight ?? c.initial_weight_kg}
                      initialWeight={c.initial_weight_kg}
                      alwaysShowEdit={unweighed}
                    />
                  ) : (
                    <div className="flex items-baseline justify-end gap-1">
                      <span className="font-semibold text-foreground">
                        {c.latestWeight ?? c.initial_weight_kg}
                      </span>
                      {c.latestWeight !== null && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium ml-1">
                          (+{(c.latestWeight - c.initial_weight_kg).toFixed(1)})
                        </span>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell className="pl-3">
                  {c.status === "active" ? (() => {
                    const roughageKg = c.manual_feed_override?.roughageKg ?? feedReq.roughageKg;
                    const isManual = c.manual_feed_override?.roughageKg != null;
                    return (
                      <div className="flex flex-col gap-1 text-xs tabular-nums">
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                          <span className="font-semibold text-foreground">
                            {feedReq.actualConcentrateKg.toFixed(1)}
                            <span className="font-normal text-xs text-muted-foreground ml-0.5">kg</span>
                          </span>
                          <span className="text-xs uppercase tracking-wider text-muted-foreground/70">{t.cattle_details.feed_card.concentrate}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                          <span className="font-semibold text-foreground">
                            {roughageKg.toFixed(1)}
                            <span className="font-normal text-xs text-muted-foreground ml-0.5">kg</span>
                          </span>
                          <span className="text-xs uppercase tracking-wider text-muted-foreground/70">{t.cattle_details.feed_card.roughage}</span>
                          {isManual && <span className="text-xs text-primary/70 font-bold ml-0.5" title="Manual roughage override">M</span>}
                        </div>
                      </div>
                    );
                  })() : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <ADGBadge adg={c.adg} />
                </TableCell>
                <TableCell className="text-center">
                  <FCRBadge fcr={c.fcr} />
                </TableCell>
                <TableCell className="text-center">
                  <span
                    className={cn(
                      "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                      STATUS_STYLE[c.status]
                    )}
                  >
                    {t.cattle_details.dialogs[c.status] || c.status}
                  </span>
                  {c.is_quarantined && (
                    <div className="mt-1">
                      <span className="inline-flex items-center justify-center rounded-full bg-amber-500 px-2 py-0.5 text-xs font-medium text-white shadow-card">
                        Quarantined
                      </span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <EditCattleDialog
                      cattle={{
                        id: c.id,
                        tag_id: c.tag_id,
                        gender: c.gender,
                        breed: c.breed ?? null,
                        dob: c.dob ?? null,
                        purchase_date: c.purchase_date,
                        purchase_price: c.purchase_price,
                        initial_weight_kg: c.initial_weight_kg,
                        target_weight_kg: c.target_weight_kg ?? null,
                        expected_daily_gain_kg: c.expected_daily_gain_kg ?? null,
                        notes: c.notes ?? null,
                        existingTagIds: allTagIds.filter((t) => t !== c.tag_id),
                        existingBreeds: allBreeds,
                      }}
                    />
                    <DeleteCattleButton id={c.id} />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Trash2,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Ruler,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { deleteWeightLog } from "@/app/dashboard/(app)/cattle/[id]/actions";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import type { WeightLog } from "@/types/database";
import { useTranslation } from "@/i18n/I18nProvider";
import type { Dictionary } from "@/i18n/getDictionary";
import { DataPagination, DateRangeFilter } from "@/components/ui/data-pagination";

type LogRow = Pick<
  WeightLog,
  "id" | "weight_kg" | "recorded_at" | "notes" | "girth_cm" | "length_cm"
>;

interface LogWithStats extends LogRow {
  gainKg: number;
  daysSincePrev: number | null;
  adgKgPerDay: number | null;
}

function parseDate(s: string): Date {
  return new Date(s.length === 10 ? s + "T00:00:00" : s);
}

function daysBetween(a: string, b: string): number {
  return Math.floor(
    (parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000
  );
}

function DeleteLogButton({ logId, cattleId }: { logId: string; cattleId: string }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  const handleConfirm = () => {
    setConfirm(false);
    startTransition(async () => {
      const result = await deleteWeightLog(logId, cattleId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t.cattle_details.weight.deleted);
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-destructive"
        disabled={isPending}
        onClick={() => setConfirm(true)}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </Button>
      <ConfirmDialog
        open={confirm}
        title={t.cattle_details.weight.delete_entry}
        description={t.cattle_details.weight.delete_entry_desc}
        confirmLabel={t.cattle_details.weight.delete}
        destructive
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}

function RowDetail({ row, cattleId, t }: { row: LogWithStats; cattleId: string; t: Dictionary }) {
  const [open, setOpen] = useState(false);
  const hasTape = row.girth_cm && row.length_cm;

  return (
    <div className="border-b border-border last:border-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-24 shrink-0">
          <p className="text-xs font-medium text-foreground">
            {new Date(row.recorded_at).toLocaleDateString("bn-BD", {
              day: "numeric",
              month: "short",
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(row.recorded_at).getFullYear()}
          </p>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold tabular-nums">{row.weight_kg} kg</p>
          {row.daysSincePrev !== null && (
            <p className="text-xs text-muted-foreground">
              {row.daysSincePrev} {t.cattle_details.weight.days_later}
            </p>
          )}
        </div>

        <div
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold shrink-0",
            row.gainKg > 0
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
              : row.gainKg < 0
                ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                : "bg-muted text-muted-foreground"
          )}
        >
          {row.gainKg > 0 ? <TrendingUp className="h-3 w-3" /> : row.gainKg < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          {row.gainKg > 0 ? "+" : ""}{row.gainKg} kg
        </div>

        {row.adgKgPerDay !== null && (
          <div className="hidden sm:block shrink-0 text-right">
            <p className="text-xs font-semibold tabular-nums text-foreground">
              {row.adgKgPerDay > 0 ? "+" : ""}{row.adgKgPerDay} {t.cattle_details.weight.kg_per_day}
            </p>
            <p className="text-xs text-muted-foreground">{t.cattle_details.weight.avg_gain}</p>
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0">
          {hasTape && (
            <span title={t.cattle_details.weight.tape_measured}>
              <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          )}
          {(row.notes || hasTape || row.adgKgPerDay !== null) && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
          <DeleteLogButton logId={row.id} cattleId={cattleId} />
        </div>
      </div>

      {open && (
        <div className="px-4 pb-3 grid grid-cols-2 sm:grid-cols-3 gap-2 bg-muted/30">
          {hasTape && (
            <>
              <div className="rounded-md border border-border bg-card px-3 py-2">
                <p className="text-xs text-muted-foreground">{t.cattle_details.weight.girth}</p>
                <p className="text-sm font-semibold">{row.girth_cm} cm</p>
              </div>
              <div className="rounded-md border border-border bg-card px-3 py-2">
                <p className="text-xs text-muted-foreground">{t.cattle_details.weight.length}</p>
                <p className="text-sm font-semibold">{row.length_cm} cm</p>
              </div>
            </>
          )}
          {row.adgKgPerDay !== null && (
            <div className="rounded-md border border-border bg-card px-3 py-2 sm:hidden">
              <p className="text-xs text-muted-foreground">{t.cattle_details.weight.avg_daily_gain}</p>
              <p className="text-sm font-semibold">
                {row.adgKgPerDay > 0 ? "+" : ""}{row.adgKgPerDay} {t.cattle_details.weight.kg_per_day}
              </p>
            </div>
          )}
          {row.notes && (
            <div className="col-span-2 sm:col-span-3 rounded-md border border-border bg-card px-3 py-2">
              <p className="text-xs text-muted-foreground">{t.cattle_details.weight.notes}</p>
              <p className="text-sm">{row.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  cattleId: string;
  initialWeight: number;
  purchaseDate: string;
  logs: LogRow[];
}

export function WeightLogTable({ cattleId, initialWeight, purchaseDate, logs }: Props) {
  const { t } = useTranslation();
  const [page, setPage]           = useState(0);
  const [pageSize, setPageSize]   = useState(25);
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");

  if (!logs.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 py-10 text-center">
        <TrendingUp className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">{t.cattle_details.weight.no_entries}</p>
        <p className="text-xs text-muted-foreground">{t.cattle_details.weight.log_first}</p>
      </div>
    );
  }

  const sorted = [...logs].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  const withStats: LogWithStats[] = sorted.map((log, i) => {
    const prevWeight = i === 0 ? initialWeight : sorted[i - 1].weight_kg;
    const prevDate   = i === 0 ? purchaseDate  : sorted[i - 1].recorded_at;
    const gainKg         = parseFloat((log.weight_kg - prevWeight).toFixed(2));
    const daysSincePrev  = daysBetween(prevDate, log.recorded_at);
    const adgKgPerDay    = daysSincePrev && daysSincePrev > 0
      ? parseFloat((gainKg / daysSincePrev).toFixed(2))
      : null;
    return { ...log, gainKg, daysSincePrev, adgKgPerDay };
  });

  // Summary stats (always over all logs)
  const totalGain  = parseFloat((sorted[sorted.length - 1].weight_kg - initialWeight).toFixed(2));
  const lastDate   = sorted[sorted.length - 1].recorded_at;
  const totalDays  = daysBetween(purchaseDate, lastDate);
  const overallAdg = totalDays > 0 ? parseFloat((totalGain / totalDays).toFixed(2)) : null;

  // Newest first
  const allRows = [...withStats].reverse();

  // Date filter
  const filteredRows = allRows.filter((r) => {
    const d = r.recorded_at.slice(0, 10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo   && d > dateTo)   return false;
    return true;
  });

  const visibleRows = filteredRows.slice(page * pageSize, (page + 1) * pageSize);

  function handleFromChange(v: string) { setDateFrom(v); setPage(0); }
  function handleToChange(v: string)   { setDateTo(v);   setPage(0); }
  function handleClear()               { setDateFrom(""); setDateTo(""); setPage(0); }

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border bg-card px-3 py-2.5 text-center">
          <p className="text-xs text-muted-foreground">{t.cattle_details.weight.total_gain}</p>
          <p className={cn("text-base font-bold tabular-nums", totalGain > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
            {totalGain > 0 ? "+" : ""}{totalGain} kg
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-3 py-2.5 text-center">
          <p className="text-xs text-muted-foreground">{t.cattle_details.weight.avg_daily_gain}</p>
          <p className="text-base font-bold tabular-nums">
            {overallAdg !== null ? `${overallAdg > 0 ? "+" : ""}${overallAdg}` : "—"}{" "}
            <span className="text-xs font-normal text-muted-foreground">{t.cattle_details.weight.kg_per_day}</span>
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-3 py-2.5 text-center">
          <p className="text-xs text-muted-foreground">{t.cattle_details.weight.total_entries}</p>
          <p className="text-base font-bold tabular-nums">{logs.length}</p>
        </div>
      </div>

      {/* Log list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="border-b border-border px-4 py-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold shrink-0">{t.cattle_details.weight.weight_history}</h3>
          <span className="text-xs text-muted-foreground">
            {totalDays > 0 ? `${totalDays} ${t.cattle_details.weight.days_record}` : ""}
          </span>
        </div>

        {/* Date filter */}
        <div className="border-b border-border bg-muted/20 px-4 py-2.5">
          <DateRangeFilter
            from={dateFrom}
            to={dateTo}
            onFromChange={handleFromChange}
            onToChange={handleToChange}
            onClear={handleClear}
            filteredCount={filteredRows.length}
            totalCount={allRows.length}
          />
        </div>

        {/* Rows */}
        <div>
          {filteredRows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No entries in this date range</p>
          ) : (
            visibleRows.map((row) => (
              <RowDetail key={row.id} row={row} cattleId={cattleId} t={t} />
            ))
          )}
        </div>

        {/* Pagination */}
        {filteredRows.length > 0 && (
          <div className="border-t border-border px-4 py-3">
            <DataPagination
              total={filteredRows.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

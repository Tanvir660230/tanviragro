"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ClipboardCheck, Sparkles, Wheat, CheckCircle2 } from "lucide-react";
import {
  recordDailyFeeding,
  getFarmDailyFeedRequirement,
  type PlannedFeedLine,
} from "@/app/dashboard/(app)/inventory/actions";
import type { InventoryRow } from "./InventoryTable";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/I18nProvider";
import { kgToItemUnits } from "@/lib/inventory/feed-costing";

interface Props {
  feedItems: InventoryRow[];
  cattleCount: number;
  prominent?: boolean;
}

type Requirement = { totalConcentrateKg: number; totalRoughageKg: number; cattleCount: number; plan: PlannedFeedLine[] };

/**
 * Records what the herd was ACTUALLY fed on one date. Nothing is deducted until the user
 * saves; the ration plan only pre-fills suggestions in each item's own unit.
 */
export function DailyFeedDeductButton({ feedItems, cattleCount, prominent = false }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const tr = t.inventory.daily_deduction;

  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
  const [date, setDate] = useState(today);
  const [totals, setTotals] = useState<Record<string, string>>({});
  const [req, setReq] = useState<Requirement | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  if (!feedItems.length || cattleCount === 0) return null;

  const planByItem = new Map((req?.plan ?? []).map((l) => [l.item_id, l]));

  const handleFillFromPlan = async () => {
    setIsCalculating(true);
    try {
      const res = await getFarmDailyFeedRequirement(date);
      if (res.error) {
        toast.error(res.error);
      } else if (res.data) {
        setReq(res.data);
        // Suggestions only, per item and in the item's own unit (recipe proportions for
        // concentrate). Unknown conversions stay empty for the user to fill in.
        const next: Record<string, string> = { ...totals };
        for (const line of res.data.plan) {
          if (line.qty != null && feedItems.some((i) => i.id === line.item_id)) next[line.item_id] = String(line.qty);
        }
        setTotals(next);
      }
    } catch {
      toast.error(tr.error_calc_failed);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSubmit = () => {
    const lines = feedItems
      .map((item) => ({ item_id: item.id, qty: parseFloat(totals[item.id] ?? "") }))
      .filter((l) => Number.isFinite(l.qty) && l.qty > 0);

    if (!lines.length) {
      toast.error(tr.error_no_qty);
      return;
    }

    startTransition(async () => {
      const result = await recordDailyFeeding(lines, date);
      if (result.error) {
        toast.error(result.error);
      } else {
        const detail = lines
          .map((l) => {
            const item = feedItems.find((i) => i.id === l.item_id);
            return `${l.qty} ${item?.unit ?? ""} ${item?.name ?? ""}`;
          })
          .join(", ");
        toast.success(`${tr.success} — ${detail}`);
        setOpen(false);
        setTotals({});
        setReq(null);
        router.refresh();
      }
    });
  };

  // Entered totals in kg, per category. A piece item counts only when its kg per unit is known.
  let enteredConcentrateKg = 0;
  let enteredRoughageKg = 0;
  let roughageKgUnknown = false;
  for (const item of feedItems) {
    const v = parseFloat(totals[item.id] ?? "");
    if (!Number.isFinite(v) || v <= 0) continue;
    const kgPerUnit = item.kg_per_unit ?? (item.unit.toLowerCase() === "kg" ? 1 : null);
    const kg = kgPerUnit ? v * kgPerUnit : null;
    if (item.category === "roughage") {
      if (kg == null) roughageKgUnknown = true;
      else enteredRoughageKg += kg;
    } else if (kg != null) {
      enteredConcentrateKg += kg;
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        setOpen(val);
        if (!val) { setTotals({}); setReq(null); }
      }}
    >
      <DialogTrigger className={cn(
        prominent
          ? cn(buttonVariants({ variant: "default", size: "default" }), "w-full justify-center gap-2 py-3 text-base font-semibold")
          : buttonVariants({ variant: "outline", size: "sm" })
      )}>
        <ClipboardCheck className={cn("h-4 w-4", prominent ? "text-amber-300" : "text-amber-500")} />
        {tr.trigger}
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-amber-500" /> {tr.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-xs text-muted-foreground">{tr.explain}</p>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                {tr.date_label}
              </label>
              <Input
                type="date"
                max={today}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (req) setReq(null);
                }}
                className="w-44"
              />
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleFillFromPlan}
              disabled={isCalculating}
              className="bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300"
            >
              {isCalculating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4 text-amber-500" />
              )}
              {tr.auto_calculate}
            </Button>
          </div>

          {req && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20 p-4 space-y-3 shadow-card">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-medium">
                <Wheat className="h-4 w-4" />
                {tr.requirement_for.replace("{{n}}", String(req.cattleCount))}
                <span className="rounded bg-amber-200/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide dark:bg-amber-900/60">
                  {tr.plan_label}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{tr.concentrate_needed}</span>
                  <span className="tabular-nums font-bold">{req.totalConcentrateKg.toFixed(1)} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">{tr.roughage_needed}</span>
                  <span className="tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                    {req.totalRoughageKg.toFixed(1)} kg
                  </span>
                </div>
                <div className="text-xs text-muted-foreground text-right tabular-nums col-start-1">
                  {tr.kg_selected.replace("{{n}}", enteredConcentrateKg.toFixed(1))}
                </div>
                <div className="text-xs text-muted-foreground text-right tabular-nums">
                  {roughageKgUnknown ? "kg unknown" : tr.kg_selected.replace("{{n}}", enteredRoughageKg.toFixed(1))}
                </div>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-[1fr_auto_auto] border-b border-border bg-muted/40 px-4 py-2 gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {tr.col_item}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">
                {tr.col_available}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right w-28">
                {tr.col_total}
              </span>
            </div>
            <div className="divide-y divide-border max-h-[40vh] overflow-y-auto scrollbar-thin">
              {feedItems.map((item) => {
                const isRoughage = item.category === "roughage";
                const plan = planByItem.get(item.id);
                const planUnknown = plan && plan.qty == null && req
                  ? tr.roughage_unknown_kg.replaceAll("{{unit}}", item.unit).replace("{{name}}", item.name)
                  : null;
                const planInUnits = plan?.qty ?? (isRoughage && req && item.is_active_roughage
                  ? kgToItemUnits(req.totalRoughageKg, item.unit, item.kg_per_unit)
                  : null);
                return (
                  <div key={item.id} className="px-4 py-2.5 hover:bg-muted/20 transition-colors">
                    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1 mt-0.5">
                          {isRoughage ? (
                            <span className="text-emerald-600 dark:text-emerald-400">{tr.tag_roughage}</span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">{tr.tag_concentrate}</span>
                          )}
                          {planInUnits != null && (
                            <span className="normal-case tracking-normal">
                              · {tr.plan_label}: {planInUnits.toFixed(2)} {item.unit}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className={cn(
                        "text-right text-sm tabular-nums",
                        item.stock < 0 ? "font-semibold text-rose-600 dark:text-rose-400" : "text-muted-foreground"
                      )}>
                        {item.stock.toFixed(1)} {item.unit}
                      </div>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0"
                          value={totals[item.id] ?? ""}
                          onChange={(e) =>
                            setTotals((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                          className="h-8 w-24 sm:w-28 text-right pr-12 font-semibold"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                          {item.unit}
                        </span>
                      </div>
                    </div>
                    {planUnknown && (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{planUnknown}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{tr.already_recorded_hint}</p>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            {tr.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {tr.saving}
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {tr.confirm}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

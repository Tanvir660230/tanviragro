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
import { Loader2, Zap, Sparkles, Wheat, CheckCircle2 } from "lucide-react";
import { dailyFeedDeduction, getFarmDailyFeedRequirement } from "@/app/dashboard/(app)/inventory/actions";
import type { InventoryRow } from "./InventoryTable";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/I18nProvider";

interface Props {
  feedItems: InventoryRow[];
  cattleCount: number;
  prominent?: boolean;
}

export function DailyFeedDeductButton({ feedItems, cattleCount, prominent = false }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const tr = t.inventory.daily_deduction;

  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
  const [date, setDate] = useState(today);
  const [totals, setTotals] = useState<Record<string, string>>({});
  const [reqData, setReqData] = useState<{ totalConcentrateKg: number; totalRoughageKg: number; cattleCount: number } | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  if (!feedItems.length || cattleCount === 0) return null;

  const roughageItems = feedItems.filter((i) => i.category === "roughage");
  const concentrateItems = feedItems.filter((i) => i.category !== "roughage");

  const handleCalculate = async () => {
    setIsCalculating(true);
    try {
      const res = await getFarmDailyFeedRequirement(date);
      if (res.error) {
        toast.error(res.error);
      } else if (res.data) {
        setReqData(res.data);
        // Auto-fill: distribute requirement equally among items of each category
        const newTotals: Record<string, string> = { ...totals };
        if (res.data.totalRoughageKg > 0 && roughageItems.length > 0) {
          const perItem = (res.data.totalRoughageKg / roughageItems.length).toFixed(1);
          for (const item of roughageItems) newTotals[item.id] = perItem;
        }
        if (res.data.totalConcentrateKg > 0 && concentrateItems.length > 0) {
          const perItem = (res.data.totalConcentrateKg / concentrateItems.length).toFixed(1);
          for (const item of concentrateItems) newTotals[item.id] = perItem;
        }
        setTotals(newTotals);
      }
    } catch {
      toast.error(tr.error_calc_failed);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSubmit = () => {
    const activeCattleCount = reqData?.cattleCount || cattleCount;
    if (activeCattleCount === 0) return;

    const entries = feedItems
      .filter((item) => {
        const v = parseFloat(totals[item.id] ?? "");
        return !isNaN(v) && v > 0;
      })
      .map((item) => ({
        item_id: item.id,
        qty_per_head: parseFloat(totals[item.id]) / activeCattleCount,
      }));

    if (!entries.length) {
      toast.error(tr.error_no_qty);
      return;
    }

    startTransition(async () => {
      const result = await dailyFeedDeduction(entries, activeCattleCount, date);
      if (result.error) {
        toast.error(result.error);
      } else {
        const detail = entries
          .map((e) => {
            const item = feedItems.find((i) => i.id === e.item_id);
            const total = (e.qty_per_head * activeCattleCount).toFixed(1);
            return `${total} ${item?.unit ?? ""} ${item?.name ?? ""}`;
          })
          .join(", ");
        toast.success(`${tr.success} — ${detail}`);
        setOpen(false);
        setTotals({});
        setReqData(null);
        router.refresh();
      }
    });
  };

  // Sum inputted by category (using actual category field — no keyword guessing)
  let inputtedConcentrate = 0;
  let inputtedRoughage = 0;
  for (const item of feedItems) {
    const v = parseFloat(totals[item.id] ?? "0");
    if (!isNaN(v) && v > 0) {
      if (item.category === "roughage") inputtedRoughage += v;
      else inputtedConcentrate += v;
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        setOpen(val);
        if (!val) { setTotals({}); setReqData(null); }
      }}
    >
      <DialogTrigger className={cn(
        prominent
          ? cn(buttonVariants({ variant: "default", size: "default" }), "w-full justify-center gap-2 py-3 text-base font-semibold")
          : buttonVariants({ variant: "outline", size: "sm" })
      )}>
        <Zap className={cn("h-4 w-4", prominent ? "text-amber-300" : "text-amber-500")} />
        {tr.trigger}
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" /> {tr.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                {tr.date_label}
              </label>
              <Input
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (reqData) setReqData(null);
                }}
                className="w-44"
              />
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleCalculate}
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

          {reqData && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20 p-4 space-y-4 shadow-card animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-medium">
                <Wheat className="h-4 w-4" />
                {tr.requirement_for.replace("{{n}}", String(reqData.cattleCount))}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{tr.concentrate_needed}</span>
                    <span className="tabular-nums font-bold">{reqData.totalConcentrateKg.toFixed(1)} kg</span>
                  </div>
                  <div className="h-2 rounded-full bg-border overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all",
                        inputtedConcentrate >= reqData.totalConcentrateKg - 0.5 &&
                          inputtedConcentrate <= reqData.totalConcentrateKg + 0.5
                          ? "bg-emerald-500"
                          : "bg-amber-500"
                      )}
                      style={{ width: `${Math.min(100, (inputtedConcentrate / (reqData.totalConcentrateKg || 1)) * 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground text-right tabular-nums">
                    {tr.kg_selected.replace("{{n}}", inputtedConcentrate.toFixed(1))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">{tr.roughage_needed}</span>
                    <span className="tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                      {reqData.totalRoughageKg.toFixed(1)} kg
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-border overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all bg-emerald-400",
                        inputtedRoughage >= reqData.totalRoughageKg - 0.5 &&
                          inputtedRoughage <= reqData.totalRoughageKg + 0.5
                          ? "bg-emerald-600"
                          : "bg-emerald-400 opacity-60"
                      )}
                      style={{ width: `${Math.min(100, (inputtedRoughage / (reqData.totalRoughageKg || 1)) * 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground text-right tabular-nums">
                    {tr.kg_selected.replace("{{n}}", inputtedRoughage.toFixed(1))}
                  </div>
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
                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-[1fr_auto_auto] items-center px-4 py-2.5 gap-3 hover:bg-muted/20 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1 mt-0.5">
                        {isRoughage ? (
                          <span className="text-emerald-600 dark:text-emerald-400">{tr.tag_roughage}</span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">{tr.tag_concentrate}</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right text-sm tabular-nums text-muted-foreground">
                      {item.stock.toFixed(1)} {item.unit}
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="0"
                        value={totals[item.id] ?? ""}
                        onChange={(e) =>
                          setTotals((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        className="h-8 w-24 sm:w-28 text-right pr-8 font-semibold"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                        {item.unit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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

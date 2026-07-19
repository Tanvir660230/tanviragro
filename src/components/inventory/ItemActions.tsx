"use client";

import React, { useActionState, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, PackagePlus, Minus, CalendarDays, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  addStock,
  logConsumption,
  setActiveRoughage,
  markInventoryItemEmpty,
  type InventoryFormState,
} from "@/app/dashboard/(app)/inventory/actions";
import { enqueue } from "@/lib/offlineQueue";
import { useTranslation } from "@/i18n/I18nProvider";

export interface CattleOption {
  id: string;
  tag_id: string;
}

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  category?: string;
  is_active_roughage?: boolean | null;
  stock?: number;
}

// ── Add Stock Dialog ─────────────────────────────────────────────────────────

function AddStockForm({
  item,
  formKey,
  onSuccess,
}: {
  item: InventoryItem;
  formKey: number;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const tr = t.inventory.actions;
  const today = new Date().toISOString().split("T")[0];
  const [state, formAction, isPending] = useActionState<InventoryFormState, FormData>(addStock, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success(tr.stock_added);
      onSuccess();
      router.refresh();
    }
    if (state?.error) toast.error(state.error);
  }, [state?.success, state?.error, onSuccess, router, tr.stock_added]);

  return (
    <form key={formKey} action={formAction} className="space-y-4 pt-1">
      <input type="hidden" name="item_id" value={item.id} />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="stk_date">{tr.date_label} *</Label>
          <Input
            id="stk_date"
            name="recorded_at"
            type="date"
            max={today}
            defaultValue={today}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stk_qty">
            {tr.qty_label.replace("{{unit}}", item.unit)} *
          </Label>
          <Input
            id="stk_qty"
            name="qty"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="e.g. 100"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="stk_cost">{tr.unit_cost_label.replace("{{unit}}", item.unit)}</Label>
        <Input
          id="stk_cost"
          name="unit_cost"
          type="number"
          min="0"
          step="0.01"
          placeholder="e.g. 45.50 (optional)"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="stk_notes">{tr.notes_label}</Label>
        <Textarea
          id="stk_notes"
          name="notes"
          placeholder="Supplier, invoice no. (optional)"
          rows={2}
          maxLength={500}
        />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <DialogFooter>
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{tr.saving}</>
          ) : (
            tr.add_stock
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

function AddStockDialog({ item }: { item: InventoryItem }) {
  const { t } = useTranslation();
  const tr = t.inventory.actions;
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setFormKey((k) => k + 1);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        className={buttonVariants({ size: "sm", variant: "outline" })}
        aria-label={tr.add_stock_title.replace("{{name}}", item.name)}
      >
        <PackagePlus className="mr-1.5 h-3.5 w-3.5" />
        {tr.add_stock}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{tr.add_stock_title.replace("{{name}}", item.name)}</DialogTitle>
        </DialogHeader>
        <AddStockForm item={item} formKey={formKey} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

// ── Log Consumption Dialog ────────────────────────────────────────────────────

function LogConsumptionForm({
  item,
  cattle,
  formKey,
  onSuccess,
  onOptimisticConsume,
}: {
  item: InventoryItem;
  cattle: CattleOption[];
  formKey: number;
  onSuccess: () => void;
  onOptimisticConsume?: (qty: number) => void;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const tr = t.inventory.actions;
  const today = new Date().toISOString().split("T")[0];
  const [cattleId, setCattleId] = useState("");
  const [state, formAction, isPending] = useActionState<InventoryFormState, FormData>(logConsumption, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success(tr.consumption_logged);
      onSuccess();
      router.refresh();
    }
    if (state?.error) toast.error(state.error);
  }, [state?.success, state?.error, onSuccess, router, tr.consumption_logged]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const qty = parseFloat(data.get("qty") as string);
    const recordedAt = (data.get("recorded_at") as string) || today;
    const notes = (data.get("notes") as string) || null;

    if (!isNaN(qty) && qty > 0) {
      onOptimisticConsume?.(qty);
    }

    if (!navigator.onLine) {
      onSuccess();
      enqueue({
        type: "consumption",
        item_id: item.id,
        qty: isNaN(qty) ? 0 : qty,
        cattle_id: cattleId || null,
        notes,
        recorded_at: recordedAt,
      }).then(() => toast.info(tr.queued_offline));
      return;
    }

    formAction(data);
  };

  return (
    <form key={formKey} onSubmit={handleSubmit} className="space-y-4 pt-1">
      <input type="hidden" name="item_id" value={item.id} />
      <input type="hidden" name="cattle_id" value={cattleId} />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="con_date">{tr.date_label} *</Label>
          <Input
            id="con_date"
            name="recorded_at"
            type="date"
            max={today}
            defaultValue={today}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="con_qty">
            {tr.used_label.replace("{{unit}}", item.unit)} *
          </Label>
          <Input
            id="con_qty"
            name="qty"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="e.g. 5"
            required
          />
        </div>
      </div>

      {cattle.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="con_cattle">{tr.link_cattle}</Label>
          <Select value={cattleId} onValueChange={(v) => setCattleId(v ?? "")}>
            <SelectTrigger id="con_cattle" className="w-full">
              <SelectValue placeholder={tr.all_cattle} />
            </SelectTrigger>
            <SelectContent>
              {cattle.map((c) => (
                <SelectItem key={c.id} value={c.id}>#{c.tag_id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{tr.fcr_hint}</p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="con_notes">{tr.notes_label}</Label>
        <Textarea
          id="con_notes"
          name="notes"
          placeholder="Morning / evening feed, etc. (optional)"
          rows={2}
          maxLength={500}
        />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <DialogFooter>
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{tr.saving}</>
          ) : (
            tr.log_consumption
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

function LogConsumptionDialog({
  item,
  cattle,
  onOptimisticConsume,
}: {
  item: InventoryItem;
  cattle: CattleOption[];
  onOptimisticConsume?: (qty: number) => void;
}) {
  const { t } = useTranslation();
  const tr = t.inventory.actions;
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setFormKey((k) => k + 1);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        className={buttonVariants({ size: "sm", variant: "ghost" })}
        aria-label={tr.log_use_title.replace("{{name}}", item.name)}
      >
        <Minus className="mr-1.5 h-3.5 w-3.5" />
        {tr.log_use}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{tr.log_use_title.replace("{{name}}", item.name)}</DialogTitle>
        </DialogHeader>
        <LogConsumptionForm
          item={item}
          cattle={cattle}
          formKey={formKey}
          onSuccess={() => setOpen(false)}
          onOptimisticConsume={onOptimisticConsume}
        />
      </DialogContent>
    </Dialog>
  );
}

// ── Combined cell ─────────────────────────────────────────────────────────────

export function ItemActions({
  item,
  cattle,
  onOptimisticConsume,
}: {
  item: InventoryItem;
  cattle: CattleOption[];
  onOptimisticConsume?: (qty: number) => void;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const tr = t.inventory.actions;
  const [isPending, startTransition] = React.useTransition();
  const [showRoughageDate, setShowRoughageDate] = useState(false);
  const [roughageUntilDate, setRoughageUntilDate] = useState("");
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [finishDate, setFinishDate] = useState(
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" })
  );

  function handleSetRoughage() {
    if (item.is_active_roughage) {
      startTransition(async () => {
        await setActiveRoughage(null);
        router.refresh();
      });
    } else {
      setShowRoughageDate(true);
      setRoughageUntilDate("");
    }
  }

  function confirmSetRoughage() {
    startTransition(async () => {
      await setActiveRoughage(item.id, roughageUntilDate || null);
      setShowRoughageDate(false);
      router.refresh();
    });
  }

  function doMarkEmpty() {
    setShowFinishDialog(false);
    startTransition(async () => {
      const res = await markInventoryItemEmpty(item.id, finishDate);
      if (res.error) {
        toast.error(res.error);
      } else {
        if (res.cattleCount && res.cattleCount > 0) {
          toast.success(tr.finished_success
            .replace("{{name}}", item.name)
            .replace("{{n}}", String(res.cattleCount)));
        } else {
          toast.success(tr.marked_empty.replace("{{name}}", item.name));
        }
        if (onOptimisticConsume && item.stock) onOptimisticConsume(item.stock);
      }
      router.refresh();
    });
  }

  const [today, yesterday, tomorrow] = useMemo(() => {
     
    const now = new Date().getTime();
    return [
      new Date(now).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }),
      new Date(now - 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }),
      new Date(now + 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }),
    ];
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-1.5 justify-end">
      {(item.category === "feed" || item.category === "roughage") && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSetRoughage}
            disabled={isPending}
            className={cn(
              "h-8 px-2 text-xs",
              item.is_active_roughage
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-400"
                : "text-muted-foreground hover:text-foreground"
            )}
            title={item.is_active_roughage ? tr.active_roughage : tr.set_as_roughage}
          >
            {item.is_active_roughage ? tr.active_roughage : tr.set_roughage}
          </Button>
          {showRoughageDate && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                type="date"
                value={roughageUntilDate}
                onChange={(e) => setRoughageUntilDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="text-xs rounded border border-border bg-background px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button type="button" size="sm" className="h-7 text-xs px-2" onClick={confirmSetRoughage} disabled={isPending}>
                {tr.activate}
              </Button>
              <button type="button" onClick={() => setShowRoughageDate(false)} className="text-xs text-muted-foreground hover:text-foreground">
                {tr.cancel}
              </button>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setFinishDate(today);
              setShowFinishDialog(true);
            }}
            disabled={isPending || (item.stock !== undefined && item.stock <= 0)}
            className="h-8 px-2 text-xs text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-900 dark:hover:bg-amber-950/50"
            title={tr.finished_title}
          >
            {tr.finished}
          </Button>
        </>
      )}

      <AddStockDialog item={item} />
      <LogConsumptionDialog item={item} cattle={cattle} onOptimisticConsume={onOptimisticConsume} />

      {/* Mark Finished — date-picker dialog */}
      {showFinishDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowFinishDialog(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl bg-card p-6 shadow-floating border border-border/60 space-y-4">
            <div>
              <h2 className="text-base font-semibold">{tr.finished_dialog_title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {item.stock !== undefined
                  ? tr.finished_stock_remaining.replace("{{qty}}", item.stock.toFixed(2)).replace("{{unit}}", item.unit)
                  : item.name}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{tr.finished_date_label}</label>
              {/* Quick-pick buttons */}
              <div className="flex gap-2">
                {[
                  { label: tr.finished_yesterday, value: yesterday },
                  { label: tr.finished_today, value: today },
                  { label: tr.finished_tomorrow, value: tomorrow },
                ].map(({ label, value }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFinishDate(value)}
                    className={cn(
                      "flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                      finishDate === value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {/* Custom date input */}
              <input
                type="date"
                value={finishDate}
                max={tomorrow}
                onChange={(e) => setFinishDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <p className="text-xs text-muted-foreground">{tr.finished_cost_note}</p>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setShowFinishDialog(false)}>
                {tr.cancel}
              </Button>
              <Button
                size="sm"
                disabled={isPending || !finishDate}
                onClick={doMarkEmpty}
                className="gap-1.5"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {tr.finished_confirm}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Loader2, Minus, CircleStop, Receipt, Sprout } from "lucide-react";
import { toast } from "sonner";
import {
  addStock,
  logConsumption,
  type InventoryFormState,
} from "@/app/dashboard/(app)/inventory/actions";
import { enqueue } from "@/lib/offlineQueue";
import { useTranslation } from "@/i18n/I18nProvider";
import { todayDhaka } from "@/lib/dates";
import { useL } from "@/i18n/text";

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

/**
 * Stock harvested from the farm's own / leased land (৳0 — the land rent is an expense).
 * A PURCHASE is never entered here: it goes through the purchase memo (supplier, payment,
 * dues and purchase history), reached with the "Buy" button.
 */
function OwnStockForm({
  item,
  formKey,
  onSuccess,
}: {
  item: InventoryItem;
  formKey: number;
  onSuccess: () => void;
}) {
  const L = useL();
  const router = useRouter();
  const { t } = useTranslation();
  const tr = t.inventory.actions;
  const today = todayDhaka();
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
      <input type="hidden" name="stock_source" value="own_production" />
      <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        {L("নিজের / ভাড়া জমি থেকে কাটা — দাম ৳0 ধরা হবে, জমির ভাড়া আলাদা খরচ। কেনা হলে \"কিনুন\" দিন।", "Harvested from own / leased land — counted at ৳0; the land rent is an expense. If you bought it, use \"Buy\".")}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="stk_date">{tr.date_label} *</Label>
          <Input id="stk_date" name="recorded_at" type="date" max={today} defaultValue={today} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stk_qty">{tr.qty_label.replace("{{unit}}", item.unit)} *</Label>
          <Input id="stk_qty" name="qty" type="number" min="0.01" step="0.01" placeholder="e.g. 100" required />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="stk_notes">{tr.notes_label}</Label>
        <Textarea id="stk_notes" name="notes" placeholder={L("কোন জমি (ঐচ্ছিক)", "Which field (optional)")} rows={2} maxLength={500} />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      <DialogFooter>
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{tr.saving}</>) : tr.add_stock}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Opened by its own button, or controlled (open / onOpenChange) from a menu — then no button. */
export function OwnStockDialog({ item, open: openProp, onOpenChange }: { item: InventoryItem; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const L = useL();
  const controlled = openProp !== undefined;
  const [openState, setOpenState] = useState(false);
  const open = controlled ? openProp : openState;
  const [formKey, setFormKey] = useState(0);
  const handleOpenChange = (next: boolean) => {
    if (controlled) onOpenChange?.(next); else setOpenState(next);
    if (next) setFormKey((k) => k + 1);
  };
  const title = L(`${item.name} — নিজের জমি থেকে`, `${item.name} — from own land`);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!controlled && (
        <DialogTrigger className={buttonVariants({ size: "sm", variant: "outline" })} aria-label={title}>
          <Sprout className="mr-1.5 h-3.5 w-3.5" />
          {L("নিজের জমি", "Own land")}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <OwnStockForm item={item} formKey={formKey} onSuccess={() => handleOpenChange(false)} />
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
  const L = useL();
  const router = useRouter();
  const { t } = useTranslation();
  const tr = t.inventory.actions;
  const today = todayDhaka();
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
          placeholder={L("সকাল / বিকেলের খাবার ইত্যাদি (ঐচ্ছিক)", "Morning / evening feed, etc. (optional)")}
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

/** Opened by its own button, or controlled (open / onOpenChange) from a menu — then no button. */
export function LogConsumptionDialog({
  item,
  cattle,
  onOptimisticConsume,
  open: openProp,
  onOpenChange,
}: {
  item: InventoryItem;
  cattle: CattleOption[];
  onOptimisticConsume?: (qty: number) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const tr = t.inventory.actions;
  const controlled = openProp !== undefined;
  const [openState, setOpenState] = useState(false);
  const open = controlled ? openProp : openState;
  const [formKey, setFormKey] = useState(0);
  const handleOpenChange = (next: boolean) => {
    if (controlled) onOpenChange?.(next); else setOpenState(next);
    if (next) setFormKey((k) => k + 1);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!controlled && (
        <DialogTrigger
          className={buttonVariants({ size: "sm", variant: "ghost" })}
          aria-label={tr.log_use_title.replace("{{name}}", item.name)}
        >
          <Minus className="mr-1.5 h-3.5 w-3.5" />
          {tr.log_use}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{tr.log_use_title.replace("{{name}}", item.name)}</DialogTitle>
        </DialogHeader>
        <LogConsumptionForm
          item={item}
          cattle={cattle}
          formKey={formKey}
          onSuccess={() => handleOpenChange(false)}
          onOptimisticConsume={onOptimisticConsume}
        />
      </DialogContent>
    </Dialog>
  );
}

// ── Combined cell ─────────────────────────────────────────────────────────────

/**
 * The actions of one stock row, each shown only to someone allowed to do it.
 * "Finished" opens the stock list's finish dialog (fed since a date / used / lost) — the one
 * way to finish an item, the same as finishing several at once.
 */
export function ItemActions({
  item,
  cattle,
  onOptimisticConsume,
  canPurchase = false,
  canConsume = false,
  onFinish,
}: {
  item: InventoryItem;
  cattle: CattleOption[];
  onOptimisticConsume?: (qty: number) => void;
  canPurchase?: boolean;
  canConsume?: boolean;
  /** shown when the item has stock (or is in use) and the viewer may finish it */
  onFinish?: () => void;
}) {
  const L = useL();
  const isFeed = item.category === "feed" || item.category === "roughage";

  return (
    <div className="flex flex-wrap items-center gap-1.5 justify-end">
      {onFinish && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onFinish}
          className="h-8 px-2 text-xs text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-900 dark:hover:bg-amber-950/50"
        >
          <CircleStop className="mr-1.5 h-3.5 w-3.5" />
          {L("শেষ হয়েছে", "Finished")}
        </Button>
      )}

      {canPurchase && (
        <Link
          href={`/dashboard/inventory/purchase?item=${item.id}`}
          className={buttonVariants({ size: "sm", variant: "outline" })}
        >
          <Receipt className="mr-1.5 h-3.5 w-3.5" />
          {L("কিনুন", "Buy")}
        </Link>
      )}
      {canPurchase && isFeed && <OwnStockDialog item={item} />}
      {canConsume && <LogConsumptionDialog item={item} cattle={cattle} onOptimisticConsume={onOptimisticConsume} />}
    </div>
  );
}

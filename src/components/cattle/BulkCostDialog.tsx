"use client";

import { useActionState, useState, useEffect } from "react";
import { Banknote, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createBulkCost, type BulkCostFormState } from "@/app/dashboard/(app)/cattle/actions";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/I18nProvider";

interface CattleOption {
  id: string;
  tag_id: string;
}

interface Props {
  activeCattle: CattleOption[];
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}

const COST_CATEGORY_VALUES = ["doctor_fee", "medicine", "transport", "labor", "other"] as const;
type CostCategoryValue = typeof COST_CATEGORY_VALUES[number];

export function BulkCostDialog({ activeCattle, open: externalOpen, onOpenChange: externalOnChange }: Props) {
  const { t } = useTranslation();
  const cc = t.cattle_details.cost_categories as Record<CostCategoryValue, string>;
  const sm = t.cattle_details.smart;
  const costCategories = COST_CATEGORY_VALUES.map((v) => ({ value: v, label: cc[v] }));
  const [internalOpen, setInternalOpen] = useState(false);
  const open    = externalOpen    ?? internalOpen;
  const setOpen = externalOnChange ?? setInternalOpen;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState<CostCategoryValue>("doctor_fee");
  const [amount, setAmount] = useState("");
  const [state, action, isPending] = useActionState<BulkCostFormState, FormData>(
    createBulkCost,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(sm.batch_cost_success);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
       
      setSelectedIds(new Set());
       
      setAmount("");
       
      setCategory("doctor_fee");
    }
    if (state?.error) toast.error(state.error);
  }, [state, sm.batch_cost_success]);

  function toggleAll() {
    if (selectedIds.size === activeCattle.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeCattle.map((c) => c.id)));
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = selectedIds.size === activeCattle.length && activeCattle.length > 0;
  
  const parsedAmount = parseFloat(amount);
  const amountPerCow = !isNaN(parsedAmount) && selectedIds.size > 0 
    ? (parsedAmount / selectedIds.size).toFixed(2) 
    : "0.00";

  if (activeCattle.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!externalOnChange && (
        <DialogTrigger className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3">
          <Banknote className="h-4 w-4 text-amber-600 dark:text-amber-500" />
          {t.cattle_details?.smart?.bulk_cost || "Batch Cost"}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.cattle_details?.smart?.bulk_cost_title || "Add Batch Cost"}</DialogTitle>
        </DialogHeader>

        <form action={action} className="space-y-4">
          <input type="hidden" name="cattle_ids" value={[...selectedIds].join(",")} />
          <input type="hidden" name="category" value={category} />

          {/* Cattle selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {sm.select_cattle} ({sm.cattle_selected.replace("{{n}}", String(selectedIds.size))})
              </Label>
              <button
                type="button"
                onClick={toggleAll}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {allSelected ? (
                  <><CheckSquare className="h-3.5 w-3.5" />{t.cattle_details?.smart?.deselect_all || "Deselect All"}</>
                ) : (
                  <><Square className="h-3.5 w-3.5" />{t.cattle_details?.smart?.select_all || "Select All"}</>
                )}
              </button>
            </div>
            <div className="max-h-52 overflow-y-auto rounded-lg border border-border p-2 space-y-1 bg-muted/20">
              {activeCattle.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(c.id)}
                    onChange={() => toggleOne(c.id)}
                    className="accent-primary"
                  />
                  <span className="font-medium">#{c.tag_id}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Total Amount */}
            <div className="space-y-1.5">
              <Label htmlFor="bc_amount">{sm.total_amount_label} *</Label>
              <Input
                id="bc_amount"
                name="amount"
                type="number"
                min="1"
                step="0.01"
                placeholder="e.g. 1000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            {/* Event type */}
            <div className="space-y-1.5">
              <Label>{sm.cost_category_label}</Label>
              <Select value={category} onValueChange={(val) => { if (val !== null) setCategory(val as CostCategoryValue); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {costCategories.map((et) => (
                    <SelectItem key={et.value} value={et.value}>
                      {et.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Calculator helper */}
          {selectedIds.size > 0 && !isNaN(parsedAmount) && parsedAmount > 0 && (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 p-3 text-sm text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
              <span>{sm.dividing_among.replace("{{n}}", String(selectedIds.size))}</span>
              <span className="font-bold">{sm.per_cattle.replace("{{amount}}", amountPerCow)}</span>
            </div>
          )}

          {/* Scheduled date */}
          <div className="space-y-1.5">
            <Label htmlFor="bc_date">
              {t.cattle_details?.health?.scheduled_date || "Date"} *
            </Label>
            <Input 
              id="bc_date" 
              name="recorded_at" 
              type="date" 
              max={new Date().toISOString().slice(0, 10)}
              defaultValue={new Date().toISOString().split("T")[0]}
              required 
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="bc_notes">{t.cattle_details?.dialogs?.notes || "Notes (Optional)"}</Label>
            <Textarea
              id="bc_notes"
              name="description"
              placeholder="e.g. Paid Dr. Anis for checkup and deworming"
              rows={2}
              maxLength={500}
            />
          </div>

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t.cattle_details?.dialogs?.cancel || "Cancel"}
            </Button>
            <Button
              type="submit"
              disabled={isPending || selectedIds.size === 0 || isNaN(parsedAmount)}
            >
              {isPending ? sm.scheduling : sm.save_cost}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

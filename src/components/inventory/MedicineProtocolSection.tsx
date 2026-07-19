"use client";

import { useActionState, useEffect, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Pill, Loader2, Trash2, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  upsertMedicineProtocol,
  deleteMedicineProtocol,
  type MedicineProtocolState,
} from "@/app/dashboard/(app)/inventory/recipe-actions";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useTranslation } from "@/i18n/I18nProvider";

type InventoryItem = { id: string; name: string; unit: string; category?: string };
type Protocol = {
  item_id: string;
  dose_per_100kg_weight: number;
  frequency_days: number | null;
  notes: string | null;
};

function MedForm({
  items,
  existing,
  formKey,
}: {
  items: InventoryItem[];
  existing: Protocol[];
  formKey: number;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const tr = t.inventory.medicine;
  const [itemId, setItemId] = useState("");
  const [cattleWeightKg, setCattleWeight] = useState("");
  const [state, formAction, isPending] = useActionState<MedicineProtocolState, FormData>(
    upsertMedicineProtocol, undefined
  );

  useEffect(() => {
    if (state?.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItemId("");
      setCattleWeight("");
      router.refresh();
    }
  }, [state?.success, router]);

  const existing_protocol = existing.find((p) => p.item_id === itemId);
  const selectedItem = items.find((i) => i.id === itemId);

  const calculatedDose = existing_protocol && parseFloat(cattleWeightKg) > 0
    ? ((existing_protocol.dose_per_100kg_weight / 100) * parseFloat(cattleWeightKg))
    : null;

  return (
    <form key={formKey} action={formAction} className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
      <input type="hidden" name="item_id" value={itemId} />

      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {tr.add_update}
      </p>

      <div className="space-y-1.5">
        <Label>{tr.medicine_item} *</Label>
        <Select value={itemId} onValueChange={(v) => setItemId(v ?? "")}>
          <SelectTrigger><SelectValue placeholder={tr.select_medicine} /></SelectTrigger>
          <SelectContent>
            {items
              .filter((i) => !i.category || i.category === "medicine")
              .map((i) => (
                <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
              ))}
          </SelectContent>
        </Select>
        {existing_protocol && (
          <p className="text-xs text-amber-600 dark:text-amber-400">{tr.protocol_exists}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="dose">
            {tr.dose_label} *
            {selectedItem && <span className="ml-1 text-muted-foreground">({selectedItem.unit})</span>}
          </Label>
          <Input
            id="dose"
            name="dose_per_100kg_weight"
            type="number"
            min="0.0001"
            step="0.0001"
            defaultValue={existing_protocol?.dose_per_100kg_weight?.toString() ?? ""}
            placeholder="e.g. 10"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="freq">{tr.freq_label}</Label>
          <Input
            id="freq"
            name="frequency_days"
            type="number"
            min="1"
            step="1"
            defaultValue={existing_protocol?.frequency_days?.toString() ?? ""}
            placeholder={tr.freq_placeholder}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="med_notes">{tr.notes_label}</Label>
        <Input
          id="med_notes"
          name="notes"
          defaultValue={existing_protocol?.notes ?? ""}
          placeholder="e.g. Mix with water, administer after morning feed…"
        />
      </div>

      {itemId && (
        <div className="rounded-lg bg-muted/40 border border-border p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Calculator className="h-3.5 w-3.5" />
            {tr.dose_calculator}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="1"
              step="1"
              placeholder={tr.weight_placeholder}
              value={cattleWeightKg}
              onChange={(e) => setCattleWeight(e.target.value)}
              className="max-w-[160px]"
            />
            {calculatedDose !== null ? (
              <p className="text-sm font-medium">
                = <span className="text-primary">{calculatedDose.toFixed(2)} {selectedItem?.unit}</span>
              </p>
            ) : existing_protocol ? (
              <p className="text-xs text-muted-foreground">{tr.enter_weight}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{tr.save_first}</p>
            )}
          </div>
        </div>
      )}

      {state?.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" disabled={isPending || !itemId} size="sm" className="w-full">
        {isPending
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{tr.saving}</>
          : existing_protocol ? tr.update_protocol : tr.save_protocol}
      </Button>
    </form>
  );
}

export function MedicineProtocolSection({
  protocols,
  items,
}: {
  protocols: Protocol[];
  items: InventoryItem[];
}) {
  const { t } = useTranslation();
  const tr = t.inventory.medicine;
  const [isPending, startTransition] = useTransition();
  const [formKey, setFormKey] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const router = useRouter();

  function itemName(id: string) { return items.find((i) => i.id === id)?.name ?? id; }
  function itemUnit(id: string) { return items.find((i) => i.id === id)?.unit ?? ""; }

  function handleDelete() {
    if (!confirmDeleteId) return;
    const item_id = confirmDeleteId;
    setConfirmDeleteId(null);
    startTransition(async () => {
      await deleteMedicineProtocol(item_id);
      setFormKey((k) => k + 1);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Pill className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">{tr.title}</h2>
        {protocols.length > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {protocols.length}
          </span>
        )}
      </div>

      <MedForm items={items} existing={protocols} formKey={formKey} />

      {protocols.length > 0 && (
        <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {protocols.map((p) => {
            const unit = itemUnit(p.item_id);
            return (
              <div key={p.item_id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <div className="flex-1">
                  <p className="font-medium">{itemName(p.item_id)}</p>
                  {p.notes && <p className="text-xs text-muted-foreground mt-0.5">{p.notes}</p>}
                </div>
                <div className="text-right text-xs text-muted-foreground shrink-0">
                  <p>{tr.dose_per
                    .replace("{{dose}}", String(p.dose_per_100kg_weight))
                    .replace("{{unit}}", unit)}</p>
                  {p.frequency_days
                    ? <p>{tr.every_n_days.replace("{{n}}", String(p.frequency_days))}</p>
                    : <p>{tr.one_time}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(p.item_id)}
                  disabled={isPending}
                  className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {protocols.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">{tr.no_protocols}</p>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title={tr.confirm_delete_title}
        description={tr.confirm_delete_desc}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}

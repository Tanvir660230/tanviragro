"use client";

import { useState, useTransition, useOptimistic, useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Syringe, Plus, X, Loader2, FlaskConical } from "lucide-react";
import { DataPagination, DateRangeFilter } from "@/components/ui/data-pagination";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { administerMedicine, type CattleTreatment } from "@/app/dashboard/(app)/cattle/medical-actions";
import { useTranslation } from "@/i18n/I18nProvider";

type MedicineItem = { id: string; name: string; unit: string };
type Protocol = { item_id: string; dose_per_100kg_weight: number; frequency_days: number | null; notes: string | null };

interface Props {
  cattleId: string;
  currentWeightKg: number;
  medicineItems: MedicineItem[];
  protocols: Protocol[];
  initialTreatments: CattleTreatment[];
}

const bdt = (n: number) => `৳${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka",  day: "numeric", month: "short", year: "numeric" });

type OptimisticTreatment = CattleTreatment & { pending?: boolean };

export function MedicalHistoryTab({ cattleId, currentWeightKg, medicineItems, protocols, initialTreatments }: Props) {
  const { t } = useTranslation();
  const tr = t.cattle_details.treatment;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [page, setPage]         = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");

  const [optimisticTreatments, addOptimistic] = useOptimistic(
    initialTreatments as OptimisticTreatment[],
    (state, newTreatment: OptimisticTreatment) => [newTreatment, ...state]
  );

  // Form state
  const today = new Date().toISOString().split("T")[0];
  const [selectedMedicine, setSelectedMedicine] = useState("");
  const [dose, setDose] = useState("");
  const [doseUnit, setDoseUnit] = useState("ml");
  const [vetFee, setVetFee] = useState("");
  const [additionalCost, setAdditionalCost] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(today);

  // Auto-fill dose when medicine + weight available
  const selectedProtocol = protocols.find((p) => p.item_id === selectedMedicine);
  const suggestedDose = selectedProtocol
    ? parseFloat(((selectedProtocol.dose_per_100kg_weight / 100) * currentWeightKg).toFixed(3))
    : null;

  function handleMedicineChange(id: string) {
    setSelectedMedicine(id);
    const proto = protocols.find((p) => p.item_id === id);
    if (proto) {
      const calc = (proto.dose_per_100kg_weight / 100) * currentWeightKg;
      setDose(calc.toFixed(3));
    } else {
      setDose("");
    }
  }

  function resetForm() {
    setSelectedMedicine("");
    setDose("");
    setDoseUnit("ml");
    setVetFee("");
    setAdditionalCost("");
    setDiagnosis("");
    setNotes("");
    setDate(today);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("cattle_id", cattleId);
    fd.set("medicine_item_id", selectedMedicine);
    fd.set("dose_administered", dose);
    fd.set("dose_unit", doseUnit);
    fd.set("vet_fee", vetFee || "0");
    fd.set("additional_medical_cost", additionalCost || "0");
    fd.set("diagnosis", diagnosis);
    fd.set("notes", notes);
    fd.set("treated_at", date);

    const med = medicineItems.find((m) => m.id === selectedMedicine);
    const vetAmt = parseFloat(vetFee) || 0;
    const addAmt = parseFloat(additionalCost) || 0;

    startTransition(async () => {
      // Optimistic update
      const optimistic: OptimisticTreatment = {
        id: `optimistic-${Date.now()}`,
        cattle_id: cattleId,
        medicine_item_id: selectedMedicine || null,
        dose_administered: dose ? parseFloat(dose) : null,
        dose_unit: doseUnit,
        vet_fee: vetAmt,
        additional_medical_cost: addAmt,
        diagnosis: diagnosis || null,
        notes: notes || null,
        treated_at: date,
        created_at: new Date().toISOString(),
        inventory_items: med ? { name: med.name, unit: med.unit } : null,
        pending: true,
      };
      addOptimistic(optimistic);
      setOpen(false);
      resetForm();

      const result = await administerMedicine(undefined, fd);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(tr.saved);
        router.refresh();
      }
    });
  }

  const filteredTreatments = optimisticTreatments.filter((t) => {
    const d = t.treated_at.slice(0, 10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo   && d > dateTo)   return false;
    return true;
  });
  const displayTreatments = filteredTreatments.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="rounded-xl bg-card border border-border shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-border bg-red-50/40 dark:bg-red-950/10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10">
            <Syringe className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-sm font-semibold">{tr.history_title}</h2>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className={cn(buttonVariants({ size: "sm", variant: "outline" }), "h-7 text-xs px-2.5 gap-1")}>
            <Plus className="h-3.5 w-3.5" />
            {tr.administer}
          </DialogTrigger>

          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-primary" />
                {tr.administer}
              </DialogTitle>
            </DialogHeader>

            <form id="med-form" onSubmit={handleSubmit} className="space-y-4 py-1">
              {/* Medicine selector */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Medicine Item</label>
                {medicineItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No medicine items in inventory. Add medicine items in Inventory first.</p>
                ) : (
                  <select
                    value={selectedMedicine}
                    onChange={(e) => handleMedicineChange(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">— Select medicine (optional) —</option>
                    {medicineItems.map((m) => {
                      const proto = protocols.find((p) => p.item_id === m.id);
                      return (
                        <option key={m.id} value={m.id}>
                          {m.name}{proto ? ` (${((proto.dose_per_100kg_weight / 100) * currentWeightKg).toFixed(2)} ${m.unit} suggested)` : ""}
                        </option>
                      );
                    })}
                  </select>
                )}
                {selectedProtocol && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    Protocol: {selectedProtocol.dose_per_100kg_weight} {doseUnit}/100 kg — suggested dose for {currentWeightKg} kg = <strong>{suggestedDose} {doseUnit}</strong>
                    {selectedProtocol.frequency_days && ` · every ${selectedProtocol.frequency_days} days`}
                  </p>
                )}
              </div>

              {/* Dose + unit */}
              {selectedMedicine && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Dose Administered</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      placeholder="0.000"
                      value={dose}
                      onChange={(e) => setDose(e.target.value)}
                      required={!!selectedMedicine}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Unit</label>
                    <Input
                      type="text"
                      placeholder="ml"
                      value={doseUnit}
                      onChange={(e) => setDoseUnit(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Diagnosis */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Diagnosis / Condition</label>
                <Input
                  type="text"
                  placeholder="e.g. FMD, worm treatment, vitamin injection"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                />
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Treatment Date</label>
                <Input
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              {/* Vet costs */}
              <div className="rounded-lg bg-muted/40 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Medical Costs (optional — recorded in Finance)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Vet/Doctor Fee ৳</label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={vetFee}
                      onChange={(e) => setVetFee(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Additional Costs ৳</label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={additionalCost}
                      onChange={(e) => setAdditionalCost(e.target.value)}
                    />
                  </div>
                </div>
                {(parseFloat(vetFee) > 0 || parseFloat(additionalCost) > 0) && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Total {bdt((parseFloat(vetFee) || 0) + (parseFloat(additionalCost) || 0))} will be logged as Variable Cost → Medical/Vet Fee
                  </p>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Notes (optional)</label>
                <Input
                  type="text"
                  placeholder="Any additional observations"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </form>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => { setOpen(false); resetForm(); }}>
                Cancel
              </Button>
              <Button type="submit" form="med-form" disabled={isPending}>
                {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Save Treatment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="px-4 sm:px-5 py-4 space-y-4">
      {/* Treatment history */}
      {optimisticTreatments.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 py-10 text-center">
          <Syringe className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{tr.none_yet}</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border">
            {/* Date filter */}
            <div className="border-b border-border bg-muted/20 px-4 py-2.5">
              <DateRangeFilter
                from={dateFrom}
                to={dateTo}
                onFromChange={(v) => { setDateFrom(v); setPage(0); }}
                onToChange={(v)   => { setDateTo(v);   setPage(0); }}
                onClear={() => { setDateFrom(""); setDateTo(""); setPage(0); }}
                filteredCount={filteredTreatments.length}
                totalCount={optimisticTreatments.length}
              />
            </div>
            <div className="hidden grid-cols-[auto_1fr_auto_auto_auto] gap-3 border-b border-border bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
              <span>Date</span>
              <span>Medicine / Diagnosis</span>
              <span className="text-right">Dose</span>
              <span className="text-right">Vet Fee</span>
              <span className="text-right">Add. Cost</span>
            </div>
            <div className="divide-y divide-border">
              {displayTreatments.map((t) => (
                <div
                  key={t.id}
                  className={`px-4 py-3 text-sm ${t.pending ? "opacity-60" : ""}`}
                >
                  {/* Mobile layout */}
                  <div className="sm:hidden space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{fmtDate(t.treated_at)}</span>
                      {(t.vet_fee + t.additional_medical_cost) > 0 && (
                        <span className="text-xs text-amber-600 font-medium">
                          {bdt(t.vet_fee + t.additional_medical_cost)} cost
                        </span>
                      )}
                    </div>
                    {t.inventory_items && (
                      <p className="text-muted-foreground">
                        {t.inventory_items.name}
                        {t.dose_administered && ` · ${t.dose_administered} ${t.dose_unit}`}
                      </p>
                    )}
                    {t.diagnosis && <p className="text-muted-foreground italic">{t.diagnosis}</p>}
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden sm:grid grid-cols-[auto_1fr_auto_auto_auto] items-start gap-3">
                    <span className="tabular-nums text-muted-foreground whitespace-nowrap">
                      {fmtDate(t.treated_at)}
                    </span>
                    <div className="min-w-0">
                      {t.inventory_items && (
                        <p className="font-medium truncate">{t.inventory_items.name}</p>
                      )}
                      {t.diagnosis && (
                        <p className="text-xs text-muted-foreground truncate italic">{t.diagnosis}</p>
                      )}
                      {!t.inventory_items && !t.diagnosis && (
                        <p className="text-muted-foreground italic text-xs">No medicine — vet visit only</p>
                      )}
                    </div>
                    <span className="tabular-nums text-right whitespace-nowrap">
                      {t.dose_administered ? `${t.dose_administered} ${t.dose_unit}` : "—"}
                    </span>
                    <span className="tabular-nums text-right whitespace-nowrap">
                      {t.vet_fee > 0 ? bdt(t.vet_fee) : "—"}
                    </span>
                    <span className="tabular-nums text-right whitespace-nowrap">
                      {t.additional_medical_cost > 0 ? bdt(t.additional_medical_cost) : "—"}
                    </span>
                  </div>
                  {t.notes && (
                    <p className="mt-1 text-xs text-muted-foreground">{t.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {filteredTreatments.length === 0 && (dateFrom || dateTo) && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">{tr.none_in_range}</p>
          )}
          <div className="px-4 pb-3 pt-1">
            <DataPagination
              total={filteredTreatments.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
            />
          </div>

          {/* Summary totals */}
          {optimisticTreatments.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Treatments</p>
                <p className="mt-0.5 text-lg font-bold">{optimisticTreatments.length}</p>
              </div>
              <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Vet Fees</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums">
                  {bdt(optimisticTreatments.reduce((s, t) => s + t.vet_fee, 0))}
                </p>
              </div>
              <div className="rounded-lg bg-muted/30 p-2.5 text-center col-span-2 sm:col-span-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Medical Cost</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
                  {bdt(optimisticTreatments.reduce((s, t) => s + t.vet_fee + t.additional_medical_cost, 0))}
                </p>
              </div>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}

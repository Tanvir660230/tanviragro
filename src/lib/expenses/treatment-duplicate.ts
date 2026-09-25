/**
 * The old medical form saved every vet fee twice: a treatment row AND a "Medical/Vet Fee" cost
 * entry for the same money. Correction C14 moved the duplicates to the trash; the treatment row
 * is the one record of that payment. Restoring such a cost entry would take the money out of
 * cash a second time, so the trash explains it and does not offer a restore.
 */
export type VetCostEntry = { category: string; amount: number | string; recorded_at: string; cattle_id?: string | null; description?: string | null };
export type TreatmentFee = { cattle_id: string; vet_fee: number | string | null; additional_medical_cost: number | string | null; treated_at: string; tag?: string | null };

export function isTreatmentDuplicate(entry: VetCostEntry, treatments: TreatmentFee[]): TreatmentFee | null {
  if (entry.category !== "Medical/Vet Fee") return null;
  const amount = Number(entry.amount);
  const date = String(entry.recorded_at).slice(0, 10);
  return treatments.find((t) => {
    const fee = Number(t.vet_fee ?? 0) + Number(t.additional_medical_cost ?? 0);
    if (Math.abs(fee - amount) > 0.005 || String(t.treated_at).slice(0, 10) !== date) return false;
    if (entry.cattle_id) return entry.cattle_id === t.cattle_id;
    return !!t.tag && (entry.description ?? "").includes(`#${t.tag}`);
  }) ?? null;
}

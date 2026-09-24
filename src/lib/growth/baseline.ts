/**
 * Growth baseline: which weight growth (gain, ADG) is measured FROM.
 *
 * A weight is either MEASURED (scale/tape) or ESTIMATED (a guess). Growth compares two
 * measurements; an estimate is never a starting point, because the difference between a
 * guess and a later weighing is not growth (e.g. C006: 250 kg guessed, 210 kg weighed —
 * that is not a 40 kg loss). Rules:
 *   - initial weight measured / unknown (legacy)  → baseline = initial weight at purchase
 *   - initial weight estimated                   → baseline = first MEASURED weight log
 *   - estimated weight logs are never baselines or end points
 * Nothing is overwritten: the estimate stays on record and is shown, labelled.
 */
import type { InitialWeightType, WeightType } from "@/types/database";

export type WeightPoint = { weight_kg: number | string; recorded_at: string; weight_type?: WeightType | null };
export type InitialWeight = {
  initial_weight_kg: number | string | null;
  initial_weight_type?: InitialWeightType | null;
  purchase_date: string | null;
};
export type Baseline = { weightKg: number; date: string; source: "initial" | "first_measurement" };

export function isMeasured(p: { weight_type?: WeightType | null }): boolean {
  return (p.weight_type ?? "measured") === "measured";
}

/** Measured logs, oldest first. */
export function measuredLogs<T extends WeightPoint>(logs: T[]): T[] {
  return logs.filter(isMeasured).sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
}

export function growthBaseline(c: InitialWeight, logs: WeightPoint[]): Baseline | null {
  const initial = Number(c.initial_weight_kg);
  if (c.initial_weight_type !== "estimated" && initial > 0 && c.purchase_date) {
    return { weightKg: initial, date: c.purchase_date.slice(0, 10), source: "initial" };
  }
  const first = measuredLogs(logs)[0];
  return first ? { weightKg: Number(first.weight_kg), date: first.recorded_at.slice(0, 10), source: "first_measurement" } : null;
}

/**
 * Measured growth between the baseline and the latest measured weight.
 * null when there are not two measurements yet (e.g. estimated initial + one weighing).
 */
export function measuredGrowth(
  c: InitialWeight,
  logs: WeightPoint[]
): { gainKg: number; days: number; adg: number; baseline: Baseline; latestKg: number; latestDate: string } | null {
  const baseline = growthBaseline(c, logs);
  const latest = measuredLogs(logs).at(-1);
  if (!baseline || !latest) return null;
  const latestDate = latest.recorded_at.slice(0, 10);
  const days = Math.round((Date.parse(`${latestDate}T00:00:00Z`) - Date.parse(`${baseline.date}T00:00:00Z`)) / 86400000);
  if (days <= 0) return null;
  const gainKg = Number(latest.weight_kg) - baseline.weightKg;
  return { gainKg, days, adg: gainKg / days, baseline, latestKg: Number(latest.weight_kg), latestDate };
}

/** Human label for how a weight was obtained. */
export function weightTypeLabel(t: InitialWeightType | WeightType | null | undefined): string {
  return t === "estimated" ? "Estimated" : t === "measured" ? "Measured" : "Not specified";
}

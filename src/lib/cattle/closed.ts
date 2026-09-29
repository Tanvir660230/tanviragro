/**
 * Animals that have left the farm (sold, died, stolen) — pure.
 *
 * A closed animal's file: how long it was on the farm, what it fetched against what it cost,
 * and for a sale, how it grew and what it made per kg and per day. The cattle list and the
 * animal's page both use these, so they always show the same figures.
 */
import { measuredGrowth, type InitialWeight, type WeightPoint } from "@/lib/growth/baseline";

const DAY = 86_400_000;
const day = (d: string) => Date.parse(`${d.slice(0, 10)}T00:00:00Z`);

/** Whole days from purchase to the day it left — the same count the list shows for animals still on the farm. */
export function daysOnFarm(purchaseDate: string, endDate: string): number {
  return Math.max(0, Math.round((day(endDate) - day(purchaseDate)) / DAY));
}

/** A cost change smaller than this (rounding) is not reported. */
const CHANGE_MIN = 1;

export type SaleGrowth = {
  fromKg: number; fromDate: string; fromPurchase: boolean;
  toKg: number; toDate: string; atSale: boolean;
  gainKg: number; days: number; adg: number;
};

export type SaleReport = {
  salePrice: number; cost: number; result: number;
  /** result ÷ cost, in % */
  roiPct: number | null;
  days: number;
  /** result per day on the farm */
  perDay: number | null;
  saleWeightKg: number | null;
  pricePerKg: number | null;
  /** measured growth from purchase (or the first weighing) to the sale weight (or the last weighing) */
  growth: SaleGrowth | null;
  /** the full cost when the sale was recorded (null for sales recorded before it was kept) */
  costAtSale: number | null;
  /** cost now − cost at sale: costs dated on or before the sale day that were recorded later */
  changedBy: number | null;
};

export function saleReport(p: {
  salePrice: number; cost: number; costAtSale?: number | null;
  purchaseDate: string; soldOn: string; saleWeightKg?: number | null;
  animal: InitialWeight; logs: WeightPoint[];
}): SaleReport {
  const result = p.salePrice - p.cost;
  const days = daysOnFarm(p.purchaseDate, p.soldOn);
  const saleKg = p.saleWeightKg != null && p.saleWeightKg > 0 ? Number(p.saleWeightKg) : null;
  // growth to the sale: weighings up to the sale day, and the sale weight as the last measurement
  const logs: WeightPoint[] = [
    ...p.logs.filter((l) => l.recorded_at.slice(0, 10) <= p.soldOn.slice(0, 10)),
    ...(saleKg ? [{ weight_kg: saleKg, recorded_at: `${p.soldOn.slice(0, 10)}T23:59:59Z`, weight_type: "measured" as const }] : []),
  ];
  const g = measuredGrowth(p.animal, logs);
  const costAtSale = p.costAtSale != null && Number.isFinite(Number(p.costAtSale)) ? Number(p.costAtSale) : null;
  const changedBy = costAtSale != null && Math.abs(p.cost - costAtSale) >= CHANGE_MIN ? p.cost - costAtSale : null;
  return {
    salePrice: p.salePrice, cost: p.cost, result,
    roiPct: p.cost > 0 ? (result / p.cost) * 100 : null,
    days, perDay: days > 0 ? result / days : null,
    saleWeightKg: saleKg, pricePerKg: saleKg ? p.salePrice / saleKg : null,
    growth: g ? {
      fromKg: g.baseline.weightKg, fromDate: g.baseline.date, fromPurchase: g.baseline.source === "initial",
      toKg: g.latestKg, toDate: g.latestDate, atSale: !!saleKg && g.latestDate === p.soldOn.slice(0, 10) && g.latestKg === saleKg,
      gainKg: g.gainKg, days: g.days, adg: g.adg,
    } : null,
    costAtSale, changedBy,
  };
}

export type ClosedRow = { status: string; realised: { kind: string; salePrice: number | null; cost: number; result: number; days: number | null } | null };

export type ClosedSummary = {
  sold: { count: number; revenue: number; cost: number; result: number; avgResult: number | null; avgDays: number | null; roiPct: number | null };
  lost: { count: number; cost: number };
};

/** Totals for the "Sold" and "Died / stolen" views of the cattle list. */
export function closedSummary(rows: ClosedRow[]): ClosedSummary {
  const sold = rows.filter((r) => r.status === "sold" && r.realised);
  const lost = rows.filter((r) => r.status !== "sold" && r.status !== "active" && r.realised);
  const revenue = sold.reduce((s, r) => s + (r.realised!.salePrice ?? 0), 0);
  const cost = sold.reduce((s, r) => s + r.realised!.cost, 0);
  const result = sold.reduce((s, r) => s + r.realised!.result, 0);
  const dayRows = sold.filter((r) => r.realised!.days != null);
  return {
    sold: {
      count: sold.length, revenue, cost, result,
      avgResult: sold.length ? result / sold.length : null,
      avgDays: dayRows.length ? dayRows.reduce((s, r) => s + r.realised!.days!, 0) / dayRows.length : null,
      roiPct: cost > 0 ? (result / cost) * 100 : null,
    },
    lost: { count: lost.length, cost: lost.reduce((s, r) => s + r.realised!.cost, 0) },
  };
}

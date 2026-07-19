import type { Metadata } from "next";
import { Suspense } from "react";
import { BarChart3 } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { AnalyticsDashboardClient } from "@/components/cattle/AnalyticsDashboardClient";

export const metadata: Metadata = { title: "Cattle Analytics" };

export type AnalyticsCattle = {
  id: string;
  tagId: string;
  breed: string | null;
  gender: string;
  daysInPen: number;
  initialWeight: number;
  currentWeight: number;
  weightGain: number;
  lastWeighedAt: string | null;
  adg: number | null;
  adg14: number | null;
  feedConsumedKg: number;
  feedCost: number;
  purchasePrice: number;
  fcr: number | null;
  costPerKgGain: number | null;
};

export default async function CattleAnalyticsPage() {
  return (
    <div className="space-y-4">
      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsSection />
      </Suspense>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg animate-shimmer overflow-hidden shrink-0" />
        <div className="h-10 w-10 rounded-xl animate-shimmer overflow-hidden shrink-0" />
        <div className="space-y-1.5">
          <div className="h-7 w-52 animate-shimmer rounded overflow-hidden" />
          <div className="h-4 w-32 animate-shimmer rounded overflow-hidden" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-shimmer rounded-xl overflow-hidden" />
        ))}
      </div>
      <div className="h-64 animate-shimmer rounded-xl overflow-hidden" />
      <div className="h-96 animate-shimmer rounded-xl overflow-hidden" />
    </div>
  );
}

async function AnalyticsSection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();

  if (!businessId) {
    return <PageHeader title="Cattle Analytics" icon={BarChart3} back="/dashboard/cattle" />;
  }

  const today = new Date();
  const todayMs = today.getTime();
  const cutoff14 = todayMs - 14 * 86400000;

  // All active cattle
  const { data: rawCattle } = await supabase
    .from("cattle")
    .select("id, tag_id, breed, gender, purchase_date, purchase_price, initial_weight_kg, status")
    .eq("business_id", businessId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("tag_id", { ascending: true });

  const cattle = rawCattle ?? [];
  const activeIds = cattle.map((c) => c.id);

  if (activeIds.length === 0) {
    return (
      <>
        <PageHeader title="Cattle Analytics" icon={BarChart3} back="/dashboard/cattle" subtitle="No active cattle" />
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 py-12 text-center">
          <BarChart3 className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">No active cattle to analyse.</p>
        </div>
      </>
    );
  }

  // Parallel: weight logs + feed consumption
  const [{ data: rawLogs }, { data: rawConsumption }] = await Promise.all([
    supabase
      .from("weight_logs")
      .select("cattle_id, weight_kg, recorded_at")
      .in("cattle_id", activeIds)
      .is("deleted_at", null)
      .order("recorded_at", { ascending: false }),
    supabase
      .from("inventory_transactions")
      .select("cattle_id, qty, unit_cost, inventory_items!inner(category, deleted_at)")
      .eq("type", "consumption")
      .eq("inventory_items.category", "feed")
      .is("inventory_items.deleted_at", null)
      .in("cattle_id", activeIds),
  ]);

  // Build lookup maps
  const latestWeightMap: Record<string, number> = {};
  const lastWeighedMap: Record<string, string> = {};
  const adg14Map: Record<string, number> = {};
  const recentLogsMap: Record<string, { weight_kg: number; recorded_at: string }[]> = {};

  for (const log of (rawLogs ?? []) as { cattle_id: string; weight_kg: number; recorded_at: string }[]) {
    if (!(log.cattle_id in latestWeightMap)) {
      latestWeightMap[log.cattle_id] = log.weight_kg;
      lastWeighedMap[log.cattle_id] = log.recorded_at;
    }
    if (new Date(log.recorded_at).getTime() >= cutoff14) {
      if (!recentLogsMap[log.cattle_id]) recentLogsMap[log.cattle_id] = [];
      recentLogsMap[log.cattle_id].push(log);
    }
  }

  for (const [id, logs] of Object.entries(recentLogsMap)) {
    if (logs.length < 2) continue;
    const sorted = logs.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
    const newest = sorted[0], oldest = sorted[sorted.length - 1];
    const days = (new Date(newest.recorded_at).getTime() - new Date(oldest.recorded_at).getTime()) / 86400000;
    if (days >= 3) adg14Map[id] = (newest.weight_kg - oldest.weight_kg) / days;
  }

  const feedKgMap: Record<string, number> = {};
  const feedCostMap: Record<string, number> = {};
  for (const row of (rawConsumption ?? []) as { cattle_id: string | null; qty: number; unit_cost: number | null }[]) {
    if (!row.cattle_id) continue;
    feedKgMap[row.cattle_id] = (feedKgMap[row.cattle_id] ?? 0) + row.qty;
    feedCostMap[row.cattle_id] = (feedCostMap[row.cattle_id] ?? 0) + row.qty * (row.unit_cost ?? 0);
  }

  // Compute per-cattle analytics
  const result: AnalyticsCattle[] = cattle.map((c) => {
    const initialWeight = c.initial_weight_kg ?? 0;
    const currentWeight = latestWeightMap[c.id] ?? initialWeight;
    const lastWeighedAt = lastWeighedMap[c.id] ?? null;
    const weightGain = currentWeight - initialWeight;

    const purchaseMs = new Date(c.purchase_date + "T00:00:00").getTime();
    const daysInPen = Math.max(0, Math.floor((todayMs - purchaseMs) / 86400000));

    const daysToLatestWeigh = lastWeighedAt
      ? Math.max(1, Math.floor((new Date(lastWeighedAt).getTime() - purchaseMs) / 86400000))
      : daysInPen;

    const adg =
      lastWeighedAt !== null && daysToLatestWeigh > 0
        ? weightGain / daysToLatestWeigh
        : null;

    const feedConsumedKg = feedKgMap[c.id] ?? 0;
    const feedCost = feedCostMap[c.id] ?? 0;
    const fcr = weightGain > 0 && feedConsumedKg >= 10 ? feedConsumedKg / weightGain : null;
    const costPerKgGain = weightGain > 0 && feedCost > 0 ? feedCost / weightGain : null;

    return {
      id: c.id,
      tagId: c.tag_id,
      breed: c.breed,
      gender: c.gender,
      daysInPen,
      initialWeight,
      currentWeight,
      weightGain,
      lastWeighedAt,
      adg,
      adg14: adg14Map[c.id] ?? null,
      feedConsumedKg,
      feedCost,
      purchasePrice: Number(c.purchase_price ?? 0),
      fcr,
      costPerKgGain,
    };
  });

  return (
    <>
      <PageHeader
        title="Cattle Analytics"
        subtitle={`${result.length} active cattle`}
        icon={BarChart3}
        back="/dashboard/cattle"
      />
      <AnalyticsDashboardClient cattle={result} />
    </>
  );
}

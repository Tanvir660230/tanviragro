import type { Metadata } from "next";
import { Suspense } from "react";
import { BarChart3 } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { AnalyticsDashboardClient } from "@/components/cattle/AnalyticsDashboardClient";
import { loadFeedData } from "@/lib/feed/feed-data";
import { feedCostBetween, feedKgBetween } from "@/lib/feed/usage-engine";
import { measuredGrowth, measuredLogs } from "@/lib/growth/baseline";

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
    .select("id, tag_id, breed, gender, purchase_date, purchase_price, initial_weight_kg, initial_weight_type, status")
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

  // Weight logs (with measured / estimated type) + the feed engine's actual allocation
  // (the herd's feed shared by weight per day, the animal's own rows in full).
  const [{ data: rawLogs }, feed] = await Promise.all([
    supabase
      .from("weight_logs")
      .select("cattle_id, weight_kg, recorded_at, weight_type")
      .in("cattle_id", activeIds)
      .is("deleted_at", null)
      .order("recorded_at", { ascending: false }),
    loadFeedData(supabase, businessId),
  ]);

  type LogRow = { cattle_id: string; weight_kg: number; recorded_at: string; weight_type: "measured" | "estimated" | null };
  const logsBy: Record<string, LogRow[]> = {};
  for (const log of (rawLogs ?? []) as LogRow[]) (logsBy[log.cattle_id] ??= []).push(log);

  // Compute per-cattle analytics — growth from MEASURED weights only (an estimate never
  // produces an official gain), and feed over the SAME days as that gain.
  const result: AnalyticsCattle[] = cattle.map((c) => {
    const logs = logsBy[c.id] ?? [];
    const measured = measuredLogs(logs);
    const growth = measuredGrowth(c as { initial_weight_kg: number | null; initial_weight_type?: "measured" | "estimated" | "unknown" | null; purchase_date: string }, logs);
    const initialWeight = growth?.baseline.weightKg ?? Number(c.initial_weight_kg ?? 0);
    const currentWeight = Number(measured.at(-1)?.weight_kg ?? initialWeight);
    const lastWeighedAt = measured.at(-1)?.recorded_at ?? null;
    const weightGain = growth ? growth.gainKg : 0;

    const purchaseMs = new Date(c.purchase_date + "T00:00:00").getTime();
    const daysInPen = Math.max(0, Math.floor((todayMs - purchaseMs) / 86400000));
    const adg = growth ? growth.adg : null;

    // 14-day ADG from measured weighings only
    const recent = measured.filter((l) => new Date(l.recorded_at).getTime() >= cutoff14);
    let adg14: number | null = null;
    if (recent.length >= 2) {
      const oldest = recent[0], newest = recent[recent.length - 1];
      const days = (new Date(newest.recorded_at).getTime() - new Date(oldest.recorded_at).getTime()) / 86400000;
      if (days >= 3) adg14 = (Number(newest.weight_kg) - Number(oldest.weight_kg)) / days;
    }

    const f = feed.snapshot.perAnimal[c.id];
    const feedCost = f?.actual ?? 0;
    const windowCost = growth ? feedCostBetween(f, growth.baseline.date, growth.latestDate) : 0;
    const windowKg = growth ? feedKgBetween(f, growth.baseline.date, growth.latestDate) : 0;
    const feedConsumedKg = growth ? windowKg : 0;
    const fcr = weightGain > 0 && windowKg >= 10 ? windowKg / weightGain : null;
    const costPerKgGain = weightGain > 0 && windowCost > 0 ? windowCost / weightGain : null;

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
      adg14,
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

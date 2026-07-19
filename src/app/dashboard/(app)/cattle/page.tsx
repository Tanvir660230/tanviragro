import { Suspense } from "react";
import type { Metadata } from "next";
import { Beef } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { AddCattleDialog } from "@/components/cattle/AddCattleDialog";
import { CattleActionsMenu } from "@/components/cattle/CattleActionsMenu";
import { TodayWorkPanel } from "@/components/cattle/TodayWorkPanel";
import { CattleFilters } from "@/components/cattle/CattleFilters";
import type { Cattle } from "@/types/database";
import { cookies } from "next/headers";
import { getDictionary } from "@/i18n/getDictionary";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import type { Dictionary } from "@/i18n/getDictionary";

export const metadata: Metadata = { title: "Livestock" };

type Row = Pick<Cattle, "id"|"tag_id"|"breed"|"gender"|"dob"|"purchase_date"|"purchase_price"|"initial_weight_kg"|"target_weight_kg"|"expected_daily_gain_kg"|"status"|"notes"|"manual_feed_override"|"is_quarantined"|"is_qurbani_marked">;

export type CattleRowEnriched = Row & {
  daysInPen: number | null;
  fcr: number | null;
  adg: number | null;
  adg14: number | null;
  latestWeight: number | null;
  totalFeedCost: number;
  lastWeighedAt: string | null;
};

export default async function CattlePage(props: { searchParams: Promise<{ open?: string }> }) {
  const { open } = await props.searchParams;
  const cookieStore = await cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value === "bn" ? "bn" : "en");
  const t = await getDictionary(locale as "en" | "bn");

  return (
    <div className="space-y-4">
      <Suspense fallback={<CattleSkeleton t={t} />}>
        <CattleSection open={open} t={t} />
      </Suspense>
    </div>
  );
}

function CattleSkeleton({ t }: { t: Dictionary }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl animate-shimmer overflow-hidden shrink-0" />
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">{t.cattle.title}</h1>
            <div className="mt-1.5 h-4 w-32 animate-shimmer rounded overflow-hidden" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 animate-shimmer rounded overflow-hidden"></div>
          <div className="h-9 w-32 animate-shimmer rounded overflow-hidden"></div>
          <div className="h-9 w-32 animate-shimmer rounded overflow-hidden"></div>
          <div className="h-9 w-32 animate-shimmer rounded overflow-hidden"></div>
        </div>
      </div>
      <div className="h-[400px] animate-shimmer rounded-xl overflow-hidden" />
    </div>
  );
}

async function CattleSection({ open, t }: { open?: string; t: Dictionary }) {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();

  if (!businessId) {
    return (
      <>
        <PageHeader title={t.cattle.title} icon={Beef} />
        <EmptyState t={t} />
      </>
    );
  }

  const todayISO = new Date().toISOString().slice(0, 10);

  // 1. Fetch all cattle
  const { data: cattleData } = await supabase
    .from("cattle")
    .select("id, tag_id, breed, gender, dob, purchase_date, purchase_price, initial_weight_kg, target_weight_kg, expected_daily_gain_kg, status, notes, manual_feed_override, is_quarantined, is_qurbani_marked")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const cattle = (cattleData ?? []) as Row[];
  const activeIds = cattle.filter((c) => c.status === "active").map((c) => c.id);

  // 2. Fetch related data ONLY for active cattle to prevent O(N) data explosion
  const [
    { data: weightLogsData },
    { data: consumptionData },
    { count: overdueHealthCount },
  ] = await Promise.all([
    activeIds.length > 0
      ? supabase
          .from("weight_logs")
          .select("cattle_id, weight_kg, recorded_at")
          .in("cattle_id", activeIds)
          .is("deleted_at", null)
          .order("recorded_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    activeIds.length > 0
      ? supabase
          .from("inventory_transactions")
          .select("cattle_id, qty, unit_cost, inventory_items!inner(category, deleted_at)")
          .eq("type", "consumption")
          .eq("inventory_items.category", "feed")
          .is("inventory_items.deleted_at", null)
          .in("cattle_id", activeIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("health_events")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .lt("scheduled_at", todayISO)
      .is("completed_at", null)
      .is("deleted_at", null),
  ]);

  // Build latest weight map + last weighed date + 14-day rolling ADG per active cattle
  const latestWeightMap: Record<string, number> = {};
  const lastWeighedMap: Record<string, string> = {};
  // For 14-day ADG: track all logs within 14 days per cattle
  const recentLogsMap: Record<string, { weight_kg: number; recorded_at: string }[]> = {};
  const nowMs = new Date().getTime();
  const cutoff14d = nowMs - 14 * 86400000;

  for (const log of (weightLogsData ?? []) as { cattle_id: string; weight_kg: number; recorded_at: string }[]) {
    if (!(log.cattle_id in latestWeightMap)) {
      latestWeightMap[log.cattle_id] = log.weight_kg;
      lastWeighedMap[log.cattle_id] = log.recorded_at;
    }
    if (new Date(log.recorded_at).getTime() >= cutoff14d) {
      if (!recentLogsMap[log.cattle_id]) recentLogsMap[log.cattle_id] = [];
      recentLogsMap[log.cattle_id].push(log);
    }
  }

  const adg14Map: Record<string, number> = {};
  for (const [cattleId, recentLogs] of Object.entries(recentLogsMap)) {
    if (recentLogs.length < 2) continue;
    const sorted = recentLogs.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
    const newest = sorted[0];
    const oldest = sorted[sorted.length - 1];
    const days = (new Date(newest.recorded_at).getTime() - new Date(oldest.recorded_at).getTime()) / 86400000;
    if (days < 3) continue; // require ≥3 days — a 1-2 day gap amplifies gut-fill and water-weight noise into false ADG spikes
    adg14Map[cattleId] = (newest.weight_kg - oldest.weight_kg) / days;
  }

  // Build total feed consumption qty + cost per active cattle
  const consumeMap: Record<string, number> = {};
  const feedCostMap: Record<string, number> = {};
  for (const row of (consumptionData ?? []) as { cattle_id: string | null; qty: number; unit_cost: number | null }[]) {
    if (row.cattle_id) {
      consumeMap[row.cattle_id] = (consumeMap[row.cattle_id] ?? 0) + row.qty;
      feedCostMap[row.cattle_id] = (feedCostMap[row.cattle_id] ?? 0) + row.qty * (row.unit_cost ?? 0);
    }
  }

  const today = new Date().getTime();
  const sevenDaysAgo = today - 7 * 86400000;

  const enriched: CattleRowEnriched[] = cattle.map((c) => {
    const isActive = c.status === "active";
    const daysInPen = isActive
      ? Math.max(0, Math.floor((today - new Date(c.purchase_date + "T00:00:00").getTime()) / 86400000))
      : null;

    const latestWeight = latestWeightMap[c.id] ?? null;
    const lastWeighedAt = lastWeighedMap[c.id] ?? null;
    const totalFeedCost = feedCostMap[c.id] ?? 0;

    const weightGain = latestWeight !== null ? latestWeight - (c.initial_weight_kg ?? 0) : null;
    const consumed = consumeMap[c.id] ?? 0;
    const fcr =
      weightGain !== null && weightGain > 0 && consumed >= 10
        ? consumed / weightGain
        : null;

    // ADG uses last-weigh date as end, not today — avoids deflating ADG
    // for cattle that haven't been weighed recently.
    const daysToLatestWeigh = lastWeighedAt !== null
      ? Math.max(1, Math.floor(
          (new Date(lastWeighedAt).getTime() - new Date(c.purchase_date + "T00:00:00").getTime()) / 86400000
        ))
      : daysInPen;
    const adg =
      latestWeight !== null && daysToLatestWeigh !== null && daysToLatestWeigh > 0
        ? (latestWeight - (c.initial_weight_kg ?? 0)) / daysToLatestWeigh
        : null;

    const adg14 = adg14Map[c.id] ?? null;
    return { ...c, daysInPen, fcr, adg, adg14, latestWeight, totalFeedCost, lastWeighedAt };
  });

  const isUnweighed = (c: CattleRowEnriched) =>
    c.status === "active" && (!c.lastWeighedAt || new Date(c.lastWeighedAt).getTime() < sevenDaysAgo);

  const unweighedCount  = enriched.filter(isUnweighed).length;
  const unweighedCattle = enriched.filter(isUnweighed).map((c) => ({ id: c.id, tag_id: c.tag_id }));
  const highFcrCount    = enriched.filter((c) => c.fcr !== null && c.fcr > 10).length;

  const activeCattle = enriched
    .filter((c) => c.status === "active")
    .map((c) => ({ id: c.id, tag_id: c.tag_id }));

  const allBreeds = [...new Set(cattle.map((c) => c.breed).filter(Boolean) as string[])].sort();
  const existingTagIds = cattle.map((c) => c.tag_id);

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageHeader
          title={t.cattle.title}
          subtitle={cattle.length === 0 ? t.cattle.no_cattle_yet : `${cattle.length} ${t.cattle.cattle_in_operation}`}
          icon={Beef}
          badge={cattle.filter(c => c.status === "active").length || undefined}
        />
        <div className="flex items-center gap-2">
          <CattleActionsMenu
            activeCattle={activeCattle}
            defaultOpenWeigh={open === "bulk-weigh"}
          />
          <AddCattleDialog existingTagIds={existingTagIds} existingBreeds={allBreeds} />
        </div>
      </div>

      {enriched.length === 0 ? (
        <EmptyState t={t} />
      ) : (
        <>
          <TodayWorkPanel
            unweighedCattle={unweighedCattle}
            overdueHealthCount={overdueHealthCount ?? 0}
            highFcrCount={highFcrCount}
          />
          <CattleFilters
            cattle={enriched}
            allBreeds={allBreeds}
            alerts={{
              unweighedCount,
              overdueHealthCount: overdueHealthCount ?? 0,
              highFcrCount,
            }}
          />
        </>
      )}
    </>
  );
}

function EmptyState({ t }: { t: Dictionary }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-12 text-center gap-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted/50">
        <Beef className="h-8 w-8 text-muted-foreground/40" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">
          {t.cattle.no_cattle_added}
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          {t.cattle.click_add_cattle}
        </p>
      </div>
      <AddCattleDialog existingTagIds={[]} existingBreeds={[]} />
    </div>
  );
}

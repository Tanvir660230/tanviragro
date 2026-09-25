import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CATTLE_STATUS_STYLE } from "@/constants/cattle-status";
import { createClient } from "@/lib/supabase/server";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { WeightSection } from "@/components/cattle/WeightSection";
import { CattlePhotoGallery } from "@/components/cattle/CattlePhotoGallery";
import { GrowthForecastCard } from "@/components/cattle/GrowthForecastCard";
import { CostTimelineCard } from "@/components/cattle/CostTimelineCard";
import { QRCodeCard } from "@/components/cattle/QRCodeCard";
import { EditCattleDialog } from "@/components/cattle/EditCattleDialog";
import { CattleDetailMoreMenu } from "@/components/cattle/CattleDetailMoreMenu";
import { SellCashImpactCard } from "@/components/cattle/SellCashImpactCard";
import { LifeCycleTimeline } from "@/components/cattle/LifeCycleTimeline";
import { AnimalUnifiedTimeline } from "@/components/cattle/AnimalUnifiedTimeline";
import { getAnimalUnifiedTimelineAction } from "@/app/dashboard/(app)/cattle/lifecycle-actions";
import type { Cattle, WeightLog, CattlePhoto, HealthEvent } from "@/types/database";
import type { CattleTreatment } from "@/app/dashboard/(app)/cattle/medical-actions";
import { getDictionary } from "@/i18n/getDictionary";
import { cookies } from "next/headers";
import { DailyFeedRequirementCard } from "@/components/cattle/DailyFeedRequirementCard";
import { UndoSaleButton } from "@/components/cattle/UndoSaleButton";
import { calculateAlgorithmicFeedCost, ROUGHAGE_TYPES } from "@/utils/feed-calculator";
import { InsuranceCard } from "@/components/cattle/InsuranceCard";
import { CattleDetailTabs } from "@/components/cattle/CattleDetailTabs";
import { HealthWorkspace } from "@/components/cattle/HealthWorkspace";
import { measuredGrowth, measuredLogs, weightTypeLabel } from "@/lib/growth/baseline";
import { animalFeedShares, type AnimalPresence } from "@/lib/inventory/feed-costing";
import { loadUnitCostMap } from "@/lib/inventory/unit-cost";
import { loadHomeInputs } from "@/lib/home/home-data";
import { buildHomeModel } from "@/lib/home/home-model";
import { CattleProfileHero } from "@/components/cattle/CattleProfileHero";
import { todayDhaka } from "@/lib/dates";
import { dayList, feedCostBetween, feedKgBetween } from "@/lib/feed/usage-engine";
import { getL } from "@/i18n/server-text";


type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const businessId = await getCachedBusinessId();
  const { data } = await supabase
    .from("cattle")
    .select("tag_id")
    .eq("id", id)
    .eq("business_id", businessId ?? "")
    .maybeSingle();
  return {
    title: data ? `গরু #${(data as { tag_id: string }).tag_id}` : "পাওয়া যায়নি",
  };
}

const STATUS_STYLE = CATTLE_STATUS_STYLE;

/** e.g. "1 Jun 2026" in farm time */
const fmtDay = (d: string | null | undefined) =>
  d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

type LogRow = Pick<WeightLog, "id" | "weight_kg" | "recorded_at" | "notes" | "girth_cm" | "length_cm" | "weight_type">;

export type ConsumptionRow = {
  qty: number;
  unit_cost: number | null;
  recorded_at: string;
  notes: string | null;
  inventory_items: { name: string; unit: string } | null;
};

// ── Skeleton helpers ────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-shimmer rounded overflow-hidden ${className ?? ""}`} />;
}

function PhotosSkeleton() {
  return (
    <div className="rounded-xl bg-card p-5 border border-border/70 shadow-card">
      <Skeleton className="mb-4 h-6 w-24" />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function HealthSkeleton() {
  return (
    <div className="rounded-xl bg-card p-5 border border-border/70 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2.5">
            <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}


// ── Streaming async server sections ────────────────────────────────────────

async function PhotosSection({ cattle, title }: { cattle: Cattle; title: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cattle_photos")
    .select("*")
    .eq("cattle_id", cattle.id)
    .order("created_at", { ascending: false });
  return (
    <div className="rounded-xl bg-card border border-border shadow-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 sm:px-5 py-3 border-b border-border bg-muted/30">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
          <svg className="h-3.5 w-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="px-4 sm:px-5 py-4">
        <CattlePhotoGallery cattleId={cattle.id} photos={(data ?? []) as CattlePhoto[]} />
      </div>
    </div>
  );
}

async function HealthSection({
  cattle,
  currentWeightKg,
}: {
  cattle: Cattle;
  currentWeightKg: number;
}) {
  const supabase = await createClient();
  const [
    { data: eventsData },
    { data: treatmentsData },
    { data: medItemsData },
    { data: medProtocolsData },
    { data: bizNameRow },
  ] = await Promise.all([
    supabase
      .from("health_events")
      .select("*")
      .eq("cattle_id", cattle.id)
      .eq("business_id", cattle.business_id)
      .is("deleted_at", null)
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("cattle_treatments")
      .select("*")
      .eq("cattle_id", cattle.id)
      .order("treated_at", { ascending: false }),
    supabase
      .from("inventory_items")
      .select("id, name, unit")
      .eq("category", "medicine")
      .eq("business_id", cattle.business_id)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("medicine_protocols")
      .select("item_id, dose_per_100kg_weight, frequency_days, notes"),
    supabase.from("businesses").select("name").eq("id", cattle.business_id).maybeSingle(),
  ]);

  return (
    <HealthWorkspace
      cattle={cattle}
      businessId={cattle.business_id}
      businessName={(bizNameRow as { name?: string } | null)?.name ?? ""}
      currentWeightKg={currentWeightKg}
      events={(eventsData ?? []) as HealthEvent[]}
      treatments={((treatmentsData ?? []) as unknown) as CattleTreatment[]}
      medicineItems={(medItemsData ?? []) as { id: string; name: string; unit: string }[]}
      protocols={
        (medProtocolsData ?? []) as {
          item_id: string;
          dose_per_100kg_weight: number;
          frequency_days: number | null;
          notes: string | null;
        }[]
      }
    />
  );
}

async function TimelineSection({ cattle, initialWeight, weights }: { cattle: Cattle, initialWeight: number, weights: LogRow[] }) {
  const timelineResult = await getAnimalUnifiedTimelineAction(cattle.id);

  if (timelineResult.success && timelineResult.events.length > 0) {
    return <AnimalUnifiedTimeline events={timelineResult.events} cattleTag={cattle.tag_id} />;
  }

  const supabase = await createClient();
  const [
    { data: healthData },
    { data: treatmentsData },
  ] = await Promise.all([
    supabase
      .from("health_events")
      .select("*")
      .eq("cattle_id", cattle.id)
      .eq("business_id", cattle.business_id)
      .is("deleted_at", null),
    supabase
      .from("cattle_treatments")
      .select("*")
      .eq("cattle_id", cattle.id),
  ]);

  return (
    <LifeCycleTimeline
      purchaseDate={cattle.purchase_date!}
      purchasePrice={Number(cattle.purchase_price)}
      initialWeight={initialWeight}
      initialWeightType={cattle.initial_weight_type}
      weights={weights}
      healthEvents={(healthData ?? []) as HealthEvent[]}
      treatments={(treatmentsData ?? []) as CattleTreatment[]}
      status={cattle.status}
      updatedAt={cattle.updated_at}
    />
  );
}


// ── Page ───────────────────────────────────────────────────────────────────

export default async function CattleProfilePage({ params }: Props) {
  const { id } = await params;

  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileSection id={id} />
    </Suspense>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-48 rounded-xl animate-shimmer border border-border/70 overflow-hidden" />
      <div className="h-64 rounded-xl animate-shimmer border border-border/70 overflow-hidden" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="h-64 rounded-xl animate-shimmer border border-border overflow-hidden" />
        <div className="h-64 rounded-xl animate-shimmer border border-border overflow-hidden" />
      </div>
    </div>
  );
}

async function ProfileSection({ id }: { id: string }) {
  const L = await getL();
  const supabase = await getServerClient();
  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "bn" ? "bn" : "en";
  const t = await getDictionary(locale);

  // Resolve business_id first so every subsequent query is scoped to this business.
  const businessId = await getCachedBusinessId();
  if (!businessId) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  // Fetch business settings for feed defaults
  const { data: bizSettingsData } = await supabase
    .from("businesses")
    .select("default_roughage_type")
    .eq("id", businessId)
    .maybeSingle();
  const bizDefaultRoughage = (bizSettingsData as { default_roughage_type?: string } | null)?.default_roughage_type ?? "straw";

  // Pre-fetch feed item IDs (concentrate AND roughage) so we can filter consumption without a join
  const { data: feedItemsData } = await supabase
    .from("inventory_items")
    .select("id, name, unit")
    .eq("business_id", businessId)
    .in("category", ["feed", "roughage"]);
  const feedItemIds = (feedItemsData ?? []).map(i => i.id);
  const feedItemMap: Record<string, { name: string; unit: string }> = {};
  for (const fi of feedItemsData ?? []) feedItemMap[fi.id] = { name: fi.name, unit: fi.unit };

  const [
    { data: cattleData },
    { data: logsData },
    { data: rawConsumptionData },
    { data: individualCostsData },
    { data: treatmentsData },
    { data: marketPriceData },
    { data: roughagesData },
    { data: recipesData },
    { data: latestSaleData },
    { data: herdFeedData },
    { data: presenceData },
    { data: businessSalesData },
  ] = await Promise.all([
    supabase.from("cattle").select("*").eq("id", id).eq("business_id", businessId).maybeSingle(),
    supabase
      .from("weight_logs")
      .select("id, weight_kg, recorded_at, notes, girth_cm, length_cm, weight_type")
      .eq("cattle_id", id)
      .is("deleted_at", null)
      .order("recorded_at", { ascending: true })
      .limit(500),
    feedItemIds.length
      ? supabase
          .from("inventory_transactions")
          .select("qty, unit_cost, recorded_at, notes, item_id, movement_type")
          .eq("cattle_id", id)
          // feed eaten (and audited undos of it); not mixing inputs, wastage or count adjustments
          .in("movement_type", ["consumption", "consumption_reversal"])
          .in("item_id", feedItemIds)
          .order("recorded_at", { ascending: true })
      : Promise.resolve({ data: [] as { qty: number; unit_cost: number | null; recorded_at: string; notes: string | null; item_id: string }[], error: null }),
    supabase
      .from("cost_entries")
      .select("amount, category, description, recorded_at")
      .eq("cattle_id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      // same definition as the homepage and the cattle list (lib/home/home-data.ts):
      // expense-type direct costs; vet fees come from cattle_treatments below
      .eq("type", "variable")
      .eq("entry_class", "expense")
      .neq("category", "Medical/Vet Fee")
      .order("recorded_at", { ascending: true }),
    supabase
      .from("cattle_treatments")
      .select("vet_fee, additional_medical_cost, treated_at, diagnosis, notes")
      .eq("cattle_id", id)
      .order("treated_at", { ascending: true }),
    supabase
      .from("market_prices")
      .select("price_per_kg")
      .eq("business_id", businessId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("inventory_items")
      .select("id, name, unit, kg_per_unit, roughage_active_from, roughage_active_until")
      .eq("business_id", businessId)
      .not("roughage_active_from", "is", null),
    supabase
      .from("feed_recipes")
      .select("id, active_from, active_until, recipe_ingredients(item_id, qty_per_batch)")
      .eq("business_id", businessId)
      .not("active_from", "is", null),
    supabase
      .from("sales")
      .select("sold_at, sale_price_total")
      .eq("cattle_id", id)
      .is("deleted_at", null)
      .order("sold_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Herd-level recorded feeding (no cattle_id): shared among animals present that day
    feedItemIds.length
      ? supabase
          .from("inventory_transactions")
          .select("qty, unit_cost, recorded_at, notes, item_id, cattle_id, is_estimate, movement_type")
          .is("cattle_id", null)
          .in("movement_type", ["consumption", "consumption_reversal"])
          .in("item_id", feedItemIds)
          .order("recorded_at", { ascending: true })
      : Promise.resolve({ data: [] as { qty: number; unit_cost: number | null; recorded_at: string; notes: string | null; item_id: string; cattle_id: string | null; is_estimate: boolean }[], error: null }),
    supabase
      .from("cattle")
      .select("id, purchase_date, status, updated_at")
      .eq("business_id", businessId)
      .is("deleted_at", null),
    supabase
      .from("sales")
      .select("cattle_id, sold_at, cattle!inner(business_id)")
      .eq("cattle.business_id", businessId)
      .is("deleted_at", null),
  ]);

  if (!cattleData) notFound();

  const c = cattleData as Cattle;

  // Secondary non-blocking queries for breed benchmarking
  const { data: breedBenchData } = c.breed ? await supabase
    .from("cattle")
    .select("id, initial_weight_kg, purchase_date, status, updated_at")
    .eq("business_id", c.business_id)
    .eq("status", "active")
    .eq("breed", c.breed)
    .is("deleted_at", null)
    .limit(100) : { data: null };
  type BenchLog = { cattle_id: string; weight_kg: number; recorded_at: string };
  const { data: breedLogsData } = breedBenchData && breedBenchData.length > 0 ? await supabase
    .from("weight_logs")
    .select("cattle_id, weight_kg, recorded_at")
    .in("cattle_id", breedBenchData.map((b) => b.id))
    .is("deleted_at", null)
    .limit(3000) : { data: null };

  let breedAverageAdg: number | null = null;
  if (breedBenchData && breedLogsData) {
    let totalAdg = 0;
    let count = 0;
    const benchNowMs = new Date().getTime();
    const benchLogs = breedLogsData as BenchLog[];
    for (const bc of breedBenchData) {
      if (bc.id === c.id) continue;
      const bcLogs = benchLogs.filter((l) => l.cattle_id === bc.id);
      if (bcLogs.length === 0) continue;
      bcLogs.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
      const endMs = (bc.status === "active" || !bc.updated_at) ? benchNowMs : new Date(bc.updated_at).getTime();
      const startMs = new Date(bc.purchase_date + "T00:00:00").getTime();
      const bcDays = Math.floor((endMs - startMs) / 86400000);
      // Skip animals with zero days in pen (same-day purchase) to avoid
      // division by zero; 1+ day entries are included to keep the benchmark
      // meaningful immediately after a batch purchase.
      if (bcDays < 1) continue;
      const bcLatestWeight = bcLogs[0].weight_kg;
      totalAdg += (bcLatestWeight - (bc.initial_weight_kg ?? 0)) / bcDays;
      count++;
    }
    if (count > 0) breedAverageAdg = totalAdg / count;
  }

  const logs = (logsData ?? []) as LogRow[];
  const consumptions: ConsumptionRow[] = (rawConsumptionData ?? []).map(r => ({
    qty: r.qty,
    unit_cost: r.unit_cost,
    recorded_at: r.recorded_at,
    notes: r.notes,
    inventory_items: feedItemMap[r.item_id] ?? null,
  }));

  // Fetch sibling tag IDs and breeds for the edit dialog's duplicate validation
  const { data: siblingCattleData } = await supabase
    .from("cattle")
    .select("tag_id, breed")
    .eq("business_id", businessId)
    .neq("id", id)
    .is("deleted_at", null);
  const existingTagIds = (siblingCattleData ?? []).map((r: { tag_id: string }) => r.tag_id);
  const existingBreeds = [
    ...new Set(
      (siblingCattleData ?? [])
        .map((r: { breed: string | null }) => r.breed)
        .filter((b): b is string => Boolean(b))
    ),
  ].sort();

  const { data: roleData } = await supabase.rpc("get_user_business_role", { p_user_id: user.id });
  const role = roleData?.role ?? "owner";

  if (role === "worker") {
    const { data: activeFeedItems } = await supabase
      .from("inventory_items")
      .select("id, name, unit")
      .eq("business_id", c.business_id)
      .eq("category", "feed")
      .is("deleted_at", null)
      .order("name", { ascending: true });

    const { WorkerActionPad } = await import("@/components/cattle/WorkerActionPad");
    return <WorkerActionPad cattle={c} activeFeedItems={activeFeedItems ?? []} />;
  }

  const nowMs = new Date().getTime();

  // ── Overhead Cost — Daily Rate Method ──────────────────────────────────────
  // Problem with proportional method: if only 2 cattle are present, each gets
  // 50% of ALL accumulated overhead regardless of how long they've been there.
  // Fix: compute a daily absorption rate from the full business lifespan.
  //   dailyRate  = totalFixedCosts ÷ businessOperatingDays
  //   thisAnimal = dailyRate × daysInPen
  // This way overhead is stable — 2 cattle or 20, each animal only pays for
  // the days it occupied the pen.

  const endMs = (c.status === "active" || !c.updated_at) ? nowMs : new Date(c.updated_at).getTime();
  const startMs = new Date(c.purchase_date + "T00:00:00").getTime();
  const daysInPen = Math.max(0, Math.floor((endMs - startMs) / 86400000));

  // Overhead cost calculation removed. Cattle profiles now show direct margin.

  // ── Cost Timeline Setup ───────────────────────────────────────────────────

  const treatments = (treatmentsData ?? []) as { vet_fee: number | null; additional_medical_cost: number | null; treated_at: string; diagnosis: string | null }[];
  const medicalCost = treatments.reduce((s, t) => s + Number(t.vet_fee ?? 0) + Number(t.additional_medical_cost ?? 0), 0);

  const individualCosts = (individualCostsData ?? []) as { amount: number; category: string; description: string | null; recorded_at: string }[];
  const otherIndividualCost = individualCosts.reduce((s, i) => s + Number(i.amount), 0);

  const roughages = (roughagesData ?? []) as { id: string; name: string; unit: string; kg_per_unit: number | null; roughage_active_from: string; roughage_active_until: string | null }[];
  const recipes = (recipesData ?? []) as { id: string; active_from: string; active_until: string | null; recipe_ingredients: { item_id: string; qty_per_batch: number }[] }[];
  
  const currentRoughage = roughages.find(r => !r.roughage_active_until) || null;

  // We will pass the active roughage details to the UI
  // And we will use it to calculate the exact algorithmic feed cost.

  // Algorithmic Feed Cost = sum of daily requirements * rough estimate of unit cost
  // Let's get a rough estimate of unit cost from recent purchase transactions.
  // Current unit cost from the database (moving average of stock on hand) — never the latest price (P-04)
  const unitCostMap = await loadUnitCostMap(supabase, businessId);

  // Calculate allocated cost over the days in pen
  // ESTIMATE (ration plan × WAC). Shown for planning only — never added to actual cost.
  let allocatedFeedCost = 0;
  let allocatedConcentrateKg = 0;
  let allocatedRoughageKg = 0;
  let estimateRoughageCostUnknown = false;

  if (daysInPen > 0 && startMs > 0) {
    const overrideRoughage = (c.manual_feed_override as { roughageKg?: number } | null)?.roughageKg ?? null;

    // logs is ordered ascending (oldest first) — take the last element for latest weight.
    const latestLog = logs[logs.length - 1];
    // Resolve roughage DM% from the business default (overridable per animal later)
    const defaultRoughageDm = ROUGHAGE_TYPES.find(r => r.id === bizDefaultRoughage)?.dmPercent ?? 0.90;
    const feedData = {
      initialWeightKg: c.initial_weight_kg ?? 0,
      latestLoggedWeightKg: latestLog?.weight_kg ?? c.initial_weight_kg ?? 0,
      lastWeighedAt: latestLog?.recorded_at ?? null,
      purchaseDate: c.purchase_date ?? "",
      expectedDailyGainKg: c.expected_daily_gain_kg ?? 0.8,
      roughageDmPercent: defaultRoughageDm,
    };

    const { allocatedFeedCost: afc, allocatedConcentrateKg: ack, allocatedRoughageKg: ark, roughageCostUnknown: rcu } = calculateAlgorithmicFeedCost({
      daysInPen,
      startMs,
      recipes,
      roughages,
      unitCostMap,
      feedData,
      overrideRoughage,
    });

    allocatedFeedCost = afc;
    allocatedConcentrateKg = ack;
    allocatedRoughageKg = ark;
    estimateRoughageCostUnknown = rcu;
  }

  // Warn when allocated feed cost is zero despite having active feeds (missing purchase price data)
  const hasMissingFeedPrices =
    daysInPen > 0 &&
    (roughages.length > 0 || recipes.length > 0) &&
    allocatedFeedCost === 0 &&
    Object.keys(unitCostMap).length === 0;

  // ── ACTUAL feed cost: recorded ledger consumption only ─────────────────────
  // Rows logged for this animal count in full; herd rows are shared equally among the
  // animals on the farm that day (head-day allocation). Each row keeps the cost the
  // database gave it when it was recorded (WAC as of its date).
  const saleDateById = new Map<string, string>();
  for (const s of (businessSalesData ?? []) as { cattle_id: string; sold_at: string }[]) {
    saleDateById.set(s.cattle_id, String(s.sold_at).slice(0, 10));
  }
  const presence: AnimalPresence[] = ((presenceData ?? []) as { id: string; purchase_date: string | null; status: string; updated_at: string | null }[])
    .filter((a) => a.purchase_date)
    .map((a) => ({
      id: a.id,
      from: String(a.purchase_date).slice(0, 10),
      to: saleDateById.get(a.id) ?? (a.status === "active" ? null : a.updated_at ? String(a.updated_at).slice(0, 10) : null),
    }));
  type FeedRow = { qty: number; unit_cost: number | null; recorded_at: string; notes: string | null; item_id: string; cattle_id: string | null; is_estimate?: boolean; movement_type?: string };
  // an audited reversal undoes (part of) a consumption row: count it as a negative quantity
  const signed = (r: FeedRow): FeedRow => (r.movement_type === "consumption_reversal" ? { ...r, qty: -Number(r.qty) } : r);
  const actualRows: FeedRow[] = [
    ...((rawConsumptionData ?? []) as Omit<FeedRow, "cattle_id">[]).map((r) => signed({ ...r, cattle_id: id })),
    ...((herdFeedData ?? []) as FeedRow[]).map(signed),
  ];
  const myShares = animalFeedShares(actualRows, presence, id);
  // ── THE feed engine (lib/feed/usage-engine.ts): same numbers as the Feed Usage page ──
  // Closed usage periods + recorded feeding, split per day by live weight and presence.
  // same inputs as the homepage and the cattle list, so all three show the same figures
  const [homeInputs, { data: nextHealthData }] = await Promise.all([
    loadHomeInputs(supabase, businessId, undefined, { money: false }),
    supabase.from("health_events").select("title, scheduled_at").eq("cattle_id", id)
      .is("completed_at", null).is("deleted_at", null).order("scheduled_at", { ascending: true }).limit(1).maybeSingle(),
  ]);
  const feed = homeInputs.feed;
  const hm = buildHomeModel(homeInputs.input).cattle.find((x) => x.id === id) ?? null;
  const myFeed = feed.snapshot.perAnimal[id];
  const actualFeedCost = myFeed?.actual ?? 0;
  const runningFeedEstimate = myFeed?.estimated ?? 0;
  const actualFeedRows: ConsumptionRow[] = Object.entries(myFeed?.actualValueByItem ?? {}).map(([itemId, value]) => {
    const q = myFeed?.actualQtyByItem[itemId] ?? 0;
    return { qty: q, unit_cost: q ? value / q : null, recorded_at: feed.asOf, notes: null, inventory_items: feedItemMap[itemId] ?? null };
  });
  const actualRowsMissingCost = myShares.filter(({ row }) => row.unit_cost == null && row.qty > 0).length;
  // Rows written by the removed automatic engine: real stock movements, but their quantities
  // came from the ration formula, not from a person recording the feeding.
  const legacyEstimatedRows = myShares.filter(({ row }) => row.is_estimate && row.qty > 0).length;

  // Days in the pen that no usage period and no feeding record covers: NOT RECORDED, never guessed.
  const penEnd = new Date(endMs).toISOString().slice(0, 10);
  const me = feed.animals.find((a) => a.id === id);
  const lastDay = me?.to && me.to < penEnd ? me.to : penEnd;
  const feedDaysNotRecorded = me && me.from <= lastDay ? dayList(me.from, lastDay).filter((d) => !feed.coveredDays.has(d)).length : 0;

  // Totals use ACTUAL recorded feed only. The estimate is displayed beside it, labelled.
  const totalFeedCost = actualFeedCost;

  const overheadCost = 0;
  const totalCost = Number(c.purchase_price) + totalFeedCost + medicalCost + otherIndividualCost;
  // Marginal cost = everything spent AFTER purchase (feed, vet, transport, etc.)
  // Used for "cost per kg gained" — purchase price is excluded because it's a sunk
  // cost paid regardless of how much weight the animal gains.

  const sortedLogs = [...logs].sort(
    (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
  );
  // Current weight = latest MEASURED weight (an estimate is used only when nothing was weighed).
  const measured = measuredLogs(logs);
  const latestWeight = Number(measured.at(-1)?.weight_kg ?? sortedLogs[0]?.weight_kg ?? c.initial_weight_kg ?? 0);
  // Growth between two measurements only — an estimated initial weight is never a baseline.
  const growth = measuredGrowth(c, logs);
  const weightGain = growth ? parseFloat(growth.gainKg.toFixed(2)) : 0;
  // Cost per kg gained uses costs over the SAME days as the measured gain (baseline → last
  // weighing); dividing costs up to today by a gain measured earlier overstated it.
  const inGainWindow = (d: string) => !!growth && d.slice(0, 10) >= growth.baseline.date && d.slice(0, 10) <= growth.latestDate;
  const gainWindowFeed = growth ? feedCostBetween(myFeed, growth.baseline.date, growth.latestDate) : 0;
  // FCR uses feed actually EATEN (kg) over the measured-growth window — never the ration plan's kg
  const actualFeedKgForGain = growth ? feedKgBetween(myFeed, growth.baseline.date, growth.latestDate) : 0;
  const gainWindowCost = gainWindowFeed
    + treatments.filter((t) => inGainWindow(t.treated_at)).reduce((s, t) => s + Number(t.vet_fee ?? 0) + Number(t.additional_medical_cost ?? 0), 0)
    + individualCosts.filter((i) => inGainWindow(i.recorded_at)).reduce((s, i) => s + Number(i.amount), 0);
  const breakEvenPerKg = latestWeight > 0 ? totalCost / latestWeight : null;

  // All-time ADG — use days from purchase to LAST WEIGH DATE (not today).
  // Using today inflates the denominator when the animal hasn't been weighed recently,
  // making ADG appear artificially lower than the measured growth rate.
  const latestLogMs = measured.length > 0 ? new Date(measured[measured.length - 1].recorded_at).getTime() : nowMs;
  const adg = growth ? growth.adg : null;

  // Extrapolate today's weight: cattle keep growing after the last weigh date.
  // Using only the last logged weight understates the sale estimate by (ADG × unweighed days).
  const daysSinceLastLog = Math.max(0, Math.floor((nowMs - latestLogMs) / 86400000));
  const estimatedWeightToday =
    adg !== null && daysSinceLastLog > 0
      ? Math.min(650, parseFloat((latestWeight + adg * daysSinceLastLog).toFixed(1)))
      : latestWeight;

  // Rolling 14-day ADG — more responsive to recent performance
  const cutoff14 = nowMs - 14 * 86400000;
  const recentLogs = sortedLogs.filter(
    (l) => new Date(l.recorded_at).getTime() >= cutoff14
  );
  const adg14 =
    recentLogs.length >= 2
      ? (() => {
          const newest = recentLogs[0];
          const oldest = recentLogs[recentLogs.length - 1];
          const days = (new Date(newest.recorded_at).getTime() - new Date(oldest.recorded_at).getTime()) / 86400000;
          // Require at least 3 days between readings — a 1-day gap amplifies normal
          // weight fluctuations (gut fill, water) into falsely extreme ADG values.
          if (days < 3) return null;
          return (newest.weight_kg - oldest.weight_kg) / days;
        })()
      : null;

  const adgTier =
    adg === null ? "none" : adg >= 0.5 ? "good" : adg >= 0.3 ? "fair" : "poor";
  const adgLabel = {
    good: t.cattle_details.smart.performance_good,
    fair: t.cattle_details.smart.performance_fair,
    poor: t.cattle_details.smart.performance_poor,
    none: "—",
  }[adgTier];

  return (
    <div className="space-y-4">

      <CattleProfileHero
        tp={t.cattle_profile}
        th={t.home}
        id={c.id}
        backLabel={t.cattle_details.profile.back_to_livestock}
        tag={c.tag_id}
        statusLabel={(t.cattle_details.dialogs as Record<string, string>)[c.status] ?? c.status}
        statusClass={STATUS_STYLE[c.status] ?? ""}
        subtitle={[c.gender === "male" ? t.cattle_details.table.gender_male : t.cattle_details.table.gender_female, c.breed].filter(Boolean).join(" · ")}
        badges={{ ready: !!hm?.readyToSell, quarantined: !!c.is_quarantined, qurbani: !!c.is_qurbani_marked }}
        actions={<>
          {/* Undo Sale — time-limited */}
          {c.status === "sold" && latestSaleData?.sold_at &&
            nowMs - new Date(latestSaleData.sold_at).getTime() <= 7 * 86400000 && (
            <UndoSaleButton cattleId={c.id} tagId={c.tag_id} soldAt={latestSaleData.sold_at} />
          )}
          <EditCattleDialog
            cattle={{
              id: c.id,
              tag_id: c.tag_id,
              gender: c.gender,
              breed: c.breed,
              dob: c.dob,
              purchase_date: c.purchase_date ?? "",
              purchase_price: c.purchase_price ?? 0,
              initial_weight_kg: c.initial_weight_kg ?? 0,
              initial_weight_type: c.initial_weight_type,
              target_weight_kg: c.target_weight_kg ?? null,
              expected_daily_gain_kg: c.expected_daily_gain_kg ?? null,
              notes: c.notes,
              existingTagIds,
              existingBreeds,
            }}
          />
          <CattleDetailMoreMenu
            cattleId={c.id}
            tagId={c.tag_id}
            status={c.status}
            isQuarantined={c.is_quarantined ?? false}
            isQurbani={c.is_qurbani_marked ?? false}
          />
        </>}
        dates={{ purchase: fmtDay(c.purchase_date), dob: c.dob ? fmtDay(c.dob) : null, daysOnFarm: daysInPen }}
        weight={{
          kg: hm?.weightKg ?? (latestWeight || null),
          basis: hm?.weightBasis ?? (measured.length ? "measured" : c.initial_weight_type === "estimated" ? "estimated" : "measured"),
          daysSinceWeighed: hm?.daysSinceWeighed ?? null,
          initialKg: c.initial_weight_kg ?? null,
          initialType: weightTypeLabel(c.initial_weight_type),
          growth: growth ? { gainKg: growth.gainKg, fromKg: growth.baseline.weightKg, from: growth.baseline.date, fromPurchase: growth.baseline.source === "initial" } : null,
        }}
        adg={{ kg: adg, tier: adgTier, tierLabel: adgLabel, adg14, breedAvg: breedAverageAdg }}
        target={c.target_weight_kg && (hm?.weightKg ?? latestWeight) ? { kg: Number(c.target_weight_kg), progress: ((hm?.weightKg ?? latestWeight) / Number(c.target_weight_kg)) * 100 } : null}
        cost={{
          total: totalCost, purchase: Number(c.purchase_price ?? 0), feed: totalFeedCost, medical: medicalCost, other: otherIndividualCost,
          running: runningFeedEstimate, planReference: allocatedFeedCost > 0 ? allocatedFeedCost : null,
          breakEvenPerKg: (hm?.weightKg ?? latestWeight) > 0 ? totalCost / (hm?.weightKg ?? latestWeight) : null,
        }}
        value={c.status === "active" && hm ? { worth: hm.valueToday, profit: hm.profitToday } : null}
        realised={c.status === "sold"
          ? { kind: "sold", salePrice: latestSaleData?.sale_price_total != null ? Number(latestSaleData.sale_price_total) : null, result: latestSaleData?.sale_price_total != null ? Number(latestSaleData.sale_price_total) - totalCost : -totalCost }
          : c.status === "dead" ? { kind: "dead", salePrice: null, result: -totalCost } : null}
        perKg={{
          cost: weightGain > 0 && gainWindowCost > 0 ? gainWindowCost / weightGain : null,
          feed: weightGain > 0 && gainWindowFeed > 0 ? gainWindowFeed / weightGain : null,
        }}
        nextHealth={c.status === "active" && nextHealthData
          ? { title: nextHealthData.title, date: String(nextHealthData.scheduled_at).slice(0, 10), overdue: String(nextHealthData.scheduled_at).slice(0, 10) < todayDhaka() }
          : null}
        notes={c.notes ?? null}
      />

      <CattleDetailTabs
        defaultTab={c.status === "active" ? "weight" : "overview"}
        overview={
          <>
            <DailyFeedRequirementCard
              cattleId={c.id}
              initialWeightKg={c.initial_weight_kg ?? 0}
              latestLoggedWeightKg={latestWeight}
              lastWeighedAt={sortedLogs[0]?.recorded_at ?? null}
              purchaseDate={c.purchase_date ?? new Date().toISOString()}
              expectedDailyGainKg={c.expected_daily_gain_kg ?? 0.8}
              roughageOverrideKg={(c.manual_feed_override as { roughageKg?: number } | null)?.roughageKg ?? null}
              activeRoughage={currentRoughage}
            />
            <WeightSection
              cattleId={c.id}
              cattleStatus={c.status}
              initialLogs={logs}
              purchaseDate={c.purchase_date}
              initialWeight={c.initial_weight_kg}
              totalConsumed={actualFeedKgForGain}
            />
            <Suspense fallback={<PhotosSkeleton />}>
              <PhotosSection cattle={c} title={t.cattle_details.photos.photos} />
            </Suspense>
            <div className="grid gap-5 sm:grid-cols-2">
              <QRCodeCard cattleId={c.id} tagId={c.tag_id} />
              <InsuranceCard
                cattleId={c.id}
                provider={c.insurance_provider ?? null}
                amount={c.insurance_amount ?? null}
                expiry={c.insurance_expiry ?? null}
              />
            </div>
          </>
        }
        health={
          <>
            <Suspense fallback={<HealthSkeleton />}>
              <HealthSection cattle={c} currentWeightKg={latestWeight} />
            </Suspense>
            <Suspense fallback={<div className="h-48 rounded-xl border border-border animate-shimmer overflow-hidden" />}>
              <TimelineSection cattle={c} initialWeight={c.initial_weight_kg} weights={logs} />
            </Suspense>
          </>
        }
        weight={
          <>
            <WeightSection
              cattleId={c.id}
              cattleStatus={c.status}
              initialLogs={logs}
              purchaseDate={c.purchase_date}
              initialWeight={c.initial_weight_kg}
              totalConsumed={actualFeedKgForGain}
            />
            <GrowthForecastCard
              initialWeight={c.initial_weight_kg}
              currentWeight={latestWeight}
              estimatedWeightToday={hm?.weightKg ?? estimatedWeightToday}
              purchaseDate={c.purchase_date}
              logs={logs}
              totalConsumed={actualFeedKgForGain}
              totalCost={totalCost}
              purchasePrice={c.purchase_price}
              breedAverageAdg={breedAverageAdg}
              breed={c.breed}
              defaultMarketPrice={marketPriceData?.price_per_kg}
            />
          </>
        }
        feed={
          <DailyFeedRequirementCard
            cattleId={c.id}
            initialWeightKg={c.initial_weight_kg ?? 0}
            latestLoggedWeightKg={latestWeight}
            lastWeighedAt={sortedLogs[0]?.recorded_at ?? null}
            purchaseDate={c.purchase_date ?? new Date().toISOString()}
            expectedDailyGainKg={c.expected_daily_gain_kg ?? 0.8}
            roughageOverrideKg={(c.manual_feed_override as { roughageKg?: number } | null)?.roughageKg ?? null}
            activeRoughage={currentRoughage}
          />
        }
        finance={
          <>
            {c.status === "active" && (
              <Suspense fallback={<div className="h-[220px] rounded-xl border border-border/60 animate-shimmer overflow-hidden" />}>
                <SellCashImpactCard
                  businessId={businessId}
                  tagId={c.tag_id}
                  latestWeightKg={latestWeight}
                  estimatedWeightKg={hm?.weightKg ?? estimatedWeightToday}
                  totalCost={totalCost}
                  marketPricePerKg={marketPriceData?.price_per_kg}
                  breakEvenPerKg={breakEvenPerKg}
                  t={t}
                />
              </Suspense>
            )}
            {(feedDaysNotRecorded > 0 || actualRowsMissingCost > 0 || legacyEstimatedRows > 0) && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
                {feedDaysNotRecorded > 0 && (
                  <p><strong>{L(`${feedDaysNotRecorded} দিনের খাবার লেখা নেই`, `${feedDaysNotRecorded} day${feedDaysNotRecorded === 1 ? "" : "s"} NOT RECORDED`)}</strong> — {L("এই দিনগুলোর কোনো খাবার চালু বা লেখা নেই, তাই খরচে ধরা হয়নি (আন্দাজও করা হয়নি)। \"খাবার ব্যবহার\" পাতায় আগের তারিখ দিয়ে খাবার চালু করলে ধরা হবে।", "no feed usage period or feeding record covers these days, so the actual feed cost does not include them. They are not guessed. Start a feed on the Feed usage page (a past start date is fine) to cover them.")}</p>
                )}
                {legacyEstimatedRows > 0 && (
                  <p>{L(`${legacyEstimatedRows}টি খাবারের রেকর্ড পুরনো স্বয়ংক্রিয় হিসাবে তৈরি (মাপা নয়, আন্দাজ)। যেমন ছিল রাখা হয়েছে, আনুমানিক হিসেবে চিহ্নিত।`, `${legacyEstimatedRows} of the feeding rows were created by the old automatic deduction (not weighed). They are kept as recorded and flagged as estimates.`)}</p>
                )}
                {actualRowsMissingCost > 0 && (
                  <p>{L(`${actualRowsMissingCost}টি খাবারের রেকর্ডের দাম জানা নেই (তখন দামসহ কেনা ছিল না)। ৳0 ধরা হয়নি।`, `${actualRowsMissingCost} recorded feeding row${actualRowsMissingCost === 1 ? " has" : "s have"} no known cost. Not counted as ৳0.`)}</p>
                )}
              </div>
            )}
            {hasMissingFeedPrices && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
                ⚠️ Feed cost cannot be calculated — no purchase price found for your active feed. Add a purchase transaction in Inventory to enable cost tracking.
              </div>
            )}
            <CostTimelineCard
              purchaseDate={c.purchase_date}
              purchasePrice={c.purchase_price}
              consumptions={actualFeedRows}
              treatments={treatments}
              individualCosts={individualCosts}
              overheadCost={overheadCost}
              allocatedFeedCost={0 /* the timeline shows actual costs only; the estimate is shown separately */}
              allocatedConcentrateKg={allocatedConcentrateKg}
              allocatedRoughageKg={allocatedRoughageKg}
              activeRoughage={currentRoughage}
            />
          </>
        }
        gallery={
          <Suspense fallback={<PhotosSkeleton />}>
            <PhotosSection cattle={c} title={t.cattle_details.photos.photos} />
          </Suspense>
        }
        timeline={
          <Suspense fallback={<div className="h-48 rounded-xl border border-border animate-shimmer overflow-hidden" />}>
            <TimelineSection cattle={c} initialWeight={c.initial_weight_kg} weights={logs} />
          </Suspense>
        }
        identity={
          <div className="grid gap-5 sm:grid-cols-2">
            <QRCodeCard cattleId={c.id} tagId={c.tag_id} />
            <InsuranceCard
              cattleId={c.id}
              provider={c.insurance_provider ?? null}
              amount={c.insurance_amount ?? null}
              expiry={c.insurance_expiry ?? null}
            />
          </div>
        }
      />
    </div>
  );
}

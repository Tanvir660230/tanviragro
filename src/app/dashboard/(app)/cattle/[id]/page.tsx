import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATTLE_STATUS_STYLE } from "@/constants/cattle-status";
import { createClient } from "@/lib/supabase/server";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { WeightSection } from "@/components/cattle/WeightSection";
import { CattlePhotoGallery } from "@/components/cattle/CattlePhotoGallery";
import { GrowthForecastCard } from "@/components/cattle/GrowthForecastCard";
import { HealthEventSection } from "@/components/cattle/HealthEventSection";
import { CostTimelineCard } from "@/components/cattle/CostTimelineCard";
import { QRCodeCard } from "@/components/cattle/QRCodeCard";
import { PrintExportButton } from "@/components/cattle/PrintExportButton";
import { EditCattleDialog } from "@/components/cattle/EditCattleDialog";
import { MedicalHistoryTab } from "@/components/cattle/MedicalHistoryTab";
import { SellCashImpactCard } from "@/components/cattle/SellCashImpactCard";
import { LifeCycleTimeline } from "@/components/cattle/LifeCycleTimeline";
import type { Cattle, WeightLog, CattlePhoto, HealthEvent } from "@/types/database";
import type { CattleTreatment } from "@/app/dashboard/(app)/cattle/medical-actions";
import { getDictionary } from "@/i18n/getDictionary";
import { cookies } from "next/headers";
import { computeDepreciation } from "@/lib/accounting/engine";
import { DailyFeedRequirementCard } from "@/components/cattle/DailyFeedRequirementCard";
import { UndoSaleButton } from "@/components/cattle/UndoSaleButton";
import { calculateDailyFeedRequirement, calculateAlgorithmicFeedCost, ROUGHAGE_TYPES } from "@/utils/feed-calculator";
import { InsuranceCard } from "@/components/cattle/InsuranceCard";
import { CattleDetailTabs } from "@/components/cattle/CattleDetailTabs";
import { CattleDetailMoreMenu } from "@/components/cattle/CattleDetailMoreMenu";
import { TrackCattleView } from "@/components/cattle/TrackCattleView";

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
    title: data ? `Cattle #${(data as { tag_id: string }).tag_id}` : "Not Found",
  };
}

const STATUS_STYLE = CATTLE_STATUS_STYLE;

type LogRow = Pick<WeightLog, "id" | "weight_kg" | "recorded_at" | "notes" | "girth_cm" | "length_cm">;

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

function MedicalSkeleton() {
  return (
    <div className="rounded-xl bg-card p-5 border border-border/70 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-52" />
        <Skeleton className="h-8 w-40 rounded-lg" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="grid grid-cols-5 gap-3 rounded-lg bg-muted/20 px-3 py-2.5">
            {Array.from({ length: 5 }).map((_, j) => (
              <Skeleton key={j} className="h-4" />
            ))}
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

async function HealthSection({ cattleId, businessId }: { cattleId: string; businessId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("health_events")
    .select("*")
    .eq("cattle_id", cattleId)
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .order("scheduled_at", { ascending: true });
  return (
    <HealthEventSection
      cattleId={cattleId}
      businessId={businessId}
      events={(data ?? []) as HealthEvent[]}
    />
  );
}

async function TimelineSection({ cattle, initialWeight, weights }: { cattle: Cattle, initialWeight: number, weights: LogRow[] }) {
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
      weights={weights}
      healthEvents={(healthData ?? []) as HealthEvent[]}
      treatments={(treatmentsData ?? []) as CattleTreatment[]}
      status={cattle.status}
      updatedAt={cattle.updated_at}
    />
  );
}

async function MedicalSection({
  cattleId,
  currentWeightKg,
}: {
  cattleId: string;
  currentWeightKg: number;
}) {
  const supabase = await createClient();
  const [
    { data: treatmentsData },
    { data: medItemsData },
    { data: medProtocolsData },
  ] = await Promise.all([
    supabase
      .from("cattle_treatments")
      .select("*")
      .eq("cattle_id", cattleId)
      .order("treated_at", { ascending: false }),
    supabase
      .from("inventory_items")
      .select("id, name, unit")
      .eq("category", "medicine")
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("medicine_protocols")
      .select("item_id, dose_per_100kg_weight, frequency_days, notes"),
  ]);
  return (
    <MedicalHistoryTab
      cattleId={cattleId}
      currentWeightKg={currentWeightKg}
      medicineItems={
        (medItemsData ?? []) as { id: string; name: string; unit: string }[]
      }
      protocols={
        (medProtocolsData ?? []) as {
          item_id: string;
          dose_per_100kg_weight: number;
          frequency_days: number | null;
          notes: string | null;
        }[]
      }
      initialTreatments={(treatmentsData ?? []) as CattleTreatment[]}
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

  // Pre-fetch feed item IDs so we can filter consumption transactions without a join
  const { data: feedItemsData } = await supabase
    .from("inventory_items")
    .select("id, name, unit")
    .eq("business_id", businessId)
    .eq("category", "feed");
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
  ] = await Promise.all([
    supabase.from("cattle").select("*").eq("id", id).eq("business_id", businessId).maybeSingle(),
    supabase
      .from("weight_logs")
      .select("id, weight_kg, recorded_at, notes, girth_cm, length_cm")
      .eq("cattle_id", id)
      .is("deleted_at", null)
      .order("recorded_at", { ascending: true })
      .limit(500),
    feedItemIds.length
      ? supabase
          .from("inventory_transactions")
          .select("qty, unit_cost, recorded_at, notes, item_id")
          .eq("cattle_id", id)
          .eq("type", "consumption")
          .in("item_id", feedItemIds)
          .order("recorded_at", { ascending: true })
      : Promise.resolve({ data: [] as { qty: number; unit_cost: number | null; recorded_at: string; notes: string | null; item_id: string }[], error: null }),
    supabase
      .from("cost_entries")
      .select("amount, category, description, recorded_at")
      .eq("cattle_id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      // Vet/medical costs are already shown via cattle_treatments below —
      // excluding the category here avoids double-counting the same expense.
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
      .select("id, name, unit, roughage_active_from, roughage_active_until")
      .eq("business_id", businessId)
      .not("roughage_active_from", "is", null),
    supabase
      .from("feed_recipes")
      .select("id, active_from, active_until, recipe_ingredients(item_id, qty_per_batch)")
      .eq("business_id", businessId)
      .not("active_from", "is", null),
    supabase
      .from("sales")
      .select("sold_at")
      .eq("cattle_id", id)
      .is("deleted_at", null)
      .order("sold_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
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

  const roughages = (roughagesData ?? []) as { id: string; name: string; unit: string; roughage_active_from: string; roughage_active_until: string | null }[];
  const recipes = (recipesData ?? []) as { id: string; active_from: string; active_until: string | null; recipe_ingredients: { item_id: string; qty_per_batch: number }[] }[];
  
  const currentRoughage = roughages.find(r => !r.roughage_active_until) || null;

  // We will pass the active roughage details to the UI
  // And we will use it to calculate the exact algorithmic feed cost.

  // Algorithmic Feed Cost = sum of daily requirements * rough estimate of unit cost
  // Let's get a rough estimate of unit cost from recent purchase transactions.
  const { data: recentPurchases } = await supabase
    .from("inventory_transactions")
    .select("item_id, unit_cost, inventory_items!inner(business_id)")
    .eq("inventory_items.business_id", businessId)
    .eq("type", "purchase")
    .order("recorded_at", { ascending: false })
    .limit(300);

  const unitCostMap: Record<string, number> = {};
  for (const p of (recentPurchases ?? [])) {
    if (p.unit_cost != null && !unitCostMap[p.item_id]) {
      unitCostMap[p.item_id] = p.unit_cost; // First one found is most recent
    }
  }

  // Calculate allocated cost over the days in pen
  let allocatedFeedCost = 0;
  let allocatedConcentrateKg = 0;
  let allocatedRoughageKg = 0;

  if (daysInPen > 0 && startMs > 0) {
    const overrideRoughage = (c.manual_feed_override as { roughageKg?: number } | null)?.roughageKg ?? null;

    function getCostsForDate(dateStr: string) {
      let activeRecipe = recipes.find(r => r.active_from <= dateStr && (!r.active_until || r.active_until >= dateStr));
      if (!activeRecipe && recipes.length > 0) {
        activeRecipe = [...recipes].sort((a,b) => b.active_from.localeCompare(a.active_from)).find(r => r.active_from <= dateStr) || recipes[0];
      }
      
      let mixFeedUnitCost = 0;
      if (activeRecipe) {
        let totalCost = 0;
        let totalQty = 0;
        for (const ing of activeRecipe.recipe_ingredients) {
          totalQty += ing.qty_per_batch;
          totalCost += ing.qty_per_batch * (unitCostMap[ing.item_id] || 0);
        }
        if (totalQty > 0) mixFeedUnitCost = totalCost / totalQty;
      }

      let activeRoughage = roughages.find(r => r.roughage_active_from <= dateStr && (!r.roughage_active_until || r.roughage_active_until >= dateStr));
      if (!activeRoughage && roughages.length > 0) {
         activeRoughage = [...roughages].sort((a,b) => b.roughage_active_from.localeCompare(a.roughage_active_from)).find(r => r.roughage_active_from <= dateStr) || roughages[0];
      }
      const roughageUnitCost = activeRoughage ? (unitCostMap[activeRoughage.id] || 0) : 0;

      return { mixFeedUnitCost, roughageUnitCost };
    }

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

    const { allocatedFeedCost: afc, allocatedConcentrateKg: ack, allocatedRoughageKg: ark } = calculateAlgorithmicFeedCost({
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
  }

  // Warn when allocated feed cost is zero despite having active feeds (missing purchase price data)
  const hasMissingFeedPrices =
    daysInPen > 0 &&
    (roughages.length > 0 || recipes.length > 0) &&
    allocatedFeedCost === 0 &&
    Object.keys(unitCostMap).length === 0;

  // Individual logged consumptions directly for this cow (if any).
  const directFeedCost = consumptions
    .filter((r) => r.unit_cost != null)
    .reduce((s, r) => s + Number(r.qty) * Number(r.unit_cost!), 0);

  // Use direct logs when available; fall back to algorithmic allocation otherwise.
  // Mixing both would double-count: direct logs ARE the same feed that the allocation
  // estimates from schedules — they measure the same physical feed from two angles.
  const totalFeedCost = directFeedCost > 0 ? directFeedCost : allocatedFeedCost;

  const overheadCost = 0;
  const totalCost = Number(c.purchase_price) + totalFeedCost + medicalCost + otherIndividualCost;
  // Marginal cost = everything spent AFTER purchase (feed, vet, transport, etc.)
  // Used for "cost per kg gained" — purchase price is excluded because it's a sunk
  // cost paid regardless of how much weight the animal gains.
  const marginalCost = totalFeedCost + medicalCost + otherIndividualCost;

  const sortedLogs = [...logs].sort(
    (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
  );
  const latestWeight = sortedLogs[0]?.weight_kg ?? (c.initial_weight_kg ?? 0);
  const weightGain = parseFloat((latestWeight - (c.initial_weight_kg ?? 0)).toFixed(2));
  const breakEvenPerKg = latestWeight > 0 ? totalCost / latestWeight : null;

  // All-time ADG — use days from purchase to LAST WEIGH DATE (not today).
  // Using today inflates the denominator when the animal hasn't been weighed recently,
  // making ADG appear artificially lower than the measured growth rate.
  const latestLogMs = logs.length > 0 ? new Date(sortedLogs[0].recorded_at).getTime() : nowMs;
  const daysToLatestLog = Math.max(1, Math.floor((latestLogMs - startMs) / 86400000));
  const adg =
    logs.length > 0 && daysToLatestLog > 0
      ? (latestWeight - (c.initial_weight_kg ?? 0)) / daysToLatestLog
      : null;

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
  const adgColor = {
    good: "text-emerald-600 dark:text-emerald-400",
    fair: "text-amber-600 dark:text-amber-400",
    poor: "text-red-500 dark:text-red-400",
    none: "text-muted-foreground",
  }[adgTier];
  const adgLabel = {
    good: t.cattle_details.smart.performance_good,
    fair: t.cattle_details.smart.performance_fair,
    poor: t.cattle_details.smart.performance_poor,
    none: "—",
  }[adgTier];

  return (
    <div className="space-y-4">
      {/* Track this cattle view for SearchBox recent history */}
      <TrackCattleView id={c.id} tagId={c.tag_id} />

      {/* ── Hero ── */}
      <div className="overflow-hidden rounded-xl bg-card border border-border shadow-card animate-fade-in-up">
        {/* ADG performance band */}
        <div className={cn("h-1 w-full", {
          "bg-gradient-to-r from-emerald-300 via-emerald-500 to-emerald-300": adgTier === "good",
          "bg-gradient-to-r from-amber-300 via-amber-500 to-amber-300": adgTier === "fair",
          "bg-gradient-to-r from-red-300 via-red-500 to-red-300": adgTier === "poor",
          "bg-muted/40": adgTier === "none",
        })} />

        {/* Header bar */}
        <div className="flex items-center gap-2 sm:gap-3 border-b border-border px-3 sm:px-5 py-3 sm:py-4">
          <Link
            href="/dashboard/cattle"
            className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t.cattle_details.profile.back_to_livestock}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h1 className="text-xl sm:text-2xl font-bold">#{c.tag_id}</h1>
              <span
                className={cn(
                  "rounded-full px-2 sm:px-2.5 py-0.5 text-xs font-medium capitalize",
                  STATUS_STYLE[c.status]
                )}
              >
                {(t.cattle_details.dialogs as Record<string, string>)[c.status] ?? c.status}
              </span>
            </div>
            <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
              {c.gender === "male" ? "♂" : "♀"} {c.gender === "male" ? t.cattle_details.table.gender_male : t.cattle_details.table.gender_female}
              {c.breed && ` · ${c.breed}`}
              {daysInPen !== null && ` · ${daysInPen} ${t.cattle_details.profile.days_unit}`}
              {adg !== null && (
                <span className={cn("ml-1.5 font-semibold", adgColor)}>
                  · ADG {adg.toFixed(2)} kg/d
                </span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Undo Sale — time-limited, shown prominently */}
            {c.status === "sold" && latestSaleData?.sold_at &&
              nowMs - new Date(latestSaleData.sold_at).getTime() <= 7 * 86400000 && (
              <UndoSaleButton cattleId={c.id} tagId={c.tag_id} soldAt={latestSaleData.sold_at} />
            )}

            {/* Edit — primary action, always visible */}
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
                target_weight_kg: c.target_weight_kg ?? null,
                expected_daily_gain_kg: c.expected_daily_gain_kg ?? null,
                notes: c.notes,
                existingTagIds,
                existingBreeds,
              }}
            />

            {/* Secondary actions — collapsed in "···" menu */}
            <CattleDetailMoreMenu
              cattleId={c.id}
              tagId={c.tag_id}
              status={c.status}
              isQuarantined={c.is_quarantined ?? false}
              isQurbani={c.is_qurbani_marked ?? false}
            />
          </div>
        </div>

        {/* 3-column body */}
        <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">

          {/* Col 1 — Identity */}
          <div className="p-3 sm:p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.cattle_details.profile.identity}
            </p>
            {/* Gender + breed chips */}
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize">
                {c.gender === "male" ? "♂" : "♀"} {c.gender === "male" ? t.cattle_details.table.gender_male : t.cattle_details.table.gender_female}
              </span>
              {c.breed && (
                <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-semibold">
                  {c.breed}
                </span>
              )}
            </div>
            {/* Key dates */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t.cattle_details.profile.purchase_date}</span>
                <span className="font-medium tabular-nums">
                  {new Date(c.purchase_date ?? "").toLocaleDateString("en-US", {
                    timeZone: "Asia/Dhaka",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              {c.dob && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t.cattle_details.profile.dob}</span>
                  <span className="font-medium tabular-nums">
                    {new Date(c.dob).toLocaleDateString("en-US", {
                      timeZone: "Asia/Dhaka",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t.cattle_details.profile.days_in_pen_label}</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {daysInPen !== null ? `${daysInPen} ${t.cattle_details.profile.days_unit}` : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Col 2 — Weight */}
          <div className="p-3 sm:p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.cattle_details.profile.weight_tab}
            </p>
            <div>
              <p className="text-4xl font-bold tabular-nums leading-none">
                {latestWeight}
                <span className="ml-1 text-lg font-normal text-muted-foreground">kg</span>
              </p>
              {logs.length > 0 ? (
                <p
                  className={cn(
                    "mt-1.5 text-sm font-medium",
                    weightGain >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
                  )}
                >
                  {weightGain >= 0 ? "+" : ""}
                  {weightGain} kg from {c.initial_weight_kg} kg
                </p>
              ) : (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {t.cattle_details.profile.initial_weight_purchase}
                </p>
              )}
            </div>

            {weightGain > 0 && (c.initial_weight_kg ?? 0) > 0 && (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{c.initial_weight_kg} kg</span>
                  <span>
                    {latestWeight} kg (+
                    {((weightGain / c.initial_weight_kg!) * 100).toFixed(1)}%)
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-emerald-500 transition-all"
                    style={{
                      width: `${Math.min(
                        (weightGain / c.initial_weight_kg!) * 300,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {adg !== null && (
              <div className={cn(
                "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
                adgTier === "good" ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/40" :
                adgTier === "fair" ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/40" :
                "bg-red-50 dark:bg-red-950/30 border border-red-200/70 dark:border-red-800/40"
              )}>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.cattle_details.weight.avg_daily_gain}</p>
                  <p className={cn("text-lg font-bold tabular-nums leading-tight", adgColor)}>
                    {adg.toFixed(2)} <span className="text-xs font-normal opacity-70">kg/d</span>
                  </p>
                </div>
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-bold",
                  adgTier === "good" ? "bg-emerald-600 dark:bg-emerald-500 text-white" :
                  adgTier === "fair" ? "bg-amber-600 dark:bg-amber-500 text-white" :
                  "bg-destructive text-destructive-foreground"
                )}>
                  {adgLabel}
                </span>
                {adg14 !== null && (
                  <div className="border-l border-border/60 pl-2 ml-1">
                    <p className="text-xs text-muted-foreground">{t.cattle_details.smart.adg_14_day}</p>
                    <p className={cn("text-sm font-bold tabular-nums", adg14 >= 0.5 ? "text-emerald-600 dark:text-emerald-400" : adg14 >= 0.3 ? "text-amber-600 dark:text-amber-400" : "text-red-500 dark:text-red-400")}>
                      {adg14.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Col 3 — Financials */}
          <div className="p-3 sm:p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.cattle_details.profile.financials}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-muted/40 p-2.5 border border-border/50">
                <p className="text-xs font-medium uppercase text-muted-foreground truncate">
                  {t.cattle_details.profile.purchase_price}
                </p>
                <p className="mt-0.5 text-sm font-bold tabular-nums">
                  {c.purchase_price != null ? `৳${Number(c.purchase_price).toLocaleString("en-IN")}` : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 p-2.5 border border-border/50">
                <p className="text-xs font-medium uppercase text-muted-foreground truncate">
                  {t.cattle_details.profile.feed_cost}
                </p>
                <p className="mt-0.5 text-sm font-bold tabular-nums">
                  {totalFeedCost > 0
                    ? `৳${totalFeedCost.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                    : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-primary/5 p-2.5 ring-2 ring-primary/20">
                <p className="text-xs font-medium uppercase text-muted-foreground truncate">
                  {t.cattle_details.smart.true_total_cost}
                </p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-primary">
                  ৳{totalCost.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 p-2.5 border border-border/50">
                <p className="text-xs font-medium uppercase text-muted-foreground truncate">
                  {t.cattle_details.smart.break_even}
                </p>
                <p className="mt-0.5 text-sm font-bold tabular-nums">
                  {breakEvenPerKg ? `৳${breakEvenPerKg.toFixed(0)}/kg` : "—"}
                </p>
              </div>
            </div>
            
            {c.status === "dead" && (
              <div className="rounded-lg bg-red-500/10 p-3 ring-2 ring-red-500/20">
                <p className="text-xs font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
                  {t.cattle_details.profile.total_mortality_loss}
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-red-700 dark:text-red-400">
                  -৳{totalCost.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </p>
                <p className="mt-1 text-xs text-red-600/80 dark:text-red-400/80 leading-snug">
                  {t.cattle_details.profile.mortality_desc}
                </p>
              </div>
            )}

            {/* Cost breakdown bar */}
            {totalCost > 0 && (() => {
              const segments = [
                { label: t.cattle_details.smart.purchase,         amount: Number(c.purchase_price), color: "bg-blue-500" },
                { label: t.cattle_details.smart.feed_consumption, amount: totalFeedCost,             color: "bg-amber-500" },
                { label: t.cattle_details.smart.veterinary,       amount: medicalCost,               color: "bg-red-400" },
                { label: t.cattle_details.health.other,           amount: otherIndividualCost,       color: "bg-slate-400" },
              ].filter(s => s.amount > 0);
              return (
                <div className="space-y-1.5">
                  <div className="flex h-2 w-full overflow-hidden rounded-full gap-px bg-muted">
                    {segments.map((s) => (
                      <div
                        key={s.label}
                        className={`h-full ${s.color} first:rounded-l-full last:rounded-r-full transition-all`}
                        style={{ width: `${(s.amount / totalCost) * 100}%` }}
                        title={`${s.label}: ৳${Math.round(s.amount).toLocaleString("en-IN")} (${Math.round((s.amount / totalCost) * 100)}%)`}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {segments.map((s) => (
                      <span key={s.label} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className={`inline-block h-2 w-2 rounded-full ${s.color}`} />
                        {s.label} {Math.round((s.amount / totalCost) * 100)}%
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
            {weightGain > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                {marginalCost > 0 && (
                  <span>
                    {t.cattle_details.profile.cost_per_kg_gained}:{" "}
                    <span className="font-semibold text-foreground">৳{(marginalCost / weightGain).toFixed(0)}/kg</span>
                  </span>
                )}
                {totalFeedCost > 0 && (
                  <span>
                    {t.cattle_details.profile.feed_per_kg_gain}:{" "}
                    <span className="font-semibold text-amber-700 dark:text-amber-400">৳{(totalFeedCost / weightGain).toFixed(0)}/kg</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {c.notes && (
          <div className="border-t border-border px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.cattle_details.profile.notes}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed">{c.notes}</p>
          </div>
        )}
      </div>

      <CattleDetailTabs
        defaultTab={c.status === "active" ? "growth_finance" : "overview"}
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
              totalConsumed={allocatedConcentrateKg + allocatedRoughageKg}
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
              <HealthSection cattleId={c.id} businessId={c.business_id} />
            </Suspense>
            <Suspense fallback={<MedicalSkeleton />}>
              <MedicalSection cattleId={c.id} currentWeightKg={latestWeight} />
            </Suspense>
            <Suspense fallback={<div className="h-48 rounded-xl border border-border animate-shimmer overflow-hidden" />}>
              <TimelineSection cattle={c} initialWeight={c.initial_weight_kg} weights={logs} />
            </Suspense>
          </>
        }
        growthFinance={
          <>
            {c.status === "active" && (
              <Suspense fallback={<div className="h-[220px] rounded-xl border border-border/60 animate-shimmer overflow-hidden" />}>
                <SellCashImpactCard
                  businessId={businessId}
                  tagId={c.tag_id}
                  latestWeightKg={latestWeight}
                  estimatedWeightKg={estimatedWeightToday}
                  totalCost={totalCost}
                  marketPricePerKg={marketPriceData?.price_per_kg}
                  breakEvenPerKg={breakEvenPerKg}
                  t={t}
                />
              </Suspense>
            )}
            <GrowthForecastCard
              initialWeight={c.initial_weight_kg}
              currentWeight={latestWeight}
              estimatedWeightToday={estimatedWeightToday}
              purchaseDate={c.purchase_date}
              logs={logs}
              totalConsumed={allocatedConcentrateKg + allocatedRoughageKg}
              totalCost={totalCost}
              purchasePrice={c.purchase_price}
              breedAverageAdg={breedAverageAdg}
              breed={c.breed}
              defaultMarketPrice={marketPriceData?.price_per_kg}
            />
            {hasMissingFeedPrices && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
                ⚠️ Feed cost cannot be calculated — no purchase price found for your active feed. Add a purchase transaction in Inventory to enable cost tracking.
              </div>
            )}
            <CostTimelineCard
              purchaseDate={c.purchase_date}
              purchasePrice={c.purchase_price}
              consumptions={consumptions}
              treatments={treatments}
              individualCosts={individualCosts}
              overheadCost={overheadCost}
              allocatedFeedCost={allocatedFeedCost}
              allocatedConcentrateKg={allocatedConcentrateKg}
              allocatedRoughageKg={allocatedRoughageKg}
              activeRoughage={currentRoughage}
            />
          </>
        }
      />
    </div>
  );
}

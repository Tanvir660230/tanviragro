import type { Metadata } from "next";
import { Suspense } from "react";
import { Wheat } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  EnterpriseNutritionWorkspace,
  type WorkspaceCattleItem,
} from "@/components/cattle/EnterpriseNutritionWorkspace";
import type { FeedNutrientProfile, FeedCategory } from "@/lib/nutrition/nutrition-engine";
import { ROUGHAGE_TYPES, type RoughageTypeId } from "@/utils/feed-calculator";
import { loadUnitCostMap } from "@/lib/inventory/unit-cost";

export const metadata: Metadata = {
  title: "Enterprise Feed & Nutrition Management",
  description: "Live feed planning, batch execution, ration balancing, and automated inventory sync.",
};

export type FeedCattle = {
  id: string;
  tagId: string;
  breed: string | null;
  gender: string;
  initialWeight: number;
  latestWeight: number | null;
  lastWeighedAt: string | null;
  purchaseDate: string;
  expectedDailyGainKg: number;
  roughageOverrideKg: number | null;
  daysInPen: number;
};



export default async function FeedPlanningPage() {
  return (
    <div className="space-y-4">
      <Suspense fallback={<FeedPlanningSkeleton />}>
        <FeedPlanningSection />
      </Suspense>
    </div>
  );
}

function FeedPlanningSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg animate-shimmer overflow-hidden shrink-0" />
        <div className="h-10 w-10 rounded-xl animate-shimmer overflow-hidden shrink-0" />
        <div className="space-y-1.5">
          <div className="h-7 w-44 animate-shimmer rounded overflow-hidden" />
          <div className="h-4 w-36 animate-shimmer rounded overflow-hidden" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-shimmer rounded-xl overflow-hidden" />)}
      </div>
      <div className="h-16 animate-shimmer rounded-xl overflow-hidden" />
      <div className="h-80 animate-shimmer rounded-xl overflow-hidden" />
    </div>
  );
}

async function FeedPlanningSection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();

  if (!businessId) {
    return <PageHeader title="Feed Planning" icon={Wheat} back="/dashboard/cattle" />;
  }

  const todayISO = new Date().toISOString().slice(0, 10);
  const todayMs  = new Date(todayISO).getTime();

  // 1. All active cattle
  const { data: rawCattle } = await supabase
    .from("cattle")
    .select("id, tag_id, breed, gender, purchase_date, initial_weight_kg, expected_daily_gain_kg, manual_feed_override")
    .eq("business_id", businessId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("tag_id", { ascending: true });

  const cattle = rawCattle ?? [];
  const activeIds = cattle.map((c) => c.id);

  if (activeIds.length === 0) {
    return (
      <>
        <PageHeader
          title="Feed Planning"
          subtitle="No active cattle"
          icon={Wheat}
          back="/dashboard/cattle"
        />
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 py-12 text-center">
          <Wheat className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">Add active cattle to see daily feed requirements.</p>
        </div>
      </>
    );
  }

  // 2. Latest weight per cattle + business settings + roughage + recipe prices (parallel)
  const [
    { data: rawLogs },
    { data: bizData },
    { data: roughagesData },
    { data: recipesData },
    recentPurchases,
    { data: feedItemRows },
    { data: balanceRows },
  ] = await Promise.all([
    supabase
      .from("weight_logs")
      .select("cattle_id, weight_kg, recorded_at")
      .in("cattle_id", activeIds)
      .is("deleted_at", null)
      .order("recorded_at", { ascending: false })
      .limit(activeIds.length * 5),
    supabase
      .from("businesses")
      .select("default_roughage_type")
      .eq("id", businessId)
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
    loadUnitCostMap(supabase, businessId),
    supabase
      .from("inventory_items")
      .select("id, name, unit, category, kg_per_unit, low_stock_threshold")
      .eq("business_id", businessId)
      .in("category", ["feed", "roughage"])
      .eq("is_discontinued", false)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("v_inventory_balance")
      .select("item_id, qty_on_hand")
      .eq("business_id", businessId),
  ]);

  // Build latest weight map
  const latestWeightMap: Record<string, { weight_kg: number; recorded_at: string }> = {};
  for (const l of (rawLogs ?? []) as { cattle_id: string; weight_kg: number; recorded_at: string }[]) {
    if (!(l.cattle_id in latestWeightMap)) {
      latestWeightMap[l.cattle_id] = { weight_kg: l.weight_kg, recorded_at: l.recorded_at };
    }
  }

  // Weighted-average cost of IN rows with a known cost — never the latest purchase price (P-04)
  const unitCostMap = recentPurchases;   // item_id → current unit cost (database)
  const defaultRoughageType = ((bizData as { default_roughage_type?: string } | null)?.default_roughage_type ?? "straw") as RoughageTypeId;
  const roughageDm = ROUGHAGE_TYPES.find((r) => r.id === defaultRoughageType)?.dmPercent ?? 0.90;

  // Real inventory only: stock from the signed ledger balance, price = WAC (null = "No data").
  // Feeding sessions dispense kilograms, so only items counted in kg are offered here;
  // items counted in pieces (e.g. straw bundles) are recorded with "Record Feeding" in
  // their own unit. Nutrient values are typical category values (no nutrient data is
  // stored per item) and are labelled as such.
  const stockByItem = new Map(
    ((balanceRows ?? []) as { item_id: string; qty_on_hand: number | string }[]).map((b) => [b.item_id, Number(b.qty_on_hand)])
  );
  const inventoryItems: FeedNutrientProfile[] = ((feedItemRows ?? []) as {
    id: string; name: string; unit: string; category: string; kg_per_unit: number | null; low_stock_threshold: number | null;
  }[])
    .filter((i) => i.unit.trim().toLowerCase() === "kg")
    .map((i) => {
      const isRoughage = i.category === "roughage";
      return {
        id: i.id,
        name: i.name,
        category: isRoughage ? "dry_roughage" : "energy_concentrate",
        dmPercent: isRoughage ? roughageDm : 0.88,
        cpPercentDm: isRoughage ? 4.2 : 16.5,
        tdnPercentDm: isRoughage ? 44.0 : 75.0,
        nutrientSource: "reference",
        costPerKgAsFed: unitCostMap[i.id] ?? null,
        currentStockKg: stockByItem.get(i.id) ?? 0,
        lowStockThresholdKg: i.low_stock_threshold,
      } satisfies FeedNutrientProfile;
    });

  // Build WorkspaceCattleItem array
  const workspaceCattle: WorkspaceCattleItem[] = cattle.map((c) => {
    const latestLog = latestWeightMap[c.id];
    const overrideRoughage = (c.manual_feed_override as { roughageKg?: number } | null)?.roughageKg ?? null;
    const purchaseMs = c.purchase_date ? new Date(c.purchase_date + "T00:00:00").getTime() : todayMs;
    const currentWeight = latestLog?.weight_kg ?? c.initial_weight_kg ?? 250;
    return {
      id: c.id,
      tagId: c.tag_id,
      breed: c.breed,
      gender: c.gender,
      currentWeightKg: currentWeight,
      initialWeightKg: c.initial_weight_kg ?? currentWeight,
      targetWeightKg: Math.round(currentWeight * 1.3),
      expectedDailyGainKg: c.expected_daily_gain_kg ?? 0.8,
      roughageOverrideKg: overrideRoughage,
      daysOnFarm: Math.max(0, Math.floor((todayMs - purchaseMs) / 86400000)),
    };
  });

  return (
    <>
      <PageHeader
        title="Enterprise Feed & Nutrition Management"
        subtitle={`${workspaceCattle.length} active cattle · live feeding operations, stock deduction & FCR intelligence`}
        icon={Wheat}
        back="/dashboard/cattle"
      />
      <EnterpriseNutritionWorkspace
        cattle={workspaceCattle}
        inventoryItems={inventoryItems}
        todayISO={todayISO}
      />
    </>
  );
}


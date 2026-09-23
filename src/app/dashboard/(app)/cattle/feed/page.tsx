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
import type { RoughageTypeId } from "@/utils/feed-calculator";

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
    { data: recentPurchases },
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
      .select("id, name, unit, roughage_active_from, roughage_active_until")
      .eq("business_id", businessId)
      .not("roughage_active_from", "is", null),
    supabase
      .from("feed_recipes")
      .select("id, active_from, active_until, recipe_ingredients(item_id, qty_per_batch)")
      .eq("business_id", businessId)
      .not("active_from", "is", null),
    supabase
      .from("inventory_transactions")
      .select("item_id, unit_cost, inventory_items!inner(business_id)")
      .eq("inventory_items.business_id", businessId)
      .eq("type", "purchase")
      .order("recorded_at", { ascending: false })
      .limit(300),
  ]);

  // Build latest weight map
  const latestWeightMap: Record<string, { weight_kg: number; recorded_at: string }> = {};
  for (const l of (rawLogs ?? []) as { cattle_id: string; weight_kg: number; recorded_at: string }[]) {
    if (!(l.cattle_id in latestWeightMap)) {
      latestWeightMap[l.cattle_id] = { weight_kg: l.weight_kg, recorded_at: l.recorded_at };
    }
  }

  // Unit cost map (most recent purchase price per item)
  const unitCostMap: Record<string, number> = {};
  for (const p of (recentPurchases ?? []) as { item_id: string; unit_cost: number | null }[]) {
    if (p.unit_cost != null && !unitCostMap[p.item_id]) unitCostMap[p.item_id] = p.unit_cost;
  }

  // Active roughage (no active_until = currently active)
  const roughages = (roughagesData ?? []) as { id: string; name: string; unit: string; roughage_active_from: string; roughage_active_until: string | null }[];
  const activeRoughage = roughages.find((r) => !r.roughage_active_until) ?? roughages.at(-1) ?? null;
  const roughageUnitCost = activeRoughage ? (unitCostMap[activeRoughage.id] ?? 0) : 0;

  // Active recipe cost per kg of mix
  type RecipeRow = { id: string; active_from: string; active_until: string | null; recipe_ingredients: { item_id: string; qty_per_batch: number }[] };
  const recipes = (recipesData ?? []) as RecipeRow[];
  const activeRecipe = recipes.find((r) => !r.active_until) ?? recipes.at(-1) ?? null;
  let mixUnitCostPerKg = 0;
  if (activeRecipe) {
    let totalCost = 0, totalQty = 0;
    for (const ing of activeRecipe.recipe_ingredients) {
      totalQty += ing.qty_per_batch;
      totalCost += ing.qty_per_batch * (unitCostMap[ing.item_id] ?? 0);
    }
    if (totalQty > 0) mixUnitCostPerKg = totalCost / totalQty;
  }

  const defaultRoughageType = ((bizData as { default_roughage_type?: string } | null)?.default_roughage_type ?? "straw") as RoughageTypeId;

  // Build rich FeedNutrientProfiles
  const inventoryItems: FeedNutrientProfile[] = [
    {
      id: "feed-mix-01",
      name: "Standard Fattening Concentrate Mix",
      category: "energy_concentrate",
      dmPercent: 0.88,
      cpPercentDm: 16.5,
      tdnPercentDm: 75.0,
      costPerKgAsFed: mixUnitCostPerKg > 0 ? mixUnitCostPerKg : 42.0,
      currentStockKg: 850,
      lowStockThresholdKg: 150,
    },
    {
      id: "feed-straw-01",
      name: activeRoughage?.name || "Khor / Rice Straw (খড়)",
      category: "dry_roughage",
      dmPercent: 0.90,
      cpPercentDm: 4.2,
      tdnPercentDm: 44.0,
      costPerKgAsFed: roughageUnitCost > 0 ? roughageUnitCost : 8.5,
      currentStockKg: 1200,
      lowStockThresholdKg: 200,
    },
    {
      id: "feed-protein-01",
      name: "Mustard Oil Cake (সরিষার খৈল)",
      category: "protein_concentrate",
      dmPercent: 0.91,
      cpPercentDm: 34.0,
      tdnPercentDm: 78.0,
      costPerKgAsFed: 48.0,
      currentStockKg: 320,
      lowStockThresholdKg: 100,
    },
    {
      id: "feed-min-01",
      name: "Livestock Mineral Pre-Mix (মিনারেল মিক্স)",
      category: "mineral_supplement",
      dmPercent: 0.95,
      cpPercentDm: 0.0,
      tdnPercentDm: 0.0,
      costPerKgAsFed: 120.0,
      currentStockKg: 45,
      lowStockThresholdKg: 20,
    },
  ];

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


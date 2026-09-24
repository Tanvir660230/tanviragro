import type { Metadata } from "next";
import Link from "next/link";
import { FlaskConical, History, Receipt, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AddItemDialog } from "@/components/inventory/AddItemDialog";
import { StockSection } from "@/components/inventory/StockSection";
import { DailyFeedDeductButton } from "@/components/inventory/DailyFeedDeductButton";
import { RecipesSection } from "@/components/inventory/RecipesSection";
import { ActiveFeedingDashboard } from "@/components/inventory/ActiveFeedingDashboard";
import { SetupSection } from "@/components/inventory/SetupSection";
import { InventorySubNav } from "@/components/inventory/InventorySubNav";
import { InventoryDashboardClient } from "@/components/inventory/InventoryDashboardClient";
import { CentralInventoryRepository } from "@/lib/inventory/inventory-repository";
import { getFarmDailyFeedRequirement } from "@/app/dashboard/(app)/inventory/actions";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import type { CattleOption } from "@/components/inventory/ItemActions";
import type { InventoryRow } from "@/components/inventory/InventoryTable";
import type { ItemStockSummary } from "@/lib/inventory/types";
import { cookies } from "next/headers";
import { getDictionary } from "@/i18n/getDictionary";
import { todayDhaka } from "@/lib/dates";
import { scaleRecipe } from "@/lib/inventory/recipe-math";
import { estimateFeedCost, kgToItemUnits, weightedAverageUnitCost, type ItemCostInfo } from "@/lib/inventory/feed-costing";
import { loadUnitCostMap } from "@/lib/inventory/unit-cost";

type MoveRow = { item_id: string; type: string; qty: number; unit_cost: number | null; recorded_at: string; notes: string | null };

export const metadata: Metadata = { title: "Inventory & Warehouse" };

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  const { open } = await searchParams;

  const supabase = await createClient();
  const cookieStore = await cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value === "bn" ? "bn" : "en");
  const t = await getDictionary(locale as "en" | "bn");

  const todayMs = new Date().getTime();
  const thirtyDaysAgo = new Date(todayMs - 30 * 86400000);
  const thirtyDaysAgoStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
  }).format(thirtyDaysAgo);
  const businessId = await getCurrentBusinessId(supabase);

  const [
    { data: itemsData },
    { data: statsData },
    { data: purchasesData },
    { data: cattleData },
    { data: recipesData },
    portfolioData,
    movementsData,
  ] = await Promise.all([
    businessId
      ? supabase
          .from("inventory_items")
          .select("id, name, category, unit, kg_per_unit, low_stock_threshold, is_active_roughage, roughage_active_until, roughage_active_from, is_discontinued")
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .order("is_discontinued", { ascending: true })
          .order("category", { ascending: true })
          .order("name", { ascending: true })
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase
          .rpc("get_inventory_stats", {
            p_business_id: businessId,
            p_30_days_ago: thirtyDaysAgoStr,
          })
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase
          .from("inventory_transactions")
          .select("item_id, qty, unit_cost, recorded_at, inventory_items!inner(business_id)")
          .eq("inventory_items.business_id", businessId)
          .eq("type", "purchase").neq("movement_type", "consumption_reversal") // an undo is not a new price
          .order("recorded_at", { ascending: true })
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase
          .from("cattle")
          .select("id, tag_id")
          .eq("business_id", businessId)
          .eq("status", "active")
          .is("deleted_at", null)
          .order("tag_id", { ascending: true })
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase
          .from("feed_recipes")
          .select("id, name, output_qty, output_unit, notes, is_active, active_from, active_until, deleted_at, recipe_ingredients(item_id, qty_per_batch, inventory_items!inner(name, unit))")
          .eq("business_id", businessId)
          .order("deleted_at", { ascending: true, nullsFirst: true })
          .order("name", { ascending: true })
      : Promise.resolve({ data: [] }),
    businessId
      ? CentralInventoryRepository.getInventoryPortfolio(supabase, businessId)
      : Promise.resolve([]),
    businessId
      ? supabase
          .from("inventory_transactions")
          .select("item_id, type, qty, unit_cost, recorded_at, notes, inventory_items!inner(business_id)")
          .eq("inventory_items.business_id", businessId)
          .order("recorded_at", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] }),
  ]);

  const portfolio = (portfolioData ?? []) as ItemStockSummary[];
  const movements = ((movementsData ?? {}) as { data?: MoveRow[] }).data ?? [];

  type StatRow = { item_id: string; total_stock: number; total_consumed: number; consumed_last_30d: number };
  const stats = (statsData ?? []) as StatRow[];

  type PurchaseRow = { item_id: string; qty: number; unit_cost: number | null; recorded_at: string };
  const purchasesTxns = (purchasesData ?? []) as PurchaseRow[];

  const stockMap: Record<string, number> = {};
  const consumedTotalMap: Record<string, number> = {};
  const avgDailyMap: Record<string, number> = {};

  for (const s of stats) {
    stockMap[s.item_id] = s.total_stock;
    consumedTotalMap[s.item_id] = s.total_consumed;
    avgDailyMap[s.item_id] = s.consumed_last_30d / 30;
  }

  let activeRecipeName: string | null = null;
  let activeRecipeFrom: string | null = null;
  let activeRecipeUntil: string | null = null;
  let activeRoughageName: string | null = null;
  let activeRoughageUntil: string | null = null;
  let todayConcentrateKg = 0;
  let todayRoughageKg = 0;

  if (businessId) {
    const activeRecipe = (recipesData ?? []).find((r) => r.is_active);
    const activeRoughageItem = (itemsData ?? []).find((i) => i.is_active_roughage);

    if (activeRecipe) {
      activeRecipeName = activeRecipe.name;
      activeRecipeFrom = (activeRecipe as { active_from?: string | null }).active_from ?? null;
      activeRecipeUntil = activeRecipe.active_until ?? null;
    }
    if (activeRoughageItem) { activeRoughageName = activeRoughageItem.name; activeRoughageUntil = activeRoughageItem.roughage_active_until ?? null; }

    if (activeRecipe || activeRoughageItem) {
      const todayStr = todayDhaka(); // farm calendar day (Asia/Dhaka), not UTC
      const reqRes = await getFarmDailyFeedRequirement(todayStr);

      if (reqRes.success && reqRes.data) {
        const { totalConcentrateKg, totalRoughageKg } = reqRes.data;
        todayConcentrateKg = totalConcentrateKg;
        todayRoughageKg = totalRoughageKg;

        if (activeRecipe && totalConcentrateKg > 0) {
          // REPLACE the historical 30-day average with the forward-looking recipe projection.
          // Adding on top would double-count (historical avg ≈ same quantity as projection).
          // Scaled by the ingredient total (mass balance), not by the stored batch size.
          for (const l of scaleRecipe(activeRecipe.recipe_ingredients ?? [], totalConcentrateKg)) {
            avgDailyMap[l.item_id] = l.qty;
          }
        }
        if (activeRoughageItem && totalRoughageKg > 0) {
          // The plan is in kg; the item may be counted in pieces. Convert only when kg per
          // unit is known — otherwise keep the recorded 30-day average.
          const inUnits = kgToItemUnits(totalRoughageKg, activeRoughageItem.unit, activeRoughageItem.kg_per_unit);
          if (inUnits != null) avgDailyMap[activeRoughageItem.id] = inUnits;
        }
      }
    }
  }

  // Current unit cost per item from the database (moving average of the stock on hand)
  const unitCosts = businessId ? await loadUnitCostMap(supabase, businessId) : {};
  const wacMap: Record<string, number | null> = {};
  for (const itemRow of (itemsData ?? []) as { id: string }[]) wacMap[itemRow.id] = unitCosts[itemRow.id] ?? null;

  const items: InventoryRow[] = (itemsData ?? []).map(
    (item: { id: string; name: string; category: string; unit: string; low_stock_threshold: number | null; is_active_roughage: boolean | null; is_discontinued: boolean }) => ({
      ...item,
      // Signed: a negative balance means consumption was recorded without matching stock-in.
      stock: parseFloat((stockMap[item.id] ?? 0).toFixed(3)),
      avgDailyConsumption: avgDailyMap[item.id] ?? null,
      currentCost: wacMap[item.id] ?? null,
    })
  );

  const activeItems = items.filter((i) => !i.is_discontinued);
  const discontinuedItems = items.filter((i) => i.is_discontinued);

  const cattle: CattleOption[] = (cattleData ?? []) as CattleOption[];

  // ESTIMATED daily feed cost of today's ration plan at weighted-average cost.
  // Roughage priced per piece is converted with kg_per_unit; if that is unknown the
  // roughage cost is reported as unknown instead of multiplying ৳/piece by kg.
  const costInfo: Record<string, ItemCostInfo> = {};
  for (const i of (itemsData ?? []) as { id: string; name: string; unit: string; kg_per_unit: number | null }[]) {
    costInfo[i.id] = { unit: i.unit, kgPerUnit: i.kg_per_unit, unitCost: wacMap[i.id] ?? null, name: i.name };
  }
  const estimateLines: { item_id: string; kg: number }[] = [];
  const activeRecipeForCost = (recipesData ?? []).find((r) => r.is_active);
  if (activeRecipeForCost && todayConcentrateKg > 0) {
    for (const l of scaleRecipe(activeRecipeForCost.recipe_ingredients ?? [], todayConcentrateKg)) {
      estimateLines.push({ item_id: l.item_id, kg: l.qty });
    }
  }
  const activeRoughageForCost = (itemsData ?? []).find((i: { is_active_roughage: boolean | null }) => i.is_active_roughage) as { id: string } | undefined;
  if (activeRoughageForCost && todayRoughageKg > 0) {
    estimateLines.push({ item_id: activeRoughageForCost.id, kg: todayRoughageKg });
  }
  const estimate = estimateFeedCost(estimateLines, costInfo);
  const estimatedDailyCost = estimate.total;

  // Feed items that are low on stock (for Today card warning) — active only
  const lowStockFeedItems = activeItems
    .filter((i) =>
      (i.category === "feed" || i.category === "roughage") &&
      i.low_stock_threshold !== null &&
      i.stock <= i.low_stock_threshold
    )
    .map((i) => ({
      name: i.name,
      daysLeft:
        i.avgDailyConsumption && i.avgDailyConsumption > 0
          ? Math.floor(i.stock / i.avgDailyConsumption)
          : null,
    }));

  // Build item lookup for recipes
  const itemsLookup: Record<string, { name: string; unit: string }> = {};
  for (const item of items) itemsLookup[item.id] = { name: item.name, unit: item.unit };

  type JoinedItem = { name: string; unit: string } | null;
  const allRecipes = (recipesData ?? []).map((r) => ({
    ...r,
    ingredients: (r.recipe_ingredients ?? []).map((ri) => {
      const inv = ri.inventory_items as unknown as JoinedItem;
      return {
        item_id: ri.item_id,
        qty_per_batch: ri.qty_per_batch,
        item_name: inv?.name ?? itemsLookup[ri.item_id]?.name ?? ri.item_id,
        item_unit: inv?.unit ?? itemsLookup[ri.item_id]?.unit ?? "",
      };
    }),
  }));
  const recipes = allRecipes.filter((r) => !(r as { deleted_at?: string | null }).deleted_at);
  const deletedRecipes = allRecipes.filter((r) => !!(r as { deleted_at?: string | null }).deleted_at);

  const stockItems = items.map((i) => ({ id: i.id, name: i.name, unit: i.unit, stock: i.stock, category: i.category }));

  const feedItems = items.filter((i) => i.category === "feed" || i.category === "roughage");

  return (
    <div className="space-y-4 pb-12">

      {/* Mobile floating deduct button — quick access without scrolling */}
      {feedItems.length > 0 && cattle.length > 0 && (
        <div className="md:hidden fixed bottom-20 right-4 z-40">
          <DailyFeedDeductButton feedItems={feedItems} cattleCount={cattle.length} prominent />
        </div>
      )}

      {/* Enterprise Sub-Navigation */}
      <InventorySubNav />

      {/* Enterprise Operational Dashboard */}
      <InventoryDashboardClient
        portfolio={portfolio}
        movements={movements}
        inventoryRows={activeItems}
        cattle={cattle}
      />

      {/* Today's Active Feed Dashboard */}
      <ActiveFeedingDashboard
        activeRecipeName={activeRecipeName}
        activeRecipeFrom={activeRecipeFrom}
        activeRecipeUntil={activeRecipeUntil}
        activeRoughageName={activeRoughageName}
        activeRoughageUntil={activeRoughageUntil}
        dailyConcentrateKg={todayConcentrateKg}
        dailyRoughageKg={todayRoughageKg}
        feedItems={feedItems}
        cattleCount={cattle.length}
        estimatedDailyCost={estimatedDailyCost}
        estimatedCostUnknownItems={estimate.unknownItems}
        lowStockFeedItems={lowStockFeedItems}
      />

      {/* STOCK SECTION — full item list with management actions */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground tracking-tight">{t.inventory.stock.heading}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Real-time stock valuation and inventory health monitor</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DailyFeedDeductButton feedItems={feedItems} cattleCount={cattle.length} />
            <Link
              href="/dashboard/inventory/mix-feed"
              className="inline-flex h-8 items-center justify-center rounded-lg border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-muted"
            >
              <FlaskConical className="mr-1.5 h-3.5 w-3.5 text-primary" />
              Feed Mixer
            </Link>
            <Link
              href="/dashboard/inventory/purchase/history"
              className="inline-flex h-8 items-center justify-center rounded-lg border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground"
            >
              <History className="mr-1.5 h-3.5 w-3.5" />
              History
            </Link>
            <Link
              href="/dashboard/inventory/purchase"
              className="inline-flex h-8 items-center justify-center rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-amber-600/90"
            >
              <Receipt className="mr-1.5 h-3.5 w-3.5" />
              Add Purchase
            </Link>
            <AddItemDialog defaultOpen={open === "add"} />
          </div>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 py-16 text-center">
            <Package className="h-10 w-10 text-muted-foreground/50" />
            <div>
              <p className="font-medium">{t.inventory.no_items_yet}</p>
              <p className="text-sm text-muted-foreground">{t.inventory.add_first_item}</p>
            </div>
            <AddItemDialog />
          </div>
        ) : (
          <StockSection items={activeItems} discontinuedItems={discontinuedItems} cattle={cattle} />
        )}
      </div>

      {/* SETUP SECTION — collapsed by default */}
      <SetupSection>
        <RecipesSection recipes={recipes} deletedRecipes={deletedRecipes} allItems={stockItems} />
      </SetupSection>
    </div>
  );
}

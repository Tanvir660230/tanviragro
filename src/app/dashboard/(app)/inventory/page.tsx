import type { Metadata } from "next";
import Link from "next/link";
import { Package, Plus, Search, Filter, RefreshCcw, AlertTriangle, ArrowUpRight, ArrowDownRight, Settings2, MoreHorizontal, FileText, CheckCircle2, FlaskConical, Beaker, Thermometer, ShieldAlert, BadgeCheck, Receipt, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AddItemDialog } from "@/components/inventory/AddItemDialog";
import { StockSection } from "@/components/inventory/StockSection";
import { DailyFeedDeductButton } from "@/components/inventory/DailyFeedDeductButton";
import { RecipesSection } from "@/components/inventory/RecipesSection";
import { AutoEngineRunner } from "@/components/inventory/AutoEngineRunner";
import { ActiveFeedingDashboard } from "@/components/inventory/ActiveFeedingDashboard";
import { SetupSection } from "@/components/inventory/SetupSection";
import { getFarmDailyFeedRequirement } from "@/app/dashboard/(app)/inventory/actions";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import type { CattleOption } from "@/components/inventory/ItemActions";
import type { InventoryRow } from "@/components/inventory/InventoryTable";
import { cookies } from "next/headers";
import { getDictionary } from "@/i18n/getDictionary";

export const metadata: Metadata = { title: "Inventory & Feed" };

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
  ] = await Promise.all([
    businessId
      ? supabase
          .from("inventory_items")
          .select("id, name, category, unit, low_stock_threshold, is_active_roughage, roughage_active_until, roughage_active_from, is_discontinued")
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
          .eq("type", "purchase")
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
  ]);

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
      const todayStr = new Date().toISOString().slice(0, 10);
      const reqRes = await getFarmDailyFeedRequirement(todayStr);

      if (reqRes.success && reqRes.data) {
        const { totalConcentrateKg, totalRoughageKg } = reqRes.data;
        todayConcentrateKg = totalConcentrateKg;
        todayRoughageKg = totalRoughageKg;

        if (activeRecipe && totalConcentrateKg > 0) {
          const scale = totalConcentrateKg / activeRecipe.output_qty;
          for (const ing of activeRecipe.recipe_ingredients ?? []) {
            // REPLACE the historical 30-day average with the forward-looking recipe projection.
            // Adding on top would double-count (historical avg ≈ same quantity as projection).
            avgDailyMap[ing.item_id] = ing.qty_per_batch * scale;
          }
        }
        if (activeRoughageItem && totalRoughageKg > 0) {
          // Replace, not add — same reasoning as recipe ingredients above.
          avgDailyMap[activeRoughageItem.id] = totalRoughageKg;
        }
      }
    }
  }

  // FIFO unit cost per item
  const fifoUnitCostMap: Record<string, number | null> = {};
  for (const itemRow of (itemsData ?? []) as { id: string }[]) {
    const purchases = purchasesTxns.filter((tx) => tx.item_id === itemRow.id);
    const totalConsumed = consumedTotalMap[itemRow.id] ?? 0;
    const batches = purchases.map((p) => ({ qty: p.qty, unit_cost: p.unit_cost }));
    let remaining = totalConsumed;
    for (const b of batches) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, b.qty);
      b.qty -= take;
      remaining -= take;
    }
    let totalValue = 0, totalQty = 0;
    for (const b of batches) {
      if (b.qty > 0 && b.unit_cost != null) { totalValue += b.qty * b.unit_cost; totalQty += b.qty; }
    }
    fifoUnitCostMap[itemRow.id] = totalQty > 0 ? totalValue / totalQty : null;
  }

  const items: InventoryRow[] = (itemsData ?? []).map(
    (item: { id: string; name: string; category: string; unit: string; low_stock_threshold: number | null; is_active_roughage: boolean | null; is_discontinued: boolean }) => ({
      ...item,
      stock: parseFloat(Math.max(0, stockMap[item.id] ?? 0).toFixed(3)),
      avgDailyConsumption: avgDailyMap[item.id] ?? null,
      currentCost: fifoUnitCostMap[item.id] ?? null,
    })
  );

  const activeItems = items.filter((i) => !i.is_discontinued);
  const discontinuedItems = items.filter((i) => i.is_discontinued);

  const cattle: CattleOption[] = (cattleData ?? []) as CattleOption[];

  // Estimated daily feed cost using FIFO costs
  let estimatedDailyCost = 0;
  const activeRecipeForCost = (recipesData ?? []).find((r) => r.is_active);
  if (activeRecipeForCost && todayConcentrateKg > 0) {
    const scale = todayConcentrateKg / (activeRecipeForCost.output_qty || 1);
    for (const ing of activeRecipeForCost.recipe_ingredients ?? []) {
      const cost = fifoUnitCostMap[ing.item_id];
      if (cost != null) estimatedDailyCost += ing.qty_per_batch * scale * cost;
    }
  }
  const activeRoughageForCost = (itemsData ?? []).find((i: { is_active_roughage: boolean | null }) => i.is_active_roughage) as { id: string } | undefined;
  if (activeRoughageForCost && todayRoughageKg > 0) {
    const cost = fifoUnitCostMap[activeRoughageForCost.id];
    if (cost != null) estimatedDailyCost += todayRoughageKg * cost;
  }

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

  // All low-stock items (any category) — for stat card, active only
  const lowStockItems = activeItems.filter(
    (i) => i.low_stock_threshold !== null && i.stock <= i.low_stock_threshold
  );

  const totalFarmValue = activeItems.reduce(
    (sum, item) => sum + item.stock * (item.currentCost ?? 0), 0
  );

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
      <AutoEngineRunner />

      {/* Mobile floating deduct button — quick access without scrolling */}
      {feedItems.length > 0 && cattle.length > 0 && (
        <div className="md:hidden fixed bottom-20 right-4 z-40">
          <DailyFeedDeductButton feedItems={feedItems} cattleCount={cattle.length} prominent />
        </div>
      )}

      {/* TODAY CARD — most prominent, always at top */}
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
        lowStockFeedItems={lowStockFeedItems}
      />

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">{t.inventory.page.total_value}</p>
          <p className="mt-2 text-xl font-bold tabular-nums">৳{totalFarmValue.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">{t.inventory.page.total_items}</p>
          <p className="mt-2 text-xl font-bold">{items.length} <span className="text-sm font-normal text-muted-foreground">{t.inventory.tracked}</span></p>
        </div>
        <div className={`rounded-xl border p-4 shadow-card ${lowStockItems.length > 0 ? "border-amber-300/70 bg-amber-50/60 dark:border-amber-800/50 dark:bg-amber-950/20" : "border-border/70 bg-card"}`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">{t.inventory.page.low_stock}</p>
          <p className={`mt-2 text-xl font-bold ${lowStockItems.length > 0 ? "text-amber-700 dark:text-amber-400" : ""}`}>
            {lowStockItems.length} <span className="text-sm font-normal text-muted-foreground">{lowStockItems.length === 1 ? t.inventory.item : t.inventory.items}</span>
          </p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">{t.inventory.page.feed_items}</p>
          <p className="mt-2 text-xl font-bold">{feedItems.length} <span className="text-sm font-normal text-muted-foreground">{t.inventory.tracked}</span></p>
        </div>
      </div>

      {/* STOCK SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">{t.inventory.stock.heading}</h2>
          <div className="flex items-center gap-2">
            {/* Daily deduction — shown on all screens */}
            <DailyFeedDeductButton feedItems={feedItems} cattleCount={cattle.length} />
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/inventory/purchase/history"
                className="inline-flex h-8 items-center justify-center rounded-lg border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-card transition-colors hover:bg-muted hover:text-foreground"
              >
                <History className="mr-1.5 h-3.5 w-3.5" />
                History
              </Link>
              <Link
                href="/dashboard/inventory/purchase"
                className="inline-flex h-8 items-center justify-center rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-card transition-colors hover:bg-amber-600/90"
              >
                <Receipt className="mr-1.5 h-3.5 w-3.5" />
                Add Purchase
              </Link>
            </div>
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

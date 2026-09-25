import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, FlaskConical, History, Package, PlayCircle, Receipt, Wheat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AddItemDialog } from "@/components/inventory/AddItemDialog";
import { StockSection } from "@/components/inventory/StockSection";
import { DailyFeedDeductButton } from "@/components/inventory/DailyFeedDeductButton";
import { RecipesSection } from "@/components/inventory/RecipesSection";
import { ActiveFeedingDashboard } from "@/components/inventory/ActiveFeedingDashboard";
import { SetupSection } from "@/components/inventory/SetupSection";
import { InventorySubNav } from "@/components/inventory/InventorySubNav";
import { InventoryFeedBoard } from "@/components/inventory/InventoryFeedBoard";
import { loadFeedData } from "@/lib/feed/feed-data";
import { getBusinessContext } from "@/lib/context/business-context";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/constants/roles";
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
import { loadInventoryStats } from "@/lib/inventory/consumption-stats";

type MoveRow = { item_id: string; type: string; movement_type: string | null; qty: number; unit_cost: number | null; recorded_at: string; created_at: string; notes: string | null };

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
      ? loadInventoryStats(supabase, businessId, thirtyDaysAgoStr).then((data) => ({ data }))   // eaten = consumption − undo
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
          .select("item_id, type, movement_type, qty, unit_cost, recorded_at, created_at, notes, inventory_items!inner(business_id)")
          .eq("inventory_items.business_id", businessId)
          .order("created_at", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] }),
  ]);

  // THE feed engine: usage periods, running estimates, days left — same as the homepage and Feed Usage
  const feed = businessId ? await loadFeedData(supabase, businessId) : null;
  const ctx = businessId ? await getBusinessContext(supabase).catch(() => null) : null;
  const canEdit = ctx ? hasPermission(ctx, PERMISSIONS.INVENTORY_EDIT) : false;

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

  // Days left: the feed engine's daily figure (running period, else usage learned from past
  // periods) wins; the ration plan / 30-day average above is only the fallback.
  for (const st of feed?.items ?? []) {
    const running = feed!.snapshot.lines.find((l) => l.itemId === st.id && l.status === "estimated");
    const daily = running?.dailyQty ?? st.learnedDaily;
    if (daily != null && daily > 0) avgDailyMap[st.id] = daily;
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

  // ── new layout: buy → start using → finished (count) ──
  const ti = t.inventory_home;
  const th = t.home;
  const month = (feed?.asOf ?? todayDhaka()).slice(0, 7);
  const openPeriods = (feed?.periods ?? []).filter((p) => p.status === "open");
  const feedStatus = feed?.items ?? [];
  const notStartedCount = feedStatus.filter((i) => !i.openPeriodId && i.stockQty > 0).length;
  const runningLow = feedStatus.filter((i) => i.openPeriodId && i.daysLeft != null && i.daysLeft <= 7).length;
  const stockValue = portfolio.reduce((s, p) => s + Number(p.totalValuation ?? 0), 0);
  const monthFeed = feed?.snapshot.byMonth[month]?.actual ?? 0;
  const itemName = new Map(items.map((i) => [i.id, i]));
  const mvLabel = (m: string | null) =>
    m === "purchase" ? ti.mv_purchase : m === "opening_balance" ? ti.mv_opening : m === "consumption" ? ti.mv_consumption
      : m === "consumption_reversal" || m === "purchase_reversal" ? ti.mv_reversal : m === "adjustment_in" || m === "adjustment_out" ? ti.mv_adjust : ti.mv_other;
  const taka = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`;
  const summary = [
    { icon: Package, label: ti.s_value, value: taka(stockValue), sub: ti.s_value_sub, warn: false },
    { icon: PlayCircle, label: ti.s_in_use, value: String(openPeriods.length), sub: ti.s_in_use_sub.replace("{count}", String(notStartedCount)), warn: false },
    { icon: AlertTriangle, label: ti.s_low, value: String(runningLow), sub: ti.s_low_sub, warn: runningLow > 0 },
    { icon: Wheat, label: ti.s_month, value: taka(monthFeed), sub: ti.s_month_sub, warn: false },
  ];

  return (
    <div className="w-full min-w-0 space-y-5 pb-12">
      <InventorySubNav />

      {/* header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{ti.title}</h1>
          <p className="text-sm text-muted-foreground">{ti.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/inventory/purchase"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary/90">
            <Receipt className="h-4 w-4" aria-hidden />{ti.buy_feed}
          </Link>
          <AddItemDialog defaultOpen={open === "add"} />
        </div>
      </header>

      {/* summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.map(({ icon: Icon, label, value, sub, warn }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />{label}</p>
            <p className={`mt-1 text-xl font-bold tabular-nums tracking-tight ${warn ? "text-red-600 dark:text-red-400" : ""}`}>{value}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      {/* in use + in stock not started */}
      {feed && (
        <InventoryFeedBoard
          data={{ asOf: feed.asOf, items: feed.items, recipes: recipes.map((r) => ({ id: r.id, name: r.name })) }}
          open={openPeriods}
          lines={feed.snapshot.lines.filter((l) => l.status === "estimated")}
          canEdit={canEdit}
          ti={ti}
          th={th}
        />
      )}

      {/* all stock — every per-item action lives here, unchanged */}
      <section aria-labelledby="allstock-title" className="space-y-3">
        <h2 id="allstock-title" className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <Package className="h-4 w-4 text-muted-foreground" aria-hidden />{ti.all_stock}
        </h2>
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
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* recent activity */}
        <section aria-labelledby="recent-title" className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="recent-title" className="flex items-center gap-2 text-sm font-semibold"><History className="h-4 w-4 text-muted-foreground" aria-hidden />{ti.recent_title}</h2>
            <Link href="/dashboard/inventory/movements" className="text-xs font-medium text-primary hover:underline">{ti.recent_all}</Link>
          </div>
          {movements.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">{ti.no_recent}</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {movements.map((m, i) => {
                const it = itemName.get(m.item_id);
                const isIn = m.type === "purchase";
                return (
                  <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{it?.name ?? "—"} <span className="text-xs font-normal text-muted-foreground">· {mvLabel(m.movement_type)}</span></span>
                      <span className="block text-[11px] text-muted-foreground">{m.movement_type === "purchase" ? ti.bought : ti.dated} {String(m.recorded_at).slice(0, 10)} · {ti.entered} {String(m.created_at).slice(0, 10)}</span>
                    </span>
                    <span className={`shrink-0 text-right tabular-nums ${isIn ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
                      {isIn ? "+" : "−"}{Number(m.qty).toLocaleString("en-IN", { maximumFractionDigits: 2 })} {it?.unit ?? ""}
                      {m.unit_cost != null && <span className="block text-[11px] text-muted-foreground">{taka(Number(m.qty) * Number(m.unit_cost))}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* tools */}
        <section aria-labelledby="tools-title" className="rounded-xl border border-border bg-card p-4 shadow-card">
          <h2 id="tools-title" className="mb-3 flex items-center gap-2 text-sm font-semibold"><FlaskConical className="h-4 w-4 text-muted-foreground" aria-hidden />{ti.tools}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/inventory/mix-feed"
              className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-xs font-medium hover:bg-muted">
              <FlaskConical className="mr-1.5 h-3.5 w-3.5 text-primary" aria-hidden />{ti.feed_mixer}
            </Link>
            <Link href="/dashboard/inventory/purchase/history"
              className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-xs font-medium hover:bg-muted">
              <History className="mr-1.5 h-3.5 w-3.5 text-primary" aria-hidden />{ti.purchase_history}
            </Link>
            {feedItems.length > 0 && cattle.length > 0 && <DailyFeedDeductButton feedItems={feedItems} cattleCount={cattle.length} />}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{ti.record_feeding_note}</p>
        </section>
      </div>

      {/* setup — recipes and ration-plan dates (plan only) */}
      <SetupSection>
        <p className="text-xs text-muted-foreground">{ti.setup_sub}</p>
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
        <RecipesSection recipes={recipes} deletedRecipes={deletedRecipes} allItems={stockItems} />
      </SetupSection>
    </div>
  );
}

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { InventoryPageView, type InventoryMove } from "@/components/inventory/InventoryPageView";
import { isRetired, loadFeedData } from "@/lib/feed/feed-data";
import { getBusinessContext } from "@/lib/context/business-context";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/constants/roles";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import type { CattleOption } from "@/components/inventory/ItemActions";
import type { InventoryRow } from "@/components/inventory/InventoryTable";
import { getDictionary } from "@/i18n/getDictionary";
import { todayDhaka } from "@/lib/dates";
import { loadUnitCostMap } from "@/lib/inventory/unit-cost";
import { buildTodo, lastMixByItem, lowItemIds } from "@/lib/inventory/stock-view";

type MoveRow = InventoryMove;
type MixInRow = { item_id: string; qty: number; recorded_at: string; notes: string | null; idempotency_key: string | null };

export const metadata: Metadata = { title: "খাবার ও স্টক" };

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

  const businessId = await getCurrentBusinessId(supabase);
  // THE feed engine (usage periods, running estimates, days left — same as the homepage and Feed
  // Usage). It also posts any day of feed-in-use that is due, so it runs BEFORE the stock is read.
  const feed = businessId ? await loadFeedData(supabase, businessId) : null;

  const [
    { data: itemsData },
    { data: cattleData },
    movementsData,
    balanceData,
    ctx,
    unitCosts,
    { data: mixInData },
    { data: undoneMixData },
  ] = await Promise.all([
    businessId
      ? supabase
          .from("inventory_items")
          .select("id, name, category, unit, kg_per_unit, low_stock_threshold, is_discontinued")
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .order("is_discontinued", { ascending: true })
          .order("category", { ascending: true })
          .order("name", { ascending: true })
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
    // a few more than shown: the automatic daily deductions are left out of this short list
    businessId
      ? supabase
          .from("inventory_transactions")
          .select("id, item_id, type, movement_type, qty, unit_cost, recorded_at, created_at, notes, inventory_items!inner(business_id)")
          .eq("inventory_items.business_id", businessId)
          .order("created_at", { ascending: false })
          .limit(60)
      : Promise.resolve({ data: [] }),
    // THE stock on hand and its value (the same view as the feed engine, the top bar and the accounts)
    businessId
      ? supabase.from("v_inventory_balance").select("item_id, qty_on_hand, value_on_hand").eq("business_id", businessId)
      : Promise.resolve({ data: [] }),
    businessId ? getBusinessContext(supabase).catch(() => null) : Promise.resolve(null),
    // current unit cost per item from the database (moving average of the stock on hand)
    businessId ? loadUnitCostMap(supabase, businessId) : Promise.resolve({} as Record<string, number>),
    // where the ingredients went: their latest mixes (newest first; a few hundred rows is months of mixing)
    businessId
      ? supabase
          .from("inventory_transactions")
          .select("item_id, qty, recorded_at, notes, idempotency_key, inventory_items!inner(business_id)")
          .eq("inventory_items.business_id", businessId)
          .eq("movement_type", "feed_mix_input")
          .order("recorded_at", { ascending: false })
          .limit(400)
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase.from("feed_mix_batches").select("id").eq("business_id", businessId).not("undone_at", "is", null)
      : Promise.resolve({ data: [] }),
  ]);

  const can = (p: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]) => (ctx ? hasPermission(ctx, p) : false);
  const perms = {
    edit: can(PERMISSIONS.INVENTORY_EDIT),
    create: can(PERMISSIONS.INVENTORY_CREATE),
    purchase: can(PERMISSIONS.INVENTORY_PURCHASE),
    consume: can(PERMISSIONS.INVENTORY_CONSUME),
    mix: can(PERMISSIONS.FEED_MIX),
  };

  const allMoves = ((movementsData ?? {}) as { data?: MoveRow[] }).data ?? [];
  const isAuto = (m: MoveRow) => m.movement_type === "consumption" && !!m.notes?.startsWith("Auto:");
  const movements = allMoves.filter((m) => !isAuto(m)).slice(0, 6);
  // the daily deductions left out between the rows shown (all of them when fewer are shown)
  const lastShown = movements.length === 6 ? allMoves.indexOf(movements[5]) + 1 : allMoves.length;
  const autoHidden = allMoves.slice(0, lastShown).filter(isAuto).length;

  const stockMap: Record<string, number> = {};
  const valueMap: Record<string, number> = {};
  for (const b of ((balanceData as { data?: { item_id: string; qty_on_hand: number | string; value_on_hand: number | string }[] | null })?.data ?? [])) {
    stockMap[b.item_id] = Number(b.qty_on_hand);
    valueMap[b.item_id] = Number(b.value_on_hand);
  }
  const dailyOf = new Map((feed?.items ?? []).map((f) => [f.id, f.dailyQty]));

  const items: InventoryRow[] = (itemsData ?? []).map(
    (item: { id: string; name: string; category: string; unit: string; low_stock_threshold: number | null; is_discontinued: boolean }) => ({
      ...item,
      // Signed: a negative balance means consumption was recorded without matching stock-in.
      stock: parseFloat((stockMap[item.id] ?? 0).toFixed(4)),
      avgDailyConsumption: dailyOf.get(item.id) ?? null,
      currentCost: unitCosts[item.id] ?? null,
      stockValue: valueMap[item.id] ?? 0,
    })
  );

  // an item with stock or in use is never tucked away as "discontinued" (the same rule as the feed data)
  const inUseIds = new Set((feed?.items ?? []).filter((i) => i.openPeriodId).map((i) => i.id));
  const retired = (i: InventoryRow) => isRetired(!!i.is_discontinued, i.stock, inUseIds.has(i.id));
  const activeItems = items.filter((i) => !retired(i));
  const discontinuedItems = items.filter(retired);
  const cattle: CattleOption[] = (cattleData ?? []) as CattleOption[];

  // ingredients: their latest mix (undone mixes do not count)
  const undone = ((undoneMixData ?? []) as { id: string }[]).map((b) => b.id);
  const mixIn = ((mixInData ?? []) as MixInRow[]).filter((r) => !undone.some((id) => r.idempotency_key?.includes(id)));
  const lastMix = lastMixByItem(mixIn);

  const asOf = feed?.asOf ?? todayDhaka();
  const month = asOf.slice(0, 7);
  const openPeriods = (feed?.periods ?? []).filter((p) => p.status === "open");
  const feedStatus = feed?.items ?? [];

  // what needs doing, and the "running out" count — one rule for the card, the list and the summary
  const todo = buildTodo({ feed: feedStatus, items: activeItems, asOf });
  const lowIds = lowItemIds(todo);
  // THE stock value: the balance view's value on hand — the same figure as the Money page
  const stockValue = items.reduce((s, i) => s + (i.stockValue ?? 0), 0);
  const monthFeed = feed?.snapshot.byMonth[month]?.actual ?? 0;

  return (
    <InventoryPageView
      locale={locale}
      t={t}
      open={open}
      perms={perms}
      asOf={asOf}
      items={items}
      activeItems={activeItems}
      discontinuedItems={discontinuedItems}
      feedStatus={feedStatus}
      openPeriods={openPeriods.map((p) => ({ ...p, lines: p.lines.map(({ posted: _posted, ...l }) => l) }))}
      lines={(feed?.snapshot.lines ?? []).filter((l) => l.status === "estimated")}
      chartTargets={[...new Set((feed?.charts ?? []).map((c) => `${c.targetType}:${c.targetId}`))]}
      todo={todo}
      lowIds={lowIds}
      lastMix={lastMix}
      cattle={cattle}
      movements={movements}
      autoHidden={autoHidden}
      stockValue={stockValue}
      monthFeed={monthFeed}
    />
  );
}

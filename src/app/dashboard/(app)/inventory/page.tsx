import type { Metadata } from "next";
import { fmtDay } from "@/lib/format";
import Link from "next/link";
import { AlertTriangle, ArrowRightLeft, Blend, CalendarRange, ClipboardList, History, Package, PlayCircle, Receipt, Scale, Wheat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AddItemDialog } from "@/components/inventory/AddItemDialog";
import { StockList, type StockStatus } from "@/components/inventory/StockList";
import { InventoryFeedBoard } from "@/components/inventory/InventoryFeedBoard";
import { isRetired, loadFeedData } from "@/lib/feed/feed-data";
import { getBusinessContext } from "@/lib/context/business-context";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/constants/roles";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import type { CattleOption } from "@/components/inventory/ItemActions";
import type { InventoryRow } from "@/components/inventory/InventoryTable";
import { cookies } from "next/headers";
import { getDictionary } from "@/i18n/getDictionary";
import { todayDhaka } from "@/lib/dates";
import { loadUnitCostMap } from "@/lib/inventory/unit-cost";

type MoveRow = { id: string; item_id: string; type: string; movement_type: string | null; qty: number; unit_cost: number | null; recorded_at: string; created_at: string; notes: string | null };

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
  ]);

  const can = (p: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]) => (ctx ? hasPermission(ctx, p) : false);
  const perms = {
    edit: can(PERMISSIONS.INVENTORY_EDIT),
    create: can(PERMISSIONS.INVENTORY_CREATE),
    purchase: can(PERMISSIONS.INVENTORY_PURCHASE),
    consume: can(PERMISSIONS.INVENTORY_CONSUME),
    mix: can(PERMISSIONS.FEED_MIX),
  };
  const canEdit = perms.edit;

  const allMoves = ((movementsData ?? {}) as { data?: MoveRow[] }).data ?? [];
  const isAuto = (m: MoveRow) => m.movement_type === "consumption" && !!m.notes?.startsWith("Auto:");
  const movements = allMoves.filter((m) => !isAuto(m)).slice(0, 8);
  // the daily deductions left out between the rows shown (all of them when fewer than 8 are shown)
  const lastShown = movements.length === 8 ? allMoves.indexOf(movements[7]) + 1 : allMoves.length;
  const autoHidden = allMoves.slice(0, lastShown).filter(isAuto).length;

  const stockMap: Record<string, number> = {};
  const valueMap: Record<string, number> = {};
  for (const b of ((balanceData as { data?: { item_id: string; qty_on_hand: number | string; value_on_hand: number | string }[] | null })?.data ?? [])) {
    stockMap[b.item_id] = Number(b.qty_on_hand);
    valueMap[b.item_id] = Number(b.value_on_hand);
  }

  // daily use: the feed engine's figure (running period, else usage learned from past periods)
  const avgDailyMap: Record<string, number> = {};
  for (const st of feed?.items ?? []) {
    if (st.dailyQty != null && st.dailyQty > 0) avgDailyMap[st.id] = st.dailyQty;
  }

  const wacMap: Record<string, number | null> = {};
  for (const itemRow of (itemsData ?? []) as { id: string }[]) wacMap[itemRow.id] = unitCosts[itemRow.id] ?? null;

  const items: InventoryRow[] = (itemsData ?? []).map(
    (item: { id: string; name: string; category: string; unit: string; low_stock_threshold: number | null; is_discontinued: boolean }) => ({
      ...item,
      // Signed: a negative balance means consumption was recorded without matching stock-in.
      stock: parseFloat((stockMap[item.id] ?? 0).toFixed(3)),
      avgDailyConsumption: avgDailyMap[item.id] ?? null,
      currentCost: wacMap[item.id] ?? null,
      stockValue: valueMap[item.id] ?? 0,
    })
  );

  // an item with stock or in use is never tucked away as "discontinued" (the same rule as the feed data)
  const inUseIds = new Set((feed?.items ?? []).filter((i) => i.openPeriodId).map((i) => i.id));
  const retired = (i: InventoryRow) => isRetired(!!i.is_discontinued, i.stock, inUseIds.has(i.id));
  const activeItems = items.filter((i) => !retired(i));
  const discontinuedItems = items.filter(retired);

  const cattle: CattleOption[] = (cattleData ?? []) as CattleOption[];


  // ── new layout: buy → start using → finished (count) ──
  const ti = t.inventory_home;
  const th = t.home;
  const month = (feed?.asOf ?? todayDhaka()).slice(0, 7);
  const openPeriods = (feed?.periods ?? []).filter((p) => p.status === "open");
  const feedStatus = feed?.items ?? [];
  const notStartedCount = feedStatus.filter((i) => i.role !== "ingredient" && !i.discontinued && !i.openPeriodId && i.stockQty > 0).length;
  // running out: a feed in use with ≤ 7 days left, or any other item at / below its alert level
  const lowIds = new Set<string>();
  for (const i of feedStatus) if (i.openPeriodId && i.daysLeft != null && i.daysLeft <= 7) lowIds.add(i.id);
  for (const i of activeItems) {
    if (inUseIds.has(i.id)) continue;
    if (i.low_stock_threshold != null && i.low_stock_threshold > 0 && i.stock > 0.0001 && i.stock <= i.low_stock_threshold) lowIds.add(i.id);
  }
  const runningLow = lowIds.size;
  // THE stock value: the balance view's value on hand — the same figure as the Money page
  const stockValue = items.reduce((s, i) => s + (i.stockValue ?? 0), 0);
  const monthFeed = feed?.snapshot.byMonth[month]?.actual ?? 0;
  const itemName = new Map(items.map((i) => [i.id, i]));
  const mvLabel = (m: string | null, notes?: string | null) =>
    notes?.startsWith("Correction") ? ti.mv_correction
      : m === "feed_mix_input" ? ti.mv_mix_in : m === "feed_mix_output" ? ti.mv_mix_out
      : m === "consumption" && notes?.startsWith("Auto:") ? ti.mv_auto
      : m === "purchase" ? ti.mv_purchase : m === "opening_balance" ? ti.mv_opening : m === "consumption" ? ti.mv_consumption
      : m === "own_production" ? ti.mv_own : m === "wastage" ? ti.mv_wastage : m === "return" ? ti.mv_return
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

      {/* header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{ti.title}</h1>
          <p className="text-sm text-muted-foreground">{ti.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {perms.purchase && <Link href="/dashboard/inventory/purchase"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary/90">
            <Receipt className="h-4 w-4" aria-hidden />{ti.buy_feed}
          </Link>}
          {perms.mix && <Link href="/dashboard/inventory/mix"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-3.5 text-sm font-semibold text-primary hover:bg-primary/10">
            <Blend className="h-4 w-4" aria-hidden />{ti.make_mix}
          </Link>}
          {/* with no items yet the empty state below carries the one "Add item" button */}
          {perms.create && items.length > 0 && <AddItemDialog defaultOpen={open === "add"} />}
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
          data={{ asOf: feed.asOf, items: feed.items, recipes: [], chartTargets: [...new Set(feed.charts.map((c) => `${c.targetType}:${c.targetId}`))] }}
          open={openPeriods.map((p) => ({ ...p, lines: p.lines.map(({ posted: _posted, ...l }) => l) }))}
          lines={feed.snapshot.lines.filter((l) => l.status === "estimated")}
          canEdit={canEdit}
          canMix={perms.mix}
          ti={ti}
          th={th}
          lang={locale}
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
            {perms.create && <AddItemDialog defaultOpen={open === "add"} />}
          </div>
        ) : (
          <StockList items={activeItems} discontinued={discontinuedItems} cattle={cattle} lang={locale} perms={perms} asOf={feed?.asOf ?? todayDhaka()} lowIds={[...lowIds]}
            status={Object.fromEntries((feed?.items ?? []).map((i): [string, StockStatus] => [i.id, { role: i.role, inUse: !!i.openPeriodId, daysLeft: i.daysLeft, suggestedStart: i.suggestedStart }]))} />
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
                  <li key={m.id ?? i} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{it ? <Link href={`/dashboard/inventory/products/${m.item_id}`} className="hover:text-primary hover:underline">{it.name}</Link> : "—"} <span className="text-xs font-normal text-muted-foreground">· {mvLabel(m.movement_type, m.notes)}</span></span>
                      <span className="block text-[11px] text-muted-foreground">{m.movement_type === "purchase" ? ti.bought : ti.dated} {fmtDay(String(m.recorded_at).slice(0, 10), locale)} · {ti.entered} {fmtDay(String(m.created_at).slice(0, 10), locale)}</span>
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
          {autoHidden > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {ti.auto_hidden.replace("{count}", String(autoHidden))}{" "}
              <Link href="/dashboard/inventory/usage" className="font-medium text-primary hover:underline">{ti.usage_history}</Link>
            </p>
          )}
        </section>

        {/* tools */}
        <section aria-labelledby="tools-title" className="rounded-xl border border-border bg-card p-4 shadow-card">
          <h2 id="tools-title" className="mb-3 flex items-center gap-2 text-sm font-semibold"><Blend className="h-4 w-4 text-muted-foreground" aria-hidden />{ti.tools}</h2>
          <div className="flex flex-wrap items-center gap-2">
            {perms.mix && <Link href="/dashboard/inventory/mix"
              className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-xs font-medium hover:bg-muted">
              <Blend className="mr-1.5 h-3.5 w-3.5 text-primary" aria-hidden />{ti.make_mix}
            </Link>}
            <Link href="/dashboard/inventory/feeding-chart"
              className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-xs font-medium hover:bg-muted">
              <Scale className="mr-1.5 h-3.5 w-3.5 text-primary" aria-hidden />{ti.feeding_chart}
            </Link>
            <Link href="/dashboard/inventory/purchase/history"
              className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-xs font-medium hover:bg-muted">
              <History className="mr-1.5 h-3.5 w-3.5 text-primary" aria-hidden />{ti.purchase_history}
            </Link>
            <Link href="/dashboard/inventory/usage"
              className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-xs font-medium hover:bg-muted">
              <CalendarRange className="mr-1.5 h-3.5 w-3.5 text-primary" aria-hidden />{ti.feed_usage}
            </Link>
            <Link href="/dashboard/inventory/movements"
              className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-xs font-medium hover:bg-muted">
              <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5 text-primary" aria-hidden />{ti.movements}
            </Link>
            <Link href="/dashboard/inventory/adjustments"
              className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-xs font-medium hover:bg-muted">
              <ClipboardList className="mr-1.5 h-3.5 w-3.5 text-primary" aria-hidden />{ti.adjustments}
            </Link>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{ti.record_feeding_note}</p>
        </section>
      </div>

    </div>
  );
}

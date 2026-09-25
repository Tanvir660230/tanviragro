import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Blend, History, Package, PlayCircle, Receipt, Scale, Wheat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AddItemDialog } from "@/components/inventory/AddItemDialog";
import { StockList, type StockStatus } from "@/components/inventory/StockList";
import { InventoryFeedBoard } from "@/components/inventory/InventoryFeedBoard";
import { loadFeedData, syncFeedAutoUsage } from "@/lib/feed/feed-data";
import { getBusinessContext } from "@/lib/context/business-context";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/constants/roles";
import { CentralInventoryRepository } from "@/lib/inventory/inventory-repository";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import type { CattleOption } from "@/components/inventory/ItemActions";
import type { InventoryRow } from "@/components/inventory/InventoryTable";
import type { ItemStockSummary } from "@/lib/inventory/types";
import { cookies } from "next/headers";
import { getDictionary } from "@/i18n/getDictionary";
import { todayDhaka } from "@/lib/dates";
import { loadUnitCostMap } from "@/lib/inventory/unit-cost";
import { loadInventoryStats } from "@/lib/inventory/consumption-stats";

type MoveRow = { item_id: string; type: string; movement_type: string | null; qty: number; unit_cost: number | null; recorded_at: string; created_at: string; notes: string | null };

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

  const todayMs = new Date().getTime();
  const thirtyDaysAgo = new Date(todayMs - 30 * 86400000);
  const thirtyDaysAgoStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
  }).format(thirtyDaysAgo);
  const businessId = await getCurrentBusinessId(supabase);
  // feed in use is deducted every day — post any due day first so the stock below is current
  if (businessId) await syncFeedAutoUsage(supabase, businessId);

  const [
    { data: itemsData },
    { data: statsData },
    { data: cattleData },
    portfolioData,
    movementsData,
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
      ? loadInventoryStats(supabase, businessId, thirtyDaysAgoStr).then((data) => ({ data }))   // eaten = consumption − undo
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


  const stockMap: Record<string, number> = {};
  const avgDailyMap: Record<string, number> = {};

  for (const s of stats) {
    stockMap[s.item_id] = s.total_stock;
    avgDailyMap[s.item_id] = s.consumed_last_30d / 30;
  }

  // Days left: the feed engine's daily figure (running period, else usage learned from past
  // periods) wins; the recorded 30-day average above is only the fallback.
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
    (item: { id: string; name: string; category: string; unit: string; low_stock_threshold: number | null; is_discontinued: boolean }) => ({
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


  // ── new layout: buy → start using → finished (count) ──
  const ti = t.inventory_home;
  const th = t.home;
  const month = (feed?.asOf ?? todayDhaka()).slice(0, 7);
  const openPeriods = (feed?.periods ?? []).filter((p) => p.status === "open");
  const feedStatus = feed?.items ?? [];
  const notStartedCount = feedStatus.filter((i) => i.role !== "ingredient" && !i.discontinued && !i.openPeriodId && i.stockQty > 0).length;
  const runningLow = feedStatus.filter((i) => i.openPeriodId && i.daysLeft != null && i.daysLeft <= 7).length;
  const stockValue = portfolio.reduce((s, p) => s + Number(p.totalValuation ?? 0), 0);
  const monthFeed = feed?.snapshot.byMonth[month]?.actual ?? 0;
  const itemName = new Map(items.map((i) => [i.id, i]));
  const mvLabel = (m: string | null, notes?: string | null) =>
    notes?.startsWith("Correction") ? ti.mv_correction
      : m === "feed_mix_input" ? ti.mv_mix_in : m === "feed_mix_output" ? ti.mv_mix_out
      : m === "consumption" && notes?.startsWith("Auto:") ? ti.mv_auto
      : m === "purchase" ? ti.mv_purchase : m === "opening_balance" ? ti.mv_opening : m === "consumption" ? ti.mv_consumption
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
          <Link href="/dashboard/inventory/purchase"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary/90">
            <Receipt className="h-4 w-4" aria-hidden />{ti.buy_feed}
          </Link>
          <Link href="/dashboard/inventory/mix"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-3.5 text-sm font-semibold text-primary hover:bg-primary/10">
            <Blend className="h-4 w-4" aria-hidden />{ti.make_mix}
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
          data={{ asOf: feed.asOf, items: feed.items, recipes: [], chartTargets: [...new Set(feed.charts.map((c) => `${c.targetType}:${c.targetId}`))] }}
          open={openPeriods.map((p) => ({ ...p, lines: p.lines.map(({ posted: _posted, ...l }) => l) }))}
          lines={feed.snapshot.lines.filter((l) => l.status === "estimated")}
          canEdit={canEdit}
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
            <AddItemDialog />
          </div>
        ) : (
          <StockList items={activeItems} discontinued={discontinuedItems} cattle={cattle} lang={locale}
            status={Object.fromEntries((feed?.items ?? []).map((i): [string, StockStatus] => [i.id, { role: i.role, inUse: !!i.openPeriodId, daysLeft: i.daysLeft }]))} />
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
                      <span className="block truncate font-medium">{it?.name ?? "—"} <span className="text-xs font-normal text-muted-foreground">· {mvLabel(m.movement_type, m.notes)}</span></span>
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
          <h2 id="tools-title" className="mb-3 flex items-center gap-2 text-sm font-semibold"><Blend className="h-4 w-4 text-muted-foreground" aria-hidden />{ti.tools}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/inventory/mix"
              className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-xs font-medium hover:bg-muted">
              <Blend className="mr-1.5 h-3.5 w-3.5 text-primary" aria-hidden />{ti.make_mix}
            </Link>
            <Link href="/dashboard/inventory/feeding-chart"
              className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-xs font-medium hover:bg-muted">
              <Scale className="mr-1.5 h-3.5 w-3.5 text-primary" aria-hidden />{ti.feeding_chart}
            </Link>
            <Link href="/dashboard/inventory/purchase/history"
              className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-xs font-medium hover:bg-muted">
              <History className="mr-1.5 h-3.5 w-3.5 text-primary" aria-hidden />{ti.purchase_history}
            </Link>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{ti.record_feeding_note}</p>
        </section>
      </div>

    </div>
  );
}

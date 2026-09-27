import Link from "next/link";
import { AlertTriangle, History, Package, PlayCircle, Wheat } from "lucide-react";
import { fmtDay } from "@/lib/format";
import type { Dictionary } from "@/i18n/getDictionary";
import type { LineResult, Period } from "@/lib/feed/usage-engine";
import type { FeedItemStatus } from "@/lib/feed/feed-data";
import type { LastMix, TodoRow } from "@/lib/inventory/stock-view";
import { AddItemDialog } from "./AddItemDialog";
import type { StockStatus } from "./StockList";
import { InventoryWorkspace } from "./InventoryWorkspace";
import { InventoryHeaderActions } from "./InventoryHeaderActions";
import { VIEW_TEXT, fillText } from "./inventory-view-text";
import type { CattleOption } from "./ItemActions";
import type { InventoryRow } from "./InventoryTable";

export type InventoryMove = { id: string; item_id: string; type: string; movement_type: string | null; qty: number; unit_cost: number | null; recorded_at: string; created_at: string; notes: string | null };

export type InventoryPageData = {
  locale: "bn" | "en";
  t: Dictionary;
  open?: string;
  perms: { edit: boolean; create: boolean; purchase: boolean; consume: boolean; mix: boolean };
  asOf: string;
  items: InventoryRow[];
  activeItems: InventoryRow[];
  discontinuedItems: InventoryRow[];
  feedStatus: FeedItemStatus[];
  openPeriods: Period[];
  lines: LineResult[];
  chartTargets: string[];
  todo: TodoRow[];
  lowIds: string[];
  lastMix: Record<string, LastMix>;
  cattle: CattleOption[];
  movements: InventoryMove[];
  autoHidden: number;
  stockValue: number;
  monthFeed: number;
};

/**
 * The stock page's layout (server-rendered; the working parts are client components).
 * The page reads the data; this only lays it out — the same code shows the real farm and
 * the sample data used to check the layout.
 */
export function InventoryPageView({ locale, t, open, perms, asOf, items, activeItems, discontinuedItems, feedStatus, openPeriods, lines, chartTargets, todo, lowIds, lastMix, cattle, movements, autoHidden, stockValue, monthFeed }: InventoryPageData) {
  const tv = VIEW_TEXT[locale];
  const ti = t.inventory_home;
  const th = t.home;
  const notStartedCount = todo.filter((r) => r.kind === "idle" || r.kind === "not_started").length;
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
    { href: "#stock", icon: Package, label: ti.s_value, value: taka(stockValue), sub: ti.s_value_sub, warn: false },
    { href: "#in-use", icon: PlayCircle, label: ti.s_in_use, value: String(openPeriods.length), sub: ti.s_in_use_sub.replace("{count}", String(notStartedCount)), warn: false },
    { href: "#todo", icon: AlertTriangle, label: ti.s_low, value: String(lowIds.length), sub: ti.s_low_sub, warn: lowIds.length > 0 },
    { href: "/dashboard/inventory/usage", icon: Wheat, label: ti.s_month, value: taka(monthFeed), sub: ti.s_month_sub, warn: false },
  ];

  return (
    <div className="w-full min-w-0 space-y-6 pb-12">

      {/* header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{ti.title}</h1>
          <p className="text-sm text-muted-foreground">{tv.subtitle}</p>
        </div>
        <InventoryHeaderActions lang={locale} perms={perms} openAdd={open === "add" && items.length > 0} />
      </header>

      {/* summary — each card jumps to where its number comes from */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.map(({ href, icon: Icon, label, value, sub, warn }) => (
          <Link key={label} href={href}
            className="rounded-xl border border-border bg-card p-4 shadow-card transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground"><Icon className="h-4 w-4 shrink-0" aria-hidden />{label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${warn ? "text-red-600 dark:text-red-400" : ""}`}>{value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 py-16 text-center">
          <Package className="h-10 w-10 text-muted-foreground/50" aria-hidden />
          <div>
            <p className="font-medium">{t.inventory.no_items_yet}</p>
            <p className="text-sm text-muted-foreground">{t.inventory.add_first_item}</p>
          </div>
          {perms.create && <AddItemDialog defaultOpen={open === "add"} />}
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          {/* main: what needs doing · in use · all stock */}
          <InventoryWorkspace
            lang={locale}
            asOf={asOf}
            perms={perms}
            usage={{ asOf, items: feedStatus, recipes: [], chartTargets }}
            open={openPeriods}
            lines={lines}
            items={activeItems}
            discontinued={discontinuedItems}
            status={Object.fromEntries(feedStatus.map((i): [string, StockStatus] => [i.id, { role: i.role, inUse: !!i.openPeriodId, daysLeft: i.daysLeft, suggestedStart: i.suggestedStart }]))}
            todo={todo}
            lowIds={lowIds}
            lastMix={lastMix}
            cattle={cattle}
            ti={ti}
            th={th}
          />

          {/* side (computer) / bottom (phone): recent activity */}
          <aside className="space-y-4 xl:sticky xl:top-20">
            <section aria-labelledby="recent-title" className="rounded-xl border border-border bg-card p-4 shadow-card">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h2 id="recent-title" className="flex items-center gap-2 text-base font-semibold"><History className="h-4 w-4 text-muted-foreground" aria-hidden />{ti.recent_title}</h2>
                <Link href="/dashboard/inventory/movements" className="text-sm font-medium text-primary hover:underline">{tv.recent_more}</Link>
              </div>
              {movements.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">{ti.no_recent}</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {movements.map((m) => {
                    const it = itemName.get(m.item_id);
                    const isIn = m.type === "purchase";
                    return (
                      <li key={m.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {it ? <Link href={`/dashboard/inventory/products/${m.item_id}`} className="hover:text-primary hover:underline">{it.name}</Link> : "—"}
                          </span>
                          <span className="block text-xs text-muted-foreground">{mvLabel(m.movement_type, m.notes)} · {fmtDay(String(m.recorded_at).slice(0, 10), locale)}</span>
                        </span>
                        <span className={`shrink-0 text-right tabular-nums ${isIn ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
                          {isIn ? "+" : "−"}{Number(m.qty).toLocaleString("en-IN", { maximumFractionDigits: 2 })} {it?.unit ?? ""}
                          {m.unit_cost != null && <span className="block text-xs text-muted-foreground">{taka(Number(m.qty) * Number(m.unit_cost))}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {autoHidden > 0 && (
                <p className="mt-2 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                  {fillText(ti.auto_hidden, { count: autoHidden })}{" "}
                  <Link href="/dashboard/inventory/usage" className="font-medium text-primary hover:underline">{ti.usage_history}</Link>
                </p>
              )}
            </section>

          </aside>
        </div>
      )}
    </div>
  );
}

import { cache } from "react";
import { getServerClient } from "@/lib/supabase/cached";
import { addDays } from "@/lib/dates";
import { WEIGH_EVERY_DAYS } from "@/lib/home/home-model";

export type TopBarAlertData = {
  overdueHealth: { id: string; title: string; scheduled_at: string; cattle_id: string }[];
  upcomingHealth: { id: string; title: string; scheduled_at: string; cattle_id: string }[];
  lowStockItems: { id: string; name: string; unit: string; stock: number; low_stock_threshold: number }[];
  loansDue: { id: string; lender_name: string; principal_amount: number; due_date: string }[];
  insuranceExpiring: { id: string; tag_id: string; insurance_expiry: string }[];
  unweighedCattleIds: string[];
  allCattleIds: string[];
  /** tag of every animal named in the alerts (read with them — no second query) */
  tagById: Record<string, string>;
  weighEveryDays: number;
};

/** How far ahead / back the alerts look — one rule for the top bar and the notifications page. */
export const ALERT_WINDOWS = { healthAheadDays: 7, dueAheadDays: 30 } as const;

async function fetchTopBarAlerts(bizId: string, todayISO: string): Promise<TopBarAlertData> {
  if (!bizId) {
    return { overdueHealth: [], upcomingHealth: [], lowStockItems: [], loansDue: [], insuranceExpiring: [], unweighedCattleIds: [], allCattleIds: [], tagById: {}, weighEveryDays: WEIGH_EVERY_DAYS };
  }
  const in7DaysISO = addDays(todayISO, ALERT_WINDOWS.healthAheadDays);
  const in30DaysISO = addDays(todayISO, ALERT_WINDOWS.dueAheadDays);
  // the same weighing rule as the homepage ("weigh every N days")
  const weighSinceISO = addDays(todayISO, -WEIGH_EVERY_DAYS);

  // the signed-in user's client (row-level security), like every page
  const supabase = await getServerClient();

  const [
    { data: overdueHealthRaw },
    { data: upcomingHealthRaw },
    { data: allItems },
    { data: balances },
    { data: loansDueRaw },
    { data: insuranceRaw },
    { data: oldCattleRaw },
  ] = await Promise.all([
    supabase.from("health_events").select("id, title, scheduled_at, cattle_id, cattle(tag_id)").eq("business_id", bizId).lt("scheduled_at", todayISO).is("completed_at", null).is("deleted_at", null).limit(50),
    supabase.from("health_events").select("id, title, scheduled_at, cattle_id, cattle(tag_id)").eq("business_id", bizId).gte("scheduled_at", todayISO).lte("scheduled_at", in7DaysISO).is("completed_at", null).is("deleted_at", null).limit(50),
    supabase.from("inventory_items").select("id, name, unit, low_stock_threshold").eq("business_id", bizId).not("low_stock_threshold", "is", null).is("deleted_at", null).eq("is_discontinued", false),
    // THE stock balance (one row per item) — it used to add up to 5,000 raw transactions here
    supabase.from("v_inventory_balance").select("item_id, qty_on_hand").eq("business_id", bizId),
    supabase.from("loans").select("id, lender_name, principal_amount, due_date").eq("business_id", bizId).eq("status", "active").is("deleted_at", null).not("due_date", "is", null).lte("due_date", in30DaysISO).limit(20),
    supabase.from("cattle").select("id, tag_id, insurance_expiry").eq("business_id", bizId).eq("status", "active").not("insurance_expiry", "is", null).lte("insurance_expiry", in30DaysISO).limit(50),
    supabase.from("cattle").select("id, tag_id").eq("business_id", bizId).eq("status", "active").is("deleted_at", null).lte("purchase_date", weighSinceISO).limit(500),
  ]);

  const stockMap: Record<string, number> = {};
  for (const b of (balances ?? []) as { item_id: string; qty_on_hand: number | string }[]) stockMap[b.item_id] = Number(b.qty_on_hand);
  const lowStockItems = ((allItems ?? []) as { id: string; name: string; unit: string; low_stock_threshold: number | null }[])
    .map(i => ({ ...i, stock: stockMap[i.id] ?? 0, low_stock_threshold: Number(i.low_stock_threshold) }))
    .filter(i => i.stock <= i.low_stock_threshold);

  const tagById: Record<string, string> = {};
  for (const c of (oldCattleRaw ?? []) as { id: string; tag_id: string }[]) tagById[c.id] = c.tag_id;
  // (health_events.cattle_id → cattle is a foreign key; the generated types just lack it)
  for (const h of [...(overdueHealthRaw ?? []), ...(upcomingHealthRaw ?? [])] as unknown as { cattle_id: string; cattle: { tag_id: string } | { tag_id: string }[] | null }[]) {
    const c = Array.isArray(h.cattle) ? h.cattle[0] : h.cattle;
    if (h.cattle_id && c?.tag_id) tagById[h.cattle_id] = c.tag_id;
  }

  // Unweighed cattle: no weight within the weighing rule
  const oldCattleIds = (oldCattleRaw ?? []).map((c: { id: string }) => c.id);
  let unweighedCattleIds: string[] = oldCattleIds;
  if (oldCattleIds.length > 0) {
    const { data: recentWeightRaw } = await supabase.from("weight_logs").select("cattle_id").is("deleted_at", null).in("cattle_id", oldCattleIds).gte("recorded_at", weighSinceISO).limit(1000);
    const weighedIds = new Set((recentWeightRaw ?? []).map((r: { cattle_id: string }) => r.cattle_id));
    unweighedCattleIds = oldCattleIds.filter(id => !weighedIds.has(id));
  }

  const allHealthCattleIds = [
    ...new Set([
      ...(overdueHealthRaw ?? []).map((h: { cattle_id: string }) => h.cattle_id),
      ...(upcomingHealthRaw ?? []).map((h: { cattle_id: string }) => h.cattle_id),
    ].filter(Boolean)),
  ];

  return {
    overdueHealth: ((overdueHealthRaw ?? []) as unknown as { id: string; title: string; scheduled_at: string; cattle_id: string }[]).map(({ id, title, scheduled_at, cattle_id }) => ({ id, title, scheduled_at, cattle_id })),
    upcomingHealth: ((upcomingHealthRaw ?? []) as unknown as { id: string; title: string; scheduled_at: string; cattle_id: string }[]).map(({ id, title, scheduled_at, cattle_id }) => ({ id, title, scheduled_at, cattle_id })),
    lowStockItems,
    loansDue: (loansDueRaw ?? []) as TopBarAlertData["loansDue"],
    insuranceExpiring: (insuranceRaw ?? []) as TopBarAlertData["insuranceExpiring"],
    unweighedCattleIds,
    allCattleIds: allHealthCattleIds,
    tagById,
    weighEveryDays: WEIGH_EVERY_DAYS,
  };
}

/** Once per request (the top bar and the notifications page share it). */
export const getCachedTopBarAlerts = cache(fetchTopBarAlerts);

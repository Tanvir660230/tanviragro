import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export type TopBarAlertData = {
  overdueHealth: { id: string; title: string; scheduled_at: string; cattle_id: string }[];
  upcomingHealth: { id: string; title: string; scheduled_at: string; cattle_id: string }[];
  lowStockItems: { id: string; name: string; unit: string; stock: number; low_stock_threshold: number }[];
  loansDue: { id: string; lender_name: string; principal_amount: number; due_date: string }[];
  insuranceExpiring: { id: string; tag_id: string; insurance_expiry: string }[];
  unweighedCattleIds: string[];
  allCattleIds: string[];
};

async function fetchTopBarAlerts(
  bizId: string,
  todayISO: string,
  in7DaysISO: string,
  in30DaysISO: string,
  sevenDaysAgoISO: string
): Promise<TopBarAlertData> {
  if (!bizId) {
    return { overdueHealth: [], upcomingHealth: [], lowStockItems: [], loansDue: [], insuranceExpiring: [], unweighedCattleIds: [], allCattleIds: [] };
  }

  const supabase = getServiceClient();

  const [
    { data: overdueHealthRaw },
    { data: upcomingHealthRaw },
    { data: allItems },
    { data: allTxns },
    { data: loansDueRaw },
    { data: insuranceRaw },
    { data: oldCattleRaw },
  ] = await Promise.all([
    supabase.from("health_events").select("id, title, scheduled_at, cattle_id").eq("business_id", bizId).lt("scheduled_at", todayISO).is("completed_at", null).is("deleted_at", null).limit(50),
    supabase.from("health_events").select("id, title, scheduled_at, cattle_id").eq("business_id", bizId).gte("scheduled_at", todayISO).lte("scheduled_at", in7DaysISO).is("completed_at", null).is("deleted_at", null).limit(50),
    supabase.from("inventory_items").select("id, name, unit, low_stock_threshold").eq("business_id", bizId).not("low_stock_threshold", "is", null).is("deleted_at", null),
    supabase.from("inventory_transactions").select("item_id, type, qty").eq("inventory_items.business_id", bizId).limit(5000),
    supabase.from("loans").select("id, lender_name, principal_amount, due_date").eq("business_id", bizId).eq("status", "active").is("deleted_at", null).not("due_date", "is", null).lte("due_date", in30DaysISO).limit(20),
    supabase.from("cattle").select("id, tag_id, insurance_expiry").eq("business_id", bizId).eq("status", "active").not("insurance_expiry", "is", null).lte("insurance_expiry", in30DaysISO).limit(50),
    supabase.from("cattle").select("id, tag_id").eq("business_id", bizId).eq("status", "active").lte("purchase_date", sevenDaysAgoISO).limit(500),
  ]);

  // Compute low stock
  const stockMap: Record<string, number> = {};
  for (const txn of (allTxns ?? []) as { item_id: string; type: string; qty: number }[]) {
    stockMap[txn.item_id] = (stockMap[txn.item_id] ?? 0) + (txn.type === "purchase" ? txn.qty : -txn.qty);
  }
  const lowStockItems = ((allItems ?? []) as { id: string; name: string; unit: string; low_stock_threshold: number | null }[])
    .map(i => ({ ...i, stock: stockMap[i.id] ?? 0, low_stock_threshold: i.low_stock_threshold! }))
    .filter(i => i.stock <= i.low_stock_threshold);

  // Unweighed cattle
  const oldCattleIds = (oldCattleRaw ?? []).map((c: { id: string }) => c.id);
  let unweighedCattleIds: string[] = oldCattleIds;
  if (oldCattleIds.length > 0) {
    const { data: recentWeightRaw } = await supabase.from("weight_logs").select("cattle_id").in("cattle_id", oldCattleIds).gte("recorded_at", sevenDaysAgoISO).limit(1000);
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
    overdueHealth: (overdueHealthRaw ?? []) as TopBarAlertData["overdueHealth"],
    upcomingHealth: (upcomingHealthRaw ?? []) as TopBarAlertData["upcomingHealth"],
    lowStockItems,
    loansDue: (loansDueRaw ?? []) as TopBarAlertData["loansDue"],
    insuranceExpiring: (insuranceRaw ?? []) as TopBarAlertData["insuranceExpiring"],
    unweighedCattleIds,
    allCattleIds: allHealthCattleIds,
  };
}

export const getCachedTopBarAlerts = unstable_cache(
  fetchTopBarAlerts,
  ["topbar-alerts"],
  { revalidate: 60 }
);

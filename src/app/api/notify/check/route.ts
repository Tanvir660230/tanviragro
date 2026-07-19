import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  sendLowStockAlert,
  sendExpiringStockAlert,
  sendHealthEventAlert,
  sendUpcomingHealthAlert,
  sendMissingWeightAlert,
  sendSellWindowAlert,
  sendWeeklyDigest,
  type SellWindowCattle,
} from "@/lib/notifications";

// Runs daily at 08:00 UTC via Netlify Scheduled Function
// Monday runs include weekly checks: missing weight, sell window, digest

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Optional: scope all inventory queries to a specific business.
  // Set CRON_BUSINESS_ID in env vars for multi-tenant deployments.
  const cronBusinessId = process.env.CRON_BUSINESS_ID ?? null;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const isMonday = now.getDay() === 1;

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const dayAfterTomorrow = new Date(now);
  dayAfterTomorrow.setDate(now.getDate() + 2);
  const dayAfterTomorrowStr = dayAfterTomorrow.toISOString().slice(0, 10);

  const next30Days = new Date(now);
  next30Days.setDate(now.getDate() + 30);
  const next30DaysStr = next30Days.toISOString().slice(0, 10);

  const alerts: string[] = [];

  // ── 1. Low stock ─────────────────────────────────────────────────

  const [{ data: allTxns }, { data: items }] = await Promise.all([
    cronBusinessId
      ? supabase.from("inventory_transactions").select("item_id, type, qty, recorded_at, inventory_items!inner(business_id)").eq("inventory_items.business_id", cronBusinessId)
      : supabase.from("inventory_transactions").select("item_id, type, qty, recorded_at"),
    cronBusinessId
      ? supabase.from("inventory_items").select("id, name, unit, low_stock_threshold").eq("business_id", cronBusinessId).is("deleted_at", null)
      : supabase.from("inventory_items").select("id, name, unit, low_stock_threshold").is("deleted_at", null),
  ]);

  const txnList = (allTxns ?? []) as { item_id: string; type: string; qty: number; recorded_at: string }[];
  const itemList = (items ?? []) as { id: string; name: string; unit: string; low_stock_threshold: number | null }[];

  const stockByItem: Record<string, number> = {};
  const consume30ByItem: Record<string, number> = {};

  for (const t of txnList) {
    if (t.type === "purchase") {
      stockByItem[t.item_id] = (stockByItem[t.item_id] ?? 0) + t.qty;
    } else {
      stockByItem[t.item_id] = (stockByItem[t.item_id] ?? 0) - t.qty;
      if (new Date(t.recorded_at) >= thirtyDaysAgo) {
        consume30ByItem[t.item_id] = (consume30ByItem[t.item_id] ?? 0) + t.qty;
      }
    }
  }

  const lowStockNames: string[] = [];
  for (const item of itemList) {
    const stock = stockByItem[item.id] ?? 0;
    const daily = (consume30ByItem[item.id] ?? 0) / 30;
    const daysLeft = daily > 0 ? Math.floor(stock / daily) : null;

    if (daysLeft !== null && daysLeft < 10) {
      await sendLowStockAlert(item.name, daysLeft, stock, item.unit);
      alerts.push(`low-stock:${item.name}`);
      lowStockNames.push(item.name);
    } else if (item.low_stock_threshold !== null && stock < item.low_stock_threshold) {
      await sendLowStockAlert(item.name, 0, stock, item.unit);
      alerts.push(`threshold:${item.name}`);
      lowStockNames.push(item.name);
    }
  }

  // ── 1b. Expiring stock (next 30 days) ───────────────────────────────

  const baseExpiring = supabase
    .from("inventory_transactions")
    .select("expiry_date, qty, item_id, inventory_items!inner(name, unit, business_id)")
    .not("expiry_date", "is", null)
    .lte("expiry_date", next30DaysStr)
    .gte("expiry_date", today);
  const { data: expiringStock } = await (cronBusinessId
    ? baseExpiring.eq("inventory_items.business_id", cronBusinessId)
    : baseExpiring);

  type ExpiringRow = { expiry_date: string; qty: number; inventory_items: { name: string; unit: string }[] | null };
  const expiringList = ((expiringStock ?? []) as unknown as ExpiringRow[]).map((e) => ({
    name: e.inventory_items?.[0]?.name ?? "Item",
    expiryDate: e.expiry_date,
    qty: Number(e.qty),
    unit: e.inventory_items?.[0]?.unit ?? "",
  }));

  if (expiringList.length > 0) {
    await sendExpiringStockAlert(expiringList);
    alerts.push(`expiring-stock:${expiringList.length}`);
  }

  // ── 2. Overdue health events ──────────────────────────────────────

  const { data: overdueEvents } = await supabase
    .from("health_events")
    .select("id, title, scheduled_at, cattle_id, cattle(tag_id)")
    .is("completed_at", null)
    .is("deleted_at", null)
    .lt("scheduled_at", today);

  const overdueList = (overdueEvents ?? []) as unknown as {
    id: string; title: string; scheduled_at: string;
    cattle_id: string; cattle: { tag_id: string }[] | null;
  }[];

  for (const event of overdueList) {
    const tag = event.cattle?.[0]?.tag_id ?? event.cattle_id;
    await sendHealthEventAlert(tag, event.title, event.scheduled_at);
    alerts.push(`overdue-health:${tag}:${event.title}`);
  }

  // ── 3. Upcoming health events (tomorrow) ─────────────────────────

  const { data: upcomingEvents } = await supabase
    .from("health_events")
    .select("id, title, scheduled_at, cattle_id, cattle(tag_id)")
    .is("completed_at", null)
    .is("deleted_at", null)
    .gte("scheduled_at", tomorrowStr)
    .lt("scheduled_at", dayAfterTomorrowStr);

  const upcomingList = (upcomingEvents ?? []) as unknown as {
    id: string; title: string; scheduled_at: string;
    cattle_id: string; cattle: { tag_id: string }[] | null;
  }[];

  for (const event of upcomingList) {
    const tag = event.cattle?.[0]?.tag_id ?? event.cattle_id;
    await sendUpcomingHealthAlert(tag, event.title, event.scheduled_at);
    alerts.push(`upcoming-health:${tag}:${event.title}`);
  }

  // ── Weekly checks (Mondays only) ──────────────────────────────────

  let missingWeightTags: string[] = [];
  const sellReadyCattle: SellWindowCattle[] = [];

  if (isMonday) {
    // ── 4. Missing weight (no log in 7 days) ────────────────────────

    const [{ data: activeCattle }, { data: recentWeights }] = await Promise.all([
      (cronBusinessId
        ? supabase.from("cattle").select("id, tag_id").eq("status", "active").eq("business_id", cronBusinessId)
        : supabase.from("cattle").select("id, tag_id").eq("status", "active")),
      supabase
        .from("weight_logs")
        .select("cattle_id")
        .is("deleted_at", null)
        .gte("recorded_at", sevenDaysAgo.toISOString()),
    ]);

    const recentIds = new Set((recentWeights ?? []).map((w: { cattle_id: string }) => w.cattle_id));
    missingWeightTags = (activeCattle ?? [])
      .filter((c: { id: string; tag_id: string }) => !recentIds.has(c.id))
      .map((c: { id: string; tag_id: string }) => c.tag_id);

    if (missingWeightTags.length > 0) {
      await sendMissingWeightAlert(missingWeightTags);
      alerts.push(`missing-weight:${missingWeightTags.length}`);
    }

    // ── 5. Sell window ────────────────────────────────────────────────
    // Alert: active cattle in pen 90+ days with 30%+ weight gain

    const { data: cattleForSell } = await (cronBusinessId
      ? supabase.from("cattle").select("id, tag_id, purchase_date, initial_weight_kg").eq("status", "active").eq("business_id", cronBusinessId)
      : supabase.from("cattle").select("id, tag_id, purchase_date, initial_weight_kg").eq("status", "active"));

    const sellCattleIds = (cattleForSell ?? []).map((c: { id: string }) => c.id);
    const { data: allWeightLogs } = sellCattleIds.length > 0
      ? await supabase
          .from("weight_logs")
          .select("cattle_id, weight_kg, recorded_at")
          .in("cattle_id", sellCattleIds)
          .is("deleted_at", null)
          .order("recorded_at", { ascending: false })
      : { data: [] };

    // Latest weight per cattle
    const latestWeightByCattle: Record<string, number> = {};
    for (const wl of (allWeightLogs ?? []) as { cattle_id: string; weight_kg: number }[]) {
      if (!(wl.cattle_id in latestWeightByCattle)) {
        latestWeightByCattle[wl.cattle_id] = wl.weight_kg;
      }
    }

    for (const c of (cattleForSell ?? []) as {
      id: string; tag_id: string; purchase_date: string; initial_weight_kg: number;
    }[]) {
      const daysInPen = Math.floor(
        (now.getTime() - new Date(c.purchase_date + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24)
      );
      const currentWeightKg = latestWeightByCattle[c.id] ?? c.initial_weight_kg;
      const weightGainPct = c.initial_weight_kg > 0
        ? (currentWeightKg - c.initial_weight_kg) / c.initial_weight_kg
        : 0;
      // Use daysInPen for notification purposes (rough estimate is acceptable here)
      const adgKg = daysInPen > 0 ? (currentWeightKg - c.initial_weight_kg) / daysInPen : 0;

      if (daysInPen >= 90 && weightGainPct >= 0.30) {
        sellReadyCattle.push({ tag: c.tag_id, daysInPen, currentWeightKg, adgKg });
      }
    }

    if (sellReadyCattle.length > 0) {
      await sendSellWindowAlert(sellReadyCattle);
      alerts.push(`sell-window:${sellReadyCattle.length}`);
    }

    // ── 6. Weekly digest (summary) ────────────────────────────────────

    const { count: activeCattleCount } = await supabase
      .from("cattle")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");

    await sendWeeklyDigest({
      activeCattle: activeCattleCount ?? 0,
      sellReady: sellReadyCattle.length,
      overdueHealth: overdueList.length,
      lowStockItems: lowStockNames.length,
      missingWeightCattle: missingWeightTags.length,
      weeklyAlerts: alerts,
    });

    alerts.push("weekly-digest:sent");
  }

  return NextResponse.json({
    ok: true,
    checked: now.toISOString(),
    isMonday,
    alerts,
  });
}

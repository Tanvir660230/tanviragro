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
import { authenticateApiRoute } from "@/lib/auth/api-guard";
import { PERMISSIONS } from "@/constants/roles";
import { measuredGrowth } from "@/lib/growth/baseline";
import { loadLowStock } from "@/lib/inventory/low-stock";
import { selectAll } from "@/lib/supabase/select-all";

// Runs daily at 08:00 UTC via Netlify Scheduled Function
// Monday runs include weekly checks: missing weight, sell window, digest

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRoute(request, {
    allowCron: true,
    requiredPermission: PERMISSIONS.SETTINGS_VIEW,
  });

  if ("response" in authResult) {
    return authResult.response;
  }

  const { auth } = authResult;
  const cronBusinessId = auth.type === "user" ? auth.context.businessId : auth.businessId;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

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

  // the ledger's balance, every row (see loadLowStock)
  const lowStockNames: string[] = [];
  for (const item of await loadLowStock(supabase, cronBusinessId ?? null, now)) {
    await sendLowStockAlert(item.name, item.daysLeft !== null && item.daysLeft < 10 ? item.daysLeft : 0, item.stock, item.unit);
    alerts.push(`${item.daysLeft !== null && item.daysLeft < 10 ? "low-stock" : "threshold"}:${item.name}`);
    lowStockNames.push(item.name);
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
      ? supabase.from("cattle").select("id, tag_id, purchase_date, initial_weight_kg, initial_weight_type").eq("status", "active").eq("business_id", cronBusinessId)
      : supabase.from("cattle").select("id, tag_id, purchase_date, initial_weight_kg, initial_weight_type").eq("status", "active"));

    const sellCattleIds = (cattleForSell ?? []).map((c: { id: string }) => c.id);
    // every weighing (a single read stops at 1,000 rows)
    const allWeightLogs = sellCattleIds.length > 0
      ? await selectAll(() => supabase
          .from("weight_logs")
          .select("cattle_id, weight_kg, recorded_at, weight_type")
          .in("cattle_id", sellCattleIds)
          .is("deleted_at", null)
          .order("recorded_at", { ascending: false })
          .order("id", { ascending: false }))
      : [];

    // Latest weight per cattle
    const latestWeightByCattle: Record<string, number> = {};
    for (const wl of (allWeightLogs ?? []) as { cattle_id: string; weight_kg: number }[]) {
      if (!(wl.cattle_id in latestWeightByCattle)) {
        latestWeightByCattle[wl.cattle_id] = wl.weight_kg;
      }
    }

    const logsByCattle: Record<string, { weight_kg: number; recorded_at: string; weight_type: "measured" | "estimated" }[]> = {};
    for (const wl of (allWeightLogs ?? []) as { cattle_id: string; weight_kg: number; recorded_at: string; weight_type: "measured" | "estimated" }[]) {
      (logsByCattle[wl.cattle_id] ??= []).push(wl);
    }
    for (const c of (cattleForSell ?? []) as {
      id: string; tag_id: string; purchase_date: string; initial_weight_kg: number; initial_weight_type: "measured" | "estimated" | "unknown";
    }[]) {
      const daysInPen = Math.floor(
        (now.getTime() - new Date(c.purchase_date + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24)
      );
      // measured growth only — an estimated purchase weight is not a baseline
      const growth = measuredGrowth(c, logsByCattle[c.id] ?? []);
      if (!growth) continue;
      const currentWeightKg = growth.latestKg;
      const weightGainPct = growth.gainKg / growth.baseline.weightKg;
      const adgKg = growth.adg;

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

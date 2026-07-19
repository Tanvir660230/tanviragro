import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppWithFallback } from "@/lib/notifications";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const messages: string[] = [];
  const todayStr = new Date().toISOString().split("T")[0];

  // Optional: scope queries to a specific business for multi-tenant deployments.
  const cronBusinessId = process.env.CRON_BUSINESS_ID ?? null;

  // 1. Low Stock — compute from transactions (no current_stock column)
  const [{ data: allTxns }, { data: items }] = await Promise.all([
    cronBusinessId
      ? supabase.from("inventory_transactions").select("item_id, type, qty, recorded_at, inventory_items!inner(business_id)").eq("inventory_items.business_id", cronBusinessId)
      : supabase.from("inventory_transactions").select("item_id, type, qty, recorded_at"),
    cronBusinessId
      ? supabase.from("inventory_items").select("id, name, unit, low_stock_threshold").eq("business_id", cronBusinessId).is("deleted_at", null)
      : supabase.from("inventory_items").select("id, name, unit, low_stock_threshold").is("deleted_at", null),
  ]);

  const stockByItem: Record<string, number> = {};
  const consume30ByItem: Record<string, number> = {};
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  for (const t of (allTxns ?? []) as { item_id: string; type: string; qty: number; recorded_at: string }[]) {
    if (t.type === "purchase") {
      stockByItem[t.item_id] = (stockByItem[t.item_id] ?? 0) + t.qty;
    } else {
      stockByItem[t.item_id] = (stockByItem[t.item_id] ?? 0) - t.qty;
      if (new Date(t.recorded_at) >= thirtyDaysAgo) {
        consume30ByItem[t.item_id] = (consume30ByItem[t.item_id] ?? 0) + t.qty;
      }
    }
  }

  const lowStockLines: string[] = [];
  for (const item of (items ?? []) as { id: string; name: string; unit: string; low_stock_threshold: number | null }[]) {
    const stock = Math.max(0, stockByItem[item.id] ?? 0);
    const daily = (consume30ByItem[item.id] ?? 0) / 30;
    const daysLeft = daily > 0 ? Math.floor(stock / daily) : null;
    if ((daysLeft !== null && daysLeft < 10) || (item.low_stock_threshold !== null && stock < item.low_stock_threshold)) {
      const label = daysLeft !== null ? `${stock.toFixed(1)} ${item.unit} (~${daysLeft}d left)` : `${stock.toFixed(1)} ${item.unit}`;
      lowStockLines.push(`- ${item.name}: ${label}`);
    }
  }
  if (lowStockLines.length > 0) {
    messages.push("⚠️ *Low Stock Alert*\n" + lowStockLines.join("\n"));
  }

  // 2. Expiring inventory (next 30 days)
  const next30Days = new Date();
  next30Days.setDate(next30Days.getDate() + 30);
  const next30DaysStr = next30Days.toISOString().split("T")[0];

  const baseExpiring = supabase
    .from("inventory_transactions")
    .select("expiry_date, qty, item_id, inventory_items!inner(name, unit, business_id)")
    .not("expiry_date", "is", null)
    .lte("expiry_date", next30DaysStr)
    .gte("expiry_date", todayStr);
  const { data: expiringStock } = await (cronBusinessId
    ? baseExpiring.eq("inventory_items.business_id", cronBusinessId)
    : baseExpiring);

  if (expiringStock && expiringStock.length > 0) {
    messages.push(
      "⏳ *Expiring Soon*\n" +
      expiringStock.map((e) => {
        const name = Array.isArray(e.inventory_items) ? e.inventory_items[0]?.name : (e.inventory_items as { name: string } | null)?.name;
        return `- ${name ?? "Unknown"}: expires ${e.expiry_date}`;
      }).join("\n")
    );
  }

  // 3. Overdue/today health events — use completed_at IS NULL (not status column)
  const { data: pendingEvents } = await supabase
    .from("health_events")
    .select("title, event_type, scheduled_at, cattle(tag_id)")
    .is("completed_at", null)
    .is("deleted_at", null)
    .lte("scheduled_at", todayStr);

  if (pendingEvents && pendingEvents.length > 0) {
    messages.push(
      "🩺 *Health Events Due*\n" +
      (pendingEvents as { title: string; event_type: string; scheduled_at: string; cattle: { tag_id: string }[] }[]).map((e) => `- Cow #${e.cattle?.[0]?.tag_id ?? "?"}: ${e.title} (${e.scheduled_at})`).join("\n")
    );
  }

  if (messages.length > 0) {
    const finalMessage = "🌾 *Chowdhury Agro Daily Report*\n\n" + messages.join("\n\n");
    await sendWhatsAppWithFallback(finalMessage, "Chowdhury Agro Daily Report");
    return NextResponse.json({ success: true, alerted: true });
  }

  return NextResponse.json({ success: true, alerted: false, message: "No alerts today." });
}

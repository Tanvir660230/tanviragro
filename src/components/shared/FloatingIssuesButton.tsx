import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/i18n/getDictionary";
import { AlertTriangle, HeartPulse, Package } from "lucide-react";

export async function FloatingIssuesButton() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "bn" ? "bn" : "en";
  const t = await getDictionary(locale as "en" | "bn");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const todayISO = new Date().toISOString().slice(0, 10);

  // Use RPC so team members (manager/worker) also see their farm's alerts.
  const { data: roleData } = await supabase.rpc("get_user_business_role", { p_user_id: user.id });
  const bizId = (roleData as { business_id?: string } | null)?.business_id ?? "";

  const [{ count: overdueHealth }, { data: invItems }, { data: invTxns }] = await Promise.all([
    supabase
      .from("health_events")
      .select("*", { count: "exact", head: true })
      .eq("business_id", bizId)
      .lt("scheduled_at", todayISO)
      .is("completed_at", null)
      .is("deleted_at", null),
    supabase
      .from("inventory_items")
      .select("id, low_stock_threshold")
      .eq("business_id", bizId)
      .is("deleted_at", null),
    supabase
      .from("inventory_transactions")
      .select("item_id, type, qty, inventory_items!inner(business_id)")
      .eq("inventory_items.business_id", bizId),
  ]);

  // Compute low stock count
  const stockMap: Record<string, number> = {};
  for (const t of (invTxns ?? []) as { item_id: string; type: string; qty: number }[]) {
    stockMap[t.item_id] = (stockMap[t.item_id] ?? 0) + (t.type === "purchase" ? t.qty : -t.qty);
  }
  let lowStock = 0;
  for (const item of (invItems ?? []) as { id: string; low_stock_threshold: number | null }[]) {
    if (item.low_stock_threshold !== null && (stockMap[item.id] ?? 0) <= item.low_stock_threshold) {
      lowStock++;
    }
  }

  const healthCount = overdueHealth ?? 0;
  const total = healthCount + lowStock;
  if (total === 0) return null;

  // Link to the most critical issue type
  const href = healthCount > 0 ? "/dashboard/compliance" : "/dashboard/inventory";

  return (
    <Link
      href={href}
      aria-label={`${total} pending issue${total !== 1 ? "s" : ""} — click to review`}
      className="print-hide fixed bottom-20 left-4 md:bottom-6 md:left-6 z-50 flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-white text-xs font-semibold shadow-lg hover:bg-red-700 active:scale-95 transition-all duration-200"
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />

      {/* Single issue type — show simple label */}
      {healthCount > 0 && lowStock === 0 && (
        <span className="flex items-center gap-1">
          <HeartPulse className="h-3 w-3" />
          {healthCount} {t.smart_alerts.overdue}
        </span>
      )}
      {lowStock > 0 && healthCount === 0 && (
        <span className="flex items-center gap-1">
          <Package className="h-3 w-3" />
          {lowStock} {t.smart_alerts.low_stock}
        </span>
      )}

      {/* Both types — show breakdown */}
      {healthCount > 0 && lowStock > 0 && (
        <span className="flex items-center gap-1.5">
          <span className="flex items-center gap-0.5">
            <HeartPulse className="h-3 w-3" />{healthCount}
          </span>
          <span className="opacity-50">·</span>
          <span className="flex items-center gap-0.5">
            <Package className="h-3 w-3" />{lowStock}
          </span>
        </span>
      )}
    </Link>
  );
}

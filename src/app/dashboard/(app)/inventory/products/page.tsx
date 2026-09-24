import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { redirect } from "next/navigation";
import { Package } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { InventorySubNav } from "@/components/inventory/InventorySubNav";
import { ProductsListClient } from "@/components/inventory/ProductsListClient";

export const metadata: Metadata = { title: "Products | Inventory" };

export default async function ProductsPage() {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) redirect("/login");

  const [{ data: itemsData }, { data: txnsData }] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("id, name, category, unit, low_stock_threshold, is_active_roughage, is_discontinued, deleted_at, created_at")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("inventory_transactions")
      .select("item_id, type, qty, unit_cost, recorded_at, inventory_items!inner(business_id)")
      .eq("inventory_items.business_id", businessId)
      .order("recorded_at", { ascending: false })
      .limit(5000),
  ]);

  // Compile per-item stock & cost stats client-side (mirrors StockLedgerEngine, no extra queries)
  const rows = (itemsData ?? []).map((item) => {
    const txns = (txnsData ?? []).filter((t) => t.item_id === item.id);
    let stock = 0;
    const totalIn: number[] = [];
    let lastPurchase = null;
    for (const t of txns) {
      if ((t.type as string) === "purchase" || (t.type as string) === "adjustment_in" || (t.type as string) === "return" || (t.type as string) === "transfer_in") {
        stock += Math.max(0, t.qty || 0);
        totalIn.push(t.qty || 0);
        if (!lastPurchase) lastPurchase = { price: t.unit_cost, date: t.recorded_at };
      } else {
        stock -= Math.max(0, t.qty || 0);
      }
    }
    stock = Math.max(0, stock);
    const totalPurchased = totalIn.reduce((s, q) => s + q, 0);
    return { ...item, stock: parseFloat(stock.toFixed(3)) };
  });

  return (
    <div className="space-y-4 pb-12">
      <PageHeader
        title="Products"
        subtitle="Enterprise product management — search, filter, bulk actions, export."
        icon={Package}
        back="/dashboard/inventory"
      />
      <InventorySubNav />
      <ProductsListClient items={rows} />
    </div>
  );
}
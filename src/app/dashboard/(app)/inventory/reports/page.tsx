import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { redirect } from "next/navigation";
import { FileBarChart } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { InventorySubNav } from "@/components/inventory/InventorySubNav";
import { ReportsClient } from "@/components/inventory/ReportsClient";
import { CentralInventoryRepository } from "@/lib/inventory/inventory-repository";

export const metadata: Metadata = { title: "Reports | Inventory" };

export default async function ReportsPage() {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) redirect("/login");

  const [portfolio, txnsResult] = await Promise.all([
    CentralInventoryRepository.getInventoryPortfolio(supabase, businessId),
    supabase
      .from("inventory_transactions")
      .select("item_id, type, qty, unit_cost, recorded_at, notes, inventory_items!inner(name, category, unit, business_id)")
      .eq("inventory_items.business_id", businessId)
      .order("recorded_at", { ascending: false })
      .limit(5000),
  ]);

  const movements = (txnsResult.data ?? []) as {
    item_id: string; type: string; qty: number; unit_cost: number | null;
    recorded_at: string; notes: string | null;
  }[];

  return (
    <div className="space-y-4 pb-12">
      <PageHeader
        title="Inventory Reports"
        subtitle="Stock valuation, consumption analytics, movement summaries and reorder planning."
        icon={FileBarChart}
        back="/dashboard/inventory"
      />
      <InventorySubNav />
      <ReportsClient portfolio={portfolio} movements={movements} />
    </div>
  );
}
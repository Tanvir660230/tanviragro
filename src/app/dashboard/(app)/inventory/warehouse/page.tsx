import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { redirect } from "next/navigation";
import { Warehouse as WarehouseIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { InventorySubNav } from "@/components/inventory/InventorySubNav";
import { WarehouseView } from "@/components/inventory/WarehouseView";
import { CentralInventoryRepository } from "@/lib/inventory/inventory-repository";
import { WarehouseEngine } from "@/lib/inventory/warehouse-engine";

export const metadata: Metadata = { title: "Warehouses | Inventory" };

export default async function WarehousePage() {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) redirect("/login");

  const [portfolio, txnsResult] = await Promise.all([
    CentralInventoryRepository.getInventoryPortfolio(supabase, businessId),
    supabase
      .from("inventory_transactions")
      .select("item_id, type, qty, recorded_at, notes, inventory_items!inner(business_id)")
      .eq("inventory_items.business_id", businessId)
      .order("recorded_at", { ascending: false })
      .limit(2000),
  ]);

  const warehouses = WarehouseEngine.getWarehousesForBusiness(businessId);
  const movements = (txnsResult.data ?? []) as { item_id: string; type: string; qty: number; recorded_at: string; notes: string | null }[];

  return (
    <div className="space-y-4 pb-12">
      <PageHeader
        title="Warehouses & Locations"
        subtitle="Multi-warehouse operations — bins, sections and capacity utilization."
        icon={WarehouseIcon}
        back="/dashboard/inventory"
      />
      <InventorySubNav />
      <WarehouseView warehouses={warehouses} portfolio={portfolio} movements={movements} />
    </div>
  );
}
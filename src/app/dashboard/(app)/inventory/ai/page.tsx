import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { InventorySubNav } from "@/components/inventory/InventorySubNav";
import { AIInsightsFullPage } from "@/components/inventory/AIInsightsFullPage";
import { CentralInventoryRepository } from "@/lib/inventory/inventory-repository";

export const metadata: Metadata = { title: "AI Insights | Inventory" };

export default async function AIInsightsPage() {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) redirect("/login");

  const [portfolio, txnsResult] = await Promise.all([
    CentralInventoryRepository.getInventoryPortfolio(supabase, businessId),
    supabase
      .from("inventory_transactions")
      .select("item_id, type, qty, unit_cost, recorded_at, inventory_items!inner(name, category, unit, business_id)")
      .eq("inventory_items.business_id", businessId)
      .order("recorded_at", { ascending: false })
      .limit(5000),
  ]);

  const movements = (txnsResult.data ?? []) as {
    item_id: string; type: string; qty: number; unit_cost: number | null; recorded_at: string;
  }[];

  return (
    <div className="space-y-4 pb-12">
      <PageHeader
        title="AI Inventory Insights"
        subtitle="Intelligent recommendations for stock optimization, reorder planning and anomaly detection."
        icon={Sparkles}
        back="/dashboard/inventory"
      />
      <InventorySubNav />
      <AIInsightsFullPage portfolio={portfolio} movements={movements} />
    </div>
  );
}
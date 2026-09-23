import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { InventorySubNav } from "@/components/inventory/InventorySubNav";
import { AdjustmentsClient } from "@/components/inventory/AdjustmentsClient";

export const metadata: Metadata = { title: "Adjustments | Inventory" };

export default async function AdjustmentsPage() {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) redirect("/login");

  const { data: txns } = await supabase
    .from("inventory_transactions")
    .select("id, item_id, type, qty, unit_cost, recorded_at, notes, inventory_items!inner(name, category, unit, business_id)")
    .eq("inventory_items.business_id", businessId)
    .or("type.eq.adjustment_in,type.eq.adjustment_out")
    .order("recorded_at", { ascending: false })
    .limit(500);

  const adjustments = (txns ?? []).map((t) => ({
    ...t,
    itemName: (t as any).inventory_items?.name ?? t.item_id,
    category: (t as any).inventory_items?.category ?? "other",
    unit: (t as any).inventory_items?.unit ?? "",
  }));

  return (
    <div className="space-y-4 pb-12">
      <PageHeader
        title="Stock Adjustments"
        subtitle="Physical counts, spoilage, damage and corrections — fully traceable."
        icon={ClipboardList}
        back="/dashboard/inventory"
      />
      <InventorySubNav />
      <AdjustmentsClient adjustments={adjustments} />
    </div>
  );
}
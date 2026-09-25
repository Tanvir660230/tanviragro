import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { redirect } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { MovementsClient } from "@/components/inventory/MovementsClient";

export const metadata: Metadata = { title: "Stock Movements | Inventory" };

export default async function MovementsPage() {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) redirect("/login");

  const { data: txns } = await supabase
    .from("inventory_transactions")
    .select("id, item_id, type, qty, unit_cost, cattle_id, recorded_at, notes, created_at, inventory_items!inner(name, category, unit, business_id)")
    .eq("inventory_items.business_id", businessId)
    .order("recorded_at", { ascending: false })
    .limit(2000);

  const movements = (txns ?? []).map((t) => ({
    ...t,
    itemName: (t as any).inventory_items?.name ?? t.item_id,
    category: (t as any).inventory_items?.category ?? "other",
    unit: (t as any).inventory_items?.unit ?? "",
  }));

  return (
    <div className="space-y-4 pb-12">
      <PageHeader
        title="Stock Movements"
        subtitle="Unified traceable timeline of every purchase, consumption, transfer and adjustment."
        icon={ArrowRightLeft}
        back="/dashboard/inventory"
      />
      <MovementsClient movements={movements} />
    </div>
  );
}
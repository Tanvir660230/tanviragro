import { PageHeader } from "@/components/shared/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { redirect } from "next/navigation";
import { BulkPurchaseClient } from "@/components/inventory/BulkPurchaseClient";
import { ArrowLeft, ReceiptText } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Add Purchase Invoice | Tanvir Agro",
};

export default async function BulkPurchasePage() {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) redirect("/login");

  const { data: itemsData } = await supabase
    .from("inventory_items")
    .select("id, name, category, unit, is_discontinued")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  // Only pass active items to the selector, but allow seeing all if we need to
  const items = (itemsData ?? []).filter(i => !i.is_discontinued);

  // Fetch last purchase prices for price analytics
  const { data: purchaseTxs } = await supabase
    .from("inventory_transactions")
    .select("item_id, unit_cost")
    .eq("type", "purchase")
    .order("recorded_at", { ascending: false });

  const lastPrices: Record<string, number> = {};
  purchaseTxs?.forEach(tx => {
    if (tx.unit_cost && !lastPrices[tx.item_id]) {
      lastPrices[tx.item_id] = tx.unit_cost;
    }
  });

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-12">
      <PageHeader
        title="Add Purchase Invoice"
        subtitle="Enter items from your purchase memo. Transport costs and due payments will be automatically handled."
        icon={ReceiptText}
        back="/dashboard/inventory"
      />

      <BulkPurchaseClient items={items} lastPrices={lastPrices} />
    </div>
  );
}

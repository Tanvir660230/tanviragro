import { cookies } from "next/headers";
import { ReceiptText } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { redirect } from "next/navigation";
import { BulkPurchaseClient, type PurchaseItemOption } from "@/components/inventory/BulkPurchaseClient";
import { PURCHASE_TEXT } from "@/components/inventory/purchase-text";
import { undonePurchaseIds } from "@/lib/inventory/purchase-rows";
import { buildPurchaseContext, type PurchaseRow } from "@/lib/inventory/purchase-memo";
import { todayDhaka } from "@/lib/dates";
import { selectAll } from "@/lib/supabase/select-all";
import { SupplierDuesCard, type SupplierDue } from "@/components/inventory/SupplierDuesCard";

export const metadata = {
  title: "Add Purchase Invoice | Tanvir Agro",
};

export default async function BulkPurchasePage() {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) redirect("/login");
  const lang = (await cookies()).get("NEXT_LOCALE")?.value === "bn" ? "bn" : "en";

  const [{ data: itemsData }, { data: purchaseData }, { data: duesData }] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("id, name, category, unit, kg_per_unit, is_discontinued")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    // this business's purchase rows (landed unit cost), newest last
    selectAll(() => supabase
      .from("inventory_transactions")
      .select("id, item_id, qty, unit_cost, recorded_at, created_at, notes, inventory_items!inner(business_id)")
      .eq("inventory_items.business_id", businessId)
      .eq("movement_type", "purchase")
      .order("id")).then((data) => ({ data })),
    supabase
      .from("liabilities")
      .select("id, lender, name, outstanding, recorded_at")
      .eq("business_id", businessId)
      .eq("category", "accounts_payable")
      .is("settled_at", null)
      .is("deleted_at", null),
  ]);

  // only active items can be bought; discontinued ones stay out of the picker
  const items: PurchaseItemOption[] = ((itemsData ?? []) as { id: string; name: string; category: string; unit: string; kg_per_unit: number | null; is_discontinued: boolean | null }[])
    .filter((i) => !i.is_discontinued)
    .map((i) => ({ id: i.id, name: i.name, category: i.category, unit: i.unit, kgPerUnit: i.kg_per_unit == null ? null : Number(i.kg_per_unit) }));

  const rows = (purchaseData ?? []) as unknown as PurchaseRow[];
  const undone = await undonePurchaseIds(supabase, rows.map((r) => r.id));
  const context = buildPurchaseContext({
    rows: rows.filter((r) => !undone.has(r.id)),
    dues: (duesData ?? []) as { lender: string | null; outstanding: number }[],
  });
  const t = PURCHASE_TEXT[lang];
  const dues: SupplierDue[] = ((duesData ?? []) as { id: string; lender: string | null; name: string; outstanding: number | string; recorded_at: string }[])
    .filter((d) => Number(d.outstanding) > 0)
    .map((d) => ({ id: d.id, lender: d.lender || d.name, outstanding: Number(d.outstanding), since: String(d.recorded_at).slice(0, 10) }));

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-4 pb-12">
      <PageHeader title={t.title} subtitle={t.subtitle} icon={ReceiptText} back="/dashboard/inventory" />
      <SupplierDuesCard dues={dues} today={todayDhaka()} lang={lang} />
      <BulkPurchaseClient items={items} context={context} today={todayDhaka()} lang={lang} />
    </div>
  );
}

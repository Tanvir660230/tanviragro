import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { redirect } from "next/navigation";
import { Package } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProductDetailView } from "@/components/inventory/ProductDetailView";
import { CentralInventoryRepository } from "@/lib/inventory/inventory-repository";
import { getL, getLocale } from "@/i18n/server-text";
import { costCategoryLabel } from "@/lib/expenses/labels";

export const metadata: Metadata = { title: "জিনিসের বিস্তারিত" };

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const L = await getL();
  const locale = await getLocale();
  const { id } = await params;
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) redirect("/login");

  const [portfolio, ledgerResult, purchasesResult] = await Promise.all([
    CentralInventoryRepository.getInventoryPortfolio(supabase, businessId),
    CentralInventoryRepository.getItemStockLedger(supabase, businessId, id),
    supabase
      .from("inventory_transactions")
      .select("id, item_id, qty, unit_cost, recorded_at, notes")
      .eq("item_id", id)
      .eq("movement_type", "purchase")
      .order("recorded_at", { ascending: true }),
  ]);

  if (!ledgerResult.item) notFound();

  const summary = portfolio.find((p) => p.itemId === id) ?? null;
  const purchases = (purchasesResult.data ?? []) as { id: string; qty: number; unit_cost: number | null; recorded_at: string; notes: string | null }[];

  const allItems = portfolio.map((p) => ({ id: p.itemId, name: p.itemName, unit: p.unit, category: p.category, stock: p.currentStock }));

  return (
    <div className="space-y-4 pb-12">
      <PageHeader
        title={ledgerResult.item.name}
        subtitle={`${costCategoryLabel(ledgerResult.item.category, locale)} · ${ledgerResult.item.unit}`}
        icon={Package}
        back="/dashboard/inventory"
        badge={summary?.isDiscontinued ? L("বন্ধ", "Archived") : L("চালু", "Active")}
      />
      <ProductDetailView
        item={ledgerResult.item}
        summary={summary}
        ledger={ledgerResult.ledger}
        valuation={ledgerResult.valuation}
        purchases={purchases}
        allItems={allItems}
      />
    </div>
  );
}
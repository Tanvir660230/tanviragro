import type { Metadata } from "next";
import { Suspense } from "react";
import { FlaskConical, Package, TrendingDown, DollarSign } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { SemenPageClient } from "@/components/breeding/SemenPageClient";
import type { SemenInventoryItem } from "@/lib/reproduction";

export const metadata: Metadata = { title: "Semen Inventory | Tanvir Agro" };

export default async function SemenInventoryPage() {
  return (
    <div className="space-y-5">
      <Suspense fallback={<div className="h-80 bg-muted rounded-xl animate-pulse" />}>
        <SemenSection />
      </Suspense>
    </div>
  );
}

async function SemenSection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) return <EmptyState icon={FlaskConical} title="No business found" />;

  const { data } = await (supabase as any).from("semen_inventory").select("*").eq("business_id", businessId).order("bull_name", { ascending: true });
  const rows = data || [];

  const inventory: SemenInventoryItem[] = rows.map((s: any) => ({
    id: s.id, businessId: s.business_id, bullCode: s.bull_code, bullName: s.bull_name,
    breed: s.breed, strawCode: s.straw_code, strawsInStock: Number(s.straws_in_stock || 0),
    strawsReserved: Number(s.straws_reserved || 0), strawsUsed: Number(s.straws_used || 0),
    costPerStrawBdt: Number(s.cost_per_straw_bdt || 0), supplier: s.supplier,
    storageCanister: s.storage_canister,
    motilityPercent: s.motility_percent ? Number(s.motility_percent) : null,
    geneticTraits: s.genetic_traits || {}, notes: s.notes, isActive: s.is_active,
    createdAt: s.created_at, updatedAt: s.updated_at,
  }));

  const totalStraws = inventory.reduce((acc, s) => acc + s.strawsInStock, 0);
  const totalUsed = inventory.reduce((acc, s) => acc + s.strawsUsed, 0);
  const lowStock = inventory.filter(s => s.strawsInStock <= 5 && s.isActive).length;
  const stockValue = inventory.reduce((acc, s) => acc + s.strawsInStock * s.costPerStrawBdt, 0);

  return (
    <>
      <PageHeader title="Semen Inventory" subtitle="Genetic material stock management — straws, bulls, motility, and cost" icon={FlaskConical} back="/dashboard/breeding" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Straws in Stock" value={totalStraws} icon={FlaskConical} accentColor="blue" subtext="Available straws" />
        <StatCard label="Straws Used" value={totalUsed} icon={Package} accentColor="slate" subtext="Total consumed" />
        <StatCard label="Low Stock Items" value={lowStock} icon={TrendingDown} accentColor={lowStock > 0 ? "destructive" : "slate"} subtext="≤5 straws remaining" />
        <StatCard label="Stock Value (BDT)" value={`৳${stockValue.toLocaleString()}`} icon={DollarSign} accentColor="emerald" subtext="Current inventory value" />
      </div>
      <SemenPageClient inventory={inventory} />
    </>
  );
}

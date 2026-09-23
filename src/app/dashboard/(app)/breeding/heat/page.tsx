import type { Metadata } from "next";
import { Suspense } from "react";
import { Flame, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { HeatPageClient } from "@/components/breeding/HeatPageClient";
import type { HeatRecord, SemenInventoryItem } from "@/lib/reproduction";

export const metadata: Metadata = { title: "Heat Detection | Breeding | Tanvir Agro" };

export default async function HeatDetectionPage() {
  return (
    <div className="space-y-5">
      <Suspense fallback={<div className="h-80 bg-muted rounded-xl animate-pulse" />}>
        <HeatDetectionSection />
      </Suspense>
    </div>
  );
}

async function HeatDetectionSection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) return <EmptyState icon={Flame} title="No business found" />;

  const [heatRes, cattleRes, semenRes] = await Promise.all([
    (supabase as any).from("heat_records").select("*").eq("business_id", businessId).order("detected_at", { ascending: false }).limit(200),
    (supabase as any).from("cattle").select("id,tag_number,name,gender,breed").eq("business_id", businessId).in("gender", ["cow", "heifer"]).is("deleted_at", null).order("tag_number"),
    (supabase as any).from("semen_inventory").select("*").eq("business_id", businessId).eq("is_active", true),
  ]);

  const cattleList = cattleRes.data || [];
  const cowMap = new Map<string, any>(cattleList.map((c: any): [string, any] => [c.id, c]));

  const heatRecords: HeatRecord[] = (heatRes.data || []).map((h: any) => ({
    id: h.id, businessId: h.business_id, cattleId: h.cattle_id,
    cattleTag: cowMap.get(h.cattle_id)?.tag_number,
    detectedAt: h.detected_at, heatType: h.heat_type, intensity: h.intensity,
    observedBy: h.observed_by, optimalBreedingStart: h.optimal_breeding_start,
    optimalBreedingEnd: h.optimal_breeding_end, status: h.status,
    notes: h.notes, createdAt: h.created_at,
  }));

  const semenInventory: SemenInventoryItem[] = (semenRes.data || []).map((s: any) => ({
    id: s.id, businessId: s.business_id, bullCode: s.bull_code, bullName: s.bull_name,
    breed: s.breed, strawCode: s.straw_code, strawsInStock: Number(s.straws_in_stock || 0),
    strawsReserved: Number(s.straws_reserved || 0), strawsUsed: Number(s.straws_used || 0),
    costPerStrawBdt: Number(s.cost_per_straw_bdt || 0), supplier: s.supplier,
    storageCanister: s.storage_canister,
    motilityPercent: s.motility_percent ? Number(s.motility_percent) : null,
    geneticTraits: s.genetic_traits || {}, notes: s.notes, isActive: s.is_active,
    createdAt: s.created_at, updatedAt: s.updated_at,
  }));

  const active = heatRecords.filter(h => h.status === "active").length;
  const inseminated = heatRecords.filter(h => h.status === "inseminated").length;
  const missed = heatRecords.filter(h => h.status === "missed").length;

  return (
    <>
      <PageHeader
        title="Heat & Estrus Detection"
        subtitle="AM/PM insemination timing engine — optimal breeding window per animal"
        icon={Flame}
        back="/dashboard/breeding"
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Active Heat Alerts" value={active} icon={Flame} accentColor="rose" subtext="In breeding window" />
        <StatCard label="Inseminated" value={inseminated} icon={CheckCircle} accentColor="emerald" subtext="AI performed" />
        <StatCard label="Missed / Expired" value={missed} icon={AlertCircle} accentColor="destructive" subtext="Window expired" />
        <StatCard label="Total Records" value={heatRecords.length} icon={Clock} accentColor="slate" subtext="All heat events" />
      </div>
      <HeatPageClient heatRecords={heatRecords} cattleList={cattleList} semenInventory={semenInventory} />
    </>
  );
}

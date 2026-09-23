import type { Metadata } from "next";
import { Suspense } from "react";
import { BarChart3 } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { FertilityAnalyticsTab } from "@/components/cattle/breeding/FertilityAnalyticsTab";
import { FertilityAnalyticsEngine } from "@/lib/reproduction";
import type { BreedingAttempt, CalvingRecord } from "@/lib/reproduction";

export const metadata: Metadata = { title: "Fertility Analytics | Tanvir Agro" };

export default async function AnalyticsPage() {
  return (
    <div className="space-y-5">
      <Suspense fallback={<div className="h-80 bg-muted rounded-xl animate-pulse" />}>
        <AnalyticsSection />
      </Suspense>
    </div>
  );
}

async function AnalyticsSection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) return <EmptyState icon={BarChart3} title="No business found" />;

  const [breedingRes, calvingRes] = await Promise.all([
    (supabase as any).from("breeding_attempts").select("id,cow_id,status,pd_result,expected_calving_date,insemination_date,sire_tag_or_code,technician_name,attempt_number_in_cycle,breeding_type,total_breeding_cost_bdt").eq("business_id", businessId).order("insemination_date", { ascending: false }),
    (supabase as any).from("calving_records").select("id,cow_id,calving_date,calving_type,delivery_difficulty").eq("business_id", businessId).order("calving_date", { ascending: false }),
  ]);

  const mapped: BreedingAttempt[] = (breedingRes.data || []).map((a: any) => ({
    id: a.id, businessId, cowId: a.cow_id, status: a.status, pdResult: a.pd_result,
    attemptNumberInCycle: Number(a.attempt_number_in_cycle || 1),
    expectedCalvingDate: a.expected_calving_date || "", sireTagOrCode: a.sire_tag_or_code || "",
    technicianName: a.technician_name, inseminationDate: a.insemination_date,
    breedingType: a.breeding_type || "AI", pdCheckScheduledDate: "",
    heatRecordId: null, semenInventoryId: null, sireId: null, sireBreed: null, inseminationTime: null,
    technicianCostBdt: 0, strawCostBdt: 0, totalBreedingCostBdt: Number(a.total_breeding_cost_bdt || 0),
    pdCheckActualDate: null, pdMethod: null, pdExaminedBy: null, pdGestationDays: null,
    dryOffDate: "", transitionDietDate: null, pregnancyRiskLevel: "normal" as const,
    notes: null, createdAt: a.created_at, updatedAt: a.updated_at,
  }));

  const confirmedPregnancies = mapped.filter(a => a.status === "pregnancy_confirmed").length;
  const metrics = FertilityAnalyticsEngine.calculateHerdFertilityMetrics(mapped, calvingRes.data || [], confirmedPregnancies);

  return (
    <>
      <PageHeader
        title="Fertility Analytics"
        subtitle="Conception rates, technician leaderboard, sire performance, and herd KPIs"
        icon={BarChart3}
        back="/dashboard/breeding"
      />
      <FertilityAnalyticsTab metrics={metrics} />
    </>
  );
}

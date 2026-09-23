import type { Metadata } from "next";
import { Suspense } from "react";
import { Sparkles, Clock, Baby, AlertTriangle } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { PregnancyPageClient } from "@/components/breeding/PregnancyPageClient";
import type { BreedingAttempt } from "@/lib/reproduction";

export const metadata: Metadata = { title: "Pregnancy Tracking | Tanvir Agro" };

export default async function PregnancyPage() {
  return (
    <div className="space-y-5">
      <Suspense fallback={<div className="h-80 bg-muted rounded-xl animate-pulse" />}>
        <PregnancySection />
      </Suspense>
    </div>
  );
}

async function PregnancySection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) return <EmptyState icon={Sparkles} title="No business found" />;

  const [attemptsRes, cattleRes] = await Promise.all([
    (supabase as any).from("breeding_attempts").select("*").eq("business_id", businessId).order("insemination_date", { ascending: false }),
    (supabase as any).from("cattle").select("id,tag_number,name,gender,breed").eq("business_id", businessId).is("deleted_at", null).order("tag_number"),
  ]);

  const cattleList = cattleRes.data || [];
  const cowMap = new Map<string, any>(cattleList.map((c: any): [string, any] => [c.id, c]));
  const today = new Date().toISOString().slice(0, 10);

  const breedingAttempts: BreedingAttempt[] = (attemptsRes.data || []).map((a: any) => {
    const cow = cowMap.get(a.cow_id);
    return {
      id: a.id, businessId: a.business_id, cowId: a.cow_id,
      cowTag: cow?.tag_number, cowName: cow?.name, cowBreed: cow?.breed,
      heatRecordId: a.heat_record_id, breedingType: a.breeding_type,
      semenInventoryId: a.semen_inventory_id, sireId: a.sire_id,
      sireTagOrCode: a.sire_tag_or_code, sireBreed: a.sire_breed,
      inseminationDate: a.insemination_date, inseminationTime: a.insemination_time,
      technicianName: a.technician_name, technicianCostBdt: Number(a.technician_cost_bdt || 0),
      strawCostBdt: Number(a.straw_cost_bdt || 0), totalBreedingCostBdt: Number(a.total_breeding_cost_bdt || 0),
      attemptNumberInCycle: Number(a.attempt_number_in_cycle || 1),
      status: a.status, pdCheckScheduledDate: a.pd_check_scheduled_date || "",
      pdCheckActualDate: a.pd_check_actual_date, pdMethod: a.pd_method,
      pdResult: a.pd_result, pdExaminedBy: a.pd_examined_by, pdGestationDays: a.pd_gestation_days,
      expectedCalvingDate: a.expected_calving_date || "", dryOffDate: a.dry_off_date || "",
      transitionDietDate: a.transition_diet_date, pregnancyRiskLevel: a.pregnancy_risk_level || "normal",
      notes: a.notes, createdAt: a.created_at, updatedAt: a.updated_at,
    };
  });

  const confirmed = breedingAttempts.filter(a => a.status === "pregnancy_confirmed").length;
  const pending = breedingAttempts.filter(a => a.status === "inseminated" && a.pdResult === "pending").length;
  const overdue = breedingAttempts.filter(a => a.status === "pregnancy_confirmed" && a.expectedCalvingDate < today).length;
  const aborted = breedingAttempts.filter(a => a.status === "aborted").length;

  return (
    <>
      <PageHeader
        title="Pregnancy Tracking"
        subtitle="Gestation milestones, PD checks, dry-off dates & calving countdown"
        icon={Sparkles}
        back="/dashboard/breeding"
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Confirmed Pregnant" value={confirmed} icon={Sparkles} accentColor="violet" subtext="Active pregnancies" />
        <StatCard label="Awaiting PD Check" value={pending} icon={Clock} accentColor="amber" subtext="45-day diagnosis due" />
        <StatCard label="Overdue Calvings" value={overdue} icon={AlertTriangle} accentColor={overdue > 0 ? "destructive" : "slate"} subtext="Past expected date" />
        <StatCard label="Aborted" value={aborted} icon={Baby} accentColor="slate" subtext="Pregnancy loss" />
      </div>
      <PregnancyPageClient breedingAttempts={breedingAttempts} cattleList={cattleList} />
    </>
  );
}

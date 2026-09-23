import type { Metadata } from "next";
import { Suspense } from "react";
import { Baby, CheckCircle, AlertCircle, Users } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { CalvingPageClient } from "@/components/breeding/CalvingPageClient";
import type { CalvingRecord } from "@/lib/reproduction";

export const metadata: Metadata = { title: "Calving Records | Tanvir Agro" };

export default async function CalvingPage() {
  return (
    <div className="space-y-5">
      <Suspense fallback={<div className="h-80 bg-muted rounded-xl animate-pulse" />}>
        <CalvingSection />
      </Suspense>
    </div>
  );
}

async function CalvingSection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) return <EmptyState icon={Baby} title="No business found" />;

  const [calvingRes, breedingRes, cattleRes] = await Promise.all([
    (supabase as any).from("calving_records").select("*, offspring:birth_offspring(*)").eq("business_id", businessId).order("calving_date", { ascending: false }),
    (supabase as any).from("breeding_attempts").select("id,cow_id,status,expected_calving_date,insemination_date,sire_tag_or_code").eq("business_id", businessId).eq("status", "pregnancy_confirmed").order("expected_calving_date", { ascending: true }),
    (supabase as any).from("cattle").select("id,tag_number,name,gender,breed").eq("business_id", businessId).is("deleted_at", null).order("tag_number"),
  ]);

  const cattleList = cattleRes.data || [];
  const cowMap = new Map<string, any>(cattleList.map((c: any): [string, any] => [c.id, c]));

  const calvingRecords: CalvingRecord[] = (calvingRes.data || []).map((c: any) => {
    const cow = cowMap.get(c.cow_id);
    return {
      id: c.id, businessId: c.business_id, breedingAttemptId: c.breeding_attempt_id,
      cowId: c.cow_id, cowTag: cow?.tag_number, sireId: c.sire_id, sireNameOrCode: c.sire_name_or_code,
      calvingDate: c.calving_date, calvingTime: c.calving_time, calvingType: c.calving_type,
      deliveryDifficulty: c.delivery_difficulty, birthPresentation: c.birth_presentation,
      attendantName: c.attendant_name, deliveryCostBdt: Number(c.delivery_cost_bdt || 0),
      vetFeeBdt: Number(c.vet_fee_bdt || 0), placentaExpelledCleanly: c.placenta_expelled_cleanly,
      damPostpartumCondition: c.dam_postpartum_condition || "healthy", notes: c.notes,
      offspring: (c.offspring || []).map((o: any) => ({
        id: o.id, businessId: o.business_id, calvingRecordId: o.calving_record_id,
        calfCattleId: o.calf_cattle_id, tagNumber: o.tag_number, name: o.name, gender: o.gender,
        birthWeightKg: Number(o.birth_weight_kg || 0), birthStatus: o.birth_status,
        colostrumFedWithinHours: o.colostrum_fed_within_hours, colostrumQuality: o.colostrum_quality,
        navelDipped: o.navel_dipped, initialValuationBdt: Number(o.initial_valuation_bdt || 0),
        weaningTargetDate: o.weaning_target_date, actualWeaningDate: o.actual_weaning_date,
        weaningWeightKg: o.weaning_weight_kg ? Number(o.weaning_weight_kg) : null,
        notes: o.notes, createdAt: o.created_at,
      })),
      createdAt: c.created_at,
    };
  });

  const confirmed = breedingRes.data || [];
  const today = new Date().toISOString().slice(0, 10);
  // eslint-disable-next-line react-hooks/purity
  const upcoming7d = new Date(Date.now() + 7*86400000).toISOString().slice(0, 10);
  const calvingsSoon = confirmed.filter((a: any) => a.expected_calving_date >= today && a.expected_calving_date <= upcoming7d).length;
  const totalCalves = calvingRecords.reduce((acc, c) => acc + c.offspring.length, 0);
  const aliveCalves = calvingRecords.reduce((acc, c) => acc + c.offspring.filter(o => o.birthStatus === "alive").length, 0);

  return (
    <>
      <PageHeader title="Calving Records" subtitle="Birth registry, offspring details, and postpartum monitoring" icon={Baby} back="/dashboard/breeding" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Calvings" value={calvingRecords.length} icon={Baby} accentColor="emerald" subtext="All recorded births" />
        <StatCard label="Total Calves" value={totalCalves} icon={Users} accentColor="blue" subtext="Offspring registered" />
        <StatCard label="Alive Calves" value={aliveCalves} icon={CheckCircle} accentColor="emerald" subtext="Born alive and healthy" />
        <StatCard label="Calvings in 7d" value={calvingsSoon} icon={AlertCircle} accentColor={calvingsSoon > 0 ? "amber" : "slate"} subtext="Upcoming this week" />
      </div>
      <CalvingPageClient calvingRecords={calvingRecords} breedingAttempts={confirmed} cattleList={cattleList} />
    </>
  );
}

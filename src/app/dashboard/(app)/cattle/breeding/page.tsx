import type { Metadata } from "next";
import { Suspense } from "react";
import { Heart } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { EnterpriseBreedingWorkspace } from "@/components/cattle/breeding/EnterpriseBreedingWorkspace";
import {
  PedigreeEngine,
  FertilityAnalyticsEngine,
  type PedigreeNode,
} from "@/lib/reproduction";

export const metadata: Metadata = {
  title: "Enterprise Breeding & Reproduction Platform | Tanvir Agro",
  description: "Complete reproductive lifecycle: Heat cycle detection, AI mating, gestation tracking, calving registry, and genetic pedigree lineage.",
};

export default async function BreedingPlatformPage() {
  return (
    <div className="space-y-4">
      <Suspense fallback={<BreedingSkeleton />}>
        <BreedingSection />
      </Suspense>
    </div>
  );
}

function BreedingSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-muted animate-pulse" />
        <div className="space-y-1.5">
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-72 bg-muted rounded animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
      <div className="h-96 bg-muted rounded-xl animate-pulse" />
    </div>
  );
}

async function BreedingSection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();

  if (!businessId) {
    return (
      <PageHeader
        title="Breeding &amp; Reproduction Platform"
        subtitle="Manage heat cycles, AI inseminations, pregnancies, and calf lineage"
        icon={Heart}
        back="/dashboard/cattle"
      />
    );
  }

  const [
    cattleRes,
    heatRes,
    breedingRes,
    calvingRes,
    semenRes,
  ] = await Promise.all([
    (supabase as any)
      .from("cattle")
      .select("id, tag_number, name, gender, breed, dam_id, sire_id, status, weight")
      .eq("business_id", businessId)
      .order("tag_number", { ascending: true }),
    (supabase as any)
      .from("heat_records")
      .select("*")
      .eq("business_id", businessId)
      .order("detected_at", { ascending: false }),
    (supabase as any)
      .from("breeding_attempts")
      .select("*")
      .eq("business_id", businessId)
      .order("insemination_date", { ascending: false }),
    (supabase as any)
      .from("calving_records")
      .select("*, offspring:birth_offspring(*)")
      .eq("business_id", businessId)
      .order("calving_date", { ascending: false }),
    (supabase as any)
      .from("semen_inventory")
      .select("*")
      .eq("business_id", businessId)
      .order("bull_name", { ascending: true }),
  ]);

  const cattleList = cattleRes.data || [];
  const heatRecords = (heatRes.data || []).map((h: any) => {
    const cow = cattleList.find((c: any) => c.id === h.cattle_id);
    return {
      id: h.id,
      businessId: h.business_id,
      cattleId: h.cattle_id,
      cattleTag: cow?.tag_number,
      detectedAt: h.detected_at,
      heatType: h.heat_type,
      intensity: h.intensity,
      observedBy: h.observed_by,
      optimalBreedingStart: h.optimal_breeding_start,
      optimalBreedingEnd: h.optimal_breeding_end,
      status: h.status,
      notes: h.notes,
      createdAt: h.created_at,
    };
  });

  const breedingAttempts = (breedingRes.data || []).map((b: any) => {
    const cow = cattleList.find((c: any) => c.id === b.cow_id);
    return {
      id: b.id,
      businessId: b.business_id,
      cowId: b.cow_id,
      cowTag: cow?.tag_number,
      cowName: cow?.name,
      cowBreed: cow?.breed,
      heatRecordId: b.heat_record_id,
      breedingType: b.breeding_type,
      semenInventoryId: b.semen_inventory_id,
      sireId: b.sire_id,
      sireTagOrCode: b.sire_tag_or_code,
      sireBreed: b.sire_breed,
      inseminationDate: b.insemination_date,
      inseminationTime: b.insemination_time,
      technicianName: b.technician_name,
      technicianCostBdt: Number(b.technician_cost_bdt || 0),
      strawCostBdt: Number(b.straw_cost_bdt || 0),
      totalBreedingCostBdt: Number(b.total_breeding_cost_bdt || 0),
      attemptNumberInCycle: b.attempt_number_in_cycle || 1,
      status: b.status,
      pdCheckScheduledDate: b.pd_check_scheduled_date,
      pdCheckActualDate: b.pd_check_actual_date,
      pdMethod: b.pd_method,
      pdResult: b.pd_result,
      pdExaminedBy: b.pd_examined_by,
      pdGestationDays: b.pd_gestation_days,
      expectedCalvingDate: b.expected_calving_date,
      dryOffDate: b.dry_off_date,
      transitionDietDate: b.transition_diet_date,
      pregnancyRiskLevel: b.pregnancy_risk_level || "normal",
      notes: b.notes,
      createdAt: b.created_at,
      updatedAt: b.updated_at,
    };
  });

  const calvingRecords = (calvingRes.data || []).map((c: any) => {
    const cow = cattleList.find((cat: any) => cat.id === c.cow_id);
    return {
      id: c.id,
      businessId: c.business_id,
      breedingAttemptId: c.breeding_attempt_id,
      cowId: c.cow_id,
      cowTag: cow?.tag_number,
      sireId: c.sire_id,
      sireNameOrCode: c.sire_name_or_code,
      calvingDate: c.calving_date,
      calvingTime: c.calving_time,
      calvingType: c.calving_type,
      deliveryDifficulty: c.delivery_difficulty,
      birthPresentation: c.birth_presentation,
      attendantName: c.attendant_name,
      deliveryCostBdt: Number(c.delivery_cost_bdt || 0),
      vetFeeBdt: Number(c.vet_fee_bdt || 0),
      placentaExpelledCleanly: c.placenta_expelled_cleanly,
      damPostpartumCondition: c.dam_postpartum_condition || "healthy",
      notes: c.notes,
      offspring: (c.offspring || []).map((off: any) => ({
        id: off.id,
        businessId: off.business_id,
        calvingRecordId: off.calving_record_id,
        calfCattleId: off.calf_cattle_id,
        tagNumber: off.tag_number,
        name: off.name,
        gender: off.gender,
        birthWeightKg: Number(off.birth_weight_kg || 0),
        birthStatus: off.birth_status,
        colostrumFedWithinHours: off.colostrum_fed_within_hours,
        colostrumQuality: off.colostrum_quality,
        navelDipped: off.navel_dipped,
        initialValuationBdt: Number(off.initial_valuation_bdt || 0),
        weaningTargetDate: off.weaning_target_date,
        actualWeaningDate: off.actual_weaning_date,
        weaningWeightKg: off.weaning_weight_kg ? Number(off.weaning_weight_kg) : null,
        notes: off.notes,
        createdAt: off.created_at,
      })),
      createdAt: c.created_at,
    };
  });

  const semenInventory = (semenRes.data || []).map((s: any) => ({
    id: s.id,
    businessId: s.business_id,
    bullCode: s.bull_code,
    bullName: s.bull_name,
    breed: s.breed,
    strawCode: s.straw_code,
    strawsInStock: Number(s.straws_in_stock || 0),
    strawsReserved: Number(s.straws_reserved || 0),
    strawsUsed: Number(s.straws_used || 0),
    costPerStrawBdt: Number(s.cost_per_straw_bdt || 0),
    supplier: s.supplier,
    storageCanister: s.storage_canister,
    motilityPercent: s.motility_percent ? Number(s.motility_percent) : null,
    geneticTraits: s.genetic_traits || {},
    notes: s.notes,
    isActive: s.is_active,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  }));

  const animalMap = new Map<string, any>();
  for (const c of cattleList) {
    animalMap.set(c.id, {
      id: c.id,
      tagNumber: c.tag_number,
      name: c.name,
      gender: c.gender,
      breed: c.breed,
      damId: c.dam_id,
      sireId: c.sire_id,
    });
  }

  const pedigreeNodes: Record<string, PedigreeNode> = {};
  for (const c of cattleList) {
    const tree = PedigreeEngine.buildPedigreeTree(c.id, animalMap, 3);
    if (tree) {
      pedigreeNodes[c.id] = tree;
    }
  }

  const metrics = FertilityAnalyticsEngine.calculateHerdFertilityMetrics(
    breedingAttempts,
    calvingRecords,
    breedingAttempts.filter((a: any) => a.status === "pregnancy_confirmed").length
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Breeding &amp; Reproduction Platform"
        subtitle="Manage heat cycles, AI inseminations, pregnancy diagnosis, and calf lineage"
        icon={Heart}
        back="/dashboard/cattle"
      />
      <EnterpriseBreedingWorkspace
        initialHeatRecords={heatRecords}
        initialBreedingAttempts={breedingAttempts}
        initialCalvingRecords={calvingRecords}
        initialSemenInventory={semenInventory}
        cattleList={cattleList}
        pedigreeNodes={pedigreeNodes}
        metrics={metrics}
      />
    </div>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { FileText, TrendingUp, DollarSign, Baby, Activity } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { FertilityAnalyticsEngine } from "@/lib/reproduction";

export const metadata: Metadata = { title: "Breeding Reports | Tanvir Agro" };

export default async function BreedingReportsPage() {
  return (
    <div className="space-y-5">
      <Suspense fallback={<div className="h-80 bg-muted rounded-xl animate-pulse" />}>
        <ReportsSection />
      </Suspense>
    </div>
  );
}

async function ReportsSection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) return <EmptyState icon={FileText} title="No business found" />;

  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;

  const [bRes, cRes, sRes] = await Promise.all([
    (supabase as any).from("breeding_attempts").select("id,cow_id,status,pd_result,insemination_date,breeding_type,technician_name,total_breeding_cost_bdt,attempt_number_in_cycle,sire_tag_or_code,expected_calving_date").eq("business_id", businessId).order("insemination_date", { ascending: false }),
    (supabase as any).from("calving_records").select("id,calving_date,delivery_difficulty,dam_postpartum_condition,delivery_cost_bdt,vet_fee_bdt").eq("business_id", businessId),
    (supabase as any).from("semen_inventory").select("id,straws_used,cost_per_straw_bdt").eq("business_id", businessId),
  ]);

  const attempts = bRes.data || [];
  const calvings = cRes.data || [];
  const semenRows = sRes.data || [];

  const mapped = attempts.map((a: any) => ({
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

  const confirmed = mapped.filter((a: any) => a.status === "pregnancy_confirmed").length;
  const metrics = FertilityAnalyticsEngine.calculateHerdFertilityMetrics(mapped, calvings, confirmed);
  const breedingCost = attempts.reduce((acc: number, a: any) => acc + Number(a.total_breeding_cost_bdt || 0), 0);
  const calvingCost = calvings.reduce((acc: number, c: any) => acc + Number(c.delivery_cost_bdt || 0) + Number(c.vet_fee_bdt || 0), 0);
  const semenCost = semenRows.reduce((acc: number, s: any) => acc + Number(s.straws_used || 0) * Number(s.cost_per_straw_bdt || 0), 0);
  const totalCost = breedingCost + calvingCost + semenCost;
  const thisYearAttempts = attempts.filter((a: any) => (a.insemination_date || "") >= yearStart).length;
  const thisYearCalvings = calvings.filter((c: any) => (c.calving_date || "") >= yearStart).length;
  const complications = calvings.filter((c: any) => ["difficult_dystocia", "caesarean"].includes(c.delivery_difficulty)).length;

  return (
    <>
      <PageHeader title="Breeding Reports" subtitle={`Reproductive performance — ${year}`} icon={FileText} back="/dashboard/breeding" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Attempts" value={metrics.totalBreedingAttempts} icon={Activity} accentColor="blue" subtext="All breeding records" />
        <StatCard label="Conception Rate" value={`${metrics.conceptionRatePercent}%`} icon={TrendingUp} accentColor="emerald" subtext="Overall success" />
        <StatCard label="Total Calvings" value={calvings.length} icon={Baby} accentColor="violet" subtext="All births recorded" />
        <StatCard label="Repro Cost" value={`৳${totalCost.toLocaleString()}`} icon={DollarSign} accentColor="amber" subtext="All reproductive spend" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Breeding Performance KPIs" icon={TrendingUp} iconVariant="emerald">
          <div className="space-y-2">
            {[
              ["1st Service Rate", `${metrics.firstServiceConceptionRatePercent}%`],
              ["Services / Conception", metrics.servicesPerConception.toFixed(2)],
              ["Avg Days Open", `${metrics.averageDaysOpen}d`],
              ["Avg Calving Interval", `${metrics.averageCalvingIntervalDays}d`],
              ["Pending PD Checks", metrics.pendingPDChecksCount],
              ["Calvings in 30 Days", metrics.upcomingCalvingsIn30Days],
            ].map(([l, v]) => (
              <div key={String(l)} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                <span className="text-sm text-muted-foreground">{l}</span>
                <span className="text-sm font-semibold">{v}</span>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Cost & Activity Summary" icon={DollarSign} iconVariant="amber">
          <div className="space-y-2">
            {[
              ["AI & Breeding Fees", `৳${breedingCost.toLocaleString()}`],
              ["Calving & Delivery", `৳${calvingCost.toLocaleString()}`],
              ["Semen Purchase", `৳${semenCost.toLocaleString()}`],
              ["Total Spend", `৳${totalCost.toLocaleString()}`],
              [`${year} AI Attempts`, thisYearAttempts],
              [`${year} Calvings`, thisYearCalvings],
              ["Calving Complications", complications],
            ].map(([l, v]) => (
              <div key={String(l)} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                <span className="text-sm text-muted-foreground">{l}</span>
                <span className="text-sm font-semibold">{v}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}


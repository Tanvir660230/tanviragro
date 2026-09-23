import type { Metadata } from "next";
import { Suspense } from "react";
import { Lightbulb, Target, Dna } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { AIInsightsPanel } from "@/components/breeding/AIInsightsPanel";
import { FertilityAnalyticsEngine } from "@/lib/reproduction";

export const metadata: Metadata = { title: "AI Insights | Tanvir Agro" };

export default async function AIInsightsPage() {
  return (
    <div className="space-y-5">
      <Suspense fallback={<div className="h-96 bg-muted rounded-xl animate-pulse" />}>
        <AISection />
      </Suspense>
    </div>
  );
}

async function AISection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) return <EmptyState icon={Lightbulb} title="No business found" />;

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const in7Str = new Date(today.getTime() + 7*86400000).toISOString().slice(0, 10);

  const [bRes, hRes, sRes] = await Promise.all([
    (supabase as any).from("breeding_attempts").select("id,cow_id,status,pd_result,expected_calving_date,insemination_date,sire_tag_or_code,technician_name,attempt_number_in_cycle").eq("business_id", businessId).order("insemination_date", { ascending: false }),
    (supabase as any).from("heat_records").select("id").eq("business_id", businessId).eq("status", "active"),
    (supabase as any).from("semen_inventory").select("id,bull_name,straws_in_stock").eq("business_id", businessId).eq("is_active", true).lte("straws_in_stock", 3),
  ]);

  const attempts = bRes.data || [];
  const heatCount = (hRes.data || []).length;
  const lowSemen: any[] = sRes.data || [];

  const mapped = attempts.map((a: any) => ({
    id: a.id, businessId, cowId: a.cow_id, status: a.status, pdResult: a.pd_result,
    attemptNumberInCycle: Number(a.attempt_number_in_cycle || 1),
    expectedCalvingDate: a.expected_calving_date || "", sireTagOrCode: a.sire_tag_or_code || "",
    technicianName: a.technician_name, inseminationDate: a.insemination_date,
    breedingType: "AI" as const, pdCheckScheduledDate: "", heatRecordId: null,
    semenInventoryId: null, sireId: null, sireBreed: null, inseminationTime: null,
    technicianCostBdt: 0, strawCostBdt: 0, totalBreedingCostBdt: 0,
    pdCheckActualDate: null, pdMethod: null, pdExaminedBy: null, pdGestationDays: null,
    dryOffDate: "", transitionDietDate: null, pregnancyRiskLevel: "normal" as const,
    notes: null, createdAt: a.created_at, updatedAt: a.updated_at,
  }));

  const confirmed = mapped.filter((a: any) => a.status === "pregnancy_confirmed").length;
  const metrics = FertilityAnalyticsEngine.calculateHerdFertilityMetrics(mapped, [], confirmed);
  const overdue = mapped.filter((a: any) => a.status === "pregnancy_confirmed" && a.expectedCalvingDate < todayStr).length;
  const upcoming7d = mapped.filter((a: any) => a.status === "pregnancy_confirmed" && a.expectedCalvingDate >= todayStr && a.expectedCalvingDate <= in7Str).length;
  const repeaters = attempts.filter((a: any) => Number(a.attempt_number_in_cycle) >= 3).length;

  return (
    <>
      <PageHeader title="AI Breeding Insights" subtitle="Intelligent recommendations to optimize herd fertility" icon={Lightbulb} back="/dashboard/breeding" />
      <AIInsightsPanel
        heatCount={heatCount}
        conceptionRate={metrics.conceptionRatePercent}
        totalAttempts={metrics.totalBreedingAttempts}
        overdue={overdue}
        upcoming7d={upcoming7d}
        repeaters={repeaters}
        lowSemen={lowSemen}
      />
      <SectionCard title="Technician Performance" icon={Target} iconVariant="emerald">
        {metrics.technicianSuccessLeaderboard.length === 0
          ? <p className="text-sm text-muted-foreground py-6 text-center">Record breeding with technician names to track performance.</p>
          : <div className="space-y-2">{metrics.technicianSuccessLeaderboard.slice(0, 5).map((t: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/50">
                <div><p className="text-sm font-semibold">{t.technicianName}</p><p className="text-xs text-muted-foreground">{t.attempts} attempts · {t.conceptions} conceptions</p></div>
                <Badge variant={t.successRate >= 60 ? "default" : "outline"} className="font-bold">{t.successRate}%</Badge>
              </div>
            ))}</div>}
      </SectionCard>
      <SectionCard title="Sire Performance Ranking" icon={Dna} iconVariant="blue">
        {metrics.sireConceptionLeaderboard.length === 0
          ? <p className="text-sm text-muted-foreground py-6 text-center">Record breeding attempts to rank sire performance.</p>
          : <div className="space-y-2">{metrics.sireConceptionLeaderboard.slice(0, 5).map((s: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/50">
                <div><p className="text-sm font-semibold">Sire: {s.sireCode}</p><p className="text-xs text-muted-foreground">{s.attempts} attempts · {s.conceptions} conceptions</p></div>
                <Badge variant={s.successRate >= 60 ? "default" : "outline"} className="font-bold">{s.successRate}%</Badge>
              </div>
            ))}</div>}
      </SectionCard>
    </>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { FileBarChart, Activity, Syringe, Pill, Skull } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { ExportDataButton } from "@/components/shared/ExportDataButton";

export const metadata: Metadata = { title: "Health Reports | EHR" };

export default function ReportsPage() {
  return (
    <div className="space-y-5">
      <Suspense fallback={<div className="h-96 animate-shimmer rounded-2xl" />}>
        <ReportsSection />
      </Suspense>
    </div>
  );
}

async function ReportsSection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) return <EmptyState icon={FileBarChart} title="No business found" />;

  const today = new Date();
  const thisYear = today.getFullYear().toString();
  const firstOfYear = `${thisYear}-01-01`;
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);

  const [
    { count: totalEvents },
    { count: completedEvents },
    { count: pendingEvents },
    { count: treatments },
    { count: mortalityCount },
    { data: treatmentCostData },
    diseaseRes,
  ] = await Promise.all([
    supabase.from("health_events").select("*", { count: "exact", head: true }).eq("business_id", businessId).is("deleted_at", null),
    supabase.from("health_events").select("*", { count: "exact", head: true }).eq("business_id", businessId).not("completed_at", "is", null).is("deleted_at", null),
    supabase.from("health_events").select("*", { count: "exact", head: true }).eq("business_id", businessId).is("completed_at", null).is("deleted_at", null),
    (supabase as any).from("cattle_treatments").select("*", { count: "exact", head: true }).eq("business_id", businessId),
    (supabase as any).from("cattle_death_records").select("*", { count: "exact", head: true }).eq("business_id", businessId),
    (supabase as any).from("cattle_treatments").select("vet_fee, additional_medical_cost").eq("business_id", businessId).gte("treated_at", firstOfYear),
    (supabase as any).from("disease_records").select("status").eq("business_id", businessId),
  ]);

  const totalVetCost = (treatmentCostData ?? []).reduce((s: number, t: any) => s + (Number(t.vet_fee) || 0) + (Number(t.additional_medical_cost) || 0), 0);
  const diseaseList: any[] = diseaseRes.data ?? [];
  const activeDiseases = diseaseList.filter((d) => ["active", "under_treatment"].includes(d.status)).length;
  const completionRate = totalEvents ? Math.round(((completedEvents ?? 0) / totalEvents) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Health Reports"
        subtitle="Summary statistics and exportable compliance reports"
        icon={FileBarChart}
        back="/dashboard/health"
        actions={<ExportDataButton filename="health-report" data={[]} />}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Events" value={totalEvents ?? 0} icon={Activity} accentColor="blue" subtext="all time" />
        <StatCard label="Completion Rate" value={`${completionRate}%`} icon={Activity} accentColor="emerald" subtext={`${completedEvents ?? 0} completed`} />
        <StatCard label="Total Treatments" value={treatments ?? 0} icon={Pill} accentColor="violet" subtext="all time" />
        <StatCard label="Vet Cost (YTD)" value={`৳${totalVetCost.toLocaleString()}`} icon={Syringe} accentColor="amber" subtext={`Jan–${today.toLocaleString("default", { month: "short" })}`} />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <SectionCard title="Health Events Summary" icon={Activity} iconVariant="blue">
          <dl className="space-y-3">
            {[
              { label: "Total Scheduled", value: totalEvents ?? 0 },
              { label: "Completed", value: completedEvents ?? 0 },
              { label: "Pending", value: pendingEvents ?? 0 },
              { label: "Completion Rate", value: `${completionRate}%` },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0 last:pb-0">
                <dt className="text-sm text-muted-foreground">{row.label}</dt>
                <dd className="text-sm font-semibold tabular-nums">{row.value}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>
        <SectionCard title="Disease & Mortality" icon={Skull} iconVariant="red">
          <dl className="space-y-3">
            {[
              { label: "Active Disease Cases", value: activeDiseases },
              { label: "Total Disease Records", value: diseaseList.length },
              { label: "Mortality Records", value: mortalityCount ?? 0 },
              { label: "Total Treatments", value: treatments ?? 0 },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0 last:pb-0">
                <dt className="text-sm text-muted-foreground">{row.label}</dt>
                <dd className="text-sm font-semibold tabular-nums">{row.value}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>
      </div>
    </>
  );
}

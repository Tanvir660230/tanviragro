import type { Metadata } from "next";
import { Suspense } from "react";
import { Activity, Pill } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import Link from "next/link";

export const metadata: Metadata = { title: "Treatments | Health EHR" };

export default function TreatmentsPage() {
  return (
    <div className="space-y-5">
      <Suspense fallback={<div className="h-96 animate-shimmer rounded-2xl" />}>
        <TreatmentsSection />
      </Suspense>
    </div>
  );
}

async function TreatmentsSection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) return <EmptyState icon={Pill} title="No business found" />;

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);

  const [{ data: treatments }, { count: monthCount }] = await Promise.all([
    supabase
      .from("cattle_treatments")
      .select("id, cattle_id, diagnosis, dose_administered, dose_unit, vet_fee, additional_medical_cost, treated_at, notes")
      .order("treated_at", { ascending: false })
      .limit(100),
    supabase
      .from("cattle_treatments")
      .select("*", { count: "exact", head: true })
      .gte("treated_at", firstOfMonth),
  ]);

  const list = treatments ?? [];
  const totalVetFees = list.reduce((s, t) => s + (Number(t.vet_fee) || 0), 0);
  const totalMedCosts = list.reduce((s, t) => s + (Number(t.additional_medical_cost) || 0), 0);

  const cattleIds = [...new Set(list.map((t) => t.cattle_id).filter(Boolean))];
  const { data: cd } = cattleIds.length ? await supabase.from("cattle").select("id, tag_id").in("id", cattleIds) : { data: [] as any[] };
  const cm: Record<string, string> = {};
  for (const c of cd ?? []) cm[c.id] = c.tag_id;

  return (
    <>
      <PageHeader
        title="Veterinary Treatments"
        subtitle="Clinical treatments and medicine administration log"
        icon={Pill}
        back="/dashboard/health"
        actions={
          <Link href="/dashboard/cattle" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
            Go to Cattle Profile →
          </Link>
        }
      />
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Records" value={list.length} icon={Pill} accentColor="blue" subtext="all time" />
        <StatCard label="This Month" value={monthCount ?? 0} icon={Activity} accentColor="violet" subtext="treatments" />
        <StatCard label="Total Vet Fees" value={`৳${(totalVetFees + totalMedCosts).toLocaleString()}`} icon={Activity} accentColor="amber" subtext="combined costs" />
      </div>
      <SectionCard title={`Treatment Log (${list.length})`} icon={Pill} iconVariant="blue">
        {list.length === 0 ? (
          <EmptyState icon={Pill} title="No treatments recorded" description="Treatments are logged in the animal profile." compact />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left">
                  <th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Animal</th>
                  <th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Diagnosis</th>
                  <th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Dose</th>
                  <th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Date</th>
                  <th className="py-2 text-right text-xs font-semibold text-muted-foreground">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {list.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2 pr-3 font-mono text-xs">{cm[t.cattle_id] ?? t.cattle_id.slice(0, 6)}</td>
                    <td className="py-2 pr-3 max-w-[180px] truncate">{t.diagnosis ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{t.dose_administered ? `${t.dose_administered} ${t.dose_unit ?? ""}` : "—"}</td>
                    <td className="py-2 pr-3 text-xs font-mono text-muted-foreground">{t.treated_at}</td>
                    <td className="py-2 text-right font-mono text-xs">{(t.vet_fee > 0 || t.additional_medical_cost > 0) ? `৳${(Number(t.vet_fee) + Number(t.additional_medical_cost)).toLocaleString()}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}

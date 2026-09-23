import type { Metadata } from "next";
import { Suspense } from "react";
import { Bug, CheckCircle, AlertTriangle } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";

export const metadata: Metadata = { title: "Disease Records | Health EHR" };

export default function DiseasesPage() {
  return (
    <div className="space-y-5">
      <Suspense fallback={<div className="h-96 animate-shimmer rounded-2xl" />}>
        <DiseasesSection />
      </Suspense>
    </div>
  );
}

const SEV: Record<string, string> = {
  mild: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  moderate: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  severe: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  critical: "bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300",
};
const STS: Record<string, string> = {
  active: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  under_treatment: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  recovered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  chronic: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  deceased: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400",
};

async function DiseasesSection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) return <EmptyState icon={Bug} title="No business found" />;

  const { data: rawDiseases } = await (supabase as any)
    .from("disease_records")
    .select("id, cattle_id, disease_name, diagnosis_date, severity, is_contagious, status, resolution_date")
    .eq("business_id", businessId)
    .order("diagnosis_date", { ascending: false })
    .limit(200);

  const diseases: any[] = rawDiseases ?? [];
  const active = diseases.filter((d) => ["active", "under_treatment"].includes(d.status));
  const resolved = diseases.filter((d) => !["active", "under_treatment"].includes(d.status));

  const ids = [...new Set(diseases.map((d) => d.cattle_id).filter(Boolean))];
  const { data: cd } = ids.length ? await supabase.from("cattle").select("id, tag_id").in("id", ids) : { data: [] as any[] };
  const cm: Record<string, string> = {};
  for (const c of cd ?? []) cm[c.id] = c.tag_id;

  return (
    <>
      <PageHeader title="Disease Records" subtitle="Outbreak tracking and disease history" icon={Bug} back="/dashboard/health" badge={active.length || undefined} badgeVariant="destructive" />
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Active Cases" value={active.length} icon={AlertTriangle} accentColor={active.length > 0 ? "rose" : "slate"} subtext="under treatment" />
        <StatCard label="Resolved" value={resolved.length} icon={CheckCircle} accentColor="emerald" subtext="recovered/closed" />
        <StatCard label="Total Records" value={diseases.length} icon={Bug} accentColor="blue" subtext="all time" />
      </div>
      <SectionCard title={`Active Cases (${active.length})`} icon={AlertTriangle} iconVariant={active.length > 0 ? "red" : "emerald"}>
        {active.length === 0 ? (
          <EmptyState icon={CheckCircle} title="No active disease cases" compact />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border/60 text-left"><th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Animal</th><th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Disease</th><th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Severity</th><th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Status</th><th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Contagious</th><th className="py-2 text-xs font-semibold text-muted-foreground">Diagnosed</th></tr></thead>
              <tbody className="divide-y divide-border/40">
                {active.map((d: any) => (
                  <tr key={d.id}>
                    <td className="py-2 pr-3 font-mono text-xs">{cm[d.cattle_id] ?? d.cattle_id?.slice(0,6)}</td>
                    <td className="py-2 pr-3 max-w-[140px] truncate font-medium">{d.disease_name}</td>
                    <td className="py-2 pr-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SEV[d.severity] ?? ""}`}>{d.severity}</span></td>
                    <td className="py-2 pr-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STS[d.status] ?? ""}`}>{d.status?.replace("_"," ")}</span></td>
                    <td className="py-2 pr-3 text-xs">{d.is_contagious ? <span className="text-red-600 font-semibold">Yes ⚠</span> : <span className="text-muted-foreground">No</span>}</td>
                    <td className="py-2 text-xs font-mono text-muted-foreground">{d.diagnosis_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
      {resolved.length > 0 && (
        <SectionCard title={`Resolved (${resolved.length})`} icon={CheckCircle} iconVariant="emerald">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border/60 text-left"><th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Animal</th><th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Disease</th><th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Status</th><th className="py-2 text-xs font-semibold text-muted-foreground">Resolved</th></tr></thead>
              <tbody className="divide-y divide-border/40">
                {resolved.map((d: any) => (
                  <tr key={d.id}>
                    <td className="py-2 pr-3 font-mono text-xs">{cm[d.cattle_id] ?? d.cattle_id?.slice(0,6)}</td>
                    <td className="py-2 pr-3 max-w-[200px] truncate">{d.disease_name}</td>
                    <td className="py-2 pr-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STS[d.status] ?? ""}`}>{d.status}</span></td>
                    <td className="py-2 text-xs font-mono text-muted-foreground">{d.resolution_date ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </>
  );
}


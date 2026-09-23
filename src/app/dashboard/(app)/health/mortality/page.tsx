import type { Metadata } from "next";
import { Suspense } from "react";
import { Skull, AlertTriangle } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";

export const metadata: Metadata = { title: "Mortality Records | Health EHR" };

export default function MortalityPage() {
  return (
    <div className="space-y-5">
      <Suspense fallback={<div className="h-80 animate-shimmer rounded-2xl" />}>
        <MortalitySection />
      </Suspense>
    </div>
  );
}

async function MortalitySection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) return <EmptyState icon={Skull} title="No business found" />;

  const { data: rawDeaths } = await (supabase as any)
    .from("cattle_death_records")
    .select("id, cattle_id, death_date, cause_of_death, post_mortem_notes, estimated_casualty_loss_bdt, disposal_method")
    .eq("business_id", businessId)
    .order("death_date", { ascending: false })
    .limit(100);

  const deaths: any[] = rawDeaths ?? [];
  const totalLoss = deaths.reduce((s: number, d: any) => s + (Number(d.estimated_casualty_loss_bdt) || 0), 0);
  const thisYear = new Date().getFullYear().toString();
  const yearDeaths = deaths.filter((d: any) => d.death_date?.startsWith(thisYear));

  const ids = [...new Set(deaths.map((d: any) => d.cattle_id).filter(Boolean))];
  const { data: cd } = ids.length ? await supabase.from("cattle").select("id, tag_id").in("id", ids) : { data: [] as any[] };
  const cm: Record<string, string> = {};
  for (const c of cd ?? []) cm[c.id] = c.tag_id;

  return (
    <>
      <PageHeader title="Mortality Records" subtitle="Death records and carcass disposal log" icon={Skull} back="/dashboard/health" badge={deaths.length || undefined} badgeVariant="secondary" />
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Deaths" value={deaths.length} icon={Skull} accentColor="slate" subtext="all time" />
        <StatCard label="This Year" value={yearDeaths.length} icon={AlertTriangle} accentColor={yearDeaths.length > 0 ? "rose" : "slate"} subtext={String(thisYear)} />
        <StatCard label="Total Loss" value={`৳${totalLoss.toLocaleString()}`} icon={Skull} accentColor="amber" subtext="estimated loss BDT" />
      </div>
      <SectionCard title={`Death Records (${deaths.length})`} icon={Skull} iconVariant="red">
        {deaths.length === 0 ? (
          <EmptyState icon={Skull} title="No mortality records" description="No deaths have been recorded." compact />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left">
                  <th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Animal</th>
                  <th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Cause of Death</th>
                  <th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Disposal</th>
                  <th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Date</th>
                  <th className="py-2 text-right text-xs font-semibold text-muted-foreground">Loss (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {deaths.map((d: any) => (
                  <tr key={d.id}>
                    <td className="py-2 pr-3 font-mono text-xs">{cm[d.cattle_id] ?? d.cattle_id?.slice(0, 6)}</td>
                    <td className="py-2 pr-3 max-w-[160px] truncate">{d.cause_of_death}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground capitalize">{d.disposal_method}</td>
                    <td className="py-2 pr-3 text-xs font-mono text-muted-foreground">{d.death_date}</td>
                    <td className="py-2 text-right font-mono text-xs">{d.estimated_casualty_loss_bdt > 0 ? Number(d.estimated_casualty_loss_bdt).toLocaleString() : "—"}</td>
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

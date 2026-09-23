import type { Metadata } from "next";
import { Suspense } from "react";
import { Beef, Heart, Sparkles, Clock, CheckCircle } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export const metadata: Metadata = { title: "Breeding Animals | Tanvir Agro" };

export default async function BreedingAnimalsPage() {
  return (
    <div className="space-y-5">
      <Suspense fallback={<div className="h-80 bg-muted rounded-xl animate-pulse" />}>
        <BreedingAnimalsSection />
      </Suspense>
    </div>
  );
}

async function BreedingAnimalsSection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) return <EmptyState icon={Beef} title="No business found" />;

  const [cattleRes, breedingRes, heatRes] = await Promise.all([
    (supabase as any).from("cattle").select("id,tag_number,name,gender,breed,dob").eq("business_id", businessId).in("gender", ["cow", "heifer", "bull"]).is("deleted_at", null).order("tag_number"),
    (supabase as any).from("breeding_attempts").select("id,cow_id,status,expected_calving_date,insemination_date").eq("business_id", businessId).order("insemination_date", { ascending: false }),
    (supabase as any).from("heat_records").select("id,cattle_id").eq("business_id", businessId).eq("status", "active"),
  ]);

  const cattle = cattleRes.data || [];
  const attempts = breedingRes.data || [];
  const statusMap = new Map<string, string>();
  const lastMap = new Map<string, any>();
  for (const a of attempts) {
    if (!lastMap.has(a.cow_id)) lastMap.set(a.cow_id, a);
    if (a.status === "pregnancy_confirmed") statusMap.set(a.cow_id, "pregnant");
    else if (!statusMap.has(a.cow_id) && a.status === "inseminated") statusMap.set(a.cow_id, "awaiting_pd");
  }
  const heatSet = new Set((heatRes.data || []).map((h: any) => h.cattle_id));
  const bulls = cattle.filter((c: any) => c.gender === "bull");
  const cows = cattle.filter((c: any) => c.gender !== "bull");
  const pregnantCount = [...statusMap.values()].filter(v => v === "pregnant").length;
  const awaitingPD = [...statusMap.values()].filter(v => v === "awaiting_pd").length;

  return (
    <>
      <PageHeader title="Breeding Animals" subtitle="Reproductive status of all breeding-eligible cattle" icon={Beef} back="/dashboard/breeding" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Females" value={cows.length} icon={Heart} accentColor="rose" subtext="Cows & heifers" />
        <StatCard label="Pregnant" value={pregnantCount} icon={Sparkles} accentColor="violet" subtext="Confirmed" />
        <StatCard label="Awaiting PD" value={awaitingPD} icon={Clock} accentColor="amber" subtext="Post-AI check" />
        <StatCard label="Open" value={Math.max(0, cows.length - pregnantCount - awaitingPD)} icon={CheckCircle} accentColor="emerald" subtext="Available" />
      </div>
      {bulls.length > 0 && (
        <SectionCard title={`Bulls (${bulls.length})`} icon={Beef} iconVariant="blue">
          <div className="divide-y divide-border/50">
            {bulls.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Link href={`/dashboard/cattle/${c.id}`} className="text-sm font-semibold hover:text-primary truncate block">#{c.tag_number}{c.name ? ` — ${c.name}` : ""}</Link>
                  <p className="text-xs text-muted-foreground">{c.breed || "Unknown"}{c.dob ? ` · Born ${c.dob}` : ""}</p>
                </div>
                <Badge variant="secondary" className="text-[10px] shrink-0">Sire</Badge>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
      <SectionCard title={`Females (${cows.length})`} icon={Heart} iconVariant="red">
        {cows.length === 0 ? <EmptyState icon={Heart} title="No breeding females found" compact /> : (
          <div className="divide-y divide-border/50">
            {cows.map((c: any) => {
              const last = lastMap.get(c.id);
              const s = heatSet.has(c.id) ? "heat" : statusMap.get(c.id);
              return (
                <div key={c.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/dashboard/cattle/${c.id}`} className="text-sm font-semibold hover:text-primary truncate">#{c.tag_number}{c.name ? ` — ${c.name}` : ""}</Link>
                    {s === "heat" && <Badge className="text-[10px] bg-rose-500 text-white">In Heat</Badge>}
                    {s === "pregnant" && <Badge className="text-[10px] bg-purple-500 text-white">Pregnant</Badge>}
                    {s === "awaiting_pd" && <Badge variant="warning" className="text-[10px]">Awaiting PD</Badge>}
                    {!s && <Badge variant="outline" className="text-[10px]">Open</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.breed || "Unknown"} &middot; {c.gender}
                    {last ? ` · Last AI: ${last.insemination_date}` : ""}
                    {s === "pregnant" && last?.expected_calving_date ? ` · Due: ${last.expected_calving_date}` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </>
  );
}

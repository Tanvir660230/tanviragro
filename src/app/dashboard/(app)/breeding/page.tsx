import type { Metadata } from "next";
import { Suspense } from "react";
import {
  Heart, Flame, Sparkles, Baby, Dna, FlaskConical,
  Calendar, AlertTriangle, CheckCircle, TrendingUp,
  Clock, Activity, ArrowRight, Stethoscope,
} from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { GestationEngine, FertilityAnalyticsEngine } from "@/lib/reproduction";

export const metadata: Metadata = {
  title: "Breeding & Reproduction | Tanvir Agro",
  description: "Complete breeding intelligence: heat detection, AI insemination, pregnancy tracking, calving registry, and genetic pedigree.",
};

export default async function BreedingDashboardPage() {
  return (
    <div className="space-y-5">
      <Suspense fallback={<DashboardSkeleton />}>
        <BreedingDashboardSection />
      </Suspense>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-14 bg-muted rounded-xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0,1,2,3,4,5,6,7].map(i => <div key={i} className="h-24 bg-muted rounded-xl" />)}
      </div>
      <div className="h-72 bg-muted rounded-xl" />
    </div>
  );
}

async function BreedingDashboardSection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();

  if (!businessId) {
    return (
      <EmptyState icon={Heart} title="No Business Found"
        description="Please set up your farm profile to access breeding management." />
    );
  }

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const in7Str = new Date(today.getTime() + 7*86400000).toISOString().slice(0, 10);
  const in30Str = new Date(today.getTime() + 30*86400000).toISOString().slice(0, 10);

  const [heatRes, breedingRes, calvingRes, semenRes, reminderRes] = await Promise.all([
    (supabase as any).from("heat_records").select("id,cattle_id,detected_at,status,intensity,optimal_breeding_start,optimal_breeding_end").eq("business_id", businessId).order("detected_at", { ascending: false }).limit(200),
    (supabase as any).from("breeding_attempts").select("id,cow_id,insemination_date,status,pd_result,expected_calving_date,sire_tag_or_code,technician_name,total_breeding_cost_bdt,attempt_number_in_cycle").eq("business_id", businessId).order("insemination_date", { ascending: false }).limit(500),
    (supabase as any).from("calving_records").select("id,cow_id,calving_date,calving_type").eq("business_id", businessId).order("calving_date", { ascending: false }).limit(50),
    (supabase as any).from("semen_inventory").select("id,straws_in_stock").eq("business_id", businessId).eq("is_active", true),
    (supabase as any).from("reproduction_reminders").select("id,reminder_type,scheduled_for,notes").eq("business_id", businessId).eq("is_dismissed", false).lte("scheduled_for", in7Str).order("scheduled_for", { ascending: true }).limit(20),
  ]);

  const heats = heatRes.data || [];
  const attempts = breedingRes.data || [];
  const calvings = calvingRes.data || [];
  const semenRows = semenRes.data || [];
  const reminders = reminderRes.data || [];

  const activeHeats = heats.filter((h: any) => h.status === "active").length;
  const confirmedPregnancies = attempts.filter((a: any) => a.status === "pregnancy_confirmed").length;
  const pendingPDs = attempts.filter((a: any) => a.status === "inseminated" && a.pd_result === "pending").length;
  const upcomingCalvings30d = attempts.filter((a: any) =>
    a.status === "pregnancy_confirmed" && a.expected_calving_date >= todayStr && a.expected_calving_date <= in30Str
  ).length;
  const overdueCalvings = attempts.filter((a: any) =>
    a.status === "pregnancy_confirmed" && a.expected_calving_date < todayStr
  ).length;
  const totalStraws = semenRows.reduce((acc: number, s: any) => acc + (Number(s.straws_in_stock) || 0), 0);
  const mappedAttempts = attempts.map((a: any) => ({
    id: a.id, businessId, cowId: a.cow_id, status: a.status, pdResult: a.pd_result,
    attemptNumberInCycle: Number(a.attempt_number_in_cycle) || 1,
    expectedCalvingDate: a.expected_calving_date || "", sireTagOrCode: a.sire_tag_or_code || "",
    technicianName: a.technician_name || null, inseminationDate: a.insemination_date,
    breedingType: "AI" as const, pdCheckScheduledDate: "",
    heatRecordId: null, semenInventoryId: null, sireId: null, sireBreed: null, inseminationTime: null,
    technicianCostBdt: 0, strawCostBdt: 0, totalBreedingCostBdt: Number(a.total_breeding_cost_bdt || 0),
    pdCheckActualDate: null, pdMethod: null, pdExaminedBy: null, pdGestationDays: null,
    dryOffDate: "", transitionDietDate: null, pregnancyRiskLevel: "normal" as const,
    notes: null, createdAt: a.created_at, updatedAt: a.updated_at,
  }));
  const metrics = FertilityAnalyticsEngine.calculateHerdFertilityMetrics(mappedAttempts, [], confirmedPregnancies);
  const activeHeatList = heats.filter((h: any) => h.status === "active").slice(0, 5);
  const nextCalvings = attempts
    .filter((a: any) => a.status === "pregnancy_confirmed" && a.expected_calving_date >= todayStr)
    .sort((a: any, b: any) => a.expected_calving_date.localeCompare(b.expected_calving_date)).slice(0, 5);

  return (
    <>
      <PageHeader
        title="Breeding & Reproduction"
        subtitle="Livestock reproductive intelligence — heat, insemination, pregnancy, and calving"
        icon={Heart}
        actions={
          <Link href="/dashboard/breeding/heat">
            <Button size="sm" className="gap-1.5"><Flame className="h-3.5 w-3.5" />Record Heat</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Active Heat Alerts" value={activeHeats} icon={Flame} accentColor="rose" subtext="Cows in breeding window" href="/dashboard/breeding/heat" />
        <StatCard label="Pregnancies" value={confirmedPregnancies} icon={Sparkles} accentColor="violet" subtext="Confirmed active" href="/dashboard/breeding/pregnancy" />
        <StatCard label="Pending PD Checks" value={pendingPDs} icon={Stethoscope} accentColor="amber" subtext="45-day diagnosis due" href="/dashboard/breeding/pregnancy" />
        <StatCard label="Calvings in 30d" value={upcomingCalvings30d} icon={Baby} accentColor="emerald" subtext="Expected deliveries" href="/dashboard/breeding/calving" />
        <StatCard label="Overdue Calvings" value={overdueCalvings} icon={AlertTriangle} accentColor={overdueCalvings > 0 ? "destructive" : "slate"} subtext="Past expected date" href="/dashboard/breeding/calving" />
        <StatCard label="Conception Rate" value={`${metrics.conceptionRatePercent}%`} icon={TrendingUp} accentColor="blue" subtext="Overall AI success" href="/dashboard/breeding/analytics" />
        <StatCard label="Semen in Stock" value={totalStraws} icon={FlaskConical} accentColor="blue" subtext="Total straws available" href="/dashboard/breeding/semen" />
        <StatCard label="Total Calvings" value={calvings.length} icon={Baby} accentColor="emerald" subtext="All recorded births" href="/dashboard/breeding/calving" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Active Heat Alerts" icon={Flame} iconVariant="red"
          action={<Link href="/dashboard/breeding/heat" className="text-xs text-primary hover:underline flex items-center gap-1">View All <ArrowRight className="h-3 w-3" /></Link>}>
          {activeHeatList.length === 0 ? (
            <EmptyState icon={Flame} title="No active heat alerts" description="Record heat detection to begin the breeding workflow." compact />
          ) : (
            <div className="space-y-2">
              {activeHeatList.map((h: any) => {
                const isWindowOpen = new Date() >= new Date(h.optimal_breeding_start) && new Date() <= new Date(h.optimal_breeding_end);
                return (
                  <div key={h.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/50">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-sm font-semibold truncate">Cow #{h.cattle_id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">Detected: {new Date(h.detected_at).toLocaleDateString()} &middot; {String(h.intensity ?? "").replace(/_/g, " ")}</p>
                    </div>
                    <Badge variant={isWindowOpen ? "default" : "outline"} className="shrink-0 text-[10px]">{isWindowOpen ? "Window Open" : "Window Soon"}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Upcoming Calvings" icon={Baby} iconVariant="emerald"
          action={<Link href="/dashboard/breeding/calving" className="text-xs text-primary hover:underline flex items-center gap-1">View All <ArrowRight className="h-3 w-3" /></Link>}>
          {nextCalvings.length === 0 ? (
            <EmptyState icon={Baby} title="No upcoming calvings" description="Confirmed pregnancies will appear here with due dates." compact />
          ) : (
            <div className="space-y-2">
              {nextCalvings.map((a: any) => {
                const daysLeft = Math.max(0, Math.ceil((new Date(a.expected_calving_date).getTime() - today.getTime()) / 86400000));
                const gestation = GestationEngine.getGestationDetails(a.insemination_date);
                return (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/50">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-sm font-semibold truncate">Cow #{a.cow_id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">Due: {a.expected_calving_date} &middot; {gestation.trimester}</p>
                    </div>
                    <Badge variant={daysLeft <= 7 ? "warning" : "secondary"} className="shrink-0 text-[10px]">{daysLeft}d left</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>


      {reminders.length > 0 && (
        <SectionCard title="Upcoming Reminders (next 7 days)" icon={Clock} iconVariant="amber">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {reminders.map((r: any) => (
              <div key={r.id} className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30">
                <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold capitalize">{String(r.reminder_type ?? "").replace(/_/g, " ")}</p>
                  <p className="text-[11px] text-muted-foreground">{r.scheduled_for}</p>
                  {r.notes && <p className="text-[11px] text-muted-foreground truncate">{r.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard title="Fertility Performance" icon={Activity} iconVariant="blue"
        action={<Link href="/dashboard/breeding/analytics" className="text-xs text-primary hover:underline flex items-center gap-1">Full Analytics <ArrowRight className="h-3 w-3" /></Link>}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total AI Attempts",    value: metrics.totalBreedingAttempts },
            { label: "1st Service Rate",     value: `${metrics.firstServiceConceptionRatePercent}%` },
            { label: "Services/Conception",  value: metrics.servicesPerConception.toFixed(2) },
            { label: "Avg Days Open",        value: `${metrics.averageDaysOpen}d` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-border/60 bg-muted/30 p-3 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
              <p className="text-xl font-bold text-foreground mt-1">{value}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Quick Actions" icon={CheckCircle} iconVariant="primary">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Record Heat",         href: "/dashboard/breeding/heat",      icon: Flame,       color: "text-rose-600" },
            { label: "Record Insemination", href: "/dashboard/breeding/heat",      icon: Dna,         color: "text-blue-600" },
            { label: "Pregnancy Check",     href: "/dashboard/breeding/pregnancy", icon: Stethoscope, color: "text-violet-600" },
            { label: "Register Birth",      href: "/dashboard/breeding/calving",   icon: Baby,        color: "text-emerald-600" },
          ].map(({ label, href, icon: Icon, color }) => (
            <Link key={label} href={href}>
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border/60 hover:bg-muted/50 transition-all cursor-pointer group">
                <Icon className={`h-5 w-5 ${color} group-hover:scale-110 transition-transform`} />
                <span className="text-xs font-medium text-center">{label}</span>
              </div>
            </Link>
          ))}
        </div>
      </SectionCard>
    </>
  );
}


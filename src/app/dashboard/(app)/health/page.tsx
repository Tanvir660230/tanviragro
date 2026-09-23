import type { Metadata } from "next";
import { Suspense } from "react";
import { HeartPulse, Activity, ShieldAlert, Skull, Syringe, ClipboardList, AlertTriangle, CheckCircle } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState } from "@/components/shared/EmptyState";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Health & Veterinary | Dashboard",
};

export default function HealthDashboardPage() {
  return (
    <div className="space-y-5">
      <Suspense fallback={<DashboardSkeleton />}>
        <HealthDashboardSection />
      </Suspense>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl animate-shimmer overflow-hidden shrink-0" />
        <div className="space-y-1.5">
          <div className="h-7 w-52 animate-shimmer rounded" />
          <div className="h-4 w-36 animate-shimmer rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-shimmer rounded-2xl" />
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-72 animate-shimmer rounded-2xl" />
        <div className="h-72 animate-shimmer rounded-2xl" />
      </div>
    </div>
  );
}

async function HealthDashboardSection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) {
    return <EmptyState icon={HeartPulse} title="No business found" />;
  }

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const in7ISO = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);

  const [
    { count: totalActive },
    { count: quarantined },
    { data: rawEvents },
    { count: completedThisMonth },
    { data: recentTreatments },
    diseaseRes,
  ] = await Promise.all([
    supabase.from("cattle").select("*", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "active").is("deleted_at", null),
    supabase.from("cattle").select("*", { count: "exact", head: true }).eq("business_id", businessId).eq("is_quarantined", true).is("deleted_at", null),
    supabase.from("health_events").select("id, cattle_id, title, event_type, scheduled_at").eq("business_id", businessId).is("completed_at", null).is("deleted_at", null).order("scheduled_at", { ascending: true }).limit(200),
    supabase.from("health_events").select("*", { count: "exact", head: true }).eq("business_id", businessId).gte("completed_at", firstOfMonth).is("deleted_at", null),
    supabase.from("cattle_treatments").select("id, cattle_id, diagnosis, treated_at, vet_fee").order("treated_at", { ascending: false }).limit(5),
    (supabase as any).from("disease_records").select("id, disease_name, severity, status").eq("business_id", businessId).in("status", ["active", "under_treatment"]).order("diagnosis_date", { ascending: false }).limit(5),
  ]);

  const pending = rawEvents ?? [];
  const overdueCount = pending.filter((e) => e.scheduled_at < todayISO).length;
  const thisWeekCount = pending.filter((e) => e.scheduled_at >= todayISO && e.scheduled_at <= in7ISO).length;
  const diseaseRows: any[] = diseaseRes.data ?? [];

  const SEVERITY_COLOR: Record<string, string> = {
    mild: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    moderate: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    severe: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    critical: "bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300",
  };

  const TYPE_LABEL: Record<string, string> = {
    vaccine: "Vaccine", checkup: "Check-up", deworming: "Deworming", treatment: "Treatment", other: "Other",
  };

  return (
    <>
      <PageHeader
        title="Health & Veterinary EHR"
        subtitle={`${totalActive ?? 0} active animals · ${overdueCount > 0 ? `${overdueCount} overdue events` : "All events on track"}`}
        icon={HeartPulse}
        badge={overdueCount || undefined}
        badgeVariant="destructive"
        actions={
          <Link href="/dashboard/health/records" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors">
            <ClipboardList className="h-3.5 w-3.5" />
            All Records
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Active Animals" value={totalActive ?? 0} icon={Activity} accentColor="emerald" href="/dashboard/cattle" subtext="in records" />
        <StatCard label="Pending Events" value={pending.length} icon={ClipboardList} accentColor={overdueCount > 0 ? "rose" : "blue"} href="/dashboard/health/records" subtext={overdueCount > 0 ? `${overdueCount} overdue` : `${thisWeekCount} this week`} />
        <StatCard label="Quarantine" value={quarantined ?? 0} icon={ShieldAlert} accentColor={quarantined ? "amber" : "slate"} href="/dashboard/health/quarantine" subtext="animals isolated" />
        <StatCard label="Completed (Month)" value={completedThisMonth ?? 0} icon={CheckCircle} accentColor="violet" subtext="health events done" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <SectionCard title="Pending Health Events" icon={AlertTriangle} iconVariant={overdueCount > 0 ? "red" : "amber"} className="lg:col-span-2" action={<Link href="/dashboard/health/records" className="text-xs text-primary hover:underline font-medium">View all</Link>}>
          {pending.length === 0 ? (
            <EmptyState icon={CheckCircle} title="All clear!" description="No pending health events." compact />
          ) : (
            <div className="divide-y divide-border/60">
              {pending.slice(0, 8).map((ev) => {
                const isOverdue = ev.scheduled_at < todayISO;
                return (
                  <div key={ev.id} className="flex items-center gap-3 py-2.5">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${isOverdue ? "bg-red-500" : "bg-amber-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{ev.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {TYPE_LABEL[ev.event_type] ?? ev.event_type} · {ev.scheduled_at}
                        {isOverdue && <span className="ml-1 text-red-500 font-semibold"> Overdue</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
        <div className="space-y-4">
          <SectionCard title="Active Diseases" icon={AlertTriangle} iconVariant="red" action={<Link href="/dashboard/health/diseases" className="text-xs text-primary hover:underline font-medium">View all</Link>}>
            {diseaseRows.length === 0 ? (
              <EmptyState icon={CheckCircle} title="No active cases" compact />
            ) : (
              <div className="space-y-2">
                {diseaseRows.slice(0, 4).map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{d.disease_name}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${SEVERITY_COLOR[d.severity] ?? ""}`}>{d.severity}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
          <SectionCard title="Quick Access" icon={HeartPulse} iconVariant="primary">
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: "/dashboard/health/vaccinations", label: "Vaccinations", icon: Syringe },
                { href: "/dashboard/health/treatments", label: "Treatments", icon: Activity },
                { href: "/dashboard/health/quarantine", label: "Quarantine", icon: ShieldAlert },
                { href: "/dashboard/health/mortality", label: "Mortality", icon: Skull },
              ].map((item) => (
                <Link key={item.href} href={item.href} className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-xs font-medium hover:bg-muted/60 transition-colors">
                  <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  {item.label}
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
      {recentTreatments && recentTreatments.length > 0 && (
        <SectionCard title="Recent Treatments" icon={Activity} iconVariant="blue" action={<Link href="/dashboard/health/treatments" className="text-xs text-primary hover:underline font-medium">View all</Link>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border/60"><th className="py-2 text-left text-xs font-semibold text-muted-foreground">Diagnosis</th><th className="py-2 text-left text-xs font-semibold text-muted-foreground">Date</th><th className="py-2 text-right text-xs font-semibold text-muted-foreground">Vet Fee</th></tr></thead>
              <tbody className="divide-y divide-border/40">
                {recentTreatments.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2 truncate max-w-xs">{t.diagnosis ?? "—"}</td>
                    <td className="py-2 text-muted-foreground">{t.treated_at}</td>
                    <td className="py-2 text-right font-mono">{t.vet_fee > 0 ? `৳${Number(t.vet_fee).toLocaleString()}` : "—"}</td>
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


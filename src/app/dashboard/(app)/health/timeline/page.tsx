import type { Metadata } from "next";
import { Suspense } from "react";
import { History, Activity, Syringe, Pill, Bug, ShieldAlert, Skull, ClipboardList } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState } from "@/components/shared/EmptyState";

export const metadata: Metadata = { title: "Health Timeline | EHR" };

export default function TimelinePage() {
  return (
    <div className="space-y-5">
      <Suspense fallback={<div className="h-96 animate-shimmer rounded-2xl" />}>
        <TimelineSection />
      </Suspense>
    </div>
  );
}

const EV_ICON: Record<string, typeof Activity> = {
  vaccine: Syringe,
  checkup: ClipboardList,
  deworming: Pill,
  treatment: Activity,
  other: Activity,
};

const EV_COLOR: Record<string, string> = {
  vaccine: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  checkup: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  deworming: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  treatment: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  other: "bg-muted text-muted-foreground",
};

async function TimelineSection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) return <EmptyState icon={History} title="No business found" />;

  // eslint-disable-next-line react-hooks/purity
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [{ data: events }, { data: treatments }, diseaseRes] = await Promise.all([
    supabase.from("health_events").select("id, cattle_id, title, event_type, scheduled_at, completed_at, notes").eq("business_id", businessId).is("deleted_at", null).gte("scheduled_at", thirtyDaysAgo).order("scheduled_at", { ascending: false }).limit(100),
    (supabase as any).from("cattle_treatments").select("id, cattle_id, diagnosis, treated_at, vet_fee").eq("business_id", businessId).gte("treated_at", thirtyDaysAgo).order("treated_at", { ascending: false }).limit(50),
    (supabase as any).from("disease_records").select("id, cattle_id, disease_name, severity, status, diagnosis_date").eq("business_id", businessId).gte("diagnosis_date", thirtyDaysAgo).order("diagnosis_date", { ascending: false }).limit(20),
  ]);

  type TimelineItem = { date: string; type: string; icon: typeof Activity; color: string; label: string; sub: string };

  const items: TimelineItem[] = [];

  for (const e of events ?? []) {
    items.push({
      date: e.completed_at?.slice(0, 10) ?? e.scheduled_at,
      type: e.event_type,
      icon: EV_ICON[e.event_type] ?? Activity,
      color: EV_COLOR[e.event_type] ?? EV_COLOR.other,
      label: e.title,
      sub: `${e.completed_at ? "Completed" : "Pending"} · ${e.completed_at?.slice(0, 10) ?? e.scheduled_at}`,
    });
  }

  for (const t of treatments ?? []) {
    items.push({
      date: t.treated_at,
      type: "treatment",
      icon: Pill,
      color: EV_COLOR.treatment,
      label: t.diagnosis ?? "Treatment",
      sub: `Treated · ${t.treated_at}${t.vet_fee > 0 ? ` · ৳${Number(t.vet_fee).toLocaleString()}` : ""}`,
    });
  }

  for (const d of (diseaseRes.data ?? []) as any[]) {
    items.push({
      date: d.diagnosis_date,
      type: "disease",
      icon: Bug,
      color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
      label: d.disease_name,
      sub: `Disease · ${d.severity} · ${d.status}`,
    });
  }

  items.sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <PageHeader title="Health Timeline" subtitle="Chronological activity feed — last 30 days" icon={History} back="/dashboard/health" />
      <SectionCard title={`${items.length} Events (Last 30 Days)`} icon={History} iconVariant="primary">
        {items.length === 0 ? (
          <EmptyState icon={History} title="No events in past 30 days" compact />
        ) : (
          <div className="relative pl-6">
            <div className="absolute left-2 top-0 bottom-0 w-px bg-border/60" />
            <div className="space-y-4">
              {items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="relative flex gap-3">
                    <div className={`absolute -left-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 shadow-xs ${item.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.sub}</p>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground shrink-0">{item.date}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SectionCard>
    </>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { ClipboardList, CheckCircle, AlertTriangle } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";

export const metadata: Metadata = { title: "Health Records | EHR" };

export default function HealthRecordsPage() {
  return (
    <div className="space-y-5">
      <Suspense fallback={<div className="h-96 animate-shimmer rounded-2xl" />}>
        <RecordsSection />
      </Suspense>
    </div>
  );
}

const EV_COLOR: Record<string, string> = {
  vaccine: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  checkup: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  deworming: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  treatment: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  other: "bg-muted text-muted-foreground",
};
const EV_LABEL: Record<string, string> = {
  vaccine: "Vaccine", checkup: "Check-up", deworming: "Deworming", treatment: "Treatment", other: "Other",
};

async function RecordsSection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) return <EmptyState icon={ClipboardList} title="No business found" />;

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const in7ISO = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);

  const [{ data: pending }, { data: completed }, { count: doneMonth }] = await Promise.all([
    supabase.from("health_events").select("id, cattle_id, title, event_type, scheduled_at").eq("business_id", businessId).is("completed_at", null).is("deleted_at", null).order("scheduled_at", { ascending: true }).limit(100),
    supabase.from("health_events").select("id, title, event_type, completed_at").eq("business_id", businessId).not("completed_at", "is", null).is("deleted_at", null).order("completed_at", { ascending: false }).limit(50),
    supabase.from("health_events").select("*", { count: "exact", head: true }).eq("business_id", businessId).gte("completed_at", firstOfMonth).is("deleted_at", null),
  ]);

  const pl = pending ?? [];
  const cl = completed ?? [];
  const overdue = pl.filter((e) => e.scheduled_at < todayISO).length;
  const thisWeek = pl.filter((e) => e.scheduled_at >= todayISO && e.scheduled_at <= in7ISO).length;

  const ids = [...new Set(pl.map((e) => e.cattle_id).filter(Boolean))];
  const { data: cd } = ids.length ? await supabase.from("cattle").select("id, tag_id").in("id", ids) : { data: [] as any[] };
  const cm: Record<string, string> = {};
  for (const c of cd ?? []) cm[c.id] = c.tag_id;

  return (
    <>
      <PageHeader title="Health Records" subtitle="Scheduled and completed health events" icon={ClipboardList} back="/dashboard/health" badge={overdue || undefined} badgeVariant="destructive" />
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Pending" value={pl.length} icon={AlertTriangle} accentColor={overdue > 0 ? "rose" : "amber"} subtext={`${overdue} overdue`} />
        <StatCard label="This Week" value={thisWeek} icon={ClipboardList} accentColor="blue" subtext="upcoming 7 days" />
        <StatCard label="Done (Month)" value={doneMonth ?? 0} icon={CheckCircle} accentColor="emerald" subtext="completed" />
      </div>
      <SectionCard title={`Pending (${pl.length})`} icon={AlertTriangle} iconVariant={overdue > 0 ? "red" : "amber"}>
        {pl.length === 0 ? (
          <EmptyState icon={CheckCircle} title="All events completed!" compact />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border/60 text-left"><th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Animal</th><th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Event</th><th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Type</th><th className="py-2 text-xs font-semibold text-muted-foreground">Scheduled</th></tr></thead>
              <tbody className="divide-y divide-border/40">
                {pl.map((ev) => {
                  const od = ev.scheduled_at < todayISO;
                  return (
                    <tr key={ev.id} className={od ? "bg-red-50/40 dark:bg-red-950/10" : ""}>
                      <td className="py-2 pr-3 font-mono text-xs">{cm[ev.cattle_id] ?? ev.cattle_id.slice(0, 6)}</td>
                      <td className="py-2 pr-3 max-w-[180px] truncate font-medium">{ev.title}</td>
                      <td className="py-2 pr-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${EV_COLOR[ev.event_type] ?? ""}`}>{EV_LABEL[ev.event_type] ?? ev.event_type}</span></td>
                      <td className={`py-2 text-xs font-mono ${od ? "text-red-600 dark:text-red-400 font-bold" : "text-muted-foreground"}`}>{ev.scheduled_at}{od && " ⚠"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
      <SectionCard title={`Completed (${cl.length})`} icon={CheckCircle} iconVariant="emerald">
        {cl.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No completed events yet" compact />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border/60 text-left"><th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Event</th><th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Type</th><th className="py-2 text-xs font-semibold text-muted-foreground">Completed</th></tr></thead>
              <tbody className="divide-y divide-border/40">
                {cl.map((ev) => (
                  <tr key={ev.id}>
                    <td className="py-2 pr-3 max-w-[220px] truncate font-medium">{ev.title}</td>
                    <td className="py-2 pr-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${EV_COLOR[ev.event_type] ?? ""}`}>{EV_LABEL[ev.event_type] ?? ev.event_type}</span></td>
                    <td className="py-2 text-xs font-mono text-muted-foreground">{ev.completed_at?.slice(0, 10) ?? "—"}</td>
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


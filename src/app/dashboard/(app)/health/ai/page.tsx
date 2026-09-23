import type { Metadata } from "next";
import { Suspense } from "react";
import { Sparkles, AlertTriangle, CheckCircle, Activity } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";

export const metadata: Metadata = { title: "AI Health Insights | EHR" };

export default function AIInsightsPage() {
  return (
    <div className="space-y-5">
      <Suspense fallback={<div className="h-96 animate-shimmer rounded-2xl" />}>
        <AIInsightsSection />
      </Suspense>
    </div>
  );
}

async function AIInsightsSection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) return <EmptyState icon={Sparkles} title="No business found" />;

  const todayISO = new Date().toISOString().slice(0, 10);

  const [{ data: overdueEvents }, { data: quarantined }, diseaseRes, { data: upcomingVaccines }] = await Promise.all([
    supabase.from("health_events").select("id, title, event_type").eq("business_id", businessId).is("completed_at", null).is("deleted_at", null).lt("scheduled_at", todayISO).limit(20),
    supabase.from("cattle").select("id, tag_id").eq("business_id", businessId).eq("is_quarantined", true).is("deleted_at", null),
    (supabase as any).from("disease_records").select("id, disease_name, severity").eq("business_id", businessId).in("status", ["active", "under_treatment"]).limit(10),
    supabase.from("health_events").select("id, title").eq("business_id", businessId).is("completed_at", null).is("deleted_at", null).eq("event_type", "vaccine").gte("scheduled_at", todayISO).limit(5),
  ]);

  const diseases: any[] = diseaseRes.data ?? [];
  type Alert = { icon: typeof AlertTriangle; color: string; title: string; body: string; severity: "high" | "medium" | "low" };
  const alerts: Alert[] = [];

  if ((overdueEvents?.length ?? 0) > 0) alerts.push({ icon: AlertTriangle, color: "red", title: `${overdueEvents!.length} Overdue Health Events`, body: "Past scheduled date. Requires immediate attention.", severity: "high" });
  if ((quarantined?.length ?? 0) > 0) alerts.push({ icon: AlertTriangle, color: "amber", title: `${quarantined!.length} Animals in Quarantine`, body: "Monitor closely. Ensure biosecurity protocols.", severity: "medium" });
  if (diseases.filter((d) => d.severity === "severe" || d.severity === "critical").length > 0) alerts.push({ icon: AlertTriangle, color: "red", title: "Critical Disease Cases", body: `${diseases.filter((d) => d.severity === "severe" || d.severity === "critical").length} animals with severe/critical status.`, severity: "high" });
  if ((upcomingVaccines?.length ?? 0) > 0) alerts.push({ icon: CheckCircle, color: "blue", title: `${upcomingVaccines!.length} Upcoming Vaccinations`, body: "Ensure vaccine inventory is stocked.", severity: "low" });

  const recs: string[] = [];
  if ((overdueEvents?.length ?? 0) > 5) recs.push("High volume of overdue events — schedule a dedicated health day.");
  if ((quarantined?.length ?? 0) > 0) recs.push("Review and update resolution dates for quarantined animals.");
  if (diseases.some((d: any) => d.severity === "critical")) recs.push("Critical disease cases. Consult a veterinarian immediately.");
  if (alerts.length === 0) recs.push("Health program is on track. Continue regular monitoring schedules.");

  const COLOR: Record<string, string> = {
    red: "border-red-200 bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/20",
    amber: "border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20",
    blue: "border-blue-200 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/20",
  };
  const ICON_COLOR: Record<string, string> = { red: "text-red-600", amber: "text-amber-600", blue: "text-blue-600" };

  return (
    <>
      <PageHeader title="AI Health Insights" subtitle="Smart recommendations and predictive health alerts" icon={Sparkles} back="/dashboard/health" badge={alerts.filter((a) => a.severity === "high").length || undefined} badgeVariant="destructive" />
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="High Priority" value={alerts.filter((a) => a.severity === "high").length} icon={AlertTriangle} accentColor={alerts.filter((a) => a.severity === "high").length > 0 ? "rose" : "slate"} subtext="alerts" />
        <StatCard label="Medium" value={alerts.filter((a) => a.severity === "medium").length} icon={Activity} accentColor="amber" subtext="alerts" />
        <StatCard label="Recommendations" value={recs.length} icon={Sparkles} accentColor="violet" subtext="action items" />
      </div>
      <SectionCard title="Smart Health Alerts" icon={AlertTriangle} iconVariant={alerts.some((a) => a.severity === "high") ? "red" : "amber"}>
        {alerts.length === 0 ? (
          <EmptyState icon={CheckCircle} title="No alerts — herd health looks good!" compact />
        ) : (
          <div className="space-y-3">
            {alerts.map((alert, i) => {
              const Icon = alert.icon;
              return (
                <div key={i} className={`flex items-start gap-3 rounded-xl border p-4 ${COLOR[alert.color] ?? ""}`}>
                  <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${ICON_COLOR[alert.color] ?? ""}`} />
                  <div>
                    <p className="text-sm font-semibold">{alert.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{alert.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
      <SectionCard title="AI Recommendations" icon={Sparkles} iconVariant="primary">
        <ul className="space-y-2.5">
          {recs.map((r, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </>
  );
}


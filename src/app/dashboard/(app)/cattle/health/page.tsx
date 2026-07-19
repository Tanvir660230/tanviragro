import type { Metadata } from "next";
import { Suspense } from "react";
import { HeartPulse } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { HealthHubClient } from "@/components/cattle/HealthHubClient";

export const metadata: Metadata = { title: "Health Hub" };

export type HubEventRow = {
  id: string;
  cattle_id: string;
  title: string;
  event_type: "vaccine" | "checkup" | "deworming" | "treatment" | "other";
  scheduled_at: string;
  notes: string | null;
  cattle: { tag_id: string; breed: string | null } | null;
};

export default async function HealthHubPage() {
  return (
    <div className="space-y-4">
      <Suspense fallback={<HealthHubSkeleton />}>
        <HealthHubSection />
      </Suspense>
    </div>
  );
}

function HealthHubSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl animate-shimmer overflow-hidden shrink-0" />
        <div className="space-y-1.5">
          <div className="h-7 w-40 animate-shimmer rounded overflow-hidden" />
          <div className="h-4 w-28 animate-shimmer rounded overflow-hidden" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-shimmer rounded-xl overflow-hidden" />
        ))}
      </div>
      <div className="h-[400px] animate-shimmer rounded-xl overflow-hidden" />
    </div>
  );
}

async function HealthHubSection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();

  if (!businessId) {
    return <PageHeader title="Health Hub" icon={HeartPulse} back="/dashboard/cattle" />;
  }

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const in7ISO = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);

  const [{ data: rawEvents }, { count: completedThisMonth }] = await Promise.all([
    supabase
      .from("health_events")
      .select("id, cattle_id, title, event_type, scheduled_at, notes")
      .eq("business_id", businessId)
      .is("completed_at", null)
      .is("deleted_at", null)
      .order("scheduled_at", { ascending: true })
      .limit(500),
    supabase
      .from("health_events")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("completed_at", firstOfMonth)
      .is("deleted_at", null),
  ]);

  // Fetch cattle info in a single round-trip
  const cattleIds = [...new Set((rawEvents ?? []).map((e) => e.cattle_id).filter(Boolean))];
  const { data: cattleData } = cattleIds.length
    ? await supabase
        .from("cattle")
        .select("id, tag_id, breed")
        .in("id", cattleIds)
    : { data: [] as { id: string; tag_id: string; breed: string | null }[] };

  const cattleMap: Record<string, { tag_id: string; breed: string | null }> = {};
  for (const c of cattleData ?? []) cattleMap[c.id] = { tag_id: c.tag_id, breed: c.breed };

  const events: HubEventRow[] = (rawEvents ?? []).map((e) => ({
    ...e,
    cattle: cattleMap[e.cattle_id] ?? null,
  }));

  const overdueCount = events.filter((e) => e.scheduled_at < todayISO).length;
  const thisWeekCount = events.filter(
    (e) => e.scheduled_at >= todayISO && e.scheduled_at <= in7ISO
  ).length;

  return (
    <>
      <PageHeader
        title="Health Hub"
        subtitle={`${events.length} pending event${events.length !== 1 ? "s" : ""}${overdueCount > 0 ? ` · ${overdueCount} overdue` : " · all on track"}`}
        icon={HeartPulse}
        back="/dashboard/cattle"
        badge={overdueCount || undefined}
        badgeVariant="destructive"
      />
      <HealthHubClient
        events={events}
        todayISO={todayISO}
        in7ISO={in7ISO}
        stats={{
          overdue: overdueCount,
          thisWeek: thisWeekCount,
          completedThisMonth: completedThisMonth ?? 0,
        }}
      />
    </>
  );
}

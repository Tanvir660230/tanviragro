import type { Metadata } from "next";
import { Suspense } from "react";
import { Scale } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { EnterpriseGrowthWorkspace } from "@/components/cattle/EnterpriseGrowthWorkspace";
import { buildHerdGrowthAnalytics } from "@/lib/growth/growth-engine";

export const metadata: Metadata = {
  title: "Weight & Growth Intelligence | Tanvir Agro",
  description: "Automated ADG calculation, growth stage taxonomy, anomaly detection, and trajectory forecasting.",
};

export default async function GrowthIntelligencePage() {
  return (
    <div className="space-y-4">
      <Suspense fallback={<GrowthSkeleton />}>
        <GrowthSection />
      </Suspense>
    </div>
  );
}

function GrowthSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-muted animate-pulse" />
        <div className="space-y-1.5">
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-72 bg-muted rounded animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
      <div className="h-96 bg-muted rounded-xl animate-pulse" />
    </div>
  );
}

async function GrowthSection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();

  if (!businessId) {
    return <PageHeader title="Weight & Growth Intelligence" icon={Scale} back="/dashboard/cattle" />;
  }

  // 1. Fetch cattle
  const { data: cattleRows } = await supabase
    .from("cattle")
    .select("id, tag_id, breed, gender, status, initial_weight_kg, purchase_date, pen_id, target_weight_kg")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .order("tag_id", { ascending: true });

  const rawCattle = (cattleRows ?? []) as any[];
  const cattleIds = rawCattle.map((c) => c.id);

  if (cattleIds.length === 0) {
    return (
      <>
        <PageHeader
          title="Weight & Growth Intelligence"
          subtitle="Precision Live Weight, ADG & Performance Analytics"
          icon={Scale}
          back="/dashboard/cattle"
        />
        <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-xl text-center">
          <Scale className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold text-sm">No Cattle Registered</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Add cattle to start tracking weight logs, average daily gain, and growth trajectory goals.
          </p>
        </div>
      </>
    );
  }

  // 2. Fetch weight logs
  const { data: weightRows } = await supabase
    .from("weight_logs")
    .select("id, cattle_id, recorded_at, weight_kg, heart_girth_cm, withers_height_cm, body_length_cm, bcs, weighing_method, notes")
    .is("deleted_at", null)
    .in("cattle_id", cattleIds)
    .order("recorded_at", { ascending: true });

  // 3. Fetch active growth targets
  const { data: targetRows } = await supabase
    .from("growth_targets" as any)
    .select("id, cattle_id, target_weight_kg, target_finish_date, target_adg_kg, status, notes")
    .in("cattle_id", cattleIds)
    .eq("status", "active");

  // 4. Fetch alert acknowledgements
  const { data: alertRows } = await supabase
    .from("growth_alert_acknowledgements" as any)
    .select("cattle_id, alert_type, acknowledged_at")
    .in("cattle_id", cattleIds);

  // 5. Fetch pens for pen name lookup
  const { data: penRows } = await supabase
    .from("pens")
    .select("id, name")
    .eq("business_id", businessId);

  const penMap = new Map((penRows ?? []).map((p) => [p.id, p.name]));

  const animalsInput = rawCattle.map((c) => ({
    id: c.id,
    tag_id: c.tag_id,
    name: null,
    breed: c.breed ?? "Local Cross",
    status: c.status ?? "active",
    initial_weight_kg: c.initial_weight_kg ?? 0,
    current_weight_kg: c.initial_weight_kg ?? 0,
    dob: null,
    purchase_date: c.purchase_date ?? null,
    pen_name: c.pen_id ? penMap.get(c.pen_id) || "Unassigned" : "Unassigned",
  }));

  const analytics = buildHerdGrowthAnalytics(
    animalsInput as any,
    (weightRows ?? []) as any,
    (targetRows ?? []) as any,
    (alertRows ?? []) as any
  );

  return (
    <>
      <PageHeader
        title="Weight & Growth Intelligence"
        subtitle={`${analytics.summary.totalActiveAnimals} Active Animals · Precision ADG, Trajectories & Performance Tiering`}
        icon={Scale}
        back="/dashboard/cattle"
      />
      <EnterpriseGrowthWorkspace data={analytics} />
    </>
  );
}


import type { Metadata } from "next";
import { Suspense } from "react";
import { Moon } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { QurbaniBoardClient } from "@/components/cattle/QurbaniBoardClient";

export const metadata: Metadata = { title: "Qurbani Board" };

// Approximate Eid-ul-Adha dates (Bangladesh moon sighting) — kept in sync with EidCountdownCard
const EID_DATES = [
  new Date("2025-06-06"),
  new Date("2026-05-27"),
  new Date("2027-05-16"),
  new Date("2028-05-05"),
  new Date("2029-04-24"),
  new Date("2030-04-13"),
  new Date("2031-04-03"),
  new Date("2032-03-22"),
];

function getNextEid(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const next = EID_DATES.find((d) => d > now);
  if (next) return next;
  const last = EID_DATES[EID_DATES.length - 1];
  const est = new Date(last);
  est.setDate(est.getDate() + 354);
  return est;
}

function linearADG(
  logs: { weight_kg: number; recorded_at: string }[],
  initialWeight: number,
  purchaseDate: string
): number {
  const base = new Date(purchaseDate + "T00:00:00").getTime();
  const points = [
    { x: 0, y: initialWeight },
    ...logs.map((l) => ({
      x: Math.max(0, Math.floor((new Date(l.recorded_at).getTime() - base) / 86400000)),
      y: l.weight_kg,
    })),
  ];
  if (points.length < 2) return 0;
  const n = points.length;
  const sumX  = points.reduce((s, p) => s + p.x, 0);
  const sumY  = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-9) return 0;
  return Math.min(Math.max((n * sumXY - sumX * sumY) / denom, -5), 5);
}

export type QurbaniCattle = {
  id: string;
  tagId: string;
  breed: string | null;
  gender: string;
  dob: string | null;
  purchaseDate: string;
  currentWt: number;
  projectedWt: number;
  adg: number;
  daysInPen: number;
  isQuarantined: boolean;
  readiness: "ready" | "developing" | "at_risk";
};

export default async function QurbaniBoardPage() {
  return (
    <div className="space-y-4">
      <Suspense fallback={<QurbaniSkeleton />}>
        <QurbaniBoardSection />
      </Suspense>
    </div>
  );
}

function QurbaniSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl animate-shimmer overflow-hidden shrink-0" />
        <div className="space-y-1.5">
          <div className="h-7 w-44 animate-shimmer rounded overflow-hidden" />
          <div className="h-4 w-32 animate-shimmer rounded overflow-hidden" />
        </div>
      </div>
      <div className="h-28 animate-shimmer rounded-xl overflow-hidden" />
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-shimmer rounded-xl overflow-hidden" />
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-shimmer rounded-xl overflow-hidden" />
        ))}
      </div>
    </div>
  );
}

async function QurbaniBoardSection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();

  if (!businessId) {
    return <PageHeader title="Qurbani Board" icon={Moon} back="/dashboard/cattle" />;
  }

  const eidDate = getNextEid();
  const todayBD = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
  const today = new Date(todayBD + "T00:00:00");
  const daysToEid = Math.max(0, Math.ceil((eidDate.getTime() - today.getTime()) / 86400000));
  const eidLabel = eidDate.toLocaleDateString("en-US", {
    timeZone: "Asia/Dhaka",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Fetch all active qurbani-marked cattle
  const { data: rawCattle } = await supabase
    .from("cattle")
    .select("id, tag_id, breed, gender, dob, purchase_date, initial_weight_kg, is_quarantined")
    .eq("business_id", businessId)
    .eq("status", "active")
    .eq("is_qurbani_marked", true)
    .is("deleted_at", null)
    .order("tag_id", { ascending: true });

  const cattleRows = rawCattle ?? [];
  const cattleIds = cattleRows.map((c) => c.id);

  // Fetch weight logs for these cattle
  const { data: rawLogs } = cattleIds.length
    ? await supabase
        .from("weight_logs")
        .select("cattle_id, weight_kg, recorded_at")
        .in("cattle_id", cattleIds)
        .is("deleted_at", null)
        .order("recorded_at", { ascending: true })
    : { data: [] as { cattle_id: string; weight_kg: number; recorded_at: string }[] };

  // Group logs by cattle
  const logsByCattle: Record<string, { weight_kg: number; recorded_at: string }[]> = {};
  for (const l of rawLogs ?? []) {
    if (!logsByCattle[l.cattle_id]) logsByCattle[l.cattle_id] = [];
    logsByCattle[l.cattle_id].push(l);
  }

  const cattle: QurbaniCattle[] = cattleRows.map((c) => {
    const logs = logsByCattle[c.id] ?? [];
    const currentWt = logs.at(-1)?.weight_kg ?? (c.initial_weight_kg ?? 0);
    const adg = linearADG(logs, c.initial_weight_kg ?? 0, c.purchase_date ?? "");
    const projectedWt = Math.min(650, Math.max(0, currentWt + adg * daysToEid));
    const daysInPen = Math.max(
      0,
      Math.floor((today.getTime() - new Date((c.purchase_date ?? "") + "T00:00:00").getTime()) / 86400000)
    );
    const totalDays = daysInPen + daysToEid;

    const readiness: QurbaniCattle["readiness"] =
      projectedWt >= 250 && totalDays >= 90 ? "ready"
      : projectedWt < 180 ? "at_risk"
      : "developing";

    return {
      id: c.id,
      tagId: c.tag_id,
      breed: c.breed,
      gender: c.gender,
      dob: c.dob,
      purchaseDate: c.purchase_date ?? "",
      currentWt,
      projectedWt,
      adg,
      daysInPen,
      isQuarantined: c.is_quarantined ?? false,
      readiness,
    };
  });

  const readyCount     = cattle.filter((c) => c.readiness === "ready").length;
  const developingCount = cattle.filter((c) => c.readiness === "developing").length;
  const atRiskCount    = cattle.filter((c) => c.readiness === "at_risk").length;

  return (
    <>
      <PageHeader
        title="Qurbani Board"
        subtitle={`${cattle.length} marked · Eid in ${daysToEid} days`}
        icon={Moon}
        back="/dashboard/cattle"
        badge={cattle.length || undefined}
        badgeVariant={atRiskCount > 0 ? "warning" : "default"}
      />
      <QurbaniBoardClient
        cattle={cattle}
        eidLabel={eidLabel}
        daysToEid={daysToEid}
        stats={{ total: cattle.length, ready: readyCount, developing: developingCount, atRisk: atRiskCount }}
      />
    </>
  );
}

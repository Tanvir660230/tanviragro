import type { Metadata } from "next";
import { Suspense } from "react";
import { Moon } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { QurbaniBoardClient } from "@/components/cattle/QurbaniBoardClient";
import { getL, getLocale } from "@/i18n/server-text";
import { todayDhaka } from "@/lib/dates";
import { fmtDay } from "@/lib/format";
import { nextEidDate } from "@/lib/home/eid";
import { loadHomeInputs } from "@/lib/home/home-data";
import { buildHomeModel } from "@/lib/home/home-model";

export const metadata: Metadata = { title: "কোরবানি" };

// Approximate Eid-ul-Adha dates (Bangladesh moon sighting) — kept in sync with EidCountdownCard
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
  const L = await getL();
  const lang = await getLocale();
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();

  if (!businessId) {
    return <PageHeader title={L("কোরবানি", "Qurbani")} icon={Moon} back="/dashboard/cattle" />;
  }

  // THE Eid date (lib/home/eid.ts) and THE weights and measured growth (the home model) — the
  // homepage's Eid projection and this board used to each have their own
  const todayBD = todayDhaka();
  const eidISO = nextEidDate(todayBD);
  const daysToEid = Math.max(0, Math.round((Date.parse(`${eidISO}T00:00:00Z`) - Date.parse(`${todayBD}T00:00:00Z`)) / 86400000));
  const eidLabel = fmtDay(eidISO, lang);

  const [{ data: rawCattle }, inputs] = await Promise.all([
    supabase.from("cattle")
      .select("id, tag_id, breed, gender, dob, purchase_date, is_quarantined")
      .eq("business_id", businessId).eq("status", "active").eq("is_qurbani_marked", true).is("deleted_at", null)
      .order("tag_id", { ascending: true }),
    loadHomeInputs(supabase, businessId, todayBD, { money: false }),
  ]);
  const homeBy = new Map(buildHomeModel(inputs.input).cattle.map((c) => [c.id, c]));

  const cattle: QurbaniCattle[] = (rawCattle ?? []).map((c) => {
    const h = homeBy.get(c.id);
    const currentWt = h?.weightKg ?? 0;
    const adg = h?.adgKg ?? 0;                       // measured growth only; none measured → no growth assumed
    const projectedWt = Math.min(650, Math.max(0, currentWt + adg * daysToEid));
    const daysInPen = h?.daysOnFarm ?? 0;
    const totalDays = daysInPen + daysToEid;
    const readiness: QurbaniCattle["readiness"] =
      projectedWt >= 250 && totalDays >= 90 ? "ready"
      : projectedWt < 180 ? "at_risk"
      : "developing";
    return {
      id: c.id, tagId: c.tag_id, breed: c.breed, gender: c.gender, dob: c.dob, purchaseDate: c.purchase_date ?? "",
      currentWt, projectedWt, adg, daysInPen, isQuarantined: c.is_quarantined ?? false, readiness,
    };
  });

  const readyCount     = cattle.filter((c) => c.readiness === "ready").length;
  const developingCount = cattle.filter((c) => c.readiness === "developing").length;
  const atRiskCount    = cattle.filter((c) => c.readiness === "at_risk").length;

  return (
    <>
      <PageHeader
        title={L("কোরবানি", "Qurbani")}
        subtitle={L(`${cattle.length}টি বাছাই · ঈদের ${daysToEid} দিন বাকি`, `${cattle.length} marked · Eid in ${daysToEid} days`)}
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

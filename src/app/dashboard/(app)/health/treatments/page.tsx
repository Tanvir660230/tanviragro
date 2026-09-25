import type { Metadata } from "next";
import { Suspense } from "react";
import { Activity, Pill } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { selectAll } from "@/lib/supabase/select-all";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import Link from "next/link";
import { getL } from "@/i18n/server-text";
import { startOfMonth, todayDhaka } from "@/lib/dates";

export const metadata: Metadata = { title: "চিকিৎসা" };

export default function TreatmentsPage() {
  return (
    <div className="space-y-5">
      <Suspense fallback={<div className="h-96 animate-shimmer rounded-2xl" />}>
        <TreatmentsSection />
      </Suspense>
    </div>
  );
}

type Row = { id: string; cattle_id: string; diagnosis: string | null; dose_administered: number | null; dose_unit: string | null; vet_fee: number | null; additional_medical_cost: number | null; treated_at: string };

async function TreatmentsSection() {
  const L = await getL();
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) return <EmptyState icon={Pill} title={L("খামার পাওয়া যায়নি", "No business found")} />;

  // every treatment of this farm's animals (totals used to stop at the last 100 rows)
  const { data: herd } = await supabase.from("cattle").select("id, tag_id").eq("business_id", businessId);
  const tagOf: Record<string, string> = Object.fromEntries((herd ?? []).map((c) => [c.id, c.tag_id]));
  const ids = Object.keys(tagOf);
  const list: Row[] = ids.length
    ? await selectAll<Row>(() =>
        supabase.from("cattle_treatments")
          .select("id, cattle_id, diagnosis, dose_administered, dose_unit, vet_fee, additional_medical_cost, treated_at")
          .in("cattle_id", ids).order("treated_at", { ascending: false }).order("id"))
    : [];

  const monthStart = startOfMonth(todayDhaka());
  const monthCount = list.filter((t) => t.treated_at >= monthStart).length;
  const cost = (t: Row) => (Number(t.vet_fee) || 0) + (Number(t.additional_medical_cost) || 0);
  const totalCost = list.reduce((s, t) => s + cost(t), 0);

  return (
    <>
      <PageHeader title={L("চিকিৎসা", "Treatments")} subtitle={L("রোগ, ওষুধ ও ডাক্তারের খরচের তালিকা — নতুন চিকিৎসা গরুর পাতা থেকে লিখুন", "Diagnoses, medicine and vet costs — record new ones from the animal's page")} icon={Pill} />
      <div className="grid grid-cols-3 gap-3">
        <StatCard label={L("মোট চিকিৎসা", "All treatments")} value={list.length} icon={Pill} accentColor="blue" subtext={L("শুরু থেকে", "since the start")} />
        <StatCard label={L("এই মাসে", "This month")} value={monthCount} icon={Activity} accentColor="violet" subtext={L("চিকিৎসা", "treatments")} />
        <StatCard label={L("মোট খরচ", "Total cost")} value={`৳${totalCost.toLocaleString("en-IN")}`} icon={Activity} accentColor="amber" subtext={L("ডাক্তার ফি + ওষুধ", "vet fee + medicine")} />
      </div>
      <SectionCard title={L(`চিকিৎসার তালিকা (${list.length})`, `Treatment log (${list.length})`)} icon={Pill} iconVariant="blue">
        {list.length === 0 ? (
          <EmptyState icon={Pill} title={L("কোনো চিকিৎসা নেই", "No treatments recorded")} description={L("গরুর পাতা থেকে চিকিৎসা লিখুন।", "Treatments are recorded on the animal's page.")} compact />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left">
                  <th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">{L("গরু", "Animal")}</th>
                  <th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">{L("রোগ", "Diagnosis")}</th>
                  <th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">{L("ডোজ", "Dose")}</th>
                  <th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">{L("তারিখ", "Date")}</th>
                  <th className="py-2 text-right text-xs font-semibold text-muted-foreground">{L("খরচ", "Cost")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {list.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2 pr-3 font-mono text-xs">
                      <Link href={`/dashboard/cattle/${t.cattle_id}`} className="text-primary hover:underline">{tagOf[t.cattle_id] ?? t.cattle_id.slice(0, 6)}</Link>
                    </td>
                    <td className="py-2 pr-3 max-w-[180px] truncate">{t.diagnosis ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{t.dose_administered ? `${t.dose_administered} ${t.dose_unit ?? ""}` : "—"}</td>
                    <td className="py-2 pr-3 text-xs font-mono text-muted-foreground">{t.treated_at}</td>
                    <td className="py-2 text-right font-mono text-xs">{cost(t) > 0 ? `৳${cost(t).toLocaleString("en-IN")}` : "—"}</td>
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

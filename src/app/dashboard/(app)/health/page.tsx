import type { Metadata } from "next";
import { Suspense } from "react";
import { HeartPulse, Activity, ShieldAlert, Syringe, ClipboardList, AlertTriangle, CheckCircle } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState } from "@/components/shared/EmptyState";
import Link from "next/link";
import { todayDhaka, addDays, startOfMonth } from "@/lib/dates";

export const metadata: Metadata = {
  title: "স্বাস্থ্য",
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
      <div className="h-72 animate-shimmer rounded-2xl" />
    </div>
  );
}

async function HealthDashboardSection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) {
    return <EmptyState icon={HeartPulse} title="খামার পাওয়া যায়নি" />;
  }

  // farm calendar (Dhaka), not the server's UTC date
  const todayISO = todayDhaka();
  const in7ISO = addDays(todayISO, 7);
  const firstOfMonth = startOfMonth(todayISO);

  const [
    { count: totalActive },
    { count: quarantined },
    { data: rawEvents },
    { count: completedThisMonth },
    { data: recentTreatments },
  ] = await Promise.all([
    supabase.from("cattle").select("*", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "active").is("deleted_at", null),
    supabase.from("cattle").select("*", { count: "exact", head: true }).eq("business_id", businessId).eq("is_quarantined", true).is("deleted_at", null),
    supabase.from("health_events").select("id, cattle_id, title, event_type, scheduled_at").eq("business_id", businessId).is("completed_at", null).is("deleted_at", null).order("scheduled_at", { ascending: true }).limit(1000),
    supabase.from("health_events").select("*", { count: "exact", head: true }).eq("business_id", businessId).gte("completed_at", firstOfMonth).is("deleted_at", null),
    supabase.from("cattle_treatments").select("id, cattle_id, diagnosis, treated_at, vet_fee").order("treated_at", { ascending: false }).limit(5),
  ]);

  const pending = rawEvents ?? [];
  const overdueCount = pending.filter((e) => e.scheduled_at < todayISO).length;
  const thisWeekCount = pending.filter((e) => e.scheduled_at >= todayISO && e.scheduled_at <= in7ISO).length;

  const TYPE_LABEL: Record<string, string> = {
    vaccine: "টিকা", checkup: "চেকআপ", deworming: "কৃমিনাশক", treatment: "চিকিৎসা", other: "অন্যান্য",
  };
  const TASKS = "/dashboard/health/vaccinations";

  return (
    <>
      <PageHeader
        title="স্বাস্থ্য"
        subtitle={`${totalActive ?? 0}টি সক্রিয় গরু · ${overdueCount > 0 ? `${overdueCount}টি কাজ বাকি পড়ে আছে` : "সব কাজ সময়মতো"}`}
        icon={HeartPulse}
        badge={overdueCount || undefined}
        badgeVariant="destructive"
        actions={
          <Link href={TASKS} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors">
            <Syringe className="h-3.5 w-3.5" />
            টিকা ও কাজ
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="সক্রিয় গরু" value={totalActive ?? 0} icon={Activity} accentColor="emerald" href="/dashboard/cattle" subtext="খামারে আছে" />
        <StatCard label="বাকি কাজ" value={pending.length} icon={ClipboardList} accentColor={overdueCount > 0 ? "rose" : "blue"} href={TASKS} subtext={overdueCount > 0 ? `${overdueCount}টি সময় পেরিয়েছে` : `এই সপ্তাহে ${thisWeekCount}টি`} />
        <StatCard label="আলাদা রাখা" value={quarantined ?? 0} icon={ShieldAlert} accentColor={quarantined ? "amber" : "slate"} subtext="কোয়ারেন্টাইনে" />
        <StatCard label="এই মাসে শেষ" value={completedThisMonth ?? 0} icon={CheckCircle} accentColor="violet" subtext="সম্পন্ন কাজ" />
      </div>

      <SectionCard title="বাকি স্বাস্থ্য কাজ" icon={AlertTriangle} iconVariant={overdueCount > 0 ? "red" : "amber"} action={<Link href={TASKS} className="text-xs text-primary hover:underline font-medium">সব দেখুন</Link>}>
        {pending.length === 0 ? (
          <EmptyState icon={CheckCircle} title="সব ঠিক আছে" description="কোনো বাকি কাজ নেই।" compact />
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
                      {isOverdue && <span className="ml-1 text-red-500 font-semibold"> সময় পেরিয়েছে</span>}
                    </p>
                  </div>
                </div>
              );
            })}
            {pending.length > 8 && (
              <Link href={TASKS} className="block py-2.5 text-center text-xs font-medium text-primary hover:underline">
                আরও {pending.length - 8}টি কাজ দেখুন
              </Link>
            )}
          </div>
        )}
      </SectionCard>
      {recentTreatments && recentTreatments.length > 0 && (
        <SectionCard title="সাম্প্রতিক চিকিৎসা" icon={Activity} iconVariant="blue" action={<Link href="/dashboard/health/treatments" className="text-xs text-primary hover:underline font-medium">সব দেখুন</Link>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border/60"><th className="py-2 text-left text-xs font-semibold text-muted-foreground">রোগ</th><th className="py-2 text-left text-xs font-semibold text-muted-foreground">তারিখ</th><th className="py-2 text-right text-xs font-semibold text-muted-foreground">ডাক্তারের ফি</th></tr></thead>
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

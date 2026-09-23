import type { Metadata } from "next";
import { Suspense } from "react";
import { ShieldAlert, CheckCircle } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import Link from "next/link";

export const metadata: Metadata = { title: "Quarantine | Health EHR" };

export default function QuarantinePage() {
  return (
    <div className="space-y-5">
      <Suspense fallback={<div className="h-80 animate-shimmer rounded-2xl" />}>
        <QuarantineSection />
      </Suspense>
    </div>
  );
}

async function QuarantineSection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) return <EmptyState icon={ShieldAlert} title="No business found" />;

  const [{ data: quarantined }, { count: totalActive }, { count: totalCattle }] = await Promise.all([
    supabase.from("cattle").select("id, tag_id, breed, gender, status, pen_id, notes, updated_at").eq("business_id", businessId).eq("is_quarantined", true).is("deleted_at", null).order("updated_at", { ascending: false }),
    supabase.from("cattle").select("*", { count: "exact", head: true }).eq("business_id", businessId).eq("is_quarantined", true).is("deleted_at", null),
    supabase.from("cattle").select("*", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "active").is("deleted_at", null),
  ]);

  const list = quarantined ?? [];

  return (
    <>
      <PageHeader
        title="Quarantine Management"
        subtitle="Animals under isolation — biosecurity management"
        icon={ShieldAlert}
        back="/dashboard/health"
        badge={totalActive ?? undefined}
        badgeVariant={totalActive ? "destructive" : "secondary"}
        actions={
          <Link href="/dashboard/cattle" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
            Manage in Cattle →
          </Link>
        }
      />
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="In Quarantine" value={totalActive ?? 0} icon={ShieldAlert} accentColor={totalActive ? "rose" : "slate"} subtext="currently isolated" />
        <StatCard label="Active Herd" value={totalCattle ?? 0} icon={CheckCircle} accentColor="emerald" subtext="active animals" />
        <StatCard label="Quarantine Rate" value={`${totalCattle ? (((totalActive ?? 0) / totalCattle) * 100).toFixed(1) : "0"}%`} icon={ShieldAlert} accentColor="amber" subtext="of herd" />
      </div>
      <SectionCard title={`Animals in Quarantine (${list.length})`} icon={ShieldAlert} iconVariant={list.length > 0 ? "red" : "emerald"}>
        {list.length === 0 ? (
          <EmptyState icon={CheckCircle} title="No animals in quarantine" description="All animals are cleared from isolation." compact />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left">
                  <th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Tag ID</th>
                  <th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Breed</th>
                  <th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Gender</th>
                  <th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="py-2 text-xs font-semibold text-muted-foreground">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {list.map((c) => (
                  <tr key={c.id} className="bg-red-50/30 dark:bg-red-950/10">
                    <td className="py-2 pr-3 font-mono text-xs font-bold">{c.tag_id}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{c.breed ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs">{c.gender}</td>
                    <td className="py-2 pr-3"><span className="rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 text-[11px] font-semibold">{c.status}</span></td>
                    <td className="py-2 text-xs font-mono text-muted-foreground">{c.updated_at?.slice(0, 10) ?? "—"}</td>
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

import type { Metadata } from "next";
import { Suspense } from "react";
import { ScrollText, Activity } from "lucide-react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";

export const metadata: Metadata = { title: "Health Audit Log | EHR" };

export default function AuditPage() {
  return (
    <div className="space-y-5">
      <Suspense fallback={<div className="h-96 animate-shimmer rounded-2xl" />}>
        <AuditSection />
      </Suspense>
    </div>
  );
}

const ACTION_COLOR: Record<string, string> = {
  CREATE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  UPDATE: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  STATUS_CHANGE: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  HEALTH_ADMINISTERED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  BREEDING_EVENT: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  SALE: "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-400",
  DEATH: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400",
};

async function AuditSection() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) return <EmptyState icon={ScrollText} title="No business found" />;

  const { data: rawLogs } = await (supabase as any)
    .from("livestock_audit_logs")
    .select("id, entity_type, entity_id, action, actor_id, actor_role, timestamp")
    .eq("business_id", businessId)
    .order("timestamp", { ascending: false })
    .limit(100);

  const logs: any[] = rawLogs ?? [];

  const actionCounts: Record<string, number> = {};
  for (const l of logs) actionCounts[l.action] = (actionCounts[l.action] ?? 0) + 1;

  const uniqueActors = new Set(logs.map((l) => l.actor_id)).size;
  // eslint-disable-next-line react-hooks/purity
  const last24h = logs.filter((l) => new Date(l.timestamp) > new Date(Date.now() - 86400000)).length;

  return (
    <>
      <PageHeader title="Health Audit Log" subtitle="Immutable audit trail for all health-related actions" icon={ScrollText} back="/dashboard/health" />
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Entries" value={logs.length} icon={ScrollText} accentColor="blue" subtext="last 100 records" />
        <StatCard label="Last 24h" value={last24h} icon={Activity} accentColor="emerald" subtext="recent actions" />
        <StatCard label="Unique Users" value={uniqueActors} icon={Activity} accentColor="violet" subtext="actors" />
      </div>
      <SectionCard title={`Audit Trail (${logs.length})`} icon={ScrollText} iconVariant="primary">
        {logs.length === 0 ? (
          <EmptyState icon={ScrollText} title="No audit entries found" description="Actions will appear here as they occur." compact />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left">
                  <th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Action</th>
                  <th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Entity</th>
                  <th className="py-2 pr-3 text-xs font-semibold text-muted-foreground">Actor Role</th>
                  <th className="py-2 text-xs font-semibold text-muted-foreground">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ACTION_COLOR[log.action] ?? "bg-muted text-muted-foreground"}`}>
                        {log.action?.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground capitalize">{log.entity_type?.replace("_", " ")}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground capitalize">{log.actor_role}</td>
                    <td className="py-2 text-xs font-mono text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</td>
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

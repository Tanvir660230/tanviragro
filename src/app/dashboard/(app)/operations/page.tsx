import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/PageHeader";
import { runSystemHealthProbes } from "@/lib/monitoring/health";
import { telemetryService } from "@/lib/monitoring/telemetry";
import { OperationsDashboardClient } from "./OperationsDashboardClient";
import { Activity, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Operations & Monitoring | Tanvir Agro ERP",
  description: "Enterprise Observability, Real-time Probes, Stack Traces, and Operational Runbooks",
};

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check admin/owner authorization
  const [{ data: bizData }, { data: bizUserData }] = await Promise.all([
    supabase.from("businesses").select("id, name").eq("owner_id", user.id).maybeSingle(),
    supabase.from("business_users").select("role").eq("user_id", user.id).maybeSingle(),
  ]);

  const isAdmin = Boolean(bizData?.id) || bizUserData?.role === "owner" || bizUserData?.role === "manager";
  if (!isAdmin) {
    redirect("/dashboard");
  }

  // Gather system health & telemetry
  const [healthSummary, errors, metrics, logs] = await Promise.all([
    runSystemHealthProbes(),
    Promise.resolve(telemetryService.getErrors()),
    Promise.resolve(telemetryService.getPerformanceMetrics()),
    Promise.resolve(telemetryService.getOperationalLogs()),
  ]);

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      <PageHeader
        title="Operations & Observability"
        subtitle="Real-time telemetry, diagnostic probes, sanitized exception tracking, and infrastructure runbooks."
        icon={Activity}
        badge={healthSummary.overallStatus === "OPERATIONAL" ? "Operational" : "Degraded"}
        badgeVariant={healthSummary.overallStatus === "OPERATIONAL" ? "default" : "warning"}
      />

      <OperationsDashboardClient
        initialHealth={healthSummary}
        initialErrors={errors}
        initialMetrics={metrics}
        initialJobs={healthSummary.jobs}
        initialLogs={logs}
      />
    </div>
  );
}

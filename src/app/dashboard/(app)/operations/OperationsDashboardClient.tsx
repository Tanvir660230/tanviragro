"use client";

import { useState } from "react";
import { 
  Activity, 
  AlertOctagon, 
  Gauge, 
  Workflow, 
  Terminal, 
  ShieldCheck, 
  RotateCw, 
  Clock,
  Sparkles,
  ExternalLink
} from "lucide-react";
import { SystemHealthMatrix } from "@/components/operations/SystemHealthMatrix";
import { ErrorMonitoringPanel } from "@/components/operations/ErrorMonitoringPanel";
import { PerformanceMonitorPanel } from "@/components/operations/PerformanceMonitorPanel";
import { BackgroundJobsPanel } from "@/components/operations/BackgroundJobsPanel";
import { IncidentPanel } from "@/components/operations/IncidentPanel";
import { LogExplorerPanel } from "@/components/operations/LogExplorerPanel";
import { 
  SystemHealthSummary, 
  ErrorLogEntry, 
  PerformanceMetric, 
  BackgroundJobStatus, 
  TelemetryLogEntry 
} from "@/lib/monitoring/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OperationsDashboardProps {
  initialHealth: SystemHealthSummary;
  initialErrors: ErrorLogEntry[];
  initialMetrics: PerformanceMetric[];
  initialJobs: BackgroundJobStatus[];
  initialLogs: TelemetryLogEntry[];
}

const TABS = [
  { id: "health", label: "Health & Probes", icon: Activity },
  { id: "errors", label: "Exceptions & Sentry", icon: AlertOctagon },
  { id: "performance", label: "Performance & Vitals", icon: Gauge },
  { id: "jobs", label: "Background Workflows", icon: Workflow },
  { id: "logs", label: "Live Telemetry Logs", icon: Terminal },
  { id: "incidents", label: "Disaster Recovery & SOPs", icon: ShieldCheck },
] as const;

type ActiveTab = typeof TABS[number]["id"];

export function OperationsDashboardClient({
  initialHealth,
  initialErrors,
  initialMetrics,
  initialJobs,
  initialLogs,
}: OperationsDashboardProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("health");
  const [healthData, setHealthData] = useState<SystemHealthSummary>(initialHealth);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshHealth = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch("/api/operations/health", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setHealthData(json);
      }
    } catch (err) {
      console.error("Health refresh failed:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Actions & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none py-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshHealth}
            disabled={isRefreshing}
            className="h-8 text-xs gap-1.5"
          >
            <RotateCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            {isRefreshing ? "Probing..." : "Run Health Probes"}
          </Button>
        </div>
      </div>

      {/* Active Tab View */}
      <div className="transition-all duration-200">
        {activeTab === "health" && (
          <SystemHealthMatrix
            health={healthData}
            onRefresh={handleRefreshHealth}
            isRefreshing={isRefreshing}
          />
        )}

        {activeTab === "errors" && (
          <ErrorMonitoringPanel errors={initialErrors} />
        )}

        {activeTab === "performance" && (
          <PerformanceMonitorPanel initialMetrics={initialMetrics} />
        )}

        {activeTab === "jobs" && (
          <BackgroundJobsPanel jobs={initialJobs} />
        )}

        {activeTab === "logs" && (
          <LogExplorerPanel logs={initialLogs} />
        )}

        {activeTab === "incidents" && (
          <IncidentPanel />
        )}
      </div>
    </div>
  );
}

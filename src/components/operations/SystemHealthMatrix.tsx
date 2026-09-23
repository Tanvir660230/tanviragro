"use client";

import { ServiceHealthResult, SystemHealthSummary } from "@/lib/monitoring/types";
import { ServiceStatusBadge } from "./StatusPulse";
import { 
  Database, 
  HardDrive, 
  KeyRound, 
  Bell, 
  Mail, 
  MessageSquare, 
  Cpu, 
  Globe, 
  Layers
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_BY_KEY: Record<string, React.ElementType> = {
  db_postgres: Database,
  storage_supabase: HardDrive,
  auth_supabase: KeyRound,
  notify_push: Bell,
  notify_email: Mail,
  notify_whatsapp: MessageSquare,
  engine_workflows: Cpu,
};

interface SystemHealthMatrixProps {
  health?: SystemHealthSummary;
  services?: ServiceHealthResult[];
  onRefresh?: () => Promise<void> | void;
  isRefreshing?: boolean;
}

export function SystemHealthMatrix({
  health,
  services: explicitServices,
}: SystemHealthMatrixProps) {
  const services = explicitServices || health?.services || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((srv) => {
          const Icon = ICON_BY_KEY[srv.serviceKey] || Layers;
          const isHealthy = srv.status === "healthy";
          const isDegraded = srv.status === "degraded";
          const isDown = srv.status === "down";

          return (
            <div
              key={srv.serviceKey}
              className={cn(
                "relative rounded-2xl border p-5 transition-all shadow-sm bg-card hover:shadow-md",
                isHealthy && "border-border/70 hover:border-emerald-500/40",
                isDegraded && "border-amber-400/60 bg-amber-500/[0.02]",
                isDown && "border-rose-400/70 bg-rose-500/[0.03]"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-xs",
                      isHealthy && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
                      isDegraded && "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
                      isDown && "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
                      srv.status === "unconfigured" && "bg-muted text-muted-foreground border-border/70"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground tracking-tight">
                      {srv.serviceName}
                    </h4>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      {srv.category}
                    </span>
                  </div>
                </div>

                <ServiceStatusBadge status={srv.status} />
              </div>

              <p className="mt-3.5 text-xs text-muted-foreground leading-relaxed">
                {srv.message}
              </p>

              <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Globe className="h-3 w-3 text-muted-foreground/60" />
                  {srv.latencyMs > 0 ? `${srv.latencyMs} ms latency` : "In-process / Fast"}
                </span>
                <span>
                  {new Date(srv.lastChecked).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

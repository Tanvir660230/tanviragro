"use client";

import { useState } from "react";
import { 
  ShieldAlert, 
  LifeBuoy, 
  BookOpen, 
  Database, 
  DownloadCloud, 
  Lock, 
  ExternalLink,
  CheckCircle2,
  Terminal,
  RefreshCcw,
  Copy,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";

const RUNBOOKS = [
  {
    id: "rb-supabase-outage",
    title: "Supabase Connection Pool Saturation / Outage",
    severity: "Critical",
    trigger: "PostgreSQL probe latency > 2000ms or 503 Supabase API Gateway errors",
    steps: [
      "Navigate to Supabase Dashboard -> Database -> Connection Pooling (PgBouncer/Supavisor).",
      "Check active connections count against maximum client limit (default pooler: port 6543).",
      "If pool exhausted: restart database connection pooler in Supabase dashboard settings.",
      "Verify connection recovery via Operations > Live Health Probes.",
    ],
  },
  {
    id: "rb-backup-restore",
    title: "Database Backup Verification & Snapshot Restore",
    severity: "High",
    trigger: "Scheduled disaster recovery drill or accidental corruption",
    steps: [
      "Access Supabase Dashboard > Database > Backups (Daily Automated Backups are retained for 7-30 days).",
      "Click 'Restore Backup' to the target point-in-time snapshot or trigger on-demand snapshot via /api/backup.",
      "Verify foreign key integrity by querying business_profiles, cattle, feed_logs, and journal_entries.",
      "Re-run ERP integrity audit from Operations dashboard.",
    ],
  },
  {
    id: "rb-whatsapp-vapid",
    title: "WhatsApp API / WebPush VAPID Delivery Degradation",
    severity: "Medium",
    trigger: "Notification queue errors or stale delivery logs in EventBus",
    steps: [
      "Verify WHATSAPP_API_KEY and WHATSAPP_PHONE_NUMBER_ID in environment variables.",
      "Verify NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY validity.",
      "Check Meta WhatsApp Business Cloud API quotas & rate limits.",
      "Re-queue failed notifications via EventBus telemetry.",
    ],
  },
];

export function IncidentPanel() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* DR Status Summary */}
      <div className="rounded-2xl border border-emerald-400/50 bg-emerald-500/[0.04] p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-base font-bold text-foreground">Disaster Recovery & Redundancy Ready</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Supabase automated backups, immutable audit logs, and point-in-time recovery (PITR) configured.
            </p>
          </div>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-xs"
          >
            Supabase Console
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Standard Operating Procedures (SOPs) & Runbooks */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4.5 w-4.5 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Operational Runbooks & Triage Procedures</h3>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {RUNBOOKS.map((rb) => (
            <div
              key={rb.id}
              className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                    {rb.severity} Incident Protocol
                  </span>
                  <h4 className="text-sm font-bold text-foreground">{rb.title}</h4>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(rb.id, rb.steps.join("\n"))}
                  className="h-8 text-xs gap-1.5"
                >
                  {copiedId === rb.id ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy SOP
                    </>
                  )}
                </Button>
              </div>

              <div className="p-3 rounded-xl bg-muted/30 border border-border/50 text-xs">
                <span className="font-semibold text-foreground">Trigger condition: </span>
                <span className="text-muted-foreground font-mono">{rb.trigger}</span>
              </div>

              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-bold text-foreground">Remediation Steps:</span>
                <ol className="space-y-1.5 text-xs text-muted-foreground list-decimal list-inside">
                  {rb.steps.map((step, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

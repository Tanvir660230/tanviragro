"use client";

import { useState, useMemo } from "react";
import { ErrorLogEntry } from "@/lib/monitoring/types";
import { 
  AlertCircle, 
  Search, 
  Code, 
  CheckCircle2, 
  EyeOff, 
  Clock 
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SEVERITY_STYLES = {
  critical: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400 border-rose-300 dark:border-rose-800",
  high: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border-amber-300 dark:border-amber-800",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-400 border-yellow-300 dark:border-yellow-800",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400 border-blue-300 dark:border-blue-800",
};

export function ErrorMonitoringPanel({
  errors: initialErrors,
}: {
  errors: ErrorLogEntry[];
}) {
  const [errors, setErrors] = useState<ErrorLogEntry[]>(initialErrors);
  const [search, setSearch] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [selectedModule, setSelectedModule] = useState<string>("all");
  const [inspectingError, setInspectingError] = useState<ErrorLogEntry | null>(null);

  const filteredErrors = useMemo(() => {
    return errors.filter((err) => {
      if (selectedSeverity !== "all" && err.severity !== selectedSeverity) return false;
      if (selectedModule !== "all" && err.module !== selectedModule) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesMsg = err.message.toLowerCase().includes(q);
        const matchesSig = err.signature.toLowerCase().includes(q);
        const matchesMod = err.module.toLowerCase().includes(q);
        if (!matchesMsg && !matchesSig && !matchesMod) return false;
      }
      return true;
    });
  }, [errors, search, selectedSeverity, selectedModule]);

  const handleUpdateStatus = (id: string, newStatus: ErrorLogEntry["status"]) => {
    setErrors((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: newStatus } : e))
    );
    if (inspectingError?.id === id) {
      setInspectingError((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
  };

  const modules = Array.from(new Set(errors.map((e) => e.module)));

  return (
    <div className="space-y-5">
      {/* Search & Filter Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border/70 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input
            placeholder="Search errors by message, module, or signature..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-muted/30"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="h-9 rounded-xl border border-border/70 bg-background px-3 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="h-9 rounded-xl border border-border/70 bg-background px-3 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All Modules</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Tracked</span>
          <p className="text-xl font-bold font-mono mt-1 text-foreground">{errors.length}</p>
        </div>
        <div className="rounded-xl border border-rose-300/50 bg-rose-500/[0.04] p-4">
          <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Critical / High</span>
          <p className="text-xl font-bold font-mono mt-1 text-rose-700 dark:text-rose-400">
            {errors.filter((e) => e.severity === "critical" || e.severity === "high").length}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-300/50 bg-emerald-500/[0.04] p-4">
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Resolved</span>
          <p className="text-xl font-bold font-mono mt-1 text-emerald-700 dark:text-emerald-400">
            {errors.filter((e) => e.status === "resolved").length}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Active</span>
          <p className="text-xl font-bold font-mono mt-1 text-foreground">
            {errors.filter((e) => e.status === "active").length}
          </p>
        </div>
      </div>

      {/* Error List */}
      {filteredErrors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 p-12 text-center bg-card">
          <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 mb-3" />
          <h4 className="text-sm font-bold text-foreground">No matching exceptions found</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Zero active unhandled crashes logged for the current filter criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredErrors.map((err) => {
            const isResolved = err.status === "resolved";

            return (
              <div
                key={err.id}
                className={cn(
                  "rounded-2xl border p-4 sm:p-5 bg-card transition-all shadow-xs hover:border-primary/40",
                  isResolved && "opacity-60 border-border/50",
                  !isResolved && err.severity === "critical" && "border-rose-400/60 bg-rose-500/[0.01]"
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                          SEVERITY_STYLES[err.severity]
                        )}
                      >
                        {err.severity}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-muted text-muted-foreground border border-border/60">
                        {err.module}
                      </span>
                      <span className="text-xs font-mono font-semibold text-muted-foreground/80">
                        ×{err.count} occurrences
                      </span>
                      {err.sanitized && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <EyeOff className="h-3 w-3" /> Scrubbed
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-foreground break-words font-mono">
                      {err.message}
                    </h4>

                    <div className="flex items-center gap-4 text-[11px] font-mono text-muted-foreground pt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        First: {new Date(err.firstSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span>
                        Last: {new Date(err.lastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setInspectingError(err)}
                      className="h-8 text-xs gap-1.5"
                    >
                      <Code className="h-3.5 w-3.5" />
                      Inspect
                    </Button>

                    {err.status !== "resolved" ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleUpdateStatus(err.id, "resolved")}
                        className="h-8 text-xs text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                      >
                        Resolve
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUpdateStatus(err.id, "active")}
                        className="h-8 text-xs text-muted-foreground"
                      >
                        Reopen
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Developer Stack Trace Inspection Modal */}
      {inspectingError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Diagnostic Trace Inspector</h3>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">Signature: {inspectingError.signature}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInspectingError(null)}
                className="h-8 w-8 p-0 rounded-lg"
              >
                ✕
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Error Message</label>
                <div className="mt-1 p-3 rounded-xl bg-muted/40 font-mono text-xs text-foreground break-all border border-border/60">
                  {inspectingError.message}
                </div>
              </div>

              {inspectingError.stackTrace ? (
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sanitized Stack Trace</label>
                  <pre className="mt-1 p-3 rounded-xl bg-zinc-950 text-emerald-400 font-mono text-[11px] overflow-x-auto leading-relaxed border border-zinc-800">
                    {inspectingError.stackTrace}
                  </pre>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-muted/20 text-center text-xs text-muted-foreground">
                  No execution stack trace attached to this client-reported exception.
                </div>
              )}

              <div className="p-3 rounded-xl border border-border/60 bg-muted/10 text-xs text-muted-foreground flex items-center gap-2">
                <EyeOff className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>All authentication headers, passwords, cookies, and tokens are scrubbed automatically before persistence.</span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border/60">
              <Button onClick={() => setInspectingError(null)} size="sm">
                Close Inspector
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

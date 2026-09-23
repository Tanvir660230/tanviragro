"use client";

import { useState, useMemo } from "react";
import { TelemetryLogEntry } from "@/lib/monitoring/types";
import { 
  Search, 
  Download, 
  EyeOff, 
  Terminal 
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LEVEL_COLORS: Record<string, string> = {
  INFO: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-300 dark:border-blue-900/50",
  WARN: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-300 dark:border-amber-900/50",
  ERROR: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-300 dark:border-rose-900/50",
  CRITICAL: "text-rose-700 dark:text-rose-300 bg-rose-500/20 border-rose-400 dark:border-rose-800/80 font-black",
  DEBUG: "text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-300 dark:border-purple-900/50",
};

export function LogExplorerPanel({
  logs,
}: {
  logs: TelemetryLogEntry[];
}) {
  const [search, setSearch] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [selectedModule, setSelectedModule] = useState<string>("all");

  const modules = Array.from(new Set(logs.map((l) => l.module)));

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedLevel !== "all" && log.level !== selectedLevel) return false;
      if (selectedModule !== "all" && log.module !== selectedModule) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesMsg = log.message.toLowerCase().includes(q);
        const matchesMod = log.module.toLowerCase().includes(q);
        if (!matchesMsg && !matchesMod) return false;
      }
      return true;
    });
  }, [logs, search, selectedLevel, selectedModule]);

  const handleExport = (format: "json" | "csv") => {
    if (format === "json") {
      const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tanviragro-telemetry-logs-${Date.now()}.json`;
      a.click();
    } else {
      const headers = "timestamp,level,module,message\n";
      const rows = filteredLogs
        .map((l) => `"${l.timestamp}","${l.level}","${l.module}","${l.message.replace(/"/g, '""')}"`)
        .join("\n");
      const blob = new Blob([headers + rows], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tanviragro-telemetry-logs-${Date.now()}.csv`;
      a.click();
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border/70 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input
            placeholder="Filter telemetry logs by message or module..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-muted/30"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="h-9 rounded-xl border border-border/70 bg-background px-3 text-xs font-medium text-foreground outline-none"
          >
            <option value="all">All Levels</option>
            <option value="info">INFO</option>
            <option value="warn">WARN</option>
            <option value="error">ERROR</option>
            <option value="debug">DEBUG</option>
          </select>

          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="h-9 rounded-xl border border-border/70 bg-background px-3 text-xs font-medium text-foreground outline-none"
          >
            <option value="all">All Modules</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("json")}
            className="h-9 text-xs gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            JSON
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("csv")}
            className="h-9 text-xs gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
        </div>
      </div>

      {/* Terminal-Style Log Viewer */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-3 text-zinc-400">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-emerald-500" />
            <span className="font-semibold text-zinc-200">Live Telemetry Stream ({filteredLogs.length} events)</span>
          </div>
          <span className="text-[11px] text-zinc-500 flex items-center gap-1">
            <EyeOff className="h-3 w-3 text-emerald-500" /> Automatic PII Scrubbing Enabled
          </span>
        </div>

        <div className="max-h-[500px] overflow-y-auto space-y-1.5 pr-2">
          {filteredLogs.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-xs">
              No telemetry logs match the current filter query.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="py-1.5 px-2 rounded-lg hover:bg-zinc-900/60 transition-colors flex items-start gap-2.5 leading-relaxed"
              >
                <span className="text-[11px] text-zinc-500 shrink-0 select-none">
                  {new Date(log.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>

                <span
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0",
                    LEVEL_COLORS[log.level]
                  )}
                >
                  {log.level}
                </span>

                <span className="text-[11px] text-cyan-400 shrink-0 font-semibold">
                  [{log.module}]
                </span>

                <span className="text-zinc-200 break-all flex-1">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

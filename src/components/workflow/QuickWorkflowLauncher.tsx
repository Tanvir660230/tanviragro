"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search, Star, Zap, ChevronRight, Sparkles, X, Activity } from "lucide-react";
import { enterpriseWorkflowEngine } from "@/lib/workflow-engine";
import { WorkflowTemplate, WorkflowCategory } from "@/lib/workflow-engine/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectWorkflow: (template: WorkflowTemplate) => void;
  userRole?: "owner" | "manager" | "accountant" | "veterinarian" | "worker";
}

export function QuickWorkflowLauncher({ open, onOpenChange, onSelectWorkflow, userRole = "manager" }: Props) {
  const [q, setQ] = useState("");
  const [, setFavTick] = useState(0);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape" && open) onOpenChange(false);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onOpenChange]);

  const suggested = useMemo(() => enterpriseWorkflowEngine.getSuggestedTemplates({ role: userRole }), [userRole]);
  const filtered = useMemo(() => enterpriseWorkflowEngine.searchTemplates(q), [q]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-16 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="border-b border-border px-4 py-3 bg-muted/30 flex items-center gap-3">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search action... (e.g. Feed, Expense)"
            className="w-full bg-transparent text-sm font-medium focus:outline-none"
            autoFocus
          />
          <button onClick={() => onOpenChange(false)} className="rounded p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {!q && (
            <div>
              <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mb-2">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>RECOMMENDED FOR YOU</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {suggested.slice(0, 4).map((wf) => (
                  <div
                    key={wf.id}
                    onClick={() => { onSelectWorkflow(wf); onOpenChange(false); }}
                    className="flex flex-col justify-between rounded-xl border border-border bg-background/70 p-3 hover:border-primary cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        <span className="text-xs font-bold">{wf.title}</span>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); enterpriseWorkflowEngine.toggleFavorite(wf.id); setFavTick((t) => t + 1); }}>
                        <Star className={`h-3.5 w-3.5 ${enterpriseWorkflowEngine.isFavorite(wf.id) ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`} />
                      </button>
                    </div>
                    <span className="text-[11px] text-emerald-600 mt-2 font-medium">{wf.clickReductionRatio}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-muted-foreground mb-1">{q ? `SEARCH RESULTS (${filtered.length})` : "ALL WORKFLOWS"}</div>
            {filtered.map((wf) => (
              <div
                key={wf.id}
                onClick={() => { onSelectWorkflow(wf); onOpenChange(false); }}
                className="flex items-center justify-between rounded-xl border border-border/70 bg-background/50 p-2.5 hover:border-primary cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Activity className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <span className="text-xs sm:text-sm font-semibold block">{wf.title}</span>
                    <span className="text-[11px] text-muted-foreground line-clamp-1">{wf.shortDescription}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold hidden sm:inline">{wf.clickReductionRatio}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

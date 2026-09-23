"use client";

import React, { useState } from "react";
import { Zap, Search, ArrowUpDown, CheckCircle2, Sparkles, Filter } from "lucide-react";
import { QUICK_ACTION_MATRIX, WORKFLOW_CATALOG } from "@/lib/workflow-engine/templates";
import { WorkflowTemplate, WorkflowCategory } from "@/lib/workflow-engine/types";

interface Props {
  onSelectWorkflow?: (template: WorkflowTemplate) => void;
}

export function QuickActionMatrixTable({ onSelectWorkflow }: Props) {
  const [filterCat, setFilterCat] = useState<string>("all");
  const [search, setSearch] = useState("");

  const items = QUICK_ACTION_MATRIX.filter((item) => {
    const matchesCat = filterCat === "all" || item.category === filterCat;
    const matchesSearch =
      item.actionName.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleStart = (templateId: string) => {
    const t = WORKFLOW_CATALOG.find((wf) => wf.id === templateId);
    if (t && onSelectWorkflow) {
      onSelectWorkflow(t);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search action matrix..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-background pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto">
          {["all", "livestock", "feed", "veterinary", "procurement", "finance", "partner"].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize whitespace-nowrap transition-colors ${
                filterCat === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
            <tr>
              <th className="p-3">Action Name</th>
              <th className="p-3">Category</th>
              <th className="p-3 text-center">Previous Steps</th>
              <th className="p-3 text-center">Workflow Steps</th>
              <th className="p-3 text-center">Automations</th>
              <th className="p-3">Savings</th>
              <th className="p-3 text-right">Execute</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {items.map((row) => (
              <tr key={row.workflowId} className="hover:bg-muted/20 transition-colors">
                <td className="p-3">
                  <div className="font-semibold text-foreground">{row.actionName}</div>
                  <div className="text-[11px] text-muted-foreground line-clamp-1">{row.description}</div>
                </td>
                <td className="p-3">
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                    {row.category}
                  </span>
                </td>
                <td className="p-3 text-center text-muted-foreground font-mono">{row.previousClicks} clicks</td>
                <td className="p-3 text-center font-bold text-primary font-mono">{row.workflowSteps} step{row.workflowSteps > 1 ? "s" : ""}</td>
                <td className="p-3 text-center">
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full text-[10px]">
                    <Zap className="h-3 w-3" /> {row.automatedCascades} auto
                  </span>
                </td>
                <td className="p-3 font-semibold text-emerald-600">{row.reductionSummary}</td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => handleStart(row.workflowId)}
                    className="rounded-lg bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-colors inline-flex items-center gap-1"
                  >
                    <Sparkles className="h-3 w-3" /> Launch
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

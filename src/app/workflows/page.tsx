"use client";

import React, { useState } from "react";
import { Zap, Play, Search, Clock, CheckCircle2, AlertCircle, Sparkles, RefreshCw } from "lucide-react";
import { enterpriseWorkflowEngine, WORKFLOW_CATALOG, QUICK_ACTION_MATRIX, WorkflowTemplate, WorkflowInstance } from "@/lib/workflow-engine";
import { QuickActionMatrixTable } from "@/components/workflow/QuickActionMatrixTable";
import { QuickWorkflowLauncher } from "@/components/workflow/QuickWorkflowLauncher";
import { WorkflowWizardModal } from "@/components/workflow/WorkflowWizardModal";
import { WorkflowTimelineView } from "@/components/workflow/WorkflowTimelineView";
import { WorkflowRelatedEntitiesPanel } from "@/components/workflow/WorkflowRelatedEntitiesPanel";

export default function WorkflowsPage() {
  const [activeTab, setActiveTab] = useState<"catalog" | "matrix" | "instances">("catalog");
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<WorkflowInstance | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const instances = React.useMemo(() => {
    return enterpriseWorkflowEngine.getInstances();
  }, [refreshKey, wizardOpen]);

  const handleLaunch = (tmpl: WorkflowTemplate) => {
    setSelectedTemplate(tmpl);
    setWizardOpen(true);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Enterprise Workflow Engine</h1>
            <p className="text-xs text-muted-foreground">Action-oriented execution with cascading multi-module automations</p>
          </div>
        </div>

        <button
          onClick={() => setLauncherOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold shadow-sm hover:bg-muted"
        >
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Quick Launcher</span>
          <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">Ctrl+K</kbd>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("catalog")}
          className={`pb-3 border-b-2 ${activeTab === "catalog" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
        >
          Workflow Catalog ({WORKFLOW_CATALOG.length})
        </button>
        <button
          onClick={() => setActiveTab("matrix")}
          className={`pb-3 border-b-2 ${activeTab === "matrix" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
        >
          Quick Action Matrix
        </button>
        <button
          onClick={() => setActiveTab("instances")}
          className={`pb-3 border-b-2 ${activeTab === "instances" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
        >
          Audit & Instances ({instances.length})
        </button>
      </div>
      {/* Content */}
      {activeTab === "catalog" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {WORKFLOW_CATALOG.map((tmpl) => (
            <div key={tmpl.id} className="rounded-2xl border border-border bg-card p-4 hover:border-primary/50 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-mono font-semibold uppercase bg-muted px-2 py-0.5 rounded text-muted-foreground">{tmpl.category}</span>
                  <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{tmpl.clickReductionRatio}</span>
                </div>
                <h3 className="text-sm font-bold">{tmpl.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2">{tmpl.shortDescription}</p>
              </div>
              <div className="pt-4 mt-2">
                <button
                  onClick={() => handleLaunch(tmpl)}
                  className="w-full rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-1.5"
                >
                  <Play className="h-3.5 w-3.5 fill-current" /> Launch Workflow
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "matrix" && <QuickActionMatrixTable onSelectWorkflow={handleLaunch} />}

      {activeTab === "instances" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Runs ({instances.length})</span>
              <button onClick={() => setRefreshKey((k) => k + 1)} className="hover:text-primary"><RefreshCw className="h-3.5 w-3.5" /></button>
            </div>
            {instances.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">No workflow runs yet.</div>
            ) : (
              instances.map((inst: WorkflowInstance) => (
                <div
                  key={inst.instanceId}
                  onClick={() => setSelectedInstance(inst)}
                  className={`rounded-xl border p-3 cursor-pointer text-xs ${selectedInstance?.instanceId === inst.instanceId ? "border-primary bg-primary/5" : "border-border bg-card"}`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span>{inst.title}</span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">{inst.status}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">{new Date(inst.createdAt).toLocaleTimeString()} • {inst.createdBy.userName}</div>
                </div>
              ))
            )}
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 space-y-4">
            {selectedInstance ? (
              <>
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="text-sm font-bold">{selectedInstance.title}</h3>
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{selectedInstance.cascadeResults.length} Cascades</span>
                </div>
                <WorkflowTimelineView
                  instance={selectedInstance}
                  onUpdate={() => {
                    const refreshed = enterpriseWorkflowEngine.getInstance(selectedInstance.instanceId);
                    if (refreshed) setSelectedInstance(refreshed);
                    setRefreshKey((k) => k + 1);
                  }}
                />
                <WorkflowRelatedEntitiesPanel relatedEntities={selectedInstance.relatedEntities} />
              </>
            ) : (
              <div className="py-16 text-center text-xs text-muted-foreground">Select a workflow run to view timeline and linked records.</div>
            )}
          </div>
        </div>
      )}

      <QuickWorkflowLauncher open={launcherOpen} onOpenChange={setLauncherOpen} onSelectWorkflow={handleLaunch} />
      <WorkflowWizardModal
        template={selectedTemplate}
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCompleted={(inst) => {
          setSelectedInstance(inst);
          setRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
}


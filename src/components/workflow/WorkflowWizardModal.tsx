"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, X, Zap } from "lucide-react";
import { enterpriseWorkflowEngine } from "@/lib/workflow-engine";
import { WorkflowTemplate, WorkflowInstance } from "@/lib/workflow-engine/types";

interface Props {
  template: WorkflowTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: (instance: WorkflowInstance) => void;
  user?: { userId: string; userName: string; role: any };
  businessId?: string;
}

export function WorkflowWizardModal({
  template,
  open,
  onOpenChange,
  onCompleted,
  user = { userId: "usr_active", userName: "Manager", role: "manager" },
  businessId = "biz_main",
}: Props) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [step, setStep] = useState(0);
  const [instance, setInstance] = useState<WorkflowInstance | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (template && open) {
      const inst = enterpriseWorkflowEngine.createInstance({
        templateId: template.id,
        businessId,
        user,
      });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInstance(inst);
      setStep(0);
      setFormData({});
      setErr(null);
    }
  }, [template, open, businessId]);

  if (!open || !template || !instance) return null;
  const currentStepDef = template.steps[step];
  const isLast = step === template.steps.length - 1;

  const handleSubmit = async () => {
    if (currentStepDef) {
      for (const f of currentStepDef.fields) {
        if (f.required && !formData[f.name] && formData[f.name] !== 0) {
          setErr(`Required: ${f.label}`);
          return;
        }
      }
    }
    setErr(null);
    setLoading(true);
    try {
      const updated = await enterpriseWorkflowEngine.completeStep(instance.instanceId, formData, user);
      setInstance(updated);
      if (updated.status === "completed" || updated.status === "pending") {
        if (onCompleted) onCompleted(updated);
      } else {
        setStep((s) => s + 1);
      }
    } catch (e: any) {
      setErr(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="border-b border-border px-4 py-3 bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold">{template.title}</h3>
          </div>
          <button onClick={() => onOpenChange(false)} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 max-h-[50vh] overflow-y-auto">
          {instance.status === "completed" ? (
            <div className="py-4 text-center space-y-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
              <h4 className="text-sm font-bold">Workflow Completed!</h4>
              <p className="text-xs text-muted-foreground">All cascading automated actions executed.</p>
            </div>
          ) : (
            <>
              {err && <div className="p-2 text-xs text-destructive bg-destructive/10 rounded-lg flex items-center gap-1"><AlertCircle className="h-4 w-4" />{err}</div>}
              {currentStepDef && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">{currentStepDef.description}</p>
                  {currentStepDef.fields.map((f) => (
                    <div key={f.id} className="space-y-1">
                      <label className="text-xs font-semibold">{f.label} {f.required && "*"}</label>
                      {f.type === "select" ? (
                        <select
                          value={formData[f.name] ?? f.defaultValue ?? ""}
                          onChange={(e) => setFormData({ ...formData, [f.name]: e.target.value })}
                          className="w-full rounded-lg border border-border bg-background p-2 text-xs"
                        >
                          <option value="">Select...</option>
                          {f.options?.map((o) => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : (
                        <input
                          type={f.type === "number" || f.type === "currency" ? "number" : "text"}
                          value={formData[f.name] ?? f.defaultValue ?? ""}
                          onChange={(e) => setFormData({ ...formData, [f.name]: e.target.value })}
                          placeholder={f.placeholder}
                          className="w-full rounded-lg border border-border bg-background p-2 text-xs"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t border-border px-4 py-2.5 bg-muted/20 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">{template.clickReductionRatio}</span>
          <div className="flex gap-2">
            {instance.status === "completed" ? (
              <button onClick={() => onOpenChange(false)} className="rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground font-semibold">Done</button>
            ) : (
              <>
                <button onClick={() => onOpenChange(false)} className="rounded-lg border px-3 py-1.5 text-xs">Cancel</button>
                <button onClick={handleSubmit} disabled={loading} className="rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground font-semibold disabled:opacity-50">
                  {loading ? "Processing..." : isLast ? "Submit & Execute" : "Next"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


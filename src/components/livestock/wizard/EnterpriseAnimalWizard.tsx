"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  DEFAULT_WIZARD_STATE,
  validateWizardStep,
  type AnimalWizardState,
  type WizardTemplate,
} from "@/lib/validation/cattle-wizard";
import { saveEnterpriseAnimalWizardAction } from "@/app/dashboard/(app)/cattle/wizard-actions";

import { WizardTemplateSelector } from "./WizardTemplateSelector";
import { Step1Identification } from "./steps/Step1Identification";
import { Step2FarmLocation } from "./steps/Step2FarmLocation";
import { Step3CategoryStage } from "./steps/Step3CategoryStage";
import { Step4Health } from "./steps/Step4Health";
import { Step5Origin } from "./steps/Step5Origin";
import { Step6Financial } from "./steps/Step6Financial";
import { Step7Documents } from "./steps/Step7Documents";
import { Step8ReviewConfirm } from "./steps/Step8ReviewConfirm";

import {
  Tag,
  Building2,
  Target,
  HeartPulse,
  Truck,
  DollarSign,
  FileText,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";

const STEPS = [
  { id: 1, title: "Identity", icon: Tag },
  { id: 2, title: "Farm & Pen", icon: Building2 },
  { id: 3, title: "Purpose", icon: Target },
  { id: 4, title: "Health", icon: HeartPulse },
  { id: 5, title: "Origin", icon: Truck },
  { id: 6, title: "Finance", icon: DollarSign },
  { id: 7, title: "Docs", icon: FileText },
  { id: 8, title: "Review", icon: CheckCircle2 },
];
const DRAFT_STORAGE_KEY = "tanvir_agro_animal_wizard_draft";


export interface EnterpriseWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingTagIds?: string[];
  initialData?: Partial<AnimalWizardState>;
  editAnimalId?: string;
  onSuccess?: () => void;
}


export function EnterpriseAnimalWizard({
  open,
  onOpenChange,
  existingTagIds = [],
  initialData,
  editAnimalId,
  onSuccess,
}: EnterpriseWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  const [state, setState] = useState<AnimalWizardState>(() => {
    if (initialData) {
      return {
        ...DEFAULT_WIZARD_STATE,
        ...initialData,
        identification: { ...DEFAULT_WIZARD_STATE.identification, ...initialData.identification },
        farmLocation: { ...DEFAULT_WIZARD_STATE.farmLocation, ...initialData.farmLocation },
        categoryStage: { ...DEFAULT_WIZARD_STATE.categoryStage, ...initialData.categoryStage },
        health: { ...DEFAULT_WIZARD_STATE.health, ...initialData.health },
        origin: { ...DEFAULT_WIZARD_STATE.origin, ...initialData.origin },
        financial: { ...DEFAULT_WIZARD_STATE.financial, ...initialData.financial },
      };
    }
    return DEFAULT_WIZARD_STATE;
  });

  const suggestedTag = useMemo(() => {
    let bestNum = -1;
    let bestPrefix = "";
    let bestPadLen = 3;
    for (const tag of existingTagIds) {
      const m = tag.match(/^(.*?)(\d+)$/);
      if (!m) continue;
      const n = parseInt(m[2], 10);
      if (n > bestNum) {
        bestNum = n;
        bestPrefix = m[1];
        bestPadLen = m[2].length;
      }
    }
    if (bestNum === -1) return existingTagIds.length === 0 ? "C001" : "";
    return bestPrefix + String(bestNum + 1).padStart(bestPadLen, "0");
  }, [existingTagIds]);

  useEffect(() => {
    if (!editAnimalId && typeof window !== "undefined" && open) {
      const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedDraft && !hasRestoredDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          if (parsed?.identification?.tagId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setState(parsed);
            setHasRestoredDraft(true);
            toast.info("Restored uncommitted animal draft", {
              action: {
                label: "Clear Draft",
                onClick: () => {
                  localStorage.removeItem(DRAFT_STORAGE_KEY);
                  setState(DEFAULT_WIZARD_STATE);
                },
              },
            });
          }
        } catch {}
      }
    }
  }, [open, editAnimalId, hasRestoredDraft]);

  useEffect(() => {
    if (!editAnimalId && typeof window !== "undefined" && open) {
      if (state.identification.tagId || state.origin.purchasePrice > 0) {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(state));
      }
    }
  }, [state, editAnimalId, open]);

  const stepValidation = useMemo(() => {
    const activeExistingTags = editAnimalId
      ? existingTagIds.filter((t) => t !== initialData?.identification?.tagId)
      : existingTagIds;
    return validateWizardStep(currentStep, state, activeExistingTags);
  }, [currentStep, state, existingTagIds, editAnimalId, initialData]);

  const goNext = () => {
    if (!stepValidation.isValid) {
      const firstErr = Object.values(stepValidation.errors)[0];
      toast.error(firstErr || "Please fix validation errors to continue");
      return;
    }
    if (currentStep < 8) setCurrentStep((prev) => prev + 1);
  };

  const goPrev = () => {
    if (currentStep > 1) setCurrentStep((prev) => prev - 1);
  };

  const applyTemplate = (tmpl: WizardTemplate) => {
    setState((prev) => tmpl.apply(prev));
    toast.success(`Applied template: ${tmpl.name}`);
  };

  const handleFinalSubmit = async () => {
    const step1Check = validateWizardStep(1, state, existingTagIds);
    const step5Check = validateWizardStep(5, state, existingTagIds);
    if (!step1Check.isValid || !step5Check.isValid) {
      toast.error("Please complete all required fields in Identity and Origin");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await saveEnterpriseAnimalWizardAction(state, editAnimalId);
      if (res.error) {
        toast.error(res.error);
        setIsSubmitting(false);
        return;
      }

      toast.success(
        editAnimalId ? `Animal ${state.identification.tagId} updated!` : `Animal ${state.identification.tagId} registered successfully!`
      );
      if (typeof window !== "undefined") {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
      onOpenChange(false);
      onSuccess?.();
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to save animal profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background">
        <DialogHeader className="p-4 sm:p-5 border-b bg-card/50">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span>{editAnimalId ? `Edit Livestock Profile (${state.identification.tagId || "Animal"})` : "Enterprise Animal Registration"}</span>
            </DialogTitle>
            <Badge variant="outline" className="text-xs">
              Step {currentStep} of 8
            </Badge>
          </div>

          <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-1">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const isActive = s.id === currentStep;
              const isPast = s.id < currentStep;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCurrentStep(s.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : isPast
                      ? "bg-muted text-foreground hover:bg-muted/80"
                      : "text-muted-foreground hover:bg-accent/40"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{s.title}</span>
                </button>
              );
            })}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {currentStep === 1 && (
            <>
              {!editAnimalId && <WizardTemplateSelector onSelect={applyTemplate} />}
              <Step1Identification
                data={state.identification}
                onChange={(up) =>
                  setState((p) => ({ ...p, identification: { ...p.identification, ...up } }))
                }
                errors={stepValidation.errors}
                suggestedTag={suggestedTag}
              />
            </>
          )}

          {currentStep === 2 && (
            <Step2FarmLocation
              data={state.farmLocation}
              onChange={(up) =>
                setState((p) => ({ ...p, farmLocation: { ...p.farmLocation, ...up } }))
              }
              errors={stepValidation.errors}
            />
          )}

          {currentStep === 3 && (
            <Step3CategoryStage
              data={state.categoryStage}
              onChange={(up) =>
                setState((p) => ({ ...p, categoryStage: { ...p.categoryStage, ...up } }))
              }
              errors={stepValidation.errors}
            />
          )}

          {currentStep === 4 && (
            <Step4Health
              data={state.health}
              onChange={(up) =>
                setState((p) => ({ ...p, health: { ...p.health, ...up } }))
              }
              errors={stepValidation.errors}
            />
          )}

          {currentStep === 5 && (
            <Step5Origin
              data={state.origin}
              onChange={(up) =>
                setState((p) => ({ ...p, origin: { ...p.origin, ...up } }))
              }
              errors={stepValidation.errors}
            />
          )}

          {currentStep === 6 && (
            <Step6Financial
              data={state.financial}
              onChange={(up) =>
                setState((p) => ({ ...p, financial: { ...p.financial, ...up } }))
              }
              errors={stepValidation.errors}
            />
          )}

          {currentStep === 7 && (
            <Step7Documents
              documents={state.documents}
              notes={state.notes}
              onDocumentsChange={(docs) => setState((p) => ({ ...p, documents: docs }))}
              onNotesChange={(notes) => setState((p) => ({ ...p, notes }))}
            />
          )}

          {currentStep === 8 && (
            <Step8ReviewConfirm state={state} errors={stepValidation.errors} />
          )}
        </div>

        <DialogFooter className="p-3 sm:p-4 border-t bg-card/50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {currentStep > 1 && (
              <Button type="button" variant="outline" size="sm" onClick={goPrev}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
            )}
            {!editAnimalId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => {
                  if (typeof window !== "undefined") localStorage.removeItem(DRAFT_STORAGE_KEY);
                  setState(DEFAULT_WIZARD_STATE);
                  toast.info("Form reset");
                }}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Reset
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep < 8 ? (
              <Button type="button" size="sm" onClick={goNext}>
                Next Step
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleFinalSubmit}
                disabled={isSubmitting || !stepValidation.isValid}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    {editAnimalId ? "Update Profile" : "Register Animal"}
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


"use client";

import React, { useState } from "react";
import { Stethoscope, Loader2, CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { recordPregnancyDiagnosisAction } from "@/app/dashboard/(app)/cattle/breeding-actions";
import { type BreedingAttempt, type PDMethod, type PDResult } from "@/lib/reproduction";
import { toast } from "sonner";

interface PregnancyCheckModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attempt: BreedingAttempt | null;
  onSuccess?: () => void;
}

export function PregnancyCheckModal({
  open,
  onOpenChange,
  attempt,
  onSuccess,
}: PregnancyCheckModalProps) {
  const [pdResult, setPdResult] = useState<PDResult>("pregnant");
  const [pdMethod, setPdMethod] = useState<PDMethod>("rectal_palpation");
  const [pdDate, setPdDate] = useState(new Date().toISOString().slice(0, 10));
  const [examinedBy, setExaminedBy] = useState("");
  const [riskLevel, setRiskLevel] = useState<"normal" | "elevated" | "high">("normal");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  if (!attempt) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await recordPregnancyDiagnosisAction({
        attemptId: attempt.id,
        cowId: attempt.cowId,
        pdDate,
        pdResult,
        pdMethod,
        examinedBy: examinedBy || undefined,
        riskLevel,
        notes: notes || undefined,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(
          pdResult === "pregnant"
            ? "Pregnancy confirmed! Dry-off & delivery reminders scheduled."
            : "Diagnosis recorded."
        );
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to record diagnosis");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-amber-500" />
            Pregnancy Diagnosis (PD) Check
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="p-3 bg-muted/40 rounded-xl text-xs space-y-1">
            <div className="flex justify-between font-semibold">
              <span>Cow: {attempt.cowTag || attempt.cowId}</span>
              <span>Sire: {attempt.sireTagOrCode}</span>
            </div>
            <div className="text-muted-foreground flex justify-between">
              <span>Inseminated: {attempt.inseminationDate}</span>
              <span>Method: {attempt.breedingType}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Diagnosis Result</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={pdResult === "pregnant" ? "default" : "outline"}
                className={`gap-1.5 ${pdResult === "pregnant" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                onClick={() => setPdResult("pregnant")}
              >
                <CheckCircle2 className="h-4 w-4" /> Pregnant (+)
              </Button>
              <Button
                type="button"
                variant={pdResult === "open" ? "default" : "outline"}
                className={`gap-1.5 ${pdResult === "open" ? "bg-rose-600 hover:bg-rose-700 text-white" : ""}`}
                onClick={() => setPdResult("open")}
              >
                <XCircle className="h-4 w-4" /> Open (-)
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Examination Date</Label>
              <Input
                type="date"
                value={pdDate}
                onChange={(e) => setPdDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Diagnosis Method</Label>
              <Select value={pdMethod} onValueChange={(v) => setPdMethod(v as PDMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rectal_palpation">Rectal Palpation</SelectItem>
                  <SelectItem value="ultrasound">Ultrasound Scan</SelectItem>
                  <SelectItem value="blood_test">Blood / PAG Test</SelectItem>
                  <SelectItem value="milk_progesterone">Milk Progesterone</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Examining Vet</Label>
              <Input
                placeholder="Dr. Veterinarian"
                value={examinedBy}
                onChange={(e) => setExaminedBy(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Risk Level</Label>
              <Select value={riskLevel} onValueChange={(v) => setRiskLevel(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="elevated">Elevated</SelectItem>
                  <SelectItem value="high">High Risk</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              placeholder="Clinical observations, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="gap-1.5">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Save PD Diagnosis
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import React, { useState, useTransition } from "react";
import {
  HeartPulse,
  Syringe,
  Pill,
  Bug,
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Plus,
  ShieldCheck,
  Printer,
  Activity,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { fmtBDT } from "@/lib/format";
import { useTranslation } from "@/i18n/I18nProvider";
import type { HealthEvent, HealthEventType } from "@/types/database";
import type { CattleTreatment } from "@/app/dashboard/(app)/cattle/medical-actions";
import {
  recordClinicalVisitAction,
  generateHealthCertificateAction,
} from "@/app/dashboard/(app)/cattle/medical-actions";
import {
  completeHealthEvent,
  deleteHealthEvent,
  createHealthEvent,
} from "@/app/dashboard/(app)/cattle/[id]/health-actions";
import { HealthEngine } from "@/lib/livestock/health-engine";
import type {
  AdministrationRoute,
  HealthAlert,
  HealthCertificateSummary,
  VitalSigns,
} from "@/lib/livestock/types";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataPagination } from "@/components/ui/data-pagination";
import { useL } from "@/i18n/text";
import { todayDhaka } from "@/lib/dates";

export interface MedicineItem {
  id: string;
  name: string;
  unit: string;
}

export interface MedicineProtocol {
  item_id: string;
  dose_per_100kg_weight: number;
  frequency_days: number | null;
  notes: string | null;
}

export interface HealthWorkspaceProps {
  cattle: {
    id: string;
    tag_id: string;
    breed: string | null;
    gender: string;
    dob?: string | null;
    purchase_date?: string | null;
    status: string;
    is_quarantined: boolean;
    withdrawal_end_date?: string | null;
    pen_id?: string | null;
  };
  businessId: string;
  /** the farm name printed on the health certificate */
  businessName?: string;
  currentWeightKg: number;
  events: HealthEvent[];
  treatments: CattleTreatment[];
  medicineItems: MedicineItem[];
  protocols: MedicineProtocol[];
}

const EVENT_ICON: Record<HealthEventType, React.ReactNode> = {
  vaccine: <Syringe className="h-4 w-4" />,
  checkup: <Stethoscope className="h-4 w-4" />,
  deworming: <Bug className="h-4 w-4" />,
  treatment: <Pill className="h-4 w-4" />,
  other: <Calendar className="h-4 w-4" />,
};

const EVENT_COLOR: Record<HealthEventType, string> = {
  vaccine: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  checkup: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  deworming: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  treatment: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  other: "bg-muted text-muted-foreground",
};

export function HealthWorkspace({
  cattle,
  businessId,
  businessName,
  currentWeightKg,
  events,
  treatments,
  medicineItems,
  protocols,
}: HealthWorkspaceProps) {
  const L = useL();
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const today = todayDhaka();

  const [activeTab, setActiveTab] = useState<"clinical" | "protocols">("clinical");
  const [visitOpen, setVisitOpen] = useState(false);
  const [visitType, setVisitType] = useState<"routine_check" | "emergency" | "follow_up" | "admission" | "discharge">("routine_check");
  const [vetName, setVetName] = useState("");
  const [tempC, setTempC] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [respRate, setRespRate] = useState("");
  const [bcs, setBcs] = useState("3.0");
  const [diagnosis, setDiagnosis] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [selectedMedId, setSelectedMedId] = useState("");
  const [dose, setDose] = useState("");
  const [doseUnit, setDoseUnit] = useState("ml");
  const [route, setRoute] = useState<AdministrationRoute>("IM");
  const [withdrawalDays, setWithdrawalDays] = useState("0");
  const [vetFee, setVetFee] = useState("0");
  const [labFee, setLabFee] = useState("0");
  const [quarantineFlag, setQuarantineFlag] = useState(cattle.is_quarantined);
  const [followUpDate, setFollowUpDate] = useState("");

  const [certOpen, setCertOpen] = useState(false);
  const [certificateData, setCertificateData] = useState<HealthCertificateSummary | null>(null);

  const [protoOpen, setProtoOpen] = useState(false);
  const [protoTitle, setProtoTitle] = useState("");
  const [protoType, setProtoType] = useState<HealthEventType>("vaccine");
  const [protoDate, setProtoDate] = useState(today);
  const [protoNotes, setProtoNotes] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(15);

  function handleMedSelect(itemId: string) {
    setSelectedMedId(itemId);
    const item = medicineItems.find((m) => m.id === itemId);
    if (item) setDoseUnit(item.unit || "ml");
    const proto = protocols.find((p) => p.item_id === itemId);
    if (proto && currentWeightKg > 0) {
      const calc = (proto.dose_per_100kg_weight / 100) * currentWeightKg;
      setDose(calc.toFixed(3));
    }
  }

  const alerts: HealthAlert[] = HealthEngine.evaluateAnimalHealthRisk(cattle, events, treatments);
  const pendingEvents = events.filter((e) => !e.completed_at);
  const overdueEvents = pendingEvents.filter((e) => e.scheduled_at < today);
  const completedEvents = events.filter((e) => e.completed_at);

  const totalMedicalCost = treatments.reduce(
    (acc, tr) => acc + (tr.vet_fee || 0) + (tr.additional_medical_cost || 0),
    0
  );

  const isUnderWithdrawal = HealthEngine.isUnderWithdrawal(cattle.withdrawal_end_date, today);

  function handleClinicalVisitSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!diagnosis.trim()) {
      toast.error(L("রোগের নাম লিখুন", "Please enter a primary diagnosis"));
      return;
    }

    const vitals: VitalSigns = {
      temperatureCelsius: tempC ? parseFloat(tempC) : undefined,
      heartRateBpm: heartRate ? parseInt(heartRate) : undefined,
      respirationRateBpm: respRate ? parseInt(respRate) : undefined,
      bodyConditionScore: bcs ? parseFloat(bcs) : undefined,
      recordedAt: today,
      recordedBy: vetName,
    };

    const medItem = medicineItems.find((m) => m.id === selectedMedId);
    const prescriptions = selectedMedId && parseFloat(dose) > 0 && medItem
      ? [{ medicineItemId: selectedMedId, medicineName: medItem.name, dose: parseFloat(dose), doseUnit, frequency: "Once daily", durationDays: 1, route, withdrawalDays: parseInt(withdrawalDays) || 0, notes: recommendations }]
      : [];

    startTransition(async () => {
      const res = await recordClinicalVisitAction({
        cattleId: cattle.id,
        businessId,
        visitType,
        visitDate: today,
        veterinarianName: vetName,
        vitals,
        symptoms: [],
        primaryDiagnosis: diagnosis.trim(),
        severity: "moderate",
        prescriptions,
        vetFeeBdt: parseFloat(vetFee) || 0,
        labTestFeeBdt: parseFloat(labFee) || 0,
        additionalCostBdt: 0,
        totalMedicalCostBdt: (parseFloat(vetFee) || 0) + (parseFloat(labFee) || 0),
        recommendations,
        requiresQuarantine: quarantineFlag,
        nextFollowUpDate: followUpDate || null,
      });

      if (res.success) {
        toast.success(L("চিকিৎসা লেখা হলো", "Clinical visit recorded successfully"));
        setVisitOpen(false);
        setDiagnosis("");
        setRecommendations("");
        setSelectedMedId("");
        setDose("");
        setTempC("");
        setHeartRate("");
        setRespRate("");
      } else {
        toast.error(res.error || L("চিকিৎসা লেখা যায়নি", "Failed to record clinical visit"));
      }
    });
  }

  function handleGenerateCertificate() {
    startTransition(async () => {
      const res = await generateHealthCertificateAction(cattle.id, currentWeightKg, vetName || "—");
      if (res.success && res.certificate) {
        setCertificateData(res.certificate);
        setCertOpen(true);
      } else {
        toast.error(res.error || L("সনদ তৈরি করা যায়নি", "Could not generate certificate"));
      }
    });
  }

  function handleAddProtocol(e: React.FormEvent) {
    e.preventDefault();
    if (!protoTitle.trim()) {
      toast.error(L("শিরোনাম লিখুন", "Protocol title is required"));
      return;
    }
    const formData = new FormData();
    formData.set("cattle_id", cattle.id);
    formData.set("title", protoTitle.trim());
    formData.set("event_type", protoType);
    formData.set("scheduled_at", protoDate);
    if (protoNotes) formData.set("notes", protoNotes.trim());

    startTransition(async () => {
      const res = await createHealthEvent(undefined, formData);
      if (res?.success) {
        toast.success(L("স্বাস্থ্য কাজ যোগ হলো", "Health event scheduled successfully"));
        setProtoOpen(false);
        setProtoTitle("");
        setProtoNotes("");
      } else if (res?.error) {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Top Status Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{L("স্বাস্থ্য", "Health Status")}</span>
            <HeartPulse className={cn("h-4 w-4", cattle.is_quarantined ? "text-rose-500" : "text-emerald-500")} />
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("h-3 w-3 rounded-full shrink-0", cattle.is_quarantined ? "bg-rose-500 animate-pulse" : "bg-emerald-500")} />
            <span className="text-base font-bold truncate">{cattle.is_quarantined ? L("আলাদা রাখা", "Quarantined") : L("সুস্থ", "Healthy")}</span>
          </div>
          <p className="text-xs text-muted-foreground">{cattle.is_quarantined ? L("অসুস্থদের জায়গায়", "In the sick pen") : L("দলের সাথে", "With the herd")}</p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{L("ওষুধের অপেক্ষাকাল", "Drug Withdrawal")}</span>
            <ShieldAlert className={cn("h-4 w-4", isUnderWithdrawal ? "text-amber-500" : "text-emerald-500")} />
          </div>
          <div className="text-base font-bold truncate">
            {isUnderWithdrawal ? (
              <span className="text-amber-600 dark:text-amber-400">{L(`${cattle.withdrawal_end_date} পর্যন্ত`, `Until ${cattle.withdrawal_end_date}`)}</span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400">{L("নেই (বিক্রি করা যায়)", "Clear (Fit for Sale)")}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{isUnderWithdrawal ? L("এখন বিক্রি/জবাই করা যাবে না", "Do not sell yet") : L("ওষুধের প্রভাব নেই", "No active residues")}</p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{L("টিকা", "Vaccine Schedule")}</span>
            <Syringe className="h-4 w-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">{completedEvents.length}</span>
            <span className="text-xs text-muted-foreground">{L(`শেষ / ${pendingEvents.length} বাকি`, `completed / ${pendingEvents.length} pending`)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {overdueEvents.length > 0 ? (
              <span className="text-rose-500 font-semibold">{L(`${overdueEvents.length}টি সময় পেরিয়েছে`, `${overdueEvents.length} overdue`)}</span>
            ) : (
              L("হালনাগাদ", "Up to date")
            )}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{L("মোট চিকিৎসা খরচ", "Total Medical Spent")}</span>
            <Pill className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black font-mono text-foreground">{fmtBDT(totalMedicalCost)}</div>
          <p className="text-xs text-muted-foreground">{treatments.length} treatments logged</p>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div key={alert.id} className={cn("flex items-start gap-3 p-3.5 rounded-xl border text-sm", alert.severity === "critical" ? "bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200" : "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200")}>
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-xs sm:text-sm">{alert.title}</p>
                <p className="text-xs opacity-90 mt-0.5">{alert.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-card border border-border shadow-xs">
        <div className="flex items-center gap-2">
          <Button variant={activeTab === "clinical" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("clinical")} className="rounded-xl font-medium">
            <Stethoscope className="h-4 w-4 mr-1.5" />
            Treatments ({treatments.length})
          </Button>
          <Button variant={activeTab === "protocols" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("protocols")} className="rounded-xl font-medium">
            <Calendar className="h-4 w-4 mr-1.5" />
            Protocols ({events.length})
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Dialog open={visitOpen} onOpenChange={setVisitOpen}>
            <DialogTrigger className="inline-flex items-center justify-center rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs h-8 px-3 text-xs gap-1.5 cursor-pointer">
              <Stethoscope className="h-4 w-4" />
              {L("চিকিৎসা লিখুন", "Record Vet Visit")}
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-emerald-600" />
                  {L("পরীক্ষা ও চিকিৎসা লিখুন", "Record Clinical Examination & Treatment")}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleClinicalVisitSubmit} className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">{L("ধরন", "Visit Type")}</Label>
                    <Select value={visitType} onValueChange={(v: any) => setVisitType(v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="routine_check">{L("নিয়মিত পরীক্ষা", "Routine Health Check")}</SelectItem>
                        <SelectItem value="emergency">{L("জরুরি চিকিৎসা", "Emergency Treatment")}</SelectItem>
                        <SelectItem value="follow_up">{L("পরের দেখা", "Clinical Follow-up")}</SelectItem>
                        <SelectItem value="admission">{L("আলাদা রাখা শুরু", "Quarantine Admission")}</SelectItem>
                        <SelectItem value="discharge">{L("আলাদা রাখা শেষ", "Quarantine Discharge")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">{L("ডাক্তারের নাম", "Veterinarian Name")}</Label>
                    <Input className="mt-1" value={vetName} onChange={(e) => setVetName(e.target.value)} required />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-2">
                  <span className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
                    <Activity className="h-3.5 w-3.5" /> {L("শারীরিক লক্ষণ", "Vitals")}
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <Label className="text-[11px]">{L("তাপমাত্রা (°C)", "Temp (°C)")}</Label>
                      <Input type="number" step="0.1" placeholder="38.5" value={tempC} onChange={(e) => setTempC(e.target.value)} className="h-8 font-mono" />
                    </div>
                    <div>
                      <Label className="text-[11px]">{L("হৃদস্পন্দন (bpm)", "Heart Rate (bpm)")}</Label>
                      <Input type="number" placeholder="60" value={heartRate} onChange={(e) => setHeartRate(e.target.value)} className="h-8 font-mono" />
                    </div>
                    <div>
                      <Label className="text-[11px]">{L("শ্বাস (bpm)", "Respiration (bpm)")}</Label>
                      <Input type="number" placeholder="24" value={respRate} onChange={(e) => setRespRate(e.target.value)} className="h-8 font-mono" />
                    </div>
                    <div>
                      <Label className="text-[11px]">{L("শরীরের অবস্থা (১-৫)", "BCS (1.0-5.0)")}</Label>
                      <Input type="number" step="0.25" min="1" max="5" placeholder="3.0" value={bcs} onChange={(e) => setBcs(e.target.value)} className="h-8 font-mono" />
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">{L("রোগ *", "Primary Diagnosis *")}</Label>
                  <Input className="mt-1" placeholder={L("যেমন সর্দি-কাশি", "e.g. Mild Bovine Respiratory Disease")} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} required />
                </div>
                <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-2">
                  <span className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
                    <Pill className="h-3.5 w-3.5" /> {L("ওষুধ ও ডোজ", "Medicine & dose")}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <Label className="text-[11px]">{L("ওষুধ", "Medicine Item")}</Label>
                      <Select value={selectedMedId} onValueChange={(val: any) => handleMedSelect(val || "")}>
                        <SelectTrigger className="h-8 mt-1"><SelectValue placeholder={L("ওষুধ বাছুন…", "Select medicine...")} /></SelectTrigger>
                        <SelectContent>
                          {medicineItems.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.name} ({m.unit})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[11px]">{L("ডোজ", "Dose")} ({currentWeightKg > 0 ? `${currentWeightKg}kg` : L("ওজন", "weight")})</Label>
                      <div className="flex gap-1 mt-1">
                        <Input type="number" step="0.001" placeholder="0.0" value={dose} onChange={(e) => setDose(e.target.value)} className="h-8 font-mono" />
                        <span className="flex items-center px-1.5 text-xs text-muted-foreground border rounded bg-background">{doseUnit}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px]">{L("কীভাবে", "Route")}</Label>
                      <Select value={route} onValueChange={(r: any) => setRoute(r)}>
                        <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="IM">{L("মাংসে (IM)", "Intramuscular (IM)")}</SelectItem>
                          <SelectItem value="SC">{L("চামড়ার নিচে (SC)", "Subcutaneous (SC)")}</SelectItem>
                          <SelectItem value="IV">{L("শিরায় (IV)", "Intravenous (IV)")}</SelectItem>
                          <SelectItem value="oral">{L("মুখে", "Oral")}</SelectItem>
                          <SelectItem value="topical">{L("গায়ে লাগানো", "Topical")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[11px]">{L("অপেক্ষাকাল (দিন)", "Withdrawal Days")}</Label>
                      <Input type="number" min="0" placeholder="0" value={withdrawalDays} onChange={(e) => setWithdrawalDays(e.target.value)} className="h-8 font-mono mt-1" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs font-semibold">{L("ডাক্তারের ফি (৳)", "Vet Fee (৳)")}</Label>
                    <Input type="number" min="0" value={vetFee} onChange={(e) => setVetFee(e.target.value)} className="font-mono mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">{L("ল্যাব ফি (৳)", "Lab Fee (৳)")}</Label>
                    <Input type="number" min="0" value={labFee} onChange={(e) => setLabFee(e.target.value)} className="font-mono mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">{L("পরের দেখার তারিখ", "Follow-up Date")}</Label>
                    <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className="mt-1" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">{L("পরামর্শ", "Recommendations")}</Label>
                  <Textarea placeholder={L("সুস্থ হওয়ার নির্দেশনা…", "Recovery instructions...")} value={recommendations} onChange={(e) => setRecommendations(e.target.value)} className="min-h-[50px] mt-1" />
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <input type="checkbox" id="quar-check" checked={quarantineFlag} onChange={(e) => setQuarantineFlag(e.target.checked)} className="h-4 w-4 rounded text-amber-600" />
                  <Label htmlFor="quar-check" className="text-xs font-semibold cursor-pointer text-amber-900 dark:text-amber-300">
                    {L("চিকিৎসার সময় আলাদা রাখুন", "Isolate in Quarantine Pen during treatment")}
                  </Label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button type="button" variant="outline" onClick={() => setVisitOpen(false)}>{L("বাতিল", "Cancel")}</Button>
                  <Button type="submit" disabled={isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    {isPending ? L("সেভ হচ্ছে…", "Saving…") : L("সেভ করুন", "Save record")}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" onClick={handleGenerateCertificate} disabled={isPending} className="rounded-xl font-medium">
            <ShieldCheck className="h-4 w-4 mr-1.5 text-blue-600" />
            {L("স্বাস্থ্য সনদ", "Health Certificate")}
          </Button>

          <Dialog open={protoOpen} onOpenChange={setProtoOpen}>
            <DialogTrigger className="inline-flex items-center justify-center rounded-xl font-medium border border-input bg-background hover:bg-accent h-8 px-3 text-xs gap-1.5 cursor-pointer">
              <Plus className="h-4 w-4" />
              {L("টিকা যোগ", "Add Vaccine")}
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Syringe className="h-5 w-5 text-blue-600" />
                  {L("টিকা / কাজ যোগ করুন", "Schedule Vaccine / Protocol")}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddProtocol} className="space-y-3 pt-2">
                <div>
                  <Label className="text-xs font-semibold">{L("শিরোনাম *", "Title *")}</Label>
                  <Input placeholder={L("যেমন FMD বুস্টার টিকা", "e.g. FMD Booster Vaccine")} value={protoTitle} onChange={(e) => setProtoTitle(e.target.value)} required />
                </div>
                <div>
                  <Label className="text-xs font-semibold">{L("ধরন", "Protocol Type")}</Label>
                  <Select value={protoType} onValueChange={(t: any) => setProtoType(t)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vaccine">{L("টিকা", "Vaccination")}</SelectItem>
                      <SelectItem value="deworming">{L("কৃমিনাশক", "Deworming")}</SelectItem>
                      <SelectItem value="checkup">{L("নিয়মিত পরীক্ষা", "Routine Checkup")}</SelectItem>
                      <SelectItem value="treatment">{L("চিকিৎসা", "Treatment")}</SelectItem>
                      <SelectItem value="other">{L("অন্যান্য", "Other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold">{L("তারিখ *", "Scheduled Date *")}</Label>
                  <Input type="date" value={protoDate} onChange={(e) => setProtoDate(e.target.value)} required />
                </div>
                <div>
                  <Label className="text-xs font-semibold">{L("নোট", "Notes")}</Label>
                  <Textarea placeholder={L("ডোজ বা কোম্পানির তথ্য…", "Dose or manufacturer details...")} value={protoNotes} onChange={(e) => setProtoNotes(e.target.value)} className="min-h-[50px]" />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setProtoOpen(false)}>{L("বাতিল", "Cancel")}</Button>
                  <Button type="submit" disabled={isPending}>{L("যোগ করুন", "Schedule Protocol")}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Sub-Tab 1: Clinical Treatments */}
      {activeTab === "clinical" && (
        <div className="rounded-2xl bg-card border border-border shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-emerald-600" />
              {L("চিকিৎসার ইতিহাস", "Clinical Treatment History & Prescriptions")}
            </h3>
            <span className="text-xs font-medium text-muted-foreground">{treatments.length} records</span>
          </div>

          {treatments.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Stethoscope className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="font-semibold text-sm">{L("এখনো কোনো চিকিৎসা লেখা হয়নি", "No medical treatments logged yet")}</p>
              <p className="text-xs mt-1">{L("উপরে চিকিৎসা বা ওষুধ লিখুন।", "Record a clinical visit or medicine administration above.")}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {treatments.slice(page * pageSize, (page + 1) * pageSize).map((t) => (
                <div key={t.id} className="p-4 hover:bg-muted/20 transition-colors space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-muted-foreground">{t.treated_at}</span>
                      <span className="text-sm font-bold text-foreground">{t.diagnosis || L("সাধারণ চিকিৎসা", "General treatment")}</span>
                    </div>
                    <div className="text-right font-mono text-xs font-bold">
                      {fmtBDT((t.vet_fee || 0) + (t.additional_medical_cost || 0))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    {t.inventory_items && (
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <Pill className="h-3 w-3 text-purple-500" />
                        {t.inventory_items.name}: {t.dose_administered} {t.dose_unit}
                      </span>
                    )}
                    {t.vet_fee > 0 && <span>{L("ডাক্তারের ফি", "Vet fee")}: {fmtBDT(t.vet_fee)}</span>}
                    {t.notes && <span className="italic">“{t.notes}”</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {treatments.length > pageSize && (
            <div className="p-3 border-t border-border">
              <DataPagination total={treatments.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
            </div>
          )}
        </div>
      )}


      {/* Sub-Tab 2: Protocols */}
      {activeTab === "protocols" && (
        <div className="rounded-2xl bg-card border border-border shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              {L("টিকা ও নিয়মিত কাজের তালিকা", "Vaccine & Routine Protocol Calendar")}
            </h3>
            <span className="text-xs font-medium text-muted-foreground">{pendingEvents.length} pending</span>
          </div>

          {events.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="font-semibold text-sm">{L("কোনো কাজ নির্ধারিত নেই", "No scheduled health events")}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {events.map((evt) => {
                const isOverdue = !evt.completed_at && evt.scheduled_at < today;
                return (
                  <div key={evt.id} className="p-4 hover:bg-muted/20 transition-colors flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn("p-2 rounded-xl shrink-0", EVENT_COLOR[evt.event_type] || "bg-muted")}>
                        {EVENT_ICON[evt.event_type] || <Calendar className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold truncate">{evt.title}</p>
                          {isOverdue && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400">
                              {L("সময় পেরিয়েছে", "Overdue")}
                            </span>
                          )}
                          {evt.completed_at && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              Completed {evt.completed_at}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Scheduled: {evt.scheduled_at} {evt.notes ? `• ${evt.notes}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!evt.completed_at && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            startTransition(async () => {
                              await completeHealthEvent(evt.id, cattle.id);
                              toast.success(L("কাজ শেষ হিসেবে রাখা হলো", "Protocol marked as completed"));
                            })
                          }
                          disabled={isPending}
                          className="h-8 text-xs rounded-lg font-semibold text-emerald-600 hover:text-emerald-700"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          {L("হয়ে গেছে", "Complete")}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingDeleteId(evt.id)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600 rounded-lg"
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Certificate Modal */}
      <Dialog open={certOpen} onOpenChange={setCertOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              {L("গরুর স্বাস্থ্য সনদ", "Official Bovine Health Certificate & Clearance")}
            </DialogTitle>
          </DialogHeader>

          {certificateData && (
            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-2xl border border-border bg-card space-y-3">
                <div className="flex justify-between items-start border-b border-border pb-3">
                  <div>
                    <h4 className="text-base font-black">{businessName || "Tanvir Agro"}</h4>
                    <p className="text-xs text-muted-foreground">{L("স্বাস্থ্যের রেকর্ড", "Certified Veterinary Health Record")}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-xs font-bold text-muted-foreground">{certificateData.certificateId}</span>
                    <p className="text-[11px] text-muted-foreground">{certificateData.certifiedAt}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div>
                    <span className="text-muted-foreground font-medium">{L("ট্যাগ:", "Tag ID:")}</span>
                    <p className="font-bold text-sm">#{certificateData.tagId}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium">{L("জাত / লিঙ্গ:", "Breed / Gender:")}</span>
                    <p className="font-bold">{certificateData.breed} ({certificateData.gender})</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium">{L("ওজন:", "Live Weight:")}</span>
                    <p className="font-bold font-mono">{certificateData.currentWeightKg} kg</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium">{L("আনুমানিক বয়স:", "Est. Age:")}</span>
                    <p className="font-bold font-mono">{certificateData.ageMonths} months</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">{L("বিক্রি / জবাই করা যায়:", "Fit for Sale / Slaughter:")}</span>
                    <span className={cn("font-bold px-2 py-0.5 rounded-full text-[11px]", certificateData.isFitForSaleOrSlaughter ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600")}>
                      {certificateData.isFitForSaleOrSlaughter ? "APPROVED / FIT" : "RESTRICTED / EMBARGO"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">{L("ওষুধের অপেক্ষাকাল:", "Drug Withdrawal Status:")}</span>
                    <span>{certificateData.activeWithdrawalPeriod ? L(`${certificateData.withdrawalEndDate} পর্যন্ত`, `Active until ${certificateData.withdrawalEndDate}`) : L("নেই", "Cleared")}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    {L("দেওয়া টিকা", "Completed Vaccinations")}
                  </h5>
                  {certificateData.completedVaccinations.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">{L("কোনো টিকা দেওয়া লেখা নেই।", "No completed vaccines logged.")}</p>
                  ) : (
                    <ul className="text-xs space-y-1">
                      {certificateData.completedVaccinations.map((v, i) => (
                        <li key={i} className="flex items-center justify-between text-muted-foreground">
                          <span className="font-medium text-foreground">✓ {v.title}</span>
                          <span className="font-mono">{v.completedAt}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                  <span>{L("দিয়েছেন", "Certified by")}: <strong className="text-foreground">{certificateData.certifiedBy}</strong></span>
                  <Button size="sm" variant="outline" onClick={() => window.print()} className="h-8 rounded-lg">
                    <Printer className="h-3.5 w-3.5 mr-1.5" />
                    {L("সনদ প্রিন্ট", "Print Certificate")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        title={L("কাজটি মুছবেন?", "Delete Health Protocol")}
        description={L("এই নির্ধারিত কাজটি মুছে যাবে।", "Are you sure you want to remove this scheduled health event?")}
        confirmLabel={L("মুছুন", "Delete")}
        destructive={true}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) {
            const id = pendingDeleteId;
            setPendingDeleteId(null);
            startTransition(async () => {
              await deleteHealthEvent(id, cattle.id);
              toast.success(L("কাজটি মুছে ফেলা হলো", "Health event deleted"));
            });
          }
        }}
      />





    </div>
  );
}

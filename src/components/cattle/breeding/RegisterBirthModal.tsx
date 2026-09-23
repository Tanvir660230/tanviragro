"use client";

import React, { useState } from "react";
import { Baby, Loader2, Plus, Trash2, ShieldCheck } from "lucide-react";
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
import { recordCalvingAndRegisterOffspringAction } from "@/app/dashboard/(app)/cattle/breeding-actions";
import {
  type BreedingAttempt,
  type CalvingType,
  type DeliveryDifficulty,
  type BirthStatus,
} from "@/lib/reproduction";
import { toast } from "sonner";

interface CalfInput {
  tagNumber: string;
  name: string;
  gender: "bull" | "heifer";
  birthWeightKg: string;
  birthStatus: BirthStatus;
  initialValuationBdt: string;
  colostrumFedWithinHours: string;
}

interface RegisterBirthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cattleList: { id: string; tag_number: string; name?: string; gender: string; breed?: string }[];
  preselectedAttempt?: BreedingAttempt | null;
  onSuccess?: () => void;
}

export function RegisterBirthModal({
  open,
  onOpenChange,
  cattleList,
  preselectedAttempt,
  onSuccess,
}: RegisterBirthModalProps) {
  const [cowId, setCowId] = useState(preselectedAttempt?.cowId || "");
  const [sireName, setSireName] = useState(preselectedAttempt?.sireTagOrCode || "");
  const [calvingDate, setCalvingDate] = useState(new Date().toISOString().slice(0, 10));
  const [difficulty, setDifficulty] = useState<DeliveryDifficulty>("unassisted");
  const [attendantName, setAttendantName] = useState("");
  const [vetFee, setVetFee] = useState("0");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const [calves, setCalves] = useState<CalfInput[]>(() => {
    const defaultTag = `C-${Math.floor(1000 + Math.random() * 9000)}`;
    return [
      {
        tagNumber: defaultTag,
        name: `Calf ${defaultTag}`,
        gender: "heifer",
        birthWeightKg: "28",
        birthStatus: "alive",
        initialValuationBdt: "15000",
        colostrumFedWithinHours: "2",
      },
    ];
  });

  const females = cattleList.filter((c) => c.gender === "cow" || c.gender === "heifer");

  const addTwinCalf = () => {
    const nextTag = `C-${Math.floor(1000 + Math.random() * 9000)}`;
    setCalves([
      ...calves,
      {
        tagNumber: nextTag,
        name: `Calf ${nextTag}`,
        gender: "bull",
        birthWeightKg: "26",
        birthStatus: "alive",
        initialValuationBdt: "15000",
        colostrumFedWithinHours: "2",
      },
    ]);
  };

  const removeCalf = (index: number) => {
    if (calves.length > 1) {
      setCalves(calves.filter((_, i) => i !== index));
    }
  };

  const updateCalf = (index: number, field: keyof CalfInput, value: string) => {
    const updated = [...calves];
    (updated[index] as any)[field] = value;
    setCalves(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cowId) {
      toast.error("Please select a dam (mother)");
      return;
    }

    setLoading(true);
    try {
      const res = await recordCalvingAndRegisterOffspringAction({
        cowId,
        breedingAttemptId: preselectedAttempt?.id,
        sireNameOrCode: sireName || undefined,
        calvingDate,
        deliveryDifficulty: difficulty,
        attendantName: attendantName || undefined,
        vetFeeBdt: Number(vetFee || 0),
        notes: notes || undefined,
        calves: calves.map((c) => ({
          tagNumber: c.tagNumber,
          name: c.name || undefined,
          gender: c.gender,
          birthWeightKg: Number(c.birthWeightKg || 25),
          birthStatus: c.birthStatus,
          initialValuationBdt: Number(c.initialValuationBdt || 15000),
          colostrumFedWithinHours: Number(c.colostrumFedWithinHours || 2),
        })),
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Calving logged! Registered ${calves.length} calf(s) to herd.`);
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to record calving");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Baby className="h-5 w-5 text-purple-600" />
            Register Calving &amp; Newborn Offspring
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Dam (Mother Cow)</Label>
              <Select value={cowId} onValueChange={(v) => v && setCowId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select dam..." />
                </SelectTrigger>
                <SelectContent>
                  {females.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.tag_number} ({c.breed || "Cow"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Sire (Father Tag / Code)</Label>
              <Input
                placeholder="Sire tag or bull code"
                value={sireName}
                onChange={(e) => setSireName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Calving Date</Label>
              <Input
                type="date"
                value={calvingDate}
                onChange={(e) => setCalvingDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Delivery Difficulty</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as DeliveryDifficulty)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassisted">Unassisted (Easy)</SelectItem>
                  <SelectItem value="easy_assist">Easy Assist</SelectItem>
                  <SelectItem value="difficult_dystocia">Difficult Dystocia</SelectItem>
                  <SelectItem value="caesarean">Caesarean Section</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Attendant / Vet</Label>
              <Input
                placeholder="Staff name"
                value={attendantName}
                onChange={(e) => setAttendantName(e.target.value)}
              />
            </div>
          </div>

          {/* Offspring Details Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <Label className="font-bold text-sm">Newborn Calves ({calves.length})</Label>
              {calves.length === 1 && (
                <Button type="button" variant="outline" size="sm" onClick={addTwinCalf} className="h-7 text-xs gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add Twin Calf
                </Button>
              )}
            </div>

            {calves.map((calf, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border bg-purple-50/40 dark:bg-purple-950/20 border-purple-200/60 dark:border-purple-800/40 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900 dark:text-purple-300">
                    Calf #{idx + 1}
                  </span>
                  {calves.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCalf(idx)}
                      className="h-6 w-6 p-0 text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Tag Number</Label>
                    <Input
                      value={calf.tagNumber}
                      onChange={(e) => updateCalf(idx, "tagNumber", e.target.value)}
                      className="bg-card h-8 text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px]">Gender</Label>
                    <Select value={calf.gender} onValueChange={(v) => v && updateCalf(idx, "gender", v)}>
                      <SelectTrigger className="bg-card h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="heifer">♀ Heifer</SelectItem>
                        <SelectItem value="bull">♂ Bull</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px]">Birth Wt (kg)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={calf.birthWeightKg}
                      onChange={(e) => updateCalf(idx, "birthWeightKg", e.target.value)}
                      className="bg-card h-8 text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px]">Initial Value (৳)</Label>
                    <Input
                      type="number"
                      value={calf.initialValuationBdt}
                      onChange={(e) => updateCalf(idx, "initialValuationBdt", e.target.value)}
                      className="bg-card h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              placeholder="Delivery notes, colostrum intake, dam recovery..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Complete Calving &amp; Register Calf
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

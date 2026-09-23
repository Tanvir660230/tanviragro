"use client";

import React, { useState, useEffect } from "react";
import { Heart, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
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
import {
  recordBreedingAttemptAction,
  evaluateInbreedingRiskAction,
} from "@/app/dashboard/(app)/cattle/breeding-actions";
import { GestationEngine, type BreedingType, type SemenInventoryItem } from "@/lib/reproduction";
import { toast } from "sonner";

interface RecordBreedingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cattleList: { id: string; tag_number: string; name?: string; gender: string; breed?: string }[];
  semenList: SemenInventoryItem[];
  preselectedCowId?: string;
  preselectedHeatId?: string;
  onSuccess?: () => void;
}

export function RecordBreedingModal({
  open,
  onOpenChange,
  cattleList,
  semenList,
  preselectedCowId,
  preselectedHeatId,
  onSuccess,
}: RecordBreedingModalProps) {
  const [cowId, setCowId] = useState(preselectedCowId || "");
  const [breedingType, setBreedingType] = useState<BreedingType>("AI");
  const [semenId, setSemenId] = useState("");
  const [bullId, setBullId] = useState("");
  const [sireCodeCustom, setSireCodeCustom] = useState("");
  const [inseminationDate, setInseminationDate] = useState(new Date().toISOString().slice(0, 10));
  const [technicianName, setTechnicianName] = useState("");
  const [technicianCost, setTechnicianCost] = useState("500");
  const [strawCost, setStrawCost] = useState("1000");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [inbreedingEval, setInbreedingEval] = useState<any>(null);

  const females = cattleList.filter((c) => c.gender === "cow" || c.gender === "heifer");
  const bulls = cattleList.filter((c) => c.gender === "bull");

  const selectedCow = cattleList.find((c) => c.id === cowId);
  const expectedCalving = GestationEngine.calculateExpectedCalvingDate(inseminationDate, selectedCow?.breed);
  const pdCheckDate = GestationEngine.calculatePDCheckDate(inseminationDate);

  const handleSemenChange = (id: string) => {
    setSemenId(id);
    const item = semenList.find((s) => s.id === id);
    if (item) {
      setSireCodeCustom(item.bullCode);
      setStrawCost(String(item.costPerStrawBdt));
    }
  };

  useEffect(() => {
    if (cowId && bullId && breedingType === "natural") {
      evaluateInbreedingRiskAction({ femaleId: cowId, maleId: bullId }).then((res) => {
        if (res.inbreedingRisk) {
          setInbreedingEval(res.inbreedingRisk);
        }
      });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInbreedingEval(null);
    }
  }, [cowId, bullId, breedingType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cowId) {
      toast.error("Please select a cow");
      return;
    }

    const sireTagOrCode =
      breedingType === "AI"
        ? sireCodeCustom || "AI Semen Batch"
        : bulls.find((b) => b.id === bullId)?.tag_number || sireCodeCustom || "Natural Sire";

    setLoading(true);
    try {
      const res = await recordBreedingAttemptAction({
        cowId,
        heatRecordId: preselectedHeatId || undefined,
        breedingType,
        semenInventoryId: breedingType === "AI" && semenId ? semenId : undefined,
        sireId: breedingType === "natural" && bullId ? bullId : undefined,
        sireTagOrCode,
        inseminationDate,
        technicianName: technicianName || undefined,
        technicianCostBdt: Number(technicianCost || 0),
        strawCostBdt: breedingType === "AI" ? Number(strawCost || 0) : 0,
        notes: notes || undefined,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Breeding attempt recorded! PD check scheduled.");
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to record breeding");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-purple-600" />
            Record Breeding / Insemination
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Select Cow / Heifer</Label>
              <Select value={cowId} onValueChange={(v) => v && setCowId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select cow..." />
                </SelectTrigger>
                <SelectContent>
                  {females.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.tag_number} ({c.breed || "Crossbred"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Breeding Method</Label>
              <Select value={breedingType} onValueChange={(v) => v && setBreedingType(v as BreedingType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AI">Artificial Insemination (AI)</SelectItem>
                  <SelectItem value="natural">Natural Mating</SelectItem>
                  <SelectItem value="embryo_transfer">Embryo Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {breedingType === "AI" ? (
            <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 rounded-xl">
              <div className="space-y-1.5">
                <Label className="text-xs">Semen Straw Batch</Label>
                <Select value={semenId} onValueChange={(v) => v && handleSemenChange(v)}>
                  <SelectTrigger className="bg-card">
                    <SelectValue placeholder="Choose straw..." />
                  </SelectTrigger>
                  <SelectContent>
                    {semenList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.bullCode} - {s.bullName} ({s.strawsInStock} left)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Straw Cost (৳)</Label>
                <Input
                  type="number"
                  value={strawCost}
                  onChange={(e) => setStrawCost(e.target.value)}
                  className="bg-card"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2 p-3 bg-muted/40 border rounded-xl">
              <div className="space-y-1.5">
                <Label>Select Farm Bull</Label>
                <Select value={bullId} onValueChange={(v) => v && setBullId(v)}>
                  <SelectTrigger className="bg-card">
                    <SelectValue placeholder="Choose bull..." />
                  </SelectTrigger>
                  <SelectContent>
                    {bulls.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.tag_number} ({b.name || b.breed || "Bull"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {inbreedingEval && (
                <div
                  className={`p-2 rounded-lg text-xs flex items-center justify-between ${
                    inbreedingEval.isMatingRecommended
                      ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200"
                      : "bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {inbreedingEval.isMatingRecommended ? (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    ) : (
                      <ShieldAlert className="h-3.5 w-3.5" />
                    )}
                    <span>
                      Inbreeding: {inbreedingEval.inbreedingPercentage}% ({inbreedingEval.riskLevel})
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Insemination Date</Label>
              <Input
                type="date"
                value={inseminationDate}
                onChange={(e) => setInseminationDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Technician Name</Label>
              <Input
                placeholder="AI Technician / Vet"
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Technician Service Fee (৳)</Label>
            <Input
              type="number"
              value={technicianCost}
              onChange={(e) => setTechnicianCost(e.target.value)}
            />
          </div>

          <div className="p-3 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40 rounded-xl grid grid-cols-2 gap-2 text-center text-xs">
            <div>
              <span className="text-[10px] text-muted-foreground block">PD Check Due (45d)</span>
              <span className="font-semibold text-foreground">{pdCheckDate}</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block">Expected Calving (283d)</span>
              <span className="font-semibold text-purple-700 dark:text-purple-300">{expectedCalving}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              placeholder="Batch notes, hormone timing, etc."
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
              Save Breeding Record
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

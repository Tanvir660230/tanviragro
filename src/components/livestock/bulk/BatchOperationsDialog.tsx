"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  Activity,
  ShieldAlert,
  Loader2,
  Layers,
} from "lucide-react";
import {
  bulkBatchMovementAction,
  bulkBatchHealthAction,
  bulkBatchStatusAction,
} from "@/app/dashboard/(app)/cattle/bulk-actions";

export interface BatchOperationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCattle: Array<{ id: string; tag_id: string; breed?: string }>;
  pens?: Array<{ id: string; name: string; code: string; currentOccupancy: number; capacity: number }>;
  onSuccess?: () => void;
}

export function BatchOperationsDialog({
  open,
  onOpenChange,
  selectedCattle,
  pens = [],
  onSuccess,
}: BatchOperationsDialogProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"movement" | "health" | "status">("movement");
  const [isPending, startTransition] = useTransition();

  const [targetPenId, setTargetPenId] = useState("");
  const [movementNotes, setMovementNotes] = useState("");

  const [healthType, setHealthType] = useState<"vaccination" | "deworming" | "checkup" | "treatment">("deworming");
  const [healthName, setHealthName] = useState("");
  const [healthDate, setHealthDate] = useState(new Date().toISOString().split("T")[0]);
  const [healthCost, setHealthCost] = useState("");
  const [healthNotes, setHealthNotes] = useState("");

  const [targetStatus, setTargetStatus] = useState<"active" | "quarantined" | "sold" | "dead">("quarantined");
  const [statusNotes, setStatusNotes] = useState("");

  const cattleIds = selectedCattle.map((c) => c.id);

  const handleExecuteBatchMovement = () => {
    if (!targetPenId) {
      toast.error("Please select a target pen");
      return;
    }
    startTransition(async () => {
      const res = await bulkBatchMovementAction(cattleIds, targetPenId);
      if (!res.success) {
        toast.error(res.error || "Failed to transfer animals");
        return;
      }
      toast.success(`Successfully moved ${res.updatedCount} animals to pen`);
      onSuccess?.();
      onOpenChange(false);
      router.refresh();
    });
  };

  const handleExecuteBatchHealth = () => {
    if (!healthName.trim()) {
      toast.error("Please enter treatment name");
      return;
    }
    startTransition(async () => {
      const cost = healthCost ? parseFloat(healthCost) : undefined;
      const res = await bulkBatchHealthAction(cattleIds, healthType, healthName.trim(), healthDate, healthNotes, cost);
      if (!res.success) {
        toast.error(res.error || "Failed to log health event");
        return;
      }
      toast.success(`Recorded ${healthName} for ${res.insertedCount} cattle`);
      onSuccess?.();
      onOpenChange(false);
      router.refresh();
    });
  };

  const handleExecuteBatchStatus = () => {
    startTransition(async () => {
      const res = await bulkBatchStatusAction(cattleIds, targetStatus, statusNotes);
      if (!res.success) {
        toast.error(res.error || "Failed to update status");
        return;
      }
      toast.success(`Updated status to ${targetStatus} for ${res.updatedCount} cattle`);
      onSuccess?.();
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Batch Livestock Operations</DialogTitle>
              <p className="text-xs text-muted-foreground">
                Apply bulk updates to {selectedCattle.length} selected animals
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-2.5 rounded-xl border bg-muted/20 flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
          {selectedCattle.map((c) => (
            <Badge key={c.id} variant="secondary" className="font-mono text-[11px]">
              #{c.tag_id}
            </Badge>
          ))}
        </div>

        <div className="flex rounded-xl bg-muted/40 p-1 border text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("movement")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 font-semibold rounded-lg ${
              activeTab === "movement" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground"
            }`}
          >
            <ArrowRightLeft className="h-3.5 w-3.5" /> Movement
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("health")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 font-semibold rounded-lg ${
              activeTab === "health" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground"
            }`}
          >
            <Activity className="h-3.5 w-3.5" /> Health
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("status")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 font-semibold rounded-lg ${
              activeTab === "status" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground"
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" /> Status
          </button>
        </div>

        {activeTab === "movement" && (
          <div className="space-y-3 py-1 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Destination Pen</Label>
              <select
                value={targetPenId}
                onChange={(e) => setTargetPenId(e.target.value)}
                className="w-full h-9 rounded-lg border border-border px-3 text-xs bg-background"
              >
                <option value="">-- Choose Target Pen --</option>
                {pens.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code}) — {p.currentOccupancy}/{p.capacity} head
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Transfer Notes (Optional)</Label>
              <Input placeholder="Reason..." value={movementNotes} onChange={(e) => setMovementNotes(e.target.value)} className="text-xs h-9" />
            </div>
          </div>
        )}

        {activeTab === "health" && (
          <div className="space-y-3 py-1 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <select
                  value={healthType}
                  onChange={(e) => setHealthType(e.target.value as any)}
                  className="w-full h-9 rounded-lg border border-border px-3 text-xs bg-background"
                >
                  <option value="deworming">Deworming</option>
                  <option value="vaccination">Vaccination</option>
                  <option value="treatment">Treatment</option>
                  <option value="checkup">Checkup</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={healthDate} onChange={(e) => setHealthDate(e.target.value)} className="text-xs h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Protocol Name</Label>
                <Input placeholder="e.g. Albendazole" value={healthName} onChange={(e) => setHealthName(e.target.value)} className="text-xs h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cost per Head (৳)</Label>
                <Input type="number" placeholder="0" value={healthCost} onChange={(e) => setHealthCost(e.target.value)} className="text-xs h-9" />
              </div>
            </div>
          </div>
        )}

        {activeTab === "status" && (
          <div className="space-y-3 py-1 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">New Status</Label>
              <select
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value as any)}
                className="w-full h-9 rounded-lg border border-border px-3 text-xs bg-background"
              >
                <option value="quarantined">Quarantine (Isolation)</option>
                <option value="active">Active Herd</option>
                <option value="sold">Sold</option>
                <option value="dead">Deceased</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Input placeholder="Reason..." value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)} className="text-xs h-9" />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs h-8">
            Cancel
          </Button>
          {activeTab === "movement" && (
            <Button size="sm" disabled={isPending || !targetPenId} onClick={handleExecuteBatchMovement} className="text-xs font-semibold gap-1.5 h-8">
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Transfer ({selectedCattle.length})
            </Button>
          )}
          {activeTab === "health" && (
            <Button size="sm" disabled={isPending || !healthName.trim()} onClick={handleExecuteBatchHealth} className="text-xs font-semibold gap-1.5 h-8">
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Log Event ({selectedCattle.length})
            </Button>
          )}
          {activeTab === "status" && (
            <Button size="sm" disabled={isPending} onClick={handleExecuteBatchStatus} className="text-xs font-semibold gap-1.5 h-8">
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Update Status
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

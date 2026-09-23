"use client";

import React, { useState } from "react";
import { Dna, Loader2 } from "lucide-react";
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
import { recordSemenStockAction } from "@/app/dashboard/(app)/cattle/breeding-actions";
import { toast } from "sonner";

interface SemenInventoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function SemenInventoryModal({ open, onOpenChange, onSuccess }: SemenInventoryModalProps) {
  const [bullCode, setBullCode] = useState("");
  const [bullName, setBullName] = useState("");
  const [breed, setBreed] = useState("Holstein Friesian (100%)");
  const [strawCode, setStrawCode] = useState("");
  const [strawsInStock, setStrawsInStock] = useState("10");
  const [costPerStraw, setCostPerStraw] = useState("1200");
  const [supplier, setSupplier] = useState("");
  const [storageCanister, setStorageCanister] = useState("Tank 1 - Canister A");
  const [motilityPercent, setMotilityPercent] = useState("85");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bullCode || !strawCode) {
      toast.error("Bull Code and Straw Code are required");
      return;
    }

    setLoading(true);
    try {
      const res = await recordSemenStockAction({
        bullCode,
        bullName: bullName || bullCode,
        breed,
        strawCode,
        strawsInStock: Number(strawsInStock || 0),
        costPerStrawBdt: Number(costPerStraw || 0),
        supplier: supplier || undefined,
        storageCanister: storageCanister || undefined,
        motilityPercent: motilityPercent ? Number(motilityPercent) : undefined,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Semen batch saved to inventory!");
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save semen stock");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dna className="h-5 w-5 text-blue-600" />
            Add Cryogenic Semen Straw Batch
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Bull Tag / Code</Label>
              <Input
                placeholder="e.g. HF-BULL-902"
                value={bullCode}
                onChange={(e) => setBullCode(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Bull Name</Label>
              <Input
                placeholder="e.g. Champion Max"
                value={bullName}
                onChange={(e) => setBullName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Breed / Genetic Line</Label>
              <Input
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Straw Batch Code</Label>
              <Input
                placeholder="e.g. BATCH-2026-X"
                value={strawCode}
                onChange={(e) => setStrawCode(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Straw Quantity</Label>
              <Input
                type="number"
                value={strawsInStock}
                onChange={(e) => setStrawsInStock(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cost / Straw (৳)</Label>
              <Input
                type="number"
                value={costPerStraw}
                onChange={(e) => setCostPerStraw(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Storage Canister</Label>
              <Input
                value={storageCanister}
                onChange={(e) => setStorageCanister(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Motility (%)</Label>
              <Input
                type="number"
                max="100"
                value={motilityPercent}
                onChange={(e) => setMotilityPercent(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Supplier / Genetic Center</Label>
            <Input
              placeholder="e.g. World Wide Sires / BRAC AI"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Semen Batch
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

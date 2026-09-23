"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Loader2 } from "lucide-react";
import { recordOwnershipTransferAction } from "@/app/dashboard/(app)/commerce/actions";
import { toast } from "sonner";
import type { OwnershipTransferReason } from "@/lib/commerce";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableCattle: { id: string; tag_id: string }[];
  onSuccess?: () => void;
}

export function OwnershipTransferModal({ open, onOpenChange, availableCattle, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [selectedCattleId, setSelectedCattleId] = useState("");
  const [transferReason, setTransferReason] = useState<OwnershipTransferReason>("sale");
  const [prevOwner, setPrevOwner] = useState("Tanvir Agro Enterprise");
  const [newOwner, setNewOwner] = useState("");
  const [newOwnerContact, setNewOwnerContact] = useState("");
  const [transferPrice, setTransferPrice] = useState("");
  const [witnessName, setWitnessName] = useState("");
  const [legalRef, setLegalRef] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCattleId) {
      toast.error("Please select an animal");
      return;
    }
    if (!newOwner.trim()) {
      toast.error("New legal owner name is required");
      return;
    }

    const tag = availableCattle.find((c) => c.id === selectedCattleId)?.tag_id;
    setLoading(true);
    try {
      const res = await recordOwnershipTransferAction({
        cattleId: selectedCattleId,
        tagId: tag,
        transferReason,
        previousOwnerName: prevOwner,
        newOwnerName: newOwner,
        newOwnerContact,
        transferPrice: parseFloat(transferPrice) || 0,
        witnessName,
        legalDocumentRef: legalRef,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Ownership handover recorded with digital verification");
        onOpenChange(false);
        onSuccess?.();
      }
    } catch {
      toast.error("Failed to record ownership transfer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
            Legal Animal Ownership Handover
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Select Animal *</Label>
              <Select value={selectedCattleId} onValueChange={(val) => setSelectedCattleId(val || "")}>
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue placeholder="Choose Tag" />
                </SelectTrigger>
                <SelectContent>
                  {availableCattle.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      Tag #{c.tag_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Reason</Label>
              <Select value={transferReason} onValueChange={(v) => setTransferReason((v || "sale") as OwnershipTransferReason)}>
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sale">Commercial Sale</SelectItem>
                  <SelectItem value="purchase">Initial Acquisition</SelectItem>
                  <SelectItem value="partner_allocation">Partner Dividend Lot</SelectItem>
                  <SelectItem value="internal_transfer">Internal Entity Move</SelectItem>
                  <SelectItem value="disposal">Disposal / Culling</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Transferor (Old Owner)</Label>
              <Input value={prevOwner} onChange={(e) => setPrevOwner(e.target.value)} className="h-8 text-xs mt-1" />
            </div>
            <div>
              <Label className="text-xs">Transferee (New Owner) *</Label>
              <Input
                placeholder="Full Name"
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
                required
                className="h-8 text-xs mt-1 font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Settlement Price (৳)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={transferPrice}
                onChange={(e) => setTransferPrice(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Witness / Officer</Label>
              <Input placeholder="Witness name" value={witnessName} onChange={(e) => setWitnessName(e.target.value)} className="h-8 text-xs mt-1" />
            </div>
          </div>

          <div>
            <Label className="text-xs">Legal Contract / Document Ref</Label>
            <Input placeholder="e.g. DEED-2026-CATTLE-89" value={legalRef} onChange={(e) => setLegalRef(e.target.value)} className="h-8 text-xs mt-1" />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="h-8 text-xs font-semibold">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Sign &amp; Record Transfer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

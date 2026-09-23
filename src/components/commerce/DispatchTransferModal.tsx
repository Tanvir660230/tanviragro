"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck, Loader2 } from "lucide-react";
import { createCommerceTransferAction } from "@/app/dashboard/(app)/commerce/actions";
import { toast } from "sonner";
import type { TransferType } from "@/lib/commerce";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableCattle: { id: string; tag_id: string }[];
  onSuccess?: () => void;
}

export function DispatchTransferModal({ open, onOpenChange, availableCattle, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [transferType, setTransferType] = useState<TransferType>("farm_to_farm");
  const [originName, setOriginName] = useState("Main Dairy Farm (Shed A)");
  const [destinationName, setDestinationName] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [transportCost, setTransportCost] = useState("");
  const [selectedCattleIds, setSelectedCattleIds] = useState<string[]>([]);

  const toggleCattle = (id: string) => {
    setSelectedCattleIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destinationName.trim()) {
      toast.error("Destination location is required");
      return;
    }
    if (selectedCattleIds.length === 0) {
      toast.error("Please select at least one animal to transfer");
      return;
    }

    setLoading(true);
    try {
      const res = await createCommerceTransferAction({
        transferType,
        originName,
        destinationName,
        cattleIds: selectedCattleIds,
        driverName,
        driverPhone,
        vehicleNumber,
        transportCost: parseFloat(transportCost) || 0,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Transfer manifest dispatched successfully");
        onOpenChange(false);
        onSuccess?.();
      }
    } catch {
      toast.error("Failed to dispatch transfer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Truck className="h-4 w-4 text-purple-600" />
            Dispatch Transfer Logistics
          </DialogTitle>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <Label className="text-xs">Transfer Type</Label>
            <Select value={transferType} onValueChange={(v) => setTransferType(v as TransferType)}>
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="farm_to_farm">Farm-to-Farm Movement</SelectItem>
                <SelectItem value="sale_delivery">Customer Sale Delivery</SelectItem>
                <SelectItem value="purchase_inbound">Purchase Inbound Logistics</SelectItem>
                <SelectItem value="department">Department Transfer</SelectItem>
                <SelectItem value="temporary_exhibition">Exhibition / Qurbani Haat</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Origin Location *</Label>
              <Input
                value={originName}
                onChange={(e) => setOriginName(e.target.value)}
                required
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Destination Location *</Label>
              <Input
                placeholder="e.g. Pasture Yard 2"
                value={destinationName}
                onChange={(e) => setDestinationName(e.target.value)}
                required
                className="h-8 text-xs mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Driver Name</Label>
              <Input placeholder="Name" value={driverName} onChange={(e) => setDriverName(e.target.value)} className="h-8 text-xs mt-1" />
            </div>
            <div>
              <Label className="text-xs">Driver Phone</Label>
              <Input placeholder="Phone" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} className="h-8 text-xs mt-1" />
            </div>
            <div>
              <Label className="text-xs">Vehicle No.</Label>
              <Input placeholder="Dhaka Metro..." value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} className="h-8 text-xs mt-1" />
            </div>
          </div>

          <div className="space-y-1 pt-1 border-t border-border/60">
            <Label className="text-xs font-semibold">Select Animals ({selectedCattleIds.length} chosen)</Label>
            <div className="max-h-24 overflow-y-auto border border-border/60 rounded p-1.5 flex flex-wrap gap-1">
              {availableCattle.map((c) => {
                const isSelected = selectedCattleIds.includes(c.id);
                return (
                  <Button
                    key={c.id}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleCattle(c.id)}
                    className="h-6 text-[10px] px-2"
                  >
                    #{c.tag_id}
                  </Button>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="text-xs">Logistics / Freight Expense (৳)</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={transportCost}
              onChange={(e) => setTransportCost(e.target.value)}
              className="h-8 text-xs mt-1"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="h-8 text-xs font-semibold">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Dispatch Transit
            </Button>
          </DialogFooter>
        </form>

        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

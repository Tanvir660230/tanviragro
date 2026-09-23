"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingCart, Plus, Trash2, Loader2 } from "lucide-react";
import { createCommerceOrderAction } from "@/app/dashboard/(app)/commerce/actions";
import { toast } from "sonner";
import type { CommerceOrderItem } from "@/lib/commerce";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreatePurchaseOrderModal({ open, onOpenChange, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [supplierContact, setSupplierContact] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [expectedDate, setExpectedDate] = useState("");
  const [transportCost, setTransportCost] = useState("");
  const [items, setItems] = useState<CommerceOrderItem[]>([
    { itemType: "livestock", description: "Brahman Bull Calf Lot", quantity: 1, unitPrice: 85000, totalPrice: 85000 },
  ]);

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { itemType: "livestock", description: "Livestock Head", quantity: 1, unitPrice: 0, totalPrice: 0 },
    ]);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof CommerceOrderItem, val: any) => {
    setItems((prev) => {
      const next = [...prev];
      const target = { ...next[idx], [field]: val };
      if (field === "unitPrice" || field === "quantity") {
        target.totalPrice = (Number(target.unitPrice) || 0) * (Number(target.quantity) || 1);
      }
      next[idx] = target;
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      toast.error("Supplier name is required");
      return;
    }

    setLoading(true);
    try {
      const res = await createCommerceOrderAction({
        orderType: "purchase",
        counterpartyType: "vendor",
        counterpartyName: supplierName,
        counterpartyContact: supplierContact,
        orderDate,
        expectedDeliveryDate: expectedDate || undefined,
        transportCost: parseFloat(transportCost) || 0,
        items,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Purchase order created successfully");
        onOpenChange(false);
        onSuccess?.();
      }
    } catch {
      toast.error("Failed to submit purchase order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <ShoppingCart className="h-4 w-4 text-blue-600" />
            Create Purchase Order (PO)

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Supplier *</Label>
              <Input
                placeholder="Supplier name"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                required
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Contact</Label>
              <Input
                placeholder="Phone"
                value={supplierContact}
                onChange={(e) => setSupplierContact(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Order Date</Label>
              <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="h-8 text-xs mt-1" />
            </div>
            <div>
              <Label className="text-xs">Expected Arrival</Label>
              <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="h-8 text-xs mt-1" />
            </div>
          </div>

          <div className="space-y-1.5 pt-1 border-t border-border/60">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Items</Label>
              <Button type="button" size="sm" variant="ghost" onClick={addItem} className="h-6 text-[11px] gap-1 px-1.5">
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <Input
                  placeholder="Item description"
                  value={item.description}
                  onChange={(e) => updateItem(idx, "description", e.target.value)}
                  className="h-7 text-xs flex-1"
                />
                <Input
                  type="number"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateItem(idx, "quantity", parseFloat(e.target.value))}
                  className="h-7 text-xs w-14"
                />
                <Input
                  type="number"
                  placeholder="৳"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(idx, "unitPrice", parseFloat(e.target.value))}
                  className="h-7 text-xs w-20"
                />
                {items.length > 1 && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeItem(idx)} className="h-7 w-7 p-0 text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="h-8 text-xs font-semibold">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Create Order
            </Button>
          </DialogFooter>
        </form>

          </DialogTitle>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

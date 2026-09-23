"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Plus, Trash2, Loader2 } from "lucide-react";
import { createCommerceOrderAction } from "@/app/dashboard/(app)/commerce/actions";
import { toast } from "sonner";
import type { CommerceOrderItem } from "@/lib/commerce";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateSaleOrderModal({ open, onOpenChange, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [items, setItems] = useState<CommerceOrderItem[]>([
    { itemType: "livestock", description: "Fattened Bull Lot #1", quantity: 1, unitPrice: 165000, totalPrice: 165000 },
  ]);

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { itemType: "livestock", description: "Sale Head", quantity: 1, unitPrice: 0, totalPrice: 0 },
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
    if (!customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }

    setLoading(true);
    try {
      const res = await createCommerceOrderAction({
        orderType: "sale",
        counterpartyType: "customer",
        counterpartyName: customerName,
        counterpartyContact: customerContact,
        orderDate,
        expectedDeliveryDate: deliveryDate || undefined,
        taxRatePercent: parseFloat(taxRate) || 0,
        discountAmount: parseFloat(discountAmount) || 0,
        items,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Sale order registered successfully");
        onOpenChange(false);
        onSuccess?.();
      }
    } catch {
      toast.error("Failed to register sale order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-emerald-600" />

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Customer Name *</Label>
              <Input
                placeholder="e.g. Al-Falah Dairy / Agro Meat"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input
                placeholder="+8801..."
                value={customerContact}
                onChange={(e) => setCustomerContact(e.target.value)}
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
              <Label className="text-xs">Delivery Date</Label>
              <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="h-8 text-xs mt-1" />
            </div>
          </div>

          <div className="space-y-1.5 pt-1 border-t border-border/60">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Line Items</Label>
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

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Tax Rate (%)</Label>
              <Input type="number" placeholder="0" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="h-8 text-xs mt-1" />
            </div>
            <div>
              <Label className="text-xs">Discount (৳)</Label>
              <Input type="number" placeholder="0" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} className="h-8 text-xs mt-1" />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="h-8 text-xs font-semibold">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Create Sale
            </Button>
          </DialogFooter>
        </form>

            Create Sale Order (SO)
          </DialogTitle>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

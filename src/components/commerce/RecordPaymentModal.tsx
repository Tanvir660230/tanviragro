"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Receipt, Loader2 } from "lucide-react";
import { recordCommercePaymentAction } from "@/app/dashboard/(app)/commerce/actions";
import { toast } from "sonner";
import type { CommerceInvoice, PaymentMethod, PaymentType } from "@/lib/commerce";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedInvoice?: CommerceInvoice | null;
  onSuccess?: () => void;
}

export function RecordPaymentModal({ open, onOpenChange, selectedInvoice, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [counterpartyName, setCounterpartyName] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("receipt");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [referenceTxnId, setReferenceTxnId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (selectedInvoice) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCounterpartyName(selectedInvoice.customerOrVendorName);
      setAmount(String(selectedInvoice.balanceDue));
      setPaymentType(selectedInvoice.invoiceType.includes("purchase") ? "disbursement" : "receipt");
    }
  }, [selectedInvoice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast.error("Valid amount is required");
      return;
    }

    setLoading(true);
    try {
      const res = await recordCommercePaymentAction({
        invoiceId: selectedInvoice?.id,
        paymentType,
        paymentMethod,
        amount: numAmount,
        paymentDate,
        counterpartyName: counterpartyName || "Counterparty",
        referenceTxnId,
        notes,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Payment recorded successfully");
        onOpenChange(false);
        onSuccess?.();
      }
    } catch {
      toast.error("Failed to record payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Party Name</Label>
              <Input
                placeholder="Name"
                value={counterpartyName}
                onChange={(e) => setCounterpartyName(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Settlement Amount (৳) *</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="h-8 text-xs mt-1 font-bold text-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Payment Type</Label>
              <Select value={paymentType} onValueChange={(v) => setPaymentType(v as PaymentType)}>
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receipt">Customer Receipt (Inflow)</SelectItem>
                  <SelectItem value="disbursement">Vendor Payment (Outflow)</SelectItem>
                  <SelectItem value="installment">Installment Payout</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash on Hand</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="bKash">bKash</SelectItem>
                  <SelectItem value="Nagad">Nagad</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Payment Date</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="h-8 text-xs mt-1" />
            </div>
            <div>
              <Label className="text-xs">Reference / Txn ID</Label>
              <Input placeholder="Txn Ref" value={referenceTxnId} onChange={(e) => setReferenceTxnId(e.target.value)} className="h-8 text-xs mt-1" />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="h-8 text-xs font-semibold">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Save Payment
            </Button>
          </DialogFooter>
        </form>

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Receipt className="h-4 w-4 text-amber-600" />
            Record Commercial Payment / Settlement
          </DialogTitle>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

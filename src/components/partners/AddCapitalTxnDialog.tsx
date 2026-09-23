"use client";

import { useActionState, useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { addPartnerTransaction } from "@/app/dashboard/(app)/partners/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AddCapitalTxnDialog({
  open,
  setOpen,
  partners,
}: {
  open: boolean;
  setOpen: (o: boolean) => void;
  partners: { id: string; name: string }[];
}) {
  const [txnType, setTxnType] = useState<"investment" | "withdrawal">("investment");
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [state, action, pending] = useActionState(addPartnerTransaction, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Transaction saved");
      setTimeout(() => {
        setOpen(false);
        setSelectedPartnerId("");
        setTxnType("investment");
      }, 0);
    }
    if (state?.error) toast.error(state.error);
  }, [state, setOpen]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ size: "sm" }), "gap-1.5 text-xs h-9")}>
        <Plus className="h-4 w-4" />
        Add Transaction
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Capital Transaction</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>
              Partner <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedPartnerId}
              onValueChange={(v) => setSelectedPartnerId(v ?? "")}
            >
              <SelectTrigger>
                <span>
                  {partners.find((p) => p.id === selectedPartnerId)?.name ?? "Select partner"}
                </span>
              </SelectTrigger>
              <SelectContent>
                {partners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="partner_id" value={selectedPartnerId} />
          </div>

          <div className="space-y-1.5">
            <Label>
              Transaction Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={txnType}
              onValueChange={(v) => setTxnType((v ?? "investment") as "investment" | "withdrawal")}
            >
              <SelectTrigger>
                <span>
                  {txnType === "investment"
                    ? "Capital In (Deposit)"
                    : "Capital Out (Withdrawal)"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="investment">Capital In (Deposit)</SelectItem>
                <SelectItem value="withdrawal">Capital Out (Withdrawal)</SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" name="type" value={txnType} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cl-amount">
              Amount (৳) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cl-amount"
              name="amount"
              type="number"
              step="1"
              min="1"
              required
              placeholder="e.g. 50000"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cl-date">
              Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cl-date"
              name="recorded_at"
              type="date"
              required
              defaultValue={today}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cl-notes">Notes</Label>
            <Textarea
              id="cl-notes"
              name="notes"
              rows={2}
              placeholder="Optional notes (e.g. Bank transfer ref)"
            />
          </div>

          {state?.error && (
            <p className="text-xs text-destructive font-medium">{state.error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={pending || !selectedPartnerId}
            >
              {pending ? "Saving..." : "Save Transaction"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

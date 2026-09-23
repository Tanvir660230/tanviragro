"use client";

import { useActionState, useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { createVendor } from "@/app/dashboard/(app)/vendors/actions";
import type { VendorType } from "@/types/database";
import type { Dictionary } from "@/i18n/getDictionary";
import { toast } from "sonner";

export function CreateVendorDialog({
  open,
  setOpen,
  t,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  t: Dictionary;
}) {
  const [vendorType, setVendorType] = useState<VendorType>("cattle");
  const [state, formAction, isPending] = useActionState(createVendor, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Vendor saved");
      setOpen(false);
    }
    if (state?.error) toast.error(state.error);
  }, [state, setOpen]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={cn(buttonVariants({ size: "sm" }), "h-9 gap-1.5 text-xs font-semibold")}
      >
        <Plus className="h-4 w-4" />
        {t.vendors.add_vendor}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.vendors.new_vendor}</DialogTitle>
        </DialogHeader>
        <form
          action={(fd) => {
            fd.set("type", vendorType);
            formAction(fd);
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="vname">
              {t.vendors.name} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="vname"
              name="name"
              required
              placeholder="e.g. Hasan Cattle Farm"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t.vendors.type}</Label>
            <Select
              value={vendorType}
              onValueChange={(v) => setVendorType(v as VendorType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cattle">{t.vendors.cattle}</SelectItem>
                <SelectItem value="feed">{t.vendors.feed}</SelectItem>
                <SelectItem value="medicine">{t.vendors.medicine}</SelectItem>
                <SelectItem value="other">{t.vendors.other}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vphone">{t.vendors.phone}</Label>
            <Input id="vphone" name="phone" type="tel" placeholder="01711-XXXXXX" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vaddr">{t.vendors.address}</Label>
            <Input id="vaddr" name="address" placeholder="e.g. Pabna, Bangladesh" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vnotes">{t.vendors.notes}</Label>
            <Textarea
              id="vnotes"
              name="notes"
              rows={2}
              placeholder="Optional notes about supplier..."
            />
          </div>

          {state?.error && (
            <p className="text-sm text-destructive font-medium">{state.error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {t.vendors.cancel}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t.vendors.saving : t.vendors.save}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

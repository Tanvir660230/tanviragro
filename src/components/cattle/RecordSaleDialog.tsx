"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, BadgeDollarSign } from "lucide-react";
import {
  recordSale,
  type SaleFormState,
} from "@/app/dashboard/(app)/cattle/[id]/actions";
import { useTranslation } from "@/i18n/I18nProvider";
import { toast } from "sonner";

function SaleForm({
  cattleId,
  currentWeight,
  formKey,
  onSuccess,
}: {
  cattleId: string;
  currentWeight: number;
  formKey: number;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const today = new Date().toISOString().split("T")[0];
  const [state, formAction, isPending] = useActionState<
    SaleFormState,
    FormData
  >(recordSale, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Sale recorded");
      onSuccess();
      router.refresh();
    }
    if (state?.error) toast.error(state.error);
  }, [state?.success, state?.error, onSuccess, router]);

  return (
    <form key={formKey} action={formAction} className="space-y-4 pt-1">
      <input type="hidden" name="cattle_id" value={cattleId} />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="sale_date">{t.cattle_details.dialogs.sale_date}</Label>
          <Input
            id="sale_date"
            name="sold_at"
            type="date"
            max={today}
            defaultValue={today}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sale_weight">{t.cattle_details.dialogs.final_weight}</Label>
          <Input
            id="sale_weight"
            name="weight_at_sale_kg"
            type="number"
            min="1"
            step="0.1"
            defaultValue={currentWeight}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sale_price">{t.cattle_details.dialogs.sale_price}</Label>
        <Input
          id="sale_price"
          name="sale_price_total"
          type="number"
          min="1"
          step="1"
          placeholder="e.g. 120000"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sale_buyer">{t.cattle_details.dialogs.buyer_name}</Label>
        <Input
          id="sale_buyer"
          name="buyer_name"
          placeholder="Optional"
        />
      </div>

      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
        This will mark the cattle as <strong>{t.cattle_details.dialogs.sold}</strong> and cannot be undone.
      </div>

      {state?.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <DialogFooter>
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t.cattle_details.dialogs.recording}
            </>
          ) : (
            t.cattle_details.dialogs.record_sale
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function RecordSaleDialog({
  cattleId,
  currentWeight,
}: {
  cattleId: string;
  currentWeight: number;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setFormKey((k) => k + 1);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        className={buttonVariants({ size: "sm", variant: "outline" })}
        aria-label={t.cattle_details.dialogs.record_sale}
      >
        <BadgeDollarSign className="mr-1.5 h-4 w-4" />
        {t.cattle_details.dialogs.record_sale}
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t.cattle_details.dialogs.record_sale}</DialogTitle>
        </DialogHeader>
        <SaleForm
          cattleId={cattleId}
          currentWeight={currentWeight}
          formKey={formKey}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useActionState, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Store, Phone, MapPin, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createVendor, deleteVendor } from "@/app/dashboard/(app)/vendors/actions";
import type { Vendor, VendorType } from "@/types/database";
import { useTranslation } from "@/i18n/I18nProvider";
import type { Dictionary } from "@/i18n/getDictionary";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

const TYPE_LABEL = (t: Dictionary) => ({
  cattle: t.vendors.cattle,
  feed: t.vendors.feed,
  medicine: t.vendors.medicine,
  other: t.vendors.other,
});

const TYPE_COLOR: Record<VendorType, string> = {
  cattle: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  feed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  medicine: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  other: "bg-muted text-muted-foreground",
};

type EnrichedVendor = Vendor & {
  cattleCount: number;
  totalPurchase: number;
  itemCount: number;
};

export function VendorList({ vendors }: { vendors: EnrichedVendor[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [vendorType, setVendorType] = useState<VendorType>("cattle");
  const [search, setSearch] = useState("");
  const [state, formAction, isPending] = useActionState(createVendor, undefined);

  const filteredVendors = vendors.filter(v =>
    !search ||
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.phone?.includes(search) ||
    v.type.includes(search.toLowerCase())
  );

  useEffect(() => {
    if (state?.success) { 
      toast.success("Vendor saved"); 
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false); 
    }
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <div className="space-y-4">
      {/* Add vendor button */}
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className={cn(buttonVariants(), "gap-1.5")}>
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
                <Input id="vname" name="name" placeholder={t.vendors.name} required />
              </div>

              <div className="space-y-1.5">
                <Label>{t.vendors.type}</Label>
                <Select value={vendorType} onValueChange={(v) => setVendorType(v as VendorType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABEL(t)) as VendorType[]).map((type) => (
                      <SelectItem key={type} value={type}>
                        {TYPE_LABEL(t)[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="vphone">{t.vendors.phone}</Label>
                <Input id="vphone" name="phone" placeholder="01xxxxxxxxx" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="vaddress">{t.vendors.address}</Label>
                <Input id="vaddress" name="address" placeholder={t.vendors.address} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="vnotes">{t.vendors.notes}</Label>
                <Textarea id="vnotes" name="notes" rows={2} maxLength={500} />
              </div>

              {state?.error && (
                <p className="text-sm text-destructive">{state.error}</p>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t.vendors.cancel}
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? t.vendors.saving : t.vendors.save}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search — only show when there are vendors */}
      {vendors.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${vendors.length} vendors…`}
            className="w-full rounded-xl border border-border bg-muted/30 pl-9 pr-8 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {vendors.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-10 text-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted/50">
            <Store className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold">{t.vendors.no_vendors}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t.vendors.no_vendors_desc}</p>
          </div>
        </div>
      ) : filteredVendors.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <Search className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No vendors match &ldquo;{search}&rdquo;</p>
          <button onClick={() => setSearch("")} className="text-xs text-primary hover:underline">Clear search</button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVendors.map((v) => (
            <VendorCard key={v.id} vendor={v} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function VendorCard({ vendor: v, t }: { vendor: EnrichedVendor; t: Dictionary }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setConfirm(false);
    startTransition(async () => {
      const result = await deleteVendor(v.id);
      if (result?.error) toast.error(result.error);
      else { toast.success(`"${v.name}" deleted`); router.refresh(); }
    });
  }

  return (
    <>
    <div className="rounded-xl bg-card p-4 border border-border/60 shadow-card space-y-3 relative">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm truncate">{v.name}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLOR[v.type]}`}>
              {TYPE_LABEL(t)[v.type]}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConfirm(true)}
          disabled={isPending}
          className="text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Delete vendor"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      </div>

      {v.phone && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Phone className="h-3.5 w-3.5 shrink-0" />
          <span>{v.phone}</span>
        </div>
      )}

      {v.address && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{v.address}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-3 border-t border-border pt-3 text-xs">
        {v.cattleCount > 0 && (
          <div>
            <p className="text-muted-foreground">{t.vendors.cattle_bought}</p>
            <p className="font-semibold">{v.cattleCount}</p>
          </div>
        )}
        {v.totalPurchase > 0 && (
          <div>
            <p className="text-muted-foreground">{t.vendors.total_spent}</p>
            <p className="font-semibold">৳{v.totalPurchase.toLocaleString("en-IN")}</p>
          </div>
        )}
        {v.itemCount > 0 && (
          <div>
            <p className="text-muted-foreground">{t.vendors.inventory_items}</p>
            <p className="font-semibold">{v.itemCount}</p>
          </div>
        )}
        {v.cattleCount === 0 && v.itemCount === 0 && (
          <p className="text-muted-foreground">{t.vendors.no_txns}</p>
        )}
      </div>

      {v.notes && (
        <p className="text-xs text-muted-foreground italic">{v.notes}</p>
      )}
    </div>

    <ConfirmDialog
      open={confirm}
      title={`Delete "${v.name}"`}
      description="Delete this vendor permanently? This cannot be undone."
      confirmLabel="Delete"
      destructive
      onConfirm={handleDelete}
      onCancel={() => setConfirm(false)}
    />
    </>
  );
}

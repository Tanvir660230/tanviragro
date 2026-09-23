"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Phone, MapPin, Loader2 } from "lucide-react";
import { deleteVendor } from "@/app/dashboard/(app)/vendors/actions";
import type { Dictionary } from "@/i18n/getDictionary";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EnrichedVendor, TYPE_COLOR, TYPE_LABEL, fmtBdt } from "./vendor-types";

export function VendorCard({ vendor: v, t }: { vendor: EnrichedVendor; t: Dictionary }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setConfirm(false);
    startTransition(async () => {
      const result = await deleteVendor(v.id);
      if (result?.error) toast.error(result.error);
      else {
        toast.success(`"${v.name}" deleted`);
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="group relative rounded-xl border border-border/70 bg-card p-4 shadow-sm hover:border-border hover:shadow-md transition-all flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold mb-1.5 ${
                  TYPE_COLOR[v.type]
                }`}
              >
                {TYPE_LABEL(t)[v.type]}
              </span>
              <h3 className="text-sm font-bold text-foreground truncate">{v.name}</h3>
            </div>
            <button
              type="button"
              onClick={() => setConfirm(true)}
              disabled={isPending}
              className="text-muted-foreground hover:text-destructive transition-colors p-1 -mr-1 rounded-md"
              aria-label={`Delete ${v.name}`}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="mt-2.5 space-y-1 text-xs text-muted-foreground">
            {v.phone && (
              <div className="flex items-center gap-1.5 font-mono">
                <Phone className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                <a href={`tel:${v.phone}`} className="hover:text-primary hover:underline truncate">
                  {v.phone}
                </a>
              </div>
            )}
            {v.address && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                <span className="truncate">{v.address}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border/40">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-muted/40 p-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase">
                {v.type === "cattle" ? "Cattle Supplied" : "Items Sourced"}
              </p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">
                {v.type === "cattle" ? `${v.cattleCount || 0} heads` : `${v.itemCount || 0} items`}
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 p-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase">
                Total Sourcing
              </p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {fmtBdt(v.totalPurchase || 0)}
              </p>
            </div>
          </div>

          {v.notes && (
            <p className="mt-2 text-[11px] text-muted-foreground italic border-l-2 border-primary/40 pl-2 line-clamp-2">
              {v.notes}
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title={`Delete "${v.name}"`}
        description="Delete this vendor permanently? Existing procurement transactions will remain preserved."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}

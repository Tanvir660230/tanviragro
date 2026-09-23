"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { deleteVendor } from "@/app/dashboard/(app)/vendors/actions";
import type { Dictionary } from "@/i18n/getDictionary";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EnrichedVendor, TYPE_COLOR, TYPE_LABEL, fmtBdt } from "./vendor-types";

export function VendorTableRow({
  vendor: v,
  t,
}: {
  vendor: EnrichedVendor;
  t: Dictionary;
}) {
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
      <tr className="hover:bg-muted/30 transition-colors">
        <td className="px-4 py-3 font-semibold text-foreground">{v.name}</td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${
              TYPE_COLOR[v.type]
            }`}
          >
            {TYPE_LABEL(t)[v.type]}
          </span>
        </td>
        <td className="px-4 py-3 font-mono text-muted-foreground">
          {v.phone ? (
            <a href={`tel:${v.phone}`} className="hover:text-primary hover:underline">
              {v.phone}
            </a>
          ) : (
            "—"
          )}
        </td>
        <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate">
          {v.address || "—"}
        </td>
        <td className="px-4 py-3 text-right font-medium tabular-nums">
          {v.cattleCount > 0 ? `${v.cattleCount} heads` : "—"}
        </td>
        <td className="px-4 py-3 text-right font-medium tabular-nums">
          {v.itemCount > 0 ? v.itemCount : "—"}
        </td>
        <td className="px-4 py-3 text-right font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
          {v.totalPurchase > 0 ? fmtBdt(v.totalPurchase) : "—"}
        </td>
        <td className="px-4 py-3 text-right">
          <button
            type="button"
            onClick={() => setConfirm(true)}
            disabled={isPending}
            className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-md"
            aria-label={`Delete ${v.name}`}
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        </td>
      </tr>

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

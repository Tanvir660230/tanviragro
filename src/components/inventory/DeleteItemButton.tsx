"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { deleteInventoryItem } from "@/app/dashboard/(app)/inventory/actions";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

export function DeleteItemButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  const handleConfirm = () => {
    setConfirm(false);
    startTransition(async () => {
      const result = await deleteInventoryItem(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`"${name}" deleted`);
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-destructive"
        disabled={isPending}
        onClick={() => setConfirm(true)}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </Button>

      <ConfirmDialog
        open={confirm}
        title={`Delete "${name}"`}
        description="Delete this item and all its transaction history? This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { deleteCattle } from "@/app/dashboard/(app)/cattle/actions";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

export function DeleteCattleButton({ id }: { id: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  const handleConfirm = () => {
    setConfirm(false);
    startTransition(async () => {
      const result = await deleteCattle(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Cattle deleted");
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
        onClick={() => setConfirm(true)}
        disabled={isPending}
        aria-label="Delete cattle"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </Button>

      <ConfirmDialog
        open={confirm}
        title="Delete Cattle"
        description="Delete this cattle record permanently? This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}

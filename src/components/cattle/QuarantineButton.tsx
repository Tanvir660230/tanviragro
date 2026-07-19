"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, ShieldAlert } from "lucide-react";
import { toggleQuarantine } from "@/app/dashboard/(app)/cattle/[id]/actions";

export function QuarantineButton({ cattleId, isQuarantined }: { cattleId: string; isQuarantined: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      const result = await toggleQuarantine(cattleId, !isQuarantined);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(isQuarantined ? "Removed from quarantine" : "Moved to quarantine");
        router.refresh();
      }
    });
  };

  return (
    <button
      disabled={isPending}
      className={cn(
        buttonVariants({ size: "sm", variant: isQuarantined ? "default" : "outline" }),
        isQuarantined ? "bg-amber-500 hover:bg-amber-600 text-white" : "text-amber-600 border-amber-200 hover:bg-amber-50"
      )}
      onClick={handleToggle}
    >
      {isPending ? (
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
      ) : (
        <ShieldAlert className="mr-1.5 h-4 w-4" />
      )}
      {isQuarantined ? "In Quarantine" : "Quarantine"}
    </button>
  );
}

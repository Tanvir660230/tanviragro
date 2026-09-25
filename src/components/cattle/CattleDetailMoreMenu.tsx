"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MoreHorizontal, ShieldAlert, Moon, Skull, Printer,
  RotateCcw, AlertTriangle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toggleQuarantine } from "@/app/dashboard/(app)/cattle/[id]/actions";
import {
  toggleQurbaniMark,
  markAsDeceased,
  undoMarkAsDeceased,
} from "@/app/dashboard/(app)/cattle/actions";

import type { CattleStatus } from "@/types/database";
import { useL } from "@/i18n/text";

interface Props {
  cattleId:      string;
  tagId:         string;
  status:        CattleStatus;
  isQuarantined: boolean;
  isQurbani:     boolean;
}

type Confirm = "dead" | null;

export function CattleDetailMoreMenu({
  cattleId,
  tagId,
  status,
  isQuarantined,
  isQurbani,
}: Props) {
  const L = useL();
  const router = useRouter();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string } | undefined | void>) {
    startTransition(async () => {
      const result = await action();
      if (result && "error" in result && result.error) {
        toast.error(result.error as string);
      } else {
        router.refresh();
      }
    });
  }

  const handleQuarantine = () => {
    run(async () => {
      const r = await toggleQuarantine(cattleId, !isQuarantined);
      toast.success(isQuarantined ? L("আবার দলে ফিরল", "Removed from quarantine") : L("আলাদা রাখা হলো", "Moved to quarantine"));
      return r;
    });
  };

  const handleQurbani = () => {
    run(async () => {
      const next = !isQurbani;
      const r = await toggleQurbaniMark(cattleId, next);
      toast.success(next ? L("কোরবানির জন্য বাছাই হলো", "Marked for Qurbani") : L("কোরবানি থেকে সরানো হলো", "Qurbani mark removed"));
      return r;
    });
  };

  const handleMarkDead = () => {
    run(async () => {
      const r = await markAsDeceased(cattleId);
      toast.success(L(`#${tagId} মৃত হিসেবে লেখা হলো`, `#${tagId} marked as deceased`));
      setConfirm(null);
      return r;
    });
  };

  const handleUndoDead = () => {
    run(async () => {
      const r = await undoMarkAsDeceased(cattleId);
      toast.success(L(`#${tagId} আবার সক্রিয়`, `#${tagId} restored to active`));
      return r;
    });
  };

  return (
    <>
      {/* Inline confirm overlay — appears when user selects "Mark as Dead" */}
      {confirm === "dead" && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
          <span className="text-xs text-destructive font-medium whitespace-nowrap">{L("নিশ্চিত?", "Confirm?")}</span>
          <button
            onClick={handleMarkDead}
            disabled={isPending}
            className="rounded px-2 py-0.5 text-xs font-semibold bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50 transition-colors"
          >
            {isPending ? "…" : L("হ্যাঁ", "Yes")}
          </button>
          <button
            onClick={() => setConfirm(null)}
            disabled={isPending}
            className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {L("বাতিল", "Cancel")}
          </button>
        </div>
      )}

      {/* More dropdown */}
      {confirm === null && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={L("আরও", "More actions")}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground",
              "hover:bg-muted hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isPending && "opacity-50 pointer-events-none"
            )}
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52">
            {/* Quarantine — active/stolen only */}
            {status !== "sold" && status !== "dead" && (
              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={handleQuarantine}>
                <ShieldAlert className={cn(
                  "h-4 w-4",
                  isQuarantined ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                )} />
                {isQuarantined ? L("দলে ফেরত আনুন", "Remove from quarantine") : L("আলাদা রাখুন", "Move to quarantine")}
              </DropdownMenuItem>
            )}

            {/* Qurbani — active only */}
            {status === "active" && (
              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={handleQurbani}>
                <Moon className={cn(
                  "h-4 w-4",
                  isQurbani ? "text-primary" : "text-muted-foreground"
                )} />
                {isQurbani ? L("কোরবানি থেকে সরান", "Remove Qurbani mark") : L("কোরবানির জন্য বাছুন", "Mark for Qurbani")}
              </DropdownMenuItem>
            )}

            {/* Mark as Dead — active only */}
            {status === "active" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                  onClick={() => setConfirm("dead")}
                >
                  <Skull className="h-4 w-4" />
                  {L("মৃত লিখুন", "Mark as Dead")}
                </DropdownMenuItem>
              </>
            )}

            {/* Undo dead — dead only */}
            {status === "dead" && (
              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={handleUndoDead}>
                <RotateCcw className="h-4 w-4 text-muted-foreground" />
                {L("আবার সক্রিয় করুন", "Restore to Active")}
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            {/* Print */}
            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => window.print()}>
              <Printer className="h-4 w-4 text-muted-foreground" />
              {L("প্রিন্ট / এক্সপোর্ট", "Print / Export")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}

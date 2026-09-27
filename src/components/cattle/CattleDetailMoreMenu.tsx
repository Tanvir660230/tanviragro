"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MoreHorizontal, ShieldAlert, Moon, Skull, Printer,
  RotateCcw,
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
  undoMarkAsDeceased,
} from "@/app/dashboard/(app)/cattle/actions";

import type { CattleStatus } from "@/types/database";
import { useL } from "@/i18n/text";
import { useTranslation } from "@/i18n/I18nProvider";
import { DeathDialog } from "./DeathDialog";

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
  const { locale } = useTranslation();
  const router = useRouter();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [isPending, startTransition] = useTransition();

  /** runs an action; the success message only when it really worked */
  function run(action: () => Promise<{ error?: string } | undefined | void>, ok: string) {
    startTransition(async () => {
      const result = await action().catch(() => ({ error: L("সমস্যা হয়েছে — কিছু বদলায়নি", "Something went wrong — nothing changed") }));
      if (result && "error" in result && result.error) {
        toast.error(result.error as string);
      } else {
        toast.success(ok);
        router.refresh();
      }
    });
  }

  const handleQuarantine = () =>
    run(() => toggleQuarantine(cattleId, !isQuarantined), isQuarantined ? L("আবার দলে ফিরল", "Removed from quarantine") : L("আলাদা রাখা হলো", "Moved to quarantine"));

  const handleQurbani = () =>
    run(() => toggleQurbaniMark(cattleId, !isQurbani), !isQurbani ? L("কোরবানির জন্য বাছাই হলো", "Marked for Qurbani") : L("কোরবানি থেকে সরানো হলো", "Qurbani mark removed"));

  const handleUndoDead = () =>
    run(() => undoMarkAsDeceased(cattleId), L(`#${tagId} আবার সক্রিয়`, `#${tagId} restored to active`));

  return (
    <>
      {/* the one "mark dead" form: date and cause */}
      {confirm === "dead" && (
        <DeathDialog animals={[{ id: cattleId, tag: tagId }]} lang={locale === "bn" ? "bn" : "en"} onClose={() => setConfirm(null)} />
      )}

      {/* More dropdown */}
      {(
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
            {status === "active" && (
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

            {/* Died or stolen — active only */}
            {status === "active" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                  onClick={() => setConfirm("dead")}
                >
                  <Skull className="h-4 w-4" />
                  {L("মারা গেছে / চুরি", "Died or stolen")}
                </DropdownMenuItem>
              </>
            )}

            {/* Undo dead / stolen (recorded by mistake, or it came back) */}
            {(status === "dead" || status === "stolen") && (
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

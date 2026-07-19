"use client";

import { useState } from "react";
import { MoreHorizontal, Download, Banknote, CalendarCheck, Scale } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BulkCostDialog } from "./BulkCostDialog";
import { BulkHealthEventDialog } from "./BulkHealthEventDialog";
import { BulkWeightDialog } from "./BulkWeightDialog";

interface CattleOption {
  id:     string;
  tag_id: string;
}

interface Props {
  activeCattle: CattleOption[];
  defaultOpenWeigh?: boolean;
}

type OpenDialog = "cost" | "health" | "weight" | null;

export function CattleActionsMenu({ activeCattle, defaultOpenWeigh }: Props) {
  const router = useRouter();
  const [openDialog, setOpenDialog] = useState<OpenDialog>(
    defaultOpenWeigh ? "weight" : null
  );

  if (activeCattle.length === 0) return null;

  return (
    <>
      {/* Dialogs — rendered outside dropdown, controlled by state */}
      <BulkWeightDialog
        cattle={activeCattle}
        open={openDialog === "weight"}
        onOpenChange={(v) => setOpenDialog(v ? "weight" : null)}
      />
      <BulkCostDialog
        activeCattle={activeCattle}
        open={openDialog === "cost"}
        onOpenChange={(v) => setOpenDialog(v ? "cost" : null)}
      />
      <BulkHealthEventDialog
        activeCattle={activeCattle}
        open={openDialog === "health"}
        onOpenChange={(v) => setOpenDialog(v ? "health" : null)}
      />

      {/* Weigh — visible button (most frequent action) */}
      <button
        onClick={() => setOpenDialog("weight")}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border/70 bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors"
      >
        <Scale className="h-4 w-4" />
        <span className="hidden sm:inline">Weigh</span>
      </button>

      {/* More actions — dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="More actions"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            className="gap-2 cursor-pointer"
            onClick={() => setOpenDialog("cost")}
          >
            <Banknote className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Batch Cost Entry
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2 cursor-pointer"
            onClick={() => setOpenDialog("health")}
          >
            <CalendarCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Batch Health Event
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 cursor-pointer"
            onClick={() => router.push("/dashboard/cattle/export")}
          >
            <Download className="h-4 w-4 text-muted-foreground" />
            Export CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

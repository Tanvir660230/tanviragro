"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Skull, Lock, ChevronRight, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CATTLE_STATUS_STYLE } from "@/constants/status";
import { LifecycleEngine } from "@/lib/livestock/lifecycle-engine";
import { executeLifecycleTransitionAction } from "@/app/dashboard/(app)/cattle/lifecycle-actions";
import type { CattleStatus, UserRole } from "@/types/database";

interface Props {
  cattleId: string;
  tagId: string;
  currentStatus: CattleStatus;
  userRole?: UserRole;
  onTransitionSuccess?: () => void;
}

export function AnimalLifecycleController({
  cattleId,
  tagId,
  currentStatus,
  userRole = "owner",
  onTransitionSuccess,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedTarget, setSelectedTarget] = useState<CattleStatus | null>(null);

  const allowedTransitions = LifecycleEngine.getAllowedNextStates(currentStatus, userRole);

  const handleExecuteTransition = (target: CattleStatus) => {
    startTransition(async () => {
      const res = await executeLifecycleTransitionAction({
        cattleId,
        targetStatus: target,
        actorRole: userRole,
        actorId: "current_user",
      });

      if (res.success) {
        toast.success(`Animal #${tagId} transitioned to ${target.toUpperCase()}`);
        if (res.automatedActionsExecuted.length > 0) {
          toast.info(res.automatedActionsExecuted.join(" • "));
        }
        router.refresh();
        onTransitionSuccess?.();
      } else {
        toast.error(res.error || "Failed to execute state transition.");
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold capitalize shadow-2xs tracking-wide",
          CATTLE_STATUS_STYLE[currentStatus] ?? CATTLE_STATUS_STYLE.active
        )}
      >
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
              currentStatus === "active" ? "bg-emerald-400" : "bg-zinc-400"
            )}
          />
          <span
            className={cn(
              "relative inline-flex rounded-full h-2 w-2",
              currentStatus === "active" ? "bg-emerald-500" : "bg-zinc-500"
            )}
          />
        </span>
        {currentStatus}
      </span>

      {allowedTransitions.length > 0 && currentStatus !== "archived" && (
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={isPending}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border/80 bg-background text-xs font-medium shadow-2xs hover:bg-accent transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span>{isPending ? "Updating..." : "Change State"}</span>
            <ChevronRight className="h-3 w-3 opacity-60 ml-0.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-1.5">
            <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1">
              Allowed Next States
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {allowedTransitions.map((t) => (
              <DropdownMenuItem
                key={t.status}
                disabled={t.disabled || isPending}
                onClick={() => !t.disabled && handleExecuteTransition(t.status)}
                className="flex items-start justify-between py-2 px-2.5 cursor-pointer rounded-md focus:bg-accent/80"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        t.status === "active" && "bg-emerald-500",
                        t.status === "sold" && "bg-amber-500",
                        t.status === "dead" && "bg-rose-500",
                        t.status === "quarantined" && "bg-orange-500",
                        t.status === "culled" && "bg-zinc-500",
                        t.status === "archived" && "bg-slate-500"
                      )}
                    />
                    {t.labelEn}
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    {t.description}
                  </p>
                </div>
                {t.disabled && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
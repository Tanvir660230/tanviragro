"use client";

import { useEffect, useState, useTransition } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useOffline } from "@/hooks/useOffline";
import { getAllQueued, removeQueued } from "@/lib/offlineQueue";
import { createWeightLog } from "@/app/dashboard/(app)/cattle/[id]/actions";
import { logConsumption } from "@/app/dashboard/(app)/inventory/actions";

export function OfflineBanner() {
  const isOffline = useOffline();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, startSync] = useTransition();

  // Refresh pending count when going back online
  useEffect(() => {
    async function refreshCount() {
      const { countQueued } = await import("@/lib/offlineQueue");
      const n = await countQueued();
      setPendingCount(n);
    }
    refreshCount();

    window.addEventListener("online", refreshCount);
    window.addEventListener("offline", refreshCount);
    return () => {
      window.removeEventListener("online", refreshCount);
      window.removeEventListener("offline", refreshCount);
    };
  }, []);

  async function syncNow() {
    const queue = await getAllQueued();
    if (queue.length === 0) return;

    let synced = 0;
    let failed = 0;

    for (const mutation of queue) {
      try {
        const fd = new FormData();
        if (mutation.type === "weight-log") {
          fd.set("cattle_id", mutation.cattle_id);
          fd.set("weight_kg", String(mutation.weight_kg));
          fd.set("recorded_at", mutation.recorded_at);
          if (mutation.notes) fd.set("notes", mutation.notes);
          if (mutation.girth_cm != null) fd.set("girth_cm", String(mutation.girth_cm));
          if (mutation.length_cm != null) fd.set("length_cm", String(mutation.length_cm));
          const result = await createWeightLog(undefined, fd);
          if (!result?.error) {
            await removeQueued(mutation.id);
            synced++;
          } else {
            failed++;
          }
        } else if (mutation.type === "consumption") {
          fd.set("item_id", mutation.item_id);
          fd.set("qty", String(mutation.qty));
          fd.set("recorded_at", mutation.recorded_at);
          if (mutation.cattle_id) fd.set("cattle_id", mutation.cattle_id);
          if (mutation.notes) fd.set("notes", mutation.notes);
          const result = await logConsumption(undefined, fd);
          if (!result?.error) {
            await removeQueued(mutation.id);
            synced++;
          } else {
            failed++;
          }
        }
      } catch {
        failed++;
      }
    }

    const remaining = queue.length - synced;
    setPendingCount(remaining);
    if (synced > 0) toast.success(`Synced ${synced} offline change${synced !== 1 ? "s" : ""}`);
    if (failed > 0) toast.error(`${failed} change${failed !== 1 ? "s" : ""} failed to sync`);
  }

  if (!isOffline && pendingCount === 0) return null;

  return (
    <div className={`print-hide fixed bottom-16 md:bottom-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-2.5 text-sm font-medium ${isOffline ? "bg-destructive text-destructive-foreground" : "bg-amber-600 dark:bg-amber-500 text-white"}`}>
      <WifiOff className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        {isOffline
          ? "You are offline — changes will be queued and synced when you reconnect."
          : `${pendingCount} offline change${pendingCount !== 1 ? "s" : ""} ready to sync.`}
      </span>
      {!isOffline && pendingCount > 0 && (
        <button
          onClick={() => startSync(syncNow)}
          disabled={syncing}
          aria-label={syncing ? "Syncing offline changes" : "Sync offline changes now"}
          className="flex items-center gap-1.5 rounded-md bg-white/20 px-2.5 py-1 text-xs font-semibold hover:bg-white/30 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      )}
    </div>
  );
}

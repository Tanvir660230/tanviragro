"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RefreshCw } from "lucide-react";

// Subscribes to Supabase Realtime on key tables and triggers a soft router.refresh()
// so Server Components re-fetch data without a full page reload.
// Also provides pull-to-refresh on mobile (touch drag down from top).
export function RealtimeRefresher() {
  const router = useRouter();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pulling, setPulling] = useState(false);
  const [pullPct, setPullPct] = useState(0);
  const touchStartY = useRef(0);
  const PULL_THRESHOLD = 72;

  useEffect(() => {
    const supabase = createClient();

    function scheduleRefresh() {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        router.refresh();
      }, 600);
    }

    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "cattle" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "weight_logs" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "cost_entries" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_transactions" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "health_events" }, scheduleRefresh)
      .subscribe();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  // Pull-to-refresh for mobile
  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 0) return;
      touchStartY.current = e.touches[0].clientY;
    }

    function onTouchMove(e: TouchEvent) {
      if (window.scrollY > 0) return;
      const dy = e.touches[0].clientY - touchStartY.current;
      if (dy > 10) {
        e.preventDefault();
        setPullPct(Math.min(dy / PULL_THRESHOLD, 1));
        setPulling(true);
      }
    }

    function onTouchEnd() {
      if (pullPct >= 1) {
        router.refresh();
      }
      setPulling(false);
      setPullPct(0);
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [router, pullPct]);

  if (!pulling) return null;

  return (
    <div
      className="fixed top-0 inset-x-0 z-[60] flex items-center justify-center pointer-events-none"
      style={{ paddingTop: `${pullPct * 56}px`, opacity: pullPct }}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-card border border-border shadow-md">
        <RefreshCw
          className="h-4 w-4 text-primary"
          style={{ transform: `rotate(${pullPct * 360}deg)` }}
        />
      </div>
    </div>
  );
}

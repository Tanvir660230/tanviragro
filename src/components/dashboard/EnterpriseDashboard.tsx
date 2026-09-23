"use client";

import React, { Suspense } from "react";
import { DashboardPersonalizationProvider } from "./engine/PersonalizationContext";
import { EnterpriseDashboardLayout, EnterpriseDashboardProps } from "./EnterpriseDashboardLayout";

export type { EnterpriseDashboardProps };

/** Loading skeleton for progressive loading */
function DashboardSectionSkeleton() {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-8 w-8 rounded-xl bg-muted" />
        <div className="space-y-1.5">
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="h-2 w-16 rounded bg-muted/60" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-muted/60" />
        <div className="h-3 w-3/4 rounded bg-muted/40" />
      </div>
    </div>
  );
}

export function EnterpriseDashboard(props: EnterpriseDashboardProps) {
  // Directly render the layout without the personalization provider to guarantee visibility
  return (
    <DashboardPersonalizationProvider>
        <Suspense fallback={<DashboardSectionSkeleton />}>
        <EnterpriseDashboardLayout {...props} />
        </Suspense>
    </DashboardPersonalizationProvider>
  );
}

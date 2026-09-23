function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-shimmer rounded-xl overflow-hidden bg-muted/60 ${className ?? ""}`} />
  );
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6 pb-12">
      {/* 1. Hero skeleton — matches DashboardHero */}
      <div className="rounded-2xl border border-border/70 shadow-card bg-card overflow-hidden p-6 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2.5">
            <Skeleton className="h-5 w-44 rounded-full" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-14 w-48 rounded-xl" />
            <Skeleton className="h-12 w-32 rounded-xl" />
          </div>
        </div>
      </div>

      {/* 2. Top-level Executive KPI cards — 4 columns */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col justify-between gap-4 rounded-2xl bg-card p-5 border border-border/70 shadow-card h-[130px]">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        ))}
      </div>

      {/* 3. Side-by-side Cash Balance and Live Valuation skeletons */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[200px] rounded-2xl" />
        <Skeleton className="h-[200px] rounded-2xl" />
      </div>

      {/* 4. Financial Performance & Business Health Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-2xl border border-border/70 bg-card p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-[240px] w-full rounded-xl" />
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-border/70 bg-card p-6 shadow-card space-y-4">
          <div className="border-b border-border/60 pb-3">
            <Skeleton className="h-5 w-36" />
          </div>
          <div className="flex items-center gap-5 py-2">
            <Skeleton className="h-28 w-28 shrink-0 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        </div>
      </div>

      {/* 5. Main content grid — Operations (8 cols) + Intelligence (4 cols) */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left operations column */}
        <div className="lg:col-span-8 space-y-6">
          {/* Quick actions tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>

          {/* Today's Tasks */}
          <Skeleton className="h-28 rounded-2xl" />

          {/* Feed & Cash Flow Forecasts */}
          <div className="grid gap-6 sm:grid-cols-2">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>

          {/* Activity Feed */}
          <div className="rounded-2xl bg-card border border-border/70 shadow-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="space-y-3 pt-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right intelligence column */}
        <div className="lg:col-span-4 space-y-6">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

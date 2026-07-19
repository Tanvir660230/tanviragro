function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-shimmer rounded overflow-hidden ${className ?? ""}`} />
  );
}

export default function DashboardLoading() {
  return (
    <div className="space-y-4">
      {/* Hero skeleton — matches DashboardHero */}
      <div className="rounded-xl border border-border/60 shadow-card bg-card overflow-hidden">
        <div className="flex flex-col gap-5 p-6 sm:p-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-12 w-56" />
            <Skeleton className="h-3.5 w-36" />
          </div>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border/50 bg-background/60 px-4 py-3 text-center min-w-[100px] space-y-1.5">
                <Skeleton className="h-2.5 w-16 mx-auto" />
                <Skeleton className="h-5 w-20 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stat cards — 4 columns */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl bg-card p-5 border border-border/60 shadow-card">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-8 w-28" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cash Balance card skeleton */}
      <Skeleton className="h-[168px] rounded-xl" />

      {/* Eid Countdown skeleton */}
      <Skeleton className="h-[180px] rounded-xl" />

      {/* Main content grid — left (2/3) + right (1/3) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Revenue chart */}
          <div className="rounded-xl bg-card border border-border/60 shadow-card">
            <div className="border-b border-border p-5">
              <Skeleton className="h-4 w-52" />
            </div>
            <div className="p-5">
              <Skeleton className="h-[220px] w-full rounded-lg" />
            </div>
          </div>

          {/* Activity feed */}
          <div className="rounded-xl bg-card border border-border/60 shadow-card">
            <div className="border-b border-border p-5">
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="space-y-4 p-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* AI Advisor */}
          <div className="rounded-xl bg-card border border-border/60 shadow-card overflow-hidden">
            <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-52" />
              </div>
            </div>
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 border-b border-border last:border-0 px-5 py-3.5">
                <Skeleton className="h-4 w-4 shrink-0 rounded" />
                <div className="flex-1 space-y-1.5">
                  <div className="flex gap-2">
                    <Skeleton className="h-4 w-16 rounded" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <Skeleton className="h-3 w-72" />
                </div>
                <Skeleton className="h-7 w-24 shrink-0 rounded-lg" />
              </div>
            ))}
          </div>

          {/* Insights panel */}
          <div className="rounded-xl bg-card p-5 border border-border/60 shadow-card space-y-3">
            <Skeleton className="h-3 w-28" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-r-lg border-l-2 border-muted px-3 py-2.5 bg-muted/30">
                <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-4 shrink-0" />
              </div>
            ))}
          </div>

          {/* Portfolio health */}
          <div className="flex flex-col gap-4 rounded-xl bg-card p-5 border border-border/60 shadow-card">
            <Skeleton className="h-3 w-32" />
            <div className="flex items-center gap-5">
              <Skeleton className="h-28 w-28 shrink-0 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-lg bg-muted/40 px-2 py-2 space-y-1">
                  <Skeleton className="h-2.5 w-full" />
                  <Skeleton className="h-4 w-10 mx-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

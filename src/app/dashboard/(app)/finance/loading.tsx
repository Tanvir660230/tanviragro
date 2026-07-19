function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-shimmer rounded overflow-hidden ${className ?? ""}`} />;
}

export default function FinanceLoading() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>

      {/* 3-tab strip */}
      <Skeleton className="h-9 w-72 rounded-lg" />

      {/* KPI grid (P&L Summary tab) */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-card p-4 border border-border/60 shadow-card space-y-2">
            <div className="flex items-start justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-4" />
            </div>
            <Skeleton className="h-7 w-28 mt-2" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Cost breakdown chips */}
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-card px-4 py-3 border border-border/60 shadow-card flex items-center justify-between gap-3">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>

      {/* Sales table skeleton */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
        <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted/40 px-4 py-3 flex gap-8">
            {["w-24", "w-16", "w-20", "w-20", "w-20", "w-20"].map((w, i) => (
              <Skeleton key={i} className={`h-3.5 ${w}`} />
            ))}
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border-b border-border last:border-0 flex items-center gap-8 px-4 py-3.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-20 ml-auto rounded-full" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 md:hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-card p-4 border border-border/60 shadow-card space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-6 w-20" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

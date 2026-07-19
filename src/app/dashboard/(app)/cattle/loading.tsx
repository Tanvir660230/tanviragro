function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-shimmer rounded overflow-hidden ${className ?? ""}`} />;
}

export default function CattleLoading() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>

      {/* Desktop table skeleton — 10 columns now */}
      <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border bg-muted/40 px-4 py-3 flex items-center gap-4">
          {["w-16", "w-20", "w-16", "w-24", "w-16", "w-20", "w-20", "w-16", "w-16", "w-14"].map((w, i) => (
            <Skeleton key={i} className={`h-3.5 ${w} shrink-0`} />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-b border-border last:border-0 px-4 py-3.5 flex items-center gap-4">
            <Skeleton className="h-4 w-16 shrink-0" />
            <Skeleton className="h-4 w-20 shrink-0" />
            <Skeleton className="h-4 w-16 shrink-0" />
            <Skeleton className="h-4 w-24 shrink-0" />
            <Skeleton className="h-4 w-16 shrink-0 ml-auto" />
            <Skeleton className="h-4 w-20 shrink-0" />
            <Skeleton className="h-4 w-12 shrink-0" />
            <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
            <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
            <div className="flex gap-1 shrink-0">
              <Skeleton className="h-7 w-7 rounded-md" />
              <Skeleton className="h-7 w-7 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* Mobile cards skeleton */}
      <div className="md:hidden space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-card p-4 border border-border/60 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-20" />
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-7 w-7 rounded-md" />
                <Skeleton className="h-7 w-7 rounded-md" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {Array.from({ length: 8 }).map((_, j) => (
                <Skeleton key={j} className="h-3.5 w-24" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

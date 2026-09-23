import { Skeleton } from "@/components/ui/skeleton";

export default function FinanceLoading() {
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-48 rounded-lg" />
          <Skeleton className="h-4 w-32 rounded" />
        </div>
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>

      {/* 3-tab strip */}
      <Skeleton className="h-10 w-80 rounded-xl" />

      {/* KPI grid (P&L Summary tab) */}
      <div className="grid gap-3.5 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-card p-4 sm:p-5 border border-border/60 shadow-card space-y-3">
            <div className="flex items-start justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-8 w-8 rounded-xl" />
            </div>
            <Skeleton className="h-7 w-28 mt-2" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Cost breakdown chips */}
      <div className="grid gap-3.5 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-card px-4 py-3.5 border border-border/60 shadow-card flex items-center justify-between gap-3">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        ))}
      </div>

      {/* Sales table skeleton */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32 rounded" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
        <div className="hidden md:block overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
          <div className="border-b border-border/50 bg-muted/20 px-5 py-3.5 flex gap-8">
            {["w-24", "w-16", "w-20", "w-20", "w-20", "w-20"].map((w, i) => (
              <Skeleton key={i} className={`h-3.5 ${w}`} />
            ))}
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border-b border-border/40 last:border-0 flex items-center gap-8 px-5 py-4">
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
            <div key={i} className="rounded-2xl bg-card p-4 border border-border/60 shadow-card space-y-2.5">
              <div className="flex justify-between">
                <Skeleton className="h-5 w-24 rounded" />
                <Skeleton className="h-6 w-20 rounded-md" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

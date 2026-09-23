import { Skeleton } from "@/components/ui/skeleton";

export default function AccountingLoading() {
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page Header Skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-36 rounded-lg" />
          <Skeleton className="h-4 w-64 rounded" />
        </div>
      </div>

      {/* Quick stats (4 KPI cards) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-card border border-border/70 shadow-card p-5 space-y-2"
          >
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-7 w-28 rounded-md" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
        ))}
      </div>

      {/* Trial balance status banner */}
      <div className="flex items-center gap-3 rounded-xl p-4 border border-border/70 bg-card">
        <Skeleton className="h-5 w-5 rounded-full shrink-0" />
        <div className="flex-1 min-w-0 space-y-1">
          <Skeleton className="h-4 w-36 rounded" />
          <Skeleton className="h-3 w-48 rounded" />
        </div>
        <Skeleton className="h-4 w-12 rounded ml-auto" />
      </div>

      {/* Financial Locks */}
      <div className="rounded-xl bg-card border border-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-40 rounded" />
        </div>
        <Skeleton className="h-3 w-3/4 max-w-md rounded" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="flex items-end gap-2 pt-1">
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3 w-32 rounded" />
            <Skeleton className="h-8 w-full rounded" />
          </div>
          <Skeleton className="h-8 w-24 rounded" />
        </div>
      </div>

      {/* Financial Reports Navigation */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-border/60" />
          <Skeleton className="h-3 w-32 rounded" />
          <div className="h-px flex-1 bg-border/60" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl bg-card border border-border/70 shadow-card p-4"
            >
              <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-3 w-48 rounded" />
              </div>
              <Skeleton className="h-4 w-4 rounded shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


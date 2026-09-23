import { Skeleton } from "@/components/ui/skeleton";

export default function CattleProfileLoading() {
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border/60 shadow-card">
        <div className="flex items-center gap-3.5">
          <Skeleton className="h-12 w-12 rounded-2xl shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-36 rounded-md" />
            <Skeleton className="h-4 w-48 rounded" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
      </div>

      {/* Info cards */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-card p-4 border border-border/60 shadow-card space-y-2">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-6 w-28 rounded-md" />
          </div>
        ))}
      </div>

      {/* Chart + stats */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl bg-card p-6 border border-border/60 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-28 rounded" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
        <div className="flex flex-col gap-3.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-card p-4 border border-border/60 shadow-card space-y-2">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-6 w-20 rounded-md" />
              <Skeleton className="h-3 w-32 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

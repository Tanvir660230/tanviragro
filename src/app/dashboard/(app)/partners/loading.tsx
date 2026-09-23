import { Skeleton } from "@/components/ui/skeleton";

export default function PartnersLoading() {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-48 rounded-lg" />
          <Skeleton className="h-4 w-52 rounded" />
        </div>
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>

      {/* Summary strip */}
      <div className="grid gap-3.5 sm:gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-card p-4 border border-border/60 shadow-card space-y-2">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-7 w-28 rounded-md" />
          </div>
        ))}
      </div>

      {/* Partner cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-card p-5 border border-border/60 shadow-card space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-32 rounded" />
                <Skeleton className="h-3.5 w-24 rounded" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="rounded-xl bg-muted/40 p-2.5 space-y-1.5">
                  <Skeleton className="h-2.5 w-full rounded" />
                  <Skeleton className="h-4 w-20 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

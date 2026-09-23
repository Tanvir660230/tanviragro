import { Skeleton } from "@/components/ui/skeleton";

export default function CattleLoading() {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-32 rounded-lg" />
          <Skeleton className="h-4 w-48 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
      </div>

      {/* Desktop table skeleton */}
      <div className="hidden md:block rounded-2xl border border-border/60 bg-card overflow-hidden shadow-card">
        <div className="border-b border-border/50 bg-muted/20 px-5 py-3.5 flex items-center gap-4">
          {["w-16", "w-20", "w-16", "w-24", "w-16", "w-20", "w-20", "w-16", "w-16", "w-14"].map((w, i) => (
            <Skeleton key={i} className={`h-3.5 ${w} shrink-0`} />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-b border-border/40 last:border-0 px-5 py-4 flex items-center gap-4">
            <Skeleton className="h-4 w-16 shrink-0 font-semibold" />
            <Skeleton className="h-4 w-20 shrink-0" />
            <Skeleton className="h-4 w-16 shrink-0" />
            <Skeleton className="h-4 w-24 shrink-0" />
            <Skeleton className="h-4 w-16 shrink-0 ml-auto" />
            <Skeleton className="h-4 w-20 shrink-0" />
            <Skeleton className="h-4 w-12 shrink-0" />
            <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
            <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
            <div className="flex gap-1.5 shrink-0">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Mobile cards skeleton */}
      <div className="md:hidden space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-card p-4 border border-border/60 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-24 rounded-md" />
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-2 border-t border-border/40">
              {Array.from({ length: 6 }).map((_, j) => (
                <Skeleton key={j} className="h-3.5 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

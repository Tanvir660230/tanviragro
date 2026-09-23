import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function MetricCardsSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-3.5 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col justify-between gap-3.5 rounded-2xl bg-card p-4 sm:p-5 border border-border/60 shadow-card"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-8 w-8 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-7 w-32" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-12 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({
  rows = 5,
  columns = 5,
  showHeader = true,
  showToolbar = true,
  className,
}: {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  showToolbar?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3.5 animate-fade-in", className)}>
      {showToolbar && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <Skeleton className="h-9 w-full sm:w-64 rounded-xl" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-xl" />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-card">
        {showHeader && (
          <div className="flex items-center gap-4 px-4 sm:px-6 py-3.5 border-b border-border/50 bg-muted/20">
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton
                key={i}
                className={cn(
                  "h-3.5 rounded",
                  i === 0 ? "w-28" : i === columns - 1 ? "w-16 ml-auto" : "w-20"
                )}
              />
            ))}
          </div>
        )}

        <div className="divide-y divide-border/40">
          {Array.from({ length: rows }).map((_, r) => (
            <div
              key={r}
              className="flex items-center gap-4 px-4 sm:px-6 py-4"
            >
              {Array.from({ length: columns }).map((_, c) => (
                <Skeleton
                  key={c}
                  className={cn(
                    "h-4 rounded",
                    c === 0
                      ? "w-36 font-semibold"
                      : c === columns - 1
                      ? "w-20 ml-auto"
                      : "w-24"
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CardGridSkeleton({
  count = 6,
  columns = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  className,
}: {
  count?: number;
  columns?: string;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 animate-fade-in", columns, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-card p-4 sm:p-5 border border-border/60 shadow-card space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-24 font-medium" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>

          <div className="space-y-2 py-2 border-y border-border/40">
            <div className="flex justify-between items-center">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3.5 w-16 font-semibold" />
            </div>
            <div className="flex justify-between items-center">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3.5 w-20 font-semibold" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-24 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6 animate-fade-in", className)}>
      <MetricCardsSkeleton count={4} />

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <div className="rounded-2xl bg-card p-5 sm:p-6 border border-border/60 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-4 w-32 font-semibold" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-8 w-24 rounded-xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>

        <div className="rounded-2xl bg-card p-5 sm:p-6 border border-border/60 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-4 w-36 font-semibold" />
              <Skeleton className="h-3 w-44" />
            </div>
            <Skeleton className="h-8 w-24 rounded-xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function DetailProfileSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6 animate-fade-in", className)}>
      {/* Header card */}
      <div className="rounded-2xl bg-card p-5 sm:p-6 border border-border/60 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-2xl shrink-0" />
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-6 w-32 font-bold" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3.5 w-48" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-xl" />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-24 rounded-xl" />
        <Skeleton className="h-9 w-24 rounded-xl" />
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>

      {/* Content grid */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <TableSkeleton rows={4} columns={4} showToolbar={false} />
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl bg-card p-5 border border-border/60 shadow-card space-y-3">
            <Skeleton className="h-4 w-28 font-semibold" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between py-1 border-b border-border/40">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3.5 w-24" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FormSkeleton({
  fieldCount = 4,
  className,
}: {
  fieldCount?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-card p-5 sm:p-6 border border-border/60 shadow-card space-y-5 animate-fade-in",
        className
      )}
    >
      <div className="space-y-1.5 border-b border-border/40 pb-4">
        <Skeleton className="h-5 w-40 font-semibold" />
        <Skeleton className="h-3.5 w-64" />
      </div>

      <div className="space-y-4">
        {Array.from({ length: fieldCount }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3.5 w-28 font-medium" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border/40">
        <Skeleton className="h-9 w-20 rounded-xl" />
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>
    </div>
  );
}

export function ListSkeleton({
  count = 5,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2.5 animate-fade-in", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-card border border-border/60 shadow-card"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32 font-medium" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-7 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

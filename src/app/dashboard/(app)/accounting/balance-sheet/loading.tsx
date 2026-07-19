function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-shimmer rounded overflow-hidden ${className ?? ""}`} />;
}

export default function BalanceSheetLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-card p-4 border border-border space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-32" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border bg-muted/40 px-4 py-3">
              <Skeleton className="h-4 w-28" />
            </div>
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="border-b border-border last:border-0 flex items-center justify-between px-4 py-3">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3.5 w-24" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

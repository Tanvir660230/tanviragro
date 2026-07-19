function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-shimmer rounded overflow-hidden ${className ?? ""}`} />;
}

export default function TeamLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-b border-border last:border-0 flex items-center gap-3 px-4 py-3.5">
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-7 w-7 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

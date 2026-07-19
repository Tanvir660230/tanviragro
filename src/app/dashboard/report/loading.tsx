function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-shimmer rounded overflow-hidden ${className ?? ""}`} />;
}

export default function ReportLoading() {
  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-900">
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-4">
        {/* Controls bar */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg ml-auto" />
        </div>

        {/* Paper sheet */}
        <div className="bg-white rounded-xl shadow-floating py-8 px-8 space-y-4">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <Skeleton className="h-6 w-52" />
              <Skeleton className="h-4 w-36" />
            </div>
            <Skeleton className="h-12 w-12 rounded-lg" />
          </div>
          <Skeleton className="h-px w-full" />

          {/* KPI row */}
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5 text-center">
                <Skeleton className="h-3 w-20 mx-auto" />
                <Skeleton className="h-7 w-28 mx-auto" />
              </div>
            ))}
          </div>
          <Skeleton className="h-px w-full" />

          {/* Table */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3.5 w-20 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

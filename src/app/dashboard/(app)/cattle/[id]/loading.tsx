export default function CattleProfileLoading() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg animate-shimmer overflow-hidden" />
        <div className="space-y-1.5">
          <div className="h-7 w-36 rounded-lg animate-shimmer overflow-hidden" />
          <div className="h-4 w-48 rounded-lg animate-shimmer overflow-hidden" />
        </div>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-card p-4 border border-border/60 shadow-card space-y-1.5">
            <div className="h-3 w-20 rounded animate-shimmer overflow-hidden" />
            <div className="h-6 w-28 rounded animate-shimmer overflow-hidden" />
          </div>
        ))}
      </div>

      {/* Weight section header */}
      <div className="flex items-center justify-between">
        <div className="h-6 w-36 rounded animate-shimmer overflow-hidden" />
        <div className="h-8 w-28 rounded-lg animate-shimmer overflow-hidden" />
      </div>

      {/* Chart + stats */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl bg-card p-6 border border-border/60 shadow-card">
          <div className="h-5 w-24 rounded animate-shimmer overflow-hidden mb-4" />
          <div className="h-52 w-full rounded-lg animate-shimmer overflow-hidden" />
        </div>
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-card p-4 border border-border/60 shadow-card space-y-1.5">
              <div className="h-3 w-24 rounded animate-shimmer overflow-hidden" />
              <div className="h-7 w-20 rounded animate-shimmer overflow-hidden" />
              <div className="h-3 w-32 rounded animate-shimmer overflow-hidden" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

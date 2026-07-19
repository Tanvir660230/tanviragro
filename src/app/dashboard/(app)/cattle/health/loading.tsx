export default function Loading() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg animate-shimmer overflow-hidden shrink-0" />
        <div className="h-10 w-10 rounded-xl animate-shimmer overflow-hidden shrink-0" />
        <div className="space-y-1.5">
          <div className="h-7 w-40 animate-shimmer rounded overflow-hidden" />
          <div className="h-4 w-28 animate-shimmer rounded overflow-hidden" />
        </div>
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-shimmer rounded-xl overflow-hidden" />
        ))}
      </div>

      {/* Filter tabs skeleton */}
      <div className="flex items-center gap-2">
        {[80, 96, 104, 72].map((w, i) => (
          <div
            key={i}
            className="h-8 animate-shimmer rounded-lg overflow-hidden shrink-0"
            style={{ width: w }}
          />
        ))}
      </div>

      {/* Event list skeleton */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="h-10 animate-shimmer border-b border-border" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0"
          >
            <div className="h-8 w-8 animate-shimmer rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-48 animate-shimmer rounded" />
              <div className="h-3.5 w-32 animate-shimmer rounded" />
            </div>
            <div className="flex gap-1">
              <div className="h-8 w-8 animate-shimmer rounded-lg" />
              <div className="h-8 w-8 animate-shimmer rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

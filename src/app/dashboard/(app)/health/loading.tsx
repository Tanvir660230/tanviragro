export default function Loading() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg animate-shimmer overflow-hidden shrink-0" />
        <div className="h-10 w-10 rounded-xl animate-shimmer overflow-hidden shrink-0" />
        <div className="space-y-1.5">
          <div className="h-7 w-48 animate-shimmer rounded overflow-hidden" />
          <div className="h-4 w-36 animate-shimmer rounded overflow-hidden" />
        </div>
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-shimmer rounded-2xl overflow-hidden" />
        ))}
      </div>

      {/* Panels skeleton */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-80 animate-shimmer rounded-2xl overflow-hidden" />
        <div className="h-80 animate-shimmer rounded-2xl overflow-hidden" />
      </div>

      {/* Activity list skeleton */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="h-11 animate-shimmer border-b border-border" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
            <div className="h-8 w-8 animate-shimmer rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-56 animate-shimmer rounded" />
              <div className="h-3.5 w-36 animate-shimmer rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
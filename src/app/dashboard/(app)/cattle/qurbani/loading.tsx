export default function Loading() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg animate-shimmer overflow-hidden shrink-0" />
        <div className="h-10 w-10 rounded-xl animate-shimmer overflow-hidden shrink-0" />
        <div className="space-y-1.5">
          <div className="h-7 w-44 animate-shimmer rounded overflow-hidden" />
          <div className="h-4 w-32 animate-shimmer rounded overflow-hidden" />
        </div>
      </div>

      {/* Eid banner skeleton */}
      <div className="h-20 animate-shimmer rounded-xl overflow-hidden" />

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-shimmer rounded-xl overflow-hidden" />
        ))}
      </div>

      {/* Cattle cards */}
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-shimmer rounded-xl overflow-hidden" />
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg animate-shimmer overflow-hidden shrink-0" />
        <div className="h-10 w-10 rounded-xl animate-shimmer overflow-hidden shrink-0" />
        <div className="space-y-1.5">
          <div className="h-7 w-44 animate-shimmer rounded overflow-hidden" />
          <div className="h-4 w-36 animate-shimmer rounded overflow-hidden" />
        </div>
      </div>

      {/* Active feed banner */}
      <div className="h-12 animate-shimmer rounded-xl overflow-hidden" />

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-shimmer rounded-xl overflow-hidden" />
        ))}
      </div>

      {/* View toggle + roughage select row */}
      <div className="flex items-center justify-between gap-4">
        <div className="h-9 w-48 animate-shimmer rounded-xl overflow-hidden" />
        <div className="h-8 w-48 animate-shimmer rounded-lg overflow-hidden" />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="h-10 animate-shimmer border-b border-border" />
        <div className="h-10 animate-shimmer border-b border-border opacity-80" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-12 border-b border-border last:border-0 animate-shimmer"
            style={{ opacity: 1 - i * 0.08 }}
          />
        ))}
        <div className="h-12 animate-shimmer border-t-2 border-border opacity-60" />
      </div>
    </div>
  );
}

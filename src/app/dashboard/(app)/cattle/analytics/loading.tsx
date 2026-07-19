export default function Loading() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg animate-shimmer overflow-hidden shrink-0" />
        <div className="h-10 w-10 rounded-xl animate-shimmer overflow-hidden shrink-0" />
        <div className="space-y-1.5">
          <div className="h-7 w-52 animate-shimmer rounded overflow-hidden" />
          <div className="h-4 w-28 animate-shimmer rounded overflow-hidden" />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-shimmer rounded-xl overflow-hidden" />
        ))}
      </div>

      {/* Chart */}
      <div className="h-72 animate-shimmer rounded-xl overflow-hidden" />

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="h-10 animate-shimmer border-b border-border" />
        <div className="h-10 animate-shimmer border-b border-border opacity-80" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-12 border-b border-border last:border-0 animate-shimmer"
            style={{ opacity: 1 - i * 0.1 }}
          />
        ))}
      </div>
    </div>
  );
}

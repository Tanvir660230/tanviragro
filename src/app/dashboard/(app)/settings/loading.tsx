function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-shimmer rounded overflow-hidden ${className ?? ""}`} />;
}

export default function SettingsLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-52" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="glass-panel p-5 space-y-4">
          <Skeleton className="h-4 w-36" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            ))}
          </div>
          <Skeleton className="h-9 w-24 rounded-lg ml-auto" />
        </div>
      ))}
    </div>
  );
}

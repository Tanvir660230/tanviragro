export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 w-48 rounded-xl bg-muted/50" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-3 rounded-xl border border-border bg-card p-5">
          <div className="h-4 w-32 rounded bg-muted/50" />
          {[1, 2, 3].map((j) => (
            <div key={j} className="flex items-start gap-3 rounded-xl bg-muted/30 px-4 py-3">
              <div className="h-5 w-5 rounded-full bg-muted/50 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-muted/50" />
                <div className="h-3 w-1/3 rounded bg-muted/40" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

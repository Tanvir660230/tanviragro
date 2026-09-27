import { Skeleton } from "@/components/ui/skeleton";

/** The stock page's shape while it loads: header · 4 summary cards · to-do · in use · stock | recent. */
export default function InventoryLoading() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-44 rounded-lg" />
          <Skeleton className="h-4 w-72 max-w-full rounded" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[104px] rounded-xl" />)}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <Skeleton className="h-44 rounded-xl" />
          <div className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3.5 last:border-0">
                  <div className="space-y-1.5"><Skeleton className="h-4 w-40 rounded" /><Skeleton className="h-3 w-28 rounded" /></div>
                  <Skeleton className="h-6 w-20 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Medal, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CattleRowEnriched } from "@/app/dashboard/(app)/cattle/page";

const LIMIT = 4;

export function PerformanceLeaderboard({ cattle }: { cattle: CattleRowEnriched[] }) {
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);

  const pool = cattle.filter((c) => c.status === "active" && c.adg !== null);

  if (pool.length < 2) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border/60 bg-card py-10 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50">
          <Medal className="h-5 w-5 text-muted-foreground/40" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Performance Leaderboard</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Add weight logs to at least 2 active cattle to start comparing performance.
          </p>
        </div>
      </div>
    );
  }

  const sorted = [...pool].sort((a, b) => (b.adg ?? 0) - (a.adg ?? 0));
  const maxAdg  = sorted[0].adg ?? 0.01;

  const topList    = showTop    ? sorted                   : sorted.slice(0, LIMIT);
  const bottomList = showBottom ? [...sorted].reverse()    : [...sorted].reverse().slice(0, LIMIT);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <LeaderCard
        type="top"
        list={topList}
        maxAdg={maxAdg}
        remaining={sorted.length - LIMIT}
        showAll={showTop}
        onShowAll={() => setShowTop(true)}
      />
      <LeaderCard
        type="bottom"
        list={bottomList}
        maxAdg={maxAdg}
        remaining={sorted.length - LIMIT}
        showAll={showBottom}
        onShowAll={() => setShowBottom(true)}
      />
    </div>
  );
}

function LeaderCard({
  type,
  list,
  maxAdg,
  remaining,
  showAll,
  onShowAll,
}: {
  type: "top" | "bottom";
  list: CattleRowEnriched[];
  maxAdg: number;
  remaining: number;
  showAll: boolean;
  onShowAll: () => void;
}) {
  const top = type === "top";

  return (
    <div
      className={cn(
        "rounded-xl border shadow-card overflow-hidden",
        top
          ? "border-emerald-200 dark:border-emerald-800/60"
          : "border-red-200 dark:border-red-800/60"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-2.5 px-4 py-3 border-b",
          top
            ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40"
            : "bg-red-50/70 dark:bg-red-950/20 border-red-200/60 dark:border-red-800/40"
        )}
      >
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg",
            top ? "bg-emerald-500/15" : "bg-red-500/15"
          )}
        >
          {top
            ? <Medal className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            : <AlertCircle className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
          }
        </div>
        <div>
          <h3 className="text-sm font-semibold">
            {top ? "Top Performers" : "Needs Attention"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {top ? "Highest ADG" : "Lowest ADG"}
          </p>
        </div>
      </div>

      {/* Rows */}
      <div
        className={cn(
          "divide-y",
          top
            ? "divide-emerald-100/70 dark:divide-emerald-900/30"
            : "divide-red-100/70 dark:divide-red-900/30"
        )}
      >
        {list.map((c, idx) => {
          const adg    = c.adg ?? 0;
          const barPct = maxAdg > 0 ? Math.max((adg / maxAdg) * 100, 3) : 3;

          return (
            <Link
              key={c.id}
              href={`/dashboard/cattle/${c.id}`}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 transition-colors group",
                top
                  ? "hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20"
                  : "hover:bg-red-50/60 dark:hover:bg-red-950/20"
              )}
            >
              {/* Rank badge */}
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  top
                    ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300"
                    : "bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300"
                )}
              >
                {idx + 1}
              </span>

              {/* Tag + bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-semibold group-hover:text-primary transition-colors truncate">
                      #{c.tag_id}
                    </span>
                    {c.breed && (
                      <span
                        className="text-xs text-muted-foreground hidden sm:inline truncate"
                        title={c.breed}
                      >
                        {c.breed}
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-sm font-bold tabular-nums shrink-0",
                      top
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {adg.toFixed(2)}
                    <span className="text-xs font-normal text-muted-foreground ml-0.5">kg/d</span>
                  </span>
                </div>
                {/* ADG bar */}
                <div className="h-1 w-full rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      top ? "bg-emerald-500" : "bg-red-400"
                    )}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </div>
            </Link>
          );
        })}

        {!showAll && remaining > 0 && (
          <div className="px-4 py-2.5 text-center">
            <button
              onClick={onShowAll}
              className={cn(
                "text-xs font-medium rounded-md px-2 py-1 hover:bg-muted/50 transition-colors",
                top
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-red-700 dark:text-red-400"
              )}
            >
              +{remaining} more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * One animal's cost, split into the parts every screen shows — pure.
 *
 * The cattle list, the profile header and the profile cost timeline all take their total
 * from here, so they cannot drift apart again (the timeline used to add its own feed
 * figure and leave out the farm's running costs, showing a smaller total).
 *
 * With the farm position (lib/partners/position.ts) the total IS its full cost: purchase +
 * the animal's own costs + its share of feed and running costs by head-day. Feed is then
 * part of `farmShare` and is not shown apart (a second feed figure, split another way,
 * would not add up to the total). Without it, the total is purchase + feed + own costs.
 *
 * `pieces` is the same total split by what the money went on (feed, labour, electricity …):
 * the farm share is cut up by the kinds of running cost it is made of, and what is left of
 * it (the feed recorded on the animal itself) is feed. The pieces always add up to `total`.
 */
import type { RunningKind } from "@/lib/partners/position";

/** farmShare: the whole share, when it is not known by kind */
export type CostPieceKey = "purchase" | "farmShare" | RunningKind;
export type CostPiece = { key: CostPieceKey; amount: number };

export type CostParts = {
  total: number;
  purchase: number;
  /** feed on its own — only when there is no farm position */
  feed: number | null;
  /** feed + the farm's running costs shared to this animal — only with the farm position */
  farmShare: number | null;
  medical: number;
  other: number;
  /** the total by what it was spent on, largest first after purchase; adds up to `total` */
  pieces: CostPiece[];
};

const ORDER: CostPieceKey[] = ["purchase", "farmShare", "feed", "labor", "medical", "utility", "rent", "depreciation", "interest", "other"];

function toPieces(m: Partial<Record<CostPieceKey, number>>): CostPiece[] {
  return ORDER.map((key) => ({ key, amount: m[key] ?? 0 })).filter((p) => Math.abs(p.amount) >= 0.005);
}

export function animalCostParts(p: {
  fullCost: number | null | undefined; purchase: number; feed: number; medical: number; other: number;
  /** the animal's share of the farm's running costs by kind (farm position) */
  running?: Partial<Record<RunningKind, number>> | null;
}): CostParts {
  const { purchase, medical, other } = p;
  if (p.fullCost != null) {
    // exactly the full cost: the share is what the full cost adds to purchase and own costs
    const farmShare = p.fullCost - purchase - medical - other;
    const m: Partial<Record<CostPieceKey, number>> = { purchase, medical, other };
    if (p.running == null) {
      m.farmShare = farmShare;
      return { total: p.fullCost, purchase, feed: null, farmShare, medical, other, pieces: toPieces(m) };
    }
    const run = p.running;
    let notFeed = 0;
    for (const [k, v] of Object.entries(run) as [RunningKind, number][]) {
      if (k === "feed" || !v) continue;
      m[k] = (m[k] ?? 0) + v;
      notFeed += v;
    }
    m.feed = farmShare - notFeed;   // herd feed + feed recorded on the animal
    return { total: p.fullCost, purchase, feed: null, farmShare, medical, other, pieces: toPieces(m) };
  }
  return { total: purchase + p.feed + medical + other, purchase, feed: p.feed, farmShare: null, medical, other,
    pieces: toPieces({ purchase, feed: p.feed, medical, other }) };
}

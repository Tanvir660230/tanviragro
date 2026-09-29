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
 */
export type CostParts = {
  total: number;
  purchase: number;
  /** feed on its own — only when there is no farm position */
  feed: number | null;
  /** feed + the farm's running costs shared to this animal — only with the farm position */
  farmShare: number | null;
  medical: number;
  other: number;
};

export function animalCostParts(p: { fullCost: number | null | undefined; purchase: number; feed: number; medical: number; other: number }): CostParts {
  const { purchase, medical, other } = p;
  if (p.fullCost != null) {
    // exactly the full cost: the share is what the full cost adds to purchase and own costs
    return { total: p.fullCost, purchase, feed: null, farmShare: p.fullCost - purchase - medical - other, medical, other };
  }
  return { total: purchase + p.feed + medical + other, purchase, feed: p.feed, farmShare: null, medical, other };
}

/** One cost split (src/lib/cattle/cost-parts.ts): the cattle list, the profile header and the profile cost timeline show the same total. */
import { animalCostParts } from "@/lib/cattle/cost-parts";
import { buildBoard, type BoardRow } from "@/lib/cattle/board";
import type { FarmPosition } from "@/lib/partners/position";
import type { HomeInput } from "@/lib/home/home-model";
import { computeFeedSnapshot } from "@/lib/feed/usage-engine";

// what the timeline adds up: purchase, each vet / own cost row, then the farm share (or feed)
const timelineTotal = (p: ReturnType<typeof animalCostParts>) => p.purchase + p.medical + p.other + (p.farmShare ?? p.feed ?? 0);

test("with the farm position, the parts add up to exactly its full cost and feed is not shown apart", () => {
  const p = animalCostParts({ fullCost: 105185, purchase: 87500, feed: 17000, medical: 0, other: 1640 });
  expect(p.total).toBe(105185);
  expect(p.feed).toBeNull();
  expect(p.farmShare).toBeCloseTo(105185 - 87500 - 1640, 6);
  expect(timelineTotal(p)).toBeCloseTo(p.total, 6);
});

test("without it, the total is purchase + feed + own costs", () => {
  const p = animalCostParts({ fullCost: null, purchase: 80000, feed: 5000, medical: 300, other: 200 });
  expect(p.total).toBe(85500);
  expect(p.farmShare).toBeNull();
  expect(timelineTotal(p)).toBe(p.total);
});

test("a sold animal: the list's total cost is the profile's total", () => {
  const feed = computeFeedSnapshot({ asOf: "2026-09-29", periods: [], wac: {}, animals: [], recorded: [] });
  const home: HomeInput = {
    today: "2026-09-29", nextEid: "2027-05-16", cattle: [], feed, feedItems: [], directCostByCattle: { S: 1640 },
    marketPricePerKg: 400, cash: null, monthOperatingExpenses: null, healthDue: [],
  };
  const row: BoardRow = { id: "S", tag_id: "S", breed: null, gender: null, status: "sold", purchase_date: "2026-07-31", purchase_price: 87500,
    target_weight_kg: null, is_quarantined: false, is_qurbani_marked: false };
  const farm = { animals: [{ id: "S", fullCost: 105185 }] } as unknown as FarmPosition;
  const board = buildBoard({ home, rows: [row], logs: {}, feedByAnimal: { S: 17000 }, directCostByCattle: { S: 1640 }, health: [],
    sales: [{ cattle_id: "S", sold_at: "2026-09-29", price: 106000 }], farm });
  const profile = animalCostParts({ fullCost: 105185, purchase: 87500, feed: 17000, medical: 0, other: 1640 });
  expect(board.animals[0].realised!.cost).toBe(profile.total);
  expect(board.animals[0].realised!.result).toBe(106000 - profile.total);
});

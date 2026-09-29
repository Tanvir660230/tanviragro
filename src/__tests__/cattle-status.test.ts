/** Cattle status rules and the one calculation behind the list, table and CSV. */
import { buildBoard, matchesFilter, type BoardRow } from "@/lib/cattle/board";
import { boardCsv } from "@/lib/cattle/board-csv";
import { isOnFarm, hasLeft, isLossStatus } from "@/lib/cattle/status";
import type { HomeInput } from "@/lib/home/home-model";
import { computeFeedSnapshot } from "@/lib/feed/usage-engine";
import fs from "fs";
import path from "path";

const TODAY = "2026-09-24";
const feed = computeFeedSnapshot({ asOf: TODAY, periods: [], wac: {}, animals: [], recorded: [] });
const home: HomeInput = {
  today: TODAY, nextEid: null,
  cattle: [
    { id: "A", tag: "A-1", purchaseDate: "2026-06-01", purchasePrice: 80000, initialWeightKg: 200, initialWeightType: "measured", targetWeightKg: null, logs: [] },
    { id: "Q", tag: "Q-1", purchaseDate: "2026-06-01", purchasePrice: 70000, initialWeightKg: 180, initialWeightType: "measured", targetWeightKg: null, logs: [] },
  ],
  feed, feedItems: [], directCostByCattle: {}, marketPricePerKg: 400, cash: null, monthOperatingExpenses: null, healthDue: [],
};
const row = (id: string, status: string, over: Partial<BoardRow> = {}): BoardRow => ({
  id, tag_id: `${id}-1`, breed: "Sahiwal", gender: "male", status, purchase_date: "2026-06-01", purchase_price: 80000,
  target_weight_kg: null, is_quarantined: false, is_qurbani_marked: false, initial_weight_kg: 200, initial_weight_type: "measured", ...over,
});
const board = buildBoard({
  home,
  rows: [row("A", "active"), row("Q", "quarantined", { purchase_price: 70000 }), row("D", "dead", { purchase_price: 60000 }), row("S", "stolen", { purchase_price: 50000 }), row("X", "archived", { purchase_price: 1000 })],
  logs: {}, feedByAnimal: {}, directCostByCattle: {},
  health: [{ cattle_id: "D", title: "FMD", date: "2026-09-01" }],
  sales: [],
  deaths: [{ cattle_id: "D", date: "2026-09-10", cause: "Bloat" }, { cattle_id: "S", date: "2026-09-12", cause: "Stolen — from the shed" }],
});
const by = (id: string) => board.animals.find((a) => a.id === id)!;

describe("quarantine is a flag on an animal still on the farm", () => {
  test("status helpers", () => {
    expect(isOnFarm("active")).toBe(true);
    expect(isOnFarm("quarantined")).toBe(true);
    expect(hasLeft("dead")).toBe(true);
    expect(hasLeft("sold")).toBe(true);
  });
  test("an old status 'quarantined' is active + quarantined, never 'dead' in the past list", () => {
    const q = by("Q");
    expect(q.status).toBe("active");
    expect(q.quarantined).toBe(true);
    expect(q.realised).toBeNull();
    expect(matchesFilter(q, "lost", TODAY)).toBe(false);
    expect(matchesFilter(q, "quarantine", TODAY)).toBe(true);
    expect(q.metrics?.tag).toBe("Q-1");
  });
});

describe("animals that left", () => {
  test("a dead animal carries its death day and cause; no health task", () => {
    const d = by("D");
    expect(d.realised).toMatchObject({ kind: "dead", date: "2026-09-10", cause: "Bloat", result: -60000 });
    expect(d.nextHealth).toBeNull();
    expect(matchesFilter(d, "lost", TODAY)).toBe(true);
  });
  test("a stolen animal carries the day it went missing and its whole cost as a loss", () => {
    expect(by("S").realised).toMatchObject({ kind: "stolen", date: "2026-09-12", result: -50000 });
    expect(matchesFilter(by("S"), "lost", TODAY)).toBe(true);
  });
  test("other exits without a record are 'gone', not labelled dead", () => {
    expect(by("X").realised?.kind).toBe("gone");
  });
  test("dead and stolen are losses (booked in Money and the partners' split); a sale is not", () => {
    expect(isLossStatus("dead")).toBe(true);
    expect(isLossStatus("stolen")).toBe(true);
    expect(isLossStatus("sold")).toBe(false);
    expect(isLossStatus("active")).toBe(false);
  });
  test("the accounting engine and the partners' position count a stolen animal as a loss", () => {
    const src = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
    expect(src("lib/accounting/engine.ts")).toMatch(/isLossStatus\(c\.status\)/);
    expect(src("lib/partners/load-positions.ts")).toMatch(/isLossStatus\(c\.status\)/);
  });
});

describe("one calculation for the list, the table and the download", () => {
  test("the CSV carries the board's own figures", () => {
    const csv = boardCsv(board).split("\n");
    expect(csv[0]).toContain('"Cost so far (৳)"');
    const a = csv.find((l) => l.startsWith('"A-1"'))!;
    const m = by("A").metrics!;
    expect(a).toContain(`"${m.costSoFar.toFixed(0)}"`);
    expect(csv.find((l) => l.startsWith('"D-1"'))).toContain('"Bloat"');
    // active animals first
    expect(csv[1].startsWith('"A-1"') || csv[1].startsWith('"Q-1"')).toBe(true);
  });
  test("the page and the export use the central board only (no second per-animal calculation)", () => {
    const src = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
    const page = src("app/dashboard/(app)/cattle/page.tsx");
    expect(page).toMatch(/loadCattleBoard/);
    expect(page).not.toMatch(/from\("weight_logs"\)|from\("inventory_transactions"\)|measuredGrowth/);
    const exp = src("app/dashboard/(app)/cattle/export/route.ts");
    expect(exp).toMatch(/boardCsv/);
    expect(exp).toMatch(/CATTLE_EXPORT/);
  });
  test("a batch status never marks animals sold or dead without their records", () => {
    const bulk = fs.readFileSync(path.join(__dirname, "..", "app/dashboard/(app)/cattle/bulk-actions.ts"), "utf8");
    const body = bulk.slice(bulk.indexOf("export async function bulkBatchStatusAction"));
    expect(body).toMatch(/status === "sold" \|\| status === "dead"/);
    expect(body).not.toMatch(/update\(\{ status: status/);
  });
});

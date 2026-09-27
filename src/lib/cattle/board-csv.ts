import type { Board, BoardAnimal } from "./board";

/**
 * The cattle list as a spreadsheet — the same figures as the cards (one calculation:
 * lib/cattle/board.ts), so the download never disagrees with the page.
 */
export function boardCsv(board: Board): string {
  const headers = [
    "Tag", "Breed", "Gender", "Status", "Quarantine", "Qurbani",
    "Purchase date", "Purchase price (৳)", "Days on farm",
    "Weight (kg)", "Weight basis", "Last weighed", "Daily gain (kg)",
    "Feed cost (৳)", "Cost so far (৳)", "Worth today (৳, estimate)", "Profit today (৳, estimate)", "Ready to sell",
    "Left on", "Sale price (৳)", "Result (৳)", "Cause of death",
  ];
  const n = (v: number | null | undefined, d = 0) => (v == null || !isFinite(v) ? "" : v.toFixed(d));
  const row = (a: BoardAnimal) => {
    const m = a.metrics;
    return [
      a.tag, a.breed ?? "", a.gender ?? "", a.status, a.quarantined ? "yes" : "", a.qurbani ? "yes" : "",
      a.purchaseDate, n(a.purchasePrice), n(m?.daysOnFarm),
      n(m?.weightKg, 1), m?.weightBasis ?? "", m?.lastWeighed ?? "", n(m?.adgKg, 2),
      n(m?.feedCost), n(m?.costSoFar ?? a.realised?.cost), n(m?.valueToday), n(m?.profitToday), m?.readyToSell ? "yes" : "",
      a.realised?.date ?? "", n(a.realised?.salePrice), n(a.realised?.result), a.realised?.cause ?? "",
    ];
  };
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const sorted = [...board.animals].sort((x, y) => (x.status === "active" ? 0 : 1) - (y.status === "active" ? 0 : 1) || x.tag.localeCompare(y.tag, undefined, { numeric: true }));
  return [headers, ...sorted.map(row)].map((r) => r.map(cell).join(",")).join("\n");
}

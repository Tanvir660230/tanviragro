/** A sold / dead animal's page report and the list's sold view render their figures (C006's sale as the example). */
import { renderToString } from "react-dom/server";
import { ClosedReport } from "@/components/cattle/ClosedReport";
import { ClosedList } from "@/components/cattle/ClosedList";
import { saleReport } from "@/lib/cattle/closed";
import { animalCostParts } from "@/lib/cattle/cost-parts";
import type { BoardAnimal } from "@/lib/cattle/board";

// React's text separators (<!-- -->) are dropped, other tags become spaces
const text = (html: string) => html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
const labels = { purchase: "Purchase", feed: "Feed", farmShare: "Feed & share of farm costs", medical: "Medical", other: "Other" };
const parts = animalCostParts({ fullCost: 105200, purchase: 87500, feed: 0, medical: 0, other: 1640 });
const c006 = { initial_weight_kg: 250, initial_weight_type: "estimated" as const, purchase_date: "2026-07-31" };
const logs = [{ weight_kg: 210, recorded_at: "2026-09-14T08:00:00Z", weight_type: "measured" as const }];

test("sold: sale price, cost, profit, per day, missing sale weight, and a cost added after the sale", () => {
  const sale = saleReport({ salePrice: 106000, cost: parts.total, costAtSale: 104700, purchaseDate: "2026-07-31", soldOn: "2026-09-29", animal: c006, logs });
  const html = text(renderToString(
    <ClosedReport lang="en" kind="sold" date="2026-09-29" buyer="Bashay eshe kinse" purchaseDate="2026-07-31" days={60}
      parts={parts} costLabels={labels} sale={sale} initial={{ kg: 250, estimated: true }} lastWeighed={{ kg: 210, date: "2026-09-14" }} />,
  ));
  expect(html).toMatch(/Sold 29 Sept? 2026/);
  expect(html).toContain("Buyer: Bashay eshe kinse");
  expect(html).toContain("60 days on the farm");
  expect(html).toContain("৳1,06,000");
  expect(html).toContain("৳1,05,200");
  expect(html).toContain("৳800");                       // profit
  expect(html).toContain("৳13");                        // per day (800 / 60)
  expect(html).toContain("Not recorded");               // no sale weight
  expect(html).toContain("Needs the weight at sale");   // no price per kg
  expect(html).toContain("the total cost was ৳1,04,700"); // cost changed after the sale
  expect(html).toContain("Feed & share of farm costs");
});

test("dead: the whole cost is the loss; no sale figures", () => {
  const html = text(renderToString(
    <ClosedReport lang="bn" kind="dead" date="2026-08-10" cause="Bloat" purchaseDate="2026-07-01" days={40}
      parts={animalCostParts({ fullCost: 52000, purchase: 50000, feed: 0, medical: 0, other: 0 })} costLabels={labels}
      initial={{ kg: 200, estimated: false }} lastWeighed={null} />,
  ));
  expect(html).toContain("মারা গেছে");
  expect(html).toContain("কারণ: Bloat");
  expect(html).toContain("−৳52,000");
  expect(html).not.toContain("বিক্রয় মূল্য");
});

test("the list's sold view: totals and one row per sale", () => {
  const a = {
    id: "c6", tag: "C006 Boro Goru", status: "sold",
    realised: { kind: "sold", date: "2026-09-29", salePrice: 106000, cost: 105200, result: 800, days: 60, buyer: "Bashay eshe kinse", weightKg: null, costAtSale: null },
  } as unknown as BoardAnimal;
  const html = text(renderToString(<ClosedList kind="sold" animals={[a]} lang="en" />));
  expect(html).toContain("Animals sold 1");
  expect(html).toContain("Sold for ৳1,06,000");
  expect(html).toContain("C006 Boro Goru");
  expect(html).toContain("60 days · to Bashay eshe kinse");
  expect(html).toContain("৳800");
  expect(html).toContain("+0.8%");
});

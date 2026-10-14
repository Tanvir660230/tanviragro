import { buildCashLedger, cashNet, type CashLedgerInput } from "@/lib/accounting/cash-ledger";
import {
  balanceTrend, buildHolderBook, holderBalanceOn, holderStatement, passThroughIds, splitLine, OPENING_KEY,
  type CashHolder, type HolderInput, type TagPart,
} from "@/lib/accounting/cash-holders";

const empty = (): CashLedgerInput => ({ partnerTx: [], sales: [], cattle: [], costs: [], treatments: [], invTx: [], fixedAssets: [], liabilities: [], loans: [] });

const tanvir: CashHolder = { id: "h-t", name: "Tanvir", kind: "person", partnerId: "p-t", userId: null, archived: false };
const mohi: CashHolder = { id: "h-m", name: "Mohiuddin", kind: "person", partnerId: "p-m", userId: null, archived: false };
const bank: CashHolder = { id: "h-b", name: "Bank", kind: "bank", partnerId: null, userId: null, archived: false };
const whole = (holderId: string): TagPart[] => [{ holderId, amount: null }];

function ledger() {
  return buildCashLedger({
    ...empty(),
    partnerTx: [
      { id: "inv1", amount: 200000, type: "investment", recorded_at: "2026-06-01", partner_name: "Tanvir" },
      // Mohiuddin paid an expense from his own pocket: credit + expense cancel
      { id: "pocket", amount: 800, type: "investment", recorded_at: "2026-06-05", partner_name: "Mohiuddin", cost_entry_id: "e2" },
    ],
    cattle: [{ id: "c1", purchase_price: 70000, purchase_date: "2026-06-02", tag_id: "T1" }],
    sales: [{ id: "s1", sale_price_total: 95000, sold_at: "2026-08-01", tag: "T1" }],
    costs: [
      { id: "e1", amount: 1200, recorded_at: "2026-06-05", category: "Labor", entry_class: "expense" },
      { id: "e2", amount: 800, recorded_at: "2026-06-05", category: "Transport", entry_class: "expense" },
    ],
  });
}

function input(over: Partial<HolderInput> = {}): HolderInput {
  return {
    rows: ledger(), openingCash: 10000, holders: [tanvir, mohi, bank],
    tags: { inv1: whole("h-t"), c1: whole("h-t"), s1: whole("h-m") },
    handovers: [{ id: "x1", date: "2026-08-02", fromId: "h-m", toId: "h-b", amount: 50000, note: "deposit", status: "confirmed" }],
    ...over,
  };
}

const sumAll = (i: HolderInput) => {
  const b = buildHolderBook(i);
  return b.holders.reduce((s, h) => s + h.balance, 0) + b.unassignedBalance;
};

describe("cash holders", () => {
  it("holders + not yet said always equal the farm's cash", () => {
    const i = input();
    expect(buildHolderBook(i).total).toBe(i.openingCash + cashNet(i.rows));
    expect(sumAll(i)).toBeCloseTo(i.openingCash + cashNet(i.rows), 6);
  });

  it("each holder's balance: their rows plus confirmed handovers", () => {
    const by = Object.fromEntries(buildHolderBook(input()).holders.map((h) => [h.holder.name, h.balance]));
    expect(by.Tanvir).toBe(130000);
    expect(by.Mohiuddin).toBe(45000);
    expect(by.Bank).toBe(50000);
  });

  it("untagged rows and the opening cash are listed, the opening cash last", () => {
    const book = buildHolderBook(input());
    expect(book.unassigned.map((l) => l.key)).toEqual(["e1", OPENING_KEY]);
    expect(book.unassignedBalance).toBe(10000 - 1200);
  });

  it("an own-pocket payment and its expense belong to no holder and are never asked about", () => {
    expect([...passThroughIds(ledger())].sort()).toEqual(["e2", "pocket"]);
    expect(buildHolderBook(input()).unassigned.some((l) => l.key === "e2" || l.key === "pocket")).toBe(false);
  });

  it("a tag to an unknown holder counts as not yet said", () => {
    const book = buildHolderBook(input({ tags: { inv1: whole("gone") } }));
    expect(book.unassigned.some((l) => l.key === "inv1")).toBe(true);
    expect(book.holders.find((h) => h.holder.id === "h-t")!.balance).toBe(0);
  });

  it("an archived holder shows only while it still holds money", () => {
    expect(buildHolderBook(input({ holders: [tanvir, mohi, { ...bank, archived: true }] })).holders.some((h) => h.holder.id === "h-b")).toBe(true);
    expect(buildHolderBook(input({ holders: [tanvir, mohi, { ...bank, archived: true }], handovers: [] })).holders.some((h) => h.holder.id === "h-b")).toBe(false);
  });

  it("a statement runs oldest first with the balance after each line", () => {
    const st = holderStatement(input(), "h-m");
    expect(st.map((l) => [l.key, l.balance])).toEqual([["s1", 95000], ["handover-x1", 45000]]);
    expect(holderBalanceOn(input(), "h-m", "2026-08-01")).toBe(95000);
  });
});

describe("parts of a row", () => {
  it("a sale paid half to each: both get their part, nothing left unsaid", () => {
    const i = input({ tags: { inv1: whole("h-t"), c1: whole("h-t"), s1: [{ holderId: "h-m", amount: 45000 }, { holderId: "h-t", amount: null }] } });
    const by = Object.fromEntries(buildHolderBook(i).holders.map((h) => [h.holder.name, h.balance]));
    expect(by.Mohiuddin).toBe(45000 - 50000);
    expect(by.Tanvir).toBe(130000 + 50000);
    expect(holderStatement(i, "h-m")[0]).toMatchObject({ key: "s1", signed: 45000, whole: 95000 });
    expect(sumAll(i)).toBeCloseTo(i.openingCash + cashNet(i.rows), 6);
  });

  it("fixed parts that do not cover the row leave the rest unsaid", () => {
    const i = input({ tags: { s1: [{ holderId: "h-m", amount: 30000 }] } });
    const s1 = buildHolderBook(i).unassigned.find((l) => l.key === "s1")!;
    expect(s1).toMatchObject({ signed: 65000, whole: 95000 });
    expect(sumAll(i)).toBeCloseTo(i.openingCash + cashNet(i.rows), 6);
  });

  it("parts never give more than the row (a due that shrank)", () => {
    expect(splitLine(-1000, [{ holderId: "a", amount: 800 }, { holderId: "b", amount: 800 }], () => true)).toEqual({ shares: [["a", -800], ["b", -200]], rest: 0 });
  });

  it("the opening cash can be split between holders", () => {
    const i = input({ tags: { ...input().tags, e1: whole("h-t"), [OPENING_KEY]: [{ holderId: "h-b", amount: 6000 }, { holderId: "h-t", amount: 4000 }] } });
    const book = buildHolderBook(i);
    expect(book.unassigned).toEqual([]);
    expect(book.holders.find((h) => h.holder.id === "h-b")!.balance).toBe(56000);
  });
});

describe("handovers", () => {
  it("a pending handover counts for nobody until it is confirmed", () => {
    const i = input({ handovers: [{ id: "x1", date: "2026-08-02", fromId: "h-m", toId: "h-b", amount: 50000, note: null, status: "pending" }] });
    const book = buildHolderBook(i);
    expect(book.pending.map((h) => h.id)).toEqual(["x1"]);
    expect(book.holders.find((h) => h.holder.id === "h-m")!.balance).toBe(95000);
    expect(holderStatement(i, "h-b")).toEqual([]);
  });

  it("a rejected handover is ignored", () => {
    const book = buildHolderBook(input({ handovers: [{ id: "x1", date: "2026-08-02", fromId: "h-m", toId: "h-b", amount: 50000, note: null, status: "rejected" }] }));
    expect(book.pending).toEqual([]);
    expect(book.holders.find((h) => h.holder.id === "h-b")!.balance).toBe(0);
  });
});

describe("trend", () => {
  it("carries the last balance through days without movement", () => {
    const t = balanceTrend([{ date: "2026-08-01", balance: 100 }, { date: "2026-08-03", balance: 40 }], "2026-08-04", 5);
    expect(t).toEqual([0, 100, 100, 40, 40]);
  });
});

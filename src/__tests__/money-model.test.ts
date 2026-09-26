import { buildMoneyModel, monthEnd, type MoneyInput } from "@/lib/money/money-model";
import { financePeriod } from "@/lib/money/period";
import { todayDhaka } from "@/lib/dates";
import type { AccountingData } from "@/lib/accounting/engine";
import type { CashRow } from "@/lib/accounting/cash-ledger";
import type { FarmPosition } from "@/lib/partners/position";
import type { HomeModel } from "@/lib/home/home-model";

const is = (over: Partial<AccountingData["incomeStatement"]> = {}): AccountingData["incomeStatement"] => ({
  cattleSales: 0, totalRevenue: 0, cogs: 0, directCattleCosts: 0, feedExpenses: 0, vetMedical: 0, laborWages: 0, utilities: 0, rentLease: 0,
  transport: 0, repairsMaintenance: 0, depreciation: 0, interestExpense: 0, livestockLoss: 0, assetDisposalGain: 0, generalExpenses: 0, totalExpenses: 0, grossProfit: 0, netIncome: 0, ...over,
});
const acc = (o: { is?: Partial<AccountingData["incomeStatement"]>; cash?: number; ledger?: CashRow[] } = {}) => ({
  incomeStatement: is(o.is),
  balanceSheet: { cashAndBank: o.cash ?? 16782, feedInventory: 6000, livestock: 520000, netFixedAssets: 120000, totalLiabilities: 400 } as AccountingData["balanceSheet"],
  cashFlow: { cashPaidCattle: 0, cashPaidCosts: 0, cashPaidInventory: 0, fixedAssetPurchases: 0, partnerWithdrawals: 0 } as AccountingData["cashFlow"],
  cashLedger: o.ledger ?? [], fixedAssets: [], openingCash: 0, businessName: "", trialBalance: {} as AccountingData["trialBalance"], asOf: "",
}) as unknown as AccountingData;

const row = (id: string, date: string, category: CashRow["category"], amount: number, direction: CashRow["direction"]): CashRow => ({ id, date, description: "", category, amount, direction });
const farm = { herdValue: 706805, total: 27711, realized: 0, estimate: 27711, estimateRange: { low: -40000, high: 98000 }, costPerHeadDay: 270, animals: [] } as unknown as FarmPosition;
const home = { cattle: [], feed: { dailyPerHead: 120 } } as unknown as HomeModel;

function input(over: Partial<MoneyInput> = {}): MoneyInput {
  const ledger = [
    row("a", "2026-09-01", "Operating Cost", 3000, "out"), row("b", "2026-09-16", "Inventory", 9112, "out"),
    row("c", "2026-09-25", "Capital In", 12085, "in"), row("d", "2026-08-20", "Operating Cost", 999, "out"),
  ];
  return {
    today: "2026-09-27", period: { from: "2026-09-01", to: "2026-09-27" },
    all: acc({ ledger }), inPeriod: acc({ is: { feedExpenses: 8000, laborWages: 1500, utilities: 1600, depreciation: 1100 }, ledger }),
    thisMonth: acc({ is: { feedExpenses: 8000, laborWages: 1500, utilities: 1600 } }), lastMonth: acc({ is: { feedExpenses: 9000 } }), lastMonthSameDays: acc({ is: { feedExpenses: 7000 } }),
    months: [{ month: "2026-08", data: acc({ is: { feedExpenses: 9000 } }) }, { month: "2026-09", data: acc({ is: { feedExpenses: 8000, laborWages: 1500 } }) }],
    farm, home, marketPrice: { perKg: 420, date: "2026-09-24" }, accountsCheck: 27711, cashCounts: null, ...over,
  };
}

describe("money model", () => {
  it("cash lasts: the last 30 days' running spending (not capital) against cash on hand", () => {
    const m = buildMoneyModel(input());
    expect(m.avgDailySpend).toBeCloseTo((3000 + 9112) / 30, 6);   // 20 Aug is outside the 30 days
    expect(m.runwayDays).toBe(Math.floor(16782 / ((3000 + 9112) / 30)));
  });

  it("the farm's worth: cash + stock + cattle today + assets − dues", () => {
    expect(buildMoneyModel(input()).netWorth.total).toBe(16782 + 6000 + 706805 + 120000 - 400);
  });

  it("a period with nothing sold shows running costs, not a loss", () => {
    const m = buildMoneyModel(input());
    expect(m.period.running).toBe(11100);
    expect(m.period.expenseLines[0]).toEqual({ key: "feed", amount: 8000 });
    expect(m.period.result.animals).toBe(0);
    expect(m.period.result.result).toBe(0);
  });

  it("cash in and out for the period come from the cash ledger", () => {
    const c = buildMoneyModel(input()).period.cash;
    expect(c.totalIn).toBe(12085);
    expect(c.totalOut).toBe(12112);
    expect(c.net).toBe(-27);
  });

  it("this month against last month; months from the engine and the ledger", () => {
    const m = buildMoneyModel(input());
    expect(m.monthExpenses).toBe(11100);
    expect(m.lastMonthExpenses).toBe(9000);
    expect(m.lastMonthSameDays).toBe(7000);
    expect(m.months.map((x) => [x.month, x.expenses, x.cashIn, x.cashOut])).toEqual([["2026-08", 9000, 0, 999], ["2026-09", 9500, 12085, 12112]]);
  });

  it("cattle bought is the purchase price only; costs put on one animal are listed apart", () => {
    const ledger = [row("p", "2026-09-10", "Cattle Purchase", 80000, "out"), row("q", "2026-08-10", "Cattle Purchase", 50000, "out")];
    const withCattle = acc({ ledger });
    (withCattle.cashFlow as { cashPaidCattle: number }).cashPaidCattle = 81640;   // purchase + a 1,640 vet fee on one animal
    const m = buildMoneyModel(input({ all: acc({ ledger }), inPeriod: withCattle }));
    expect(m.period.cattleBought).toBe(80000);
    expect(m.period.cattleOwnCosts).toBe(1640);
  });

  it("how old the market price is", () => {
    expect(buildMoneyModel(input()).marketPriceAgeDays).toBe(3);
    expect(buildMoneyModel(input({ marketPrice: null })).marketPriceAgeDays).toBeNull();
  });

  it("month ends", () => {
    expect(monthEnd("2026-02")).toBe("2026-02-28");
    expect(monthEnd("2028-02")).toBe("2028-02-29");
    expect(monthEnd("2026-12")).toBe("2026-12-31");
  });
  it("a custom period from the URL is cleaned: bad dates ignored, reversed ranges swapped, no future", () => {
    const today = todayDhaka();
    expect(financePeriod(undefined, "2026-09-20", "2026-09-10")).toEqual({ start: "2026-09-10", end: "2026-09-20" });
    expect(financePeriod(undefined, "2026-09-01", "3000-01-01")).toEqual({ start: "2026-09-01", end: today });
    expect(financePeriod(undefined, "garbage", undefined).start).toBe(`${today.slice(0, 7)}-01`);   // falls back to this month
  });
  it("checks: the page says what would make its figures wrong", () => {
    const ok = (m: ReturnType<typeof buildMoneyModel>, k: string) => m.checks.find((c) => c.key === k)!.ok;
    const bal = { ...acc(), balanceSheet: { ...acc().balanceSheet, isBalanced: true, discrepancy: 0 } } as AccountingData;
    const m = buildMoneyModel(input({ all: bal }));
    expect(ok(m, "books")).toBe(true);
    expect(ok(m, "engines")).toBe(true);                       // 27711 = farm.total
    expect(ok(m, "price")).toBe(true);                         // 3 days old
    expect(ok(buildMoneyModel(input({ all: bal, accountsCheck: 30000 })), "engines")).toBe(false);
    expect(ok(buildMoneyModel(input({ all: bal, marketPrice: { perKg: 420, date: "2026-09-01" } })), "price")).toBe(false);
    expect(ok(buildMoneyModel(input({ all: bal, marketPrice: null })), "price")).toBe(false);
    const neg = { ...bal, balanceSheet: { ...bal.balanceSheet, feedInventory: -500, cashAndBank: -10 } } as AccountingData;
    const n = buildMoneyModel(input({ all: neg }));
    expect(ok(n, "stock")).toBe(false);
    expect(ok(n, "cash")).toBe(false);
  });
  it("cash counts: the counted cash against the books for that day", () => {
    const ledger = [row("a", "2026-09-01", "Capital In", 20000, "in"), row("b", "2026-09-20", "Operating Cost", 3000, "out")];
    const all = { ...acc({ ledger }), openingCash: 0 } as AccountingData;
    const chk = (m: ReturnType<typeof buildMoneyModel>) => m.checks.find((c) => c.key === "count")!;
    // before the migration: no check at all
    expect(chk(buildMoneyModel(input({ all, cashCounts: null }))).ok).toBe(true);
    // never counted: a reminder
    expect(chk(buildMoneyModel(input({ all, cashCounts: [] }))).ok).toBe(false);
    // counted 14,500 on 25 Sep; the books say 17,000 → 2,500 not entered
    const m = buildMoneyModel(input({ all, cashCounts: [{ id: "k", date: "2026-09-25", amount: 14500, note: null }] }));
    expect(m.cashCount.last!.expected).toBe(17000);
    expect(m.cashCount.last!.gap).toBe(-2500);
    expect(chk(m)).toMatchObject({ ok: false, amount: -2500, date: "2026-09-25" });
    // it matches and is recent: fine; a match 20 days old: count again
    expect(chk(buildMoneyModel(input({ all, cashCounts: [{ id: "k", date: "2026-09-25", amount: 17000, note: null }] }))).ok).toBe(true);
    expect(chk(buildMoneyModel(input({ all, cashCounts: [{ id: "k", date: "2026-09-07", amount: 20000, note: null }] }))).ok).toBe(false);
  });
});

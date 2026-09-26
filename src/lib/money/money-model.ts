/**
 * The Money page model (pure, no I/O). Every figure comes from a central source:
 *   cash, cash in/out, expenses by kind, assets, dues → the accounting engine and its cash ledger
 *   the result of the cattle (final / if sold today)   → lib/partners/position.ts (farm)
 *   weights and measured growth                         → the home model
 * Nothing here adds up raw tables on its own.
 *
 * A fattening farm makes or loses money when an animal leaves. A period's running costs are what
 * the cattle cost to keep, not a loss; the period's result is the result of the animals that were
 * sold or died in it.
 */
import type { AccountingData } from "@/lib/accounting/engine";
import type { CashRow } from "@/lib/accounting/cash-ledger";
import type { FarmPosition } from "@/lib/partners/position";
import type { HomeModel } from "@/lib/home/home-model";
import { capitalSummary } from "@/lib/money/summary";
import { WEIGH_EVERY_DAYS } from "@/lib/home/home-model";

export type ExpenseKey = "feed" | "vet" | "labour" | "utilities" | "rent" | "transport" | "repairs" | "general";
export const EXPENSE_LABEL: Record<ExpenseKey, { bn: string; en: string }> = {
  feed: { bn: "খাবার (খাওয়ানো)", en: "Feed eaten" },
  vet: { bn: "ডাক্তার ও ওষুধ", en: "Vet & medicine" },
  labour: { bn: "মজুরি", en: "Labour" },
  utilities: { bn: "বিদ্যুৎ-পানি", en: "Utilities" },
  rent: { bn: "ভাড়া", en: "Rent" },
  transport: { bn: "যাতায়াত", en: "Transport" },
  repairs: { bn: "মেরামত", en: "Repairs" },
  general: { bn: "অন্যান্য", en: "Other" },
};

/** Cash ledger categories that are the farm's running spending (for "how long will cash last"). */
const RUNNING_OUT = new Set(["Operating Cost", "Inventory", "Vet Fee", "Supplier Due"]);

export type MoneyInput = {
  today: string;
  period: { from: string | null; to: string };
  all: AccountingData;            // all time (balance sheet, cash ledger)
  inPeriod: AccountingData;       // the chosen period's income statement
  thisMonth: AccountingData;
  lastMonth: AccountingData;
  lastMonthSameDays: AccountingData;   // last month, day 1 to today's day number — a fair comparison
  months: { month: string; data: AccountingData }[];   // oldest first
  farm: FarmPosition;
  home: HomeModel;
  marketPrice: { perKg: number; date: string } | null;
  /** the accounts' "if sold today" result (lib/partners/load-positions.ts) — must equal farm.total */
  accountsCheck: number;
};

/** A market price older than this is flagged: every cattle value leans on it. */
export const PRICE_STALE_DAYS = 7;

export type MoneyCheck = { key: "books" | "engines" | "price" | "weights" | "stock" | "cash"; ok: boolean; amount?: number; count?: number };

export type MoneyModel = ReturnType<typeof buildMoneyModel>;

const DAY = 86400000;
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
/** last day of a YYYY-MM month */
export const monthEnd = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
const inRange = (d: string, from: string | null, to: string) => (!from || d >= from) && d <= to;

function expenseLines(a: AccountingData): { key: ExpenseKey; amount: number }[] {
  const is = a.incomeStatement;
  const lines: { key: ExpenseKey; amount: number }[] = [
    { key: "feed", amount: is.feedExpenses }, { key: "vet", amount: is.vetMedical }, { key: "labour", amount: is.laborWages },
    { key: "utilities", amount: is.utilities }, { key: "rent", amount: is.rentLease }, { key: "transport", amount: is.transport },
    { key: "repairs", amount: is.repairsMaintenance }, { key: "general", amount: is.generalExpenses },
  ];
  return lines.filter((l) => Math.abs(l.amount) >= 0.5).sort((a, b) => b.amount - a.amount);
}

function cashFlow(rows: CashRow[], from: string | null, to: string) {
  const inside = rows.filter((r) => inRange(r.date, from, to));
  const by = (dir: "in" | "out") => {
    const m = new Map<string, number>();
    for (const r of inside) if (r.direction === dir) m.set(r.category, (m.get(r.category) ?? 0) + r.amount);
    return [...m.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  };
  const moneyIn = by("in"), moneyOut = by("out");
  const total = (l: { amount: number }[]) => l.reduce((s, x) => s + x.amount, 0);
  return { moneyIn, moneyOut, totalIn: total(moneyIn), totalOut: total(moneyOut), net: total(moneyIn) - total(moneyOut) };
}

export function buildMoneyModel(input: MoneyInput) {
  const { today, period, all, inPeriod, farm, home } = input;
  const bs = all.balanceSheet;

  // ── today ──
  const since30 = addDays(today, -29);
  const running30 = all.cashLedger.filter((r) => r.direction === "out" && RUNNING_OUT.has(r.category) && r.date >= since30 && r.date <= today)
    .reduce((s, r) => s + r.amount, 0);
  const avgDailySpend = running30 / 30;
  const runwayDays = avgDailySpend > 0 && bs.cashAndBank > 0 ? Math.floor(bs.cashAndBank / avgDailySpend) : null;
  const netWorth = {
    cash: bs.cashAndBank,
    stock: bs.feedInventory,
    herd: farm.herdValue,
    assets: bs.netFixedAssets,
    dues: bs.totalLiabilities,
    total: bs.cashAndBank + bs.feedInventory + farm.herdValue + bs.netFixedAssets - bs.totalLiabilities,
  };

  // ── the chosen period ──
  const lines = expenseLines(inPeriod);
  const running = lines.reduce((s, l) => s + l.amount, 0);
  // cattle bought = the purchase price only; costs put on one animal (a vet fee for C006) are the
  // animal's own costs — the engine's cashPaidCattle holds both
  const cattleBought = all.cashLedger.filter((r) => r.category === "Cattle Purchase" && inRange(r.date, period.from, period.to))
    .reduce((s, r) => s + r.amount, 0);
  const cattleOwnCosts = Math.max(0, inPeriod.cashFlow.cashPaidCattle - cattleBought);
  const left = farm.animals.filter((a) => a.status !== "active" && a.endDate && inRange(a.endDate, period.from, period.to));
  const periodResult = {
    animals: left.length,
    sales: left.filter((a) => a.status === "sold").reduce((s, a) => s + (a.salePrice ?? 0), 0),
    result: left.reduce((s, a) => s + a.result, 0),
  };

  // ── months (oldest first) ──
  const months = input.months.map(({ month, data }) => {
    const from = `${month}-01`;
    const to = monthEnd(month);
    const flow = cashFlow(all.cashLedger, from, to < today ? to : today);
    return { month, expenses: capitalSummary(data).operatingExpenses, cashIn: flow.totalIn, cashOut: flow.totalOut };
  });

  // ── per animal (for the sell planner) ──
  const homeBy = new Map(home.cattle.map((c) => [c.id, c]));
  const animals = farm.animals.filter((a) => a.status === "active").map((a) => {
    const h = homeBy.get(a.id);
    return {
      id: a.id, tag: a.tag, days: a.days, fullCost: a.fullCost, valueToday: a.valueToday,
      weightKg: h?.weightKg ?? null, weightBasis: h?.weightBasis ?? "none", adgKg: h?.adgKg ?? null,
      daysSinceWeighed: h?.daysSinceWeighed ?? null,
    };
  });

  // ── checks: what would make a figure on this page wrong, found before anyone notices ──
  const marketPriceAgeDays = input.marketPrice ? Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${input.marketPrice.date}T00:00:00Z`)) / DAY) : null;
  const unweighed = animals.filter((a) => a.daysSinceWeighed == null || a.daysSinceWeighed > WEIGH_EVERY_DAYS).length;
  const enginesGap = input.accountsCheck - farm.total;
  const checks: MoneyCheck[] = [
    { key: "books", ok: bs.isBalanced, amount: bs.discrepancy },                         // assets = dues + capital + profit
    { key: "engines", ok: Math.abs(enginesGap) < 10, amount: enginesGap },               // accounts and partner engine agree
    { key: "price", ok: marketPriceAgeDays != null && marketPriceAgeDays <= PRICE_STALE_DAYS, count: marketPriceAgeDays ?? undefined },
    { key: "weights", ok: unweighed === 0, count: unweighed },
    { key: "stock", ok: bs.feedInventory > -0.5, amount: bs.feedInventory },            // below zero: more fed than bought
    { key: "cash", ok: bs.cashAndBank > -0.5, amount: bs.cashAndBank },                 // below zero: money in not entered
  ];

  return {
    today,
    checks,
    cash: bs.cashAndBank,
    avgDailySpend,
    runwayDays,
    monthExpenses: capitalSummary(input.thisMonth).operatingExpenses,
    lastMonthExpenses: capitalSummary(input.lastMonth).operatingExpenses,
    lastMonthSameDays: capitalSummary(input.lastMonthSameDays).operatingExpenses,
    farmResult: { total: farm.total, realized: farm.realized, estimate: farm.estimate, range: farm.estimateRange },
    netWorth,
    marketPrice: input.marketPrice,
    /** days since the market price was set — cattle values and every "if sold" figure lean on it */
    marketPriceAgeDays,
    period: {
      ...period,
      expenseLines: lines,
      running,
      depreciation: inPeriod.incomeStatement.depreciation,
      interest: inPeriod.incomeStatement.interestExpense,
      assetsBought: inPeriod.cashFlow.fixedAssetPurchases,
      cattleBought,
      cattleOwnCosts,
      result: periodResult,
      cash: cashFlow(all.cashLedger, period.from, period.to),
    },
    months,
    costPerHeadDay: farm.costPerHeadDay,
    feedPerHeadDay: home.feed.dailyPerHead,
    animals,
    fixedAssets: all.fixedAssets,
  };
}

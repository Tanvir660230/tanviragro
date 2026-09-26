/**
 * The whole accounting engine on a small farm: cash is one figure everywhere —
 * balance sheet = trial balance "Cash & Bank" = cash statement closing balance.
 */
import { cashNet, cashStatement } from "@/lib/accounting/cash-ledger";


const BIZ = "biz-1";
const tables: Record<string, unknown[]> = {};
let rpcRows: unknown[] = [];

function query(rows: unknown[]) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is", "order", "not", "in", "neq", "gte", "lte"]) q[m] = () => q;
  q.range = (from: number, to: number) => Promise.resolve({ data: rows.slice(from, to + 1), error: null });
  q.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(res, rej);
  return q;
}
// the signed-in user's client (the engine no longer uses the service-role key)
const db = () => ({ from: (t: string) => query(tables[t] ?? []), rpc: () => Promise.resolve({ data: rpcRows, error: null }) }) as never;
jest.mock("@/lib/context/business-context", () => ({
  getBusinessContext: async () => ({
    businessId: BIZ, business: { id: BIZ, name: "Test Farm", opening_cash_balance: "1500" },
    role: "owner", permissions: Object.values(jest.requireActual("@/constants/roles").PERMISSIONS),
  }),
}));

import { getAccountingData } from "@/lib/accounting/engine";

const item = (category: string, name: string) => ({ business_id: BIZ, category, name });

beforeEach(() => {
  Object.assign(tables, {
    cattle: [
      { id: "c1", tag_id: "T1", purchase_price: "70000", status: "sold", purchase_date: "2026-06-02", updated_at: null, initial_weight_kg: 200 },
      { id: "c2", tag_id: "T2", purchase_price: 65000, status: "active", purchase_date: "2026-06-02", updated_at: null, initial_weight_kg: 190 },
      { id: "c3", tag_id: "T3", purchase_price: 30000, status: "dead", purchase_date: "2026-06-03", updated_at: "2026-07-01T00:00:00Z", initial_weight_kg: 120 },
    ],
    sales: [{ id: "s1", cattle_id: "c1", sale_price_total: "90000", sold_at: "2026-08-01", buyer_name: "Rahim", cattle: { tag_id: "T1" } }],
    cost_entries: [
      { id: "e1", category: "Labor", amount: "1200", type: "fixed", recorded_at: "2026-06-05", description: "Wages", entry_class: "expense", cattle_id: null, expense_categories: null },
      { id: "e2", category: "equipment", amount: 23200, type: "fixed", recorded_at: "2026-08-06", description: "Machine", entry_class: "asset", cattle_id: null, expense_categories: null },
      { id: "e3", category: "Transport", amount: 800, type: "variable", recorded_at: "2026-06-06", description: "Truck for T2", entry_class: "expense", cattle_id: "c2", expense_categories: null },
    ],
    inventory_transactions: [
      { id: 1, type: "purchase", movement_type: "purchase", qty: 100, unit_cost: 40, recorded_at: "2026-06-03", cattle_id: null, inventory_items: item("feed", "Bran") },
      { id: 2, type: "purchase", movement_type: "opening_balance", qty: 50, unit_cost: 30, recorded_at: "2026-06-01", cattle_id: null, inventory_items: item("feed", "Bran") },
      { id: 3, type: "consumption", movement_type: "consumption", qty: 30, unit_cost: 40, recorded_at: "2026-06-09", cattle_id: null, inventory_items: item("feed", "Bran") },
      { id: 4, type: "consumption", movement_type: "consumption", qty: 20, unit_cost: 40, recorded_at: "2026-06-10", cattle_id: "c2", inventory_items: item("feed", "Bran") },
      { id: 5, type: "purchase", movement_type: "purchase", qty: 10, unit_cost: 100, recorded_at: "2026-06-04", cattle_id: null, inventory_items: item("medicine", "Oxy") },
    ],
    partner_transactions: [
      { id: "p1", amount: "200000", type: "investment", recorded_at: "2026-06-01", partners: { name: "Tanvir" } },
      { id: "p2", amount: 5000, type: "withdrawal", recorded_at: "2026-07-01", partners: { name: "Tanvir" } },
      { id: "p3", amount: 1000, type: "profit", recorded_at: "2026-08-02", partners: { name: "Tanvir" } },
      { id: "p4", amount: 500, type: "advance", recorded_at: "2026-08-05", partners: { name: "Mohiuddin" } },
      { id: "p5", amount: 2000, type: "loan_in", recorded_at: "2026-08-06", partners: { name: "Nanu" } },
      { id: "p6", amount: 1000, type: "loan_repay", recorded_at: "2026-09-06", partners: { name: "Nanu" } },
    ],
    fixed_assets: [
      { id: "f1", name: "Machine", category: "equipment", description: null, purchase_date: "2026-08-06", purchase_cost: 23200, salvage_value: 0, useful_life_years: 5, depreciation_method: "straight_line", declining_rate: null, is_active: true, disposed_at: null, disposal_value: null, notes: null, source_cost_entry_id: "e2" },
      { id: "f2", name: "Shed", category: "infrastructure", description: null, purchase_date: "2026-06-01", purchase_cost: "10000", salvage_value: 0, useful_life_years: 10, depreciation_method: "straight_line", declining_rate: null, is_active: true, disposed_at: null, disposal_value: null, notes: null, source_cost_entry_id: null },
    ],
    liabilities: [{ id: "l1", name: "Feed shop", lender: "Feed shop", outstanding: 400, recorded_at: "2026-06-03", settled_at: null }],
    loans: [
      { id: "n1", lender_name: "Bank", principal_amount: 20000, interest_rate_pct: 0, loan_date: "2026-06-15", status: "active", loan_payments: [{ id: "lp1", amount: 5000, paid_at: "2026-07-15" }] },
      // paid off with interest: more went out than came in
      { id: "n2", lender_name: "Uncle", principal_amount: 10000, interest_rate_pct: 12, loan_date: "2026-06-01", status: "paid", loan_payments: [{ id: "lp2", amount: 10600, paid_at: "2026-09-01" }] },
    ],
    cattle_treatments: [{ id: "t1", cattle_id: "c2", vet_fee: "500", additional_medical_cost: 200, treated_at: "2026-06-10", diagnosis: "Fever", cattle: { tag_id: "T2" } }],
  });
  rpcRows = [{ cattle_id: "c2", category: "feed", total_cost: 800 }];   // row 4, capitalised into T2
});

describe("accounting engine — one cash figure", () => {
  it("a failed query is an error, never a silently wrong cash figure", async () => {
    const denied = () => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "is", "order", "not", "in"]) q[m] = () => q;
      const res = { data: null, error: { message: "permission denied" } };
      q.range = () => Promise.resolve(res);
      q.then = (ok: (v: unknown) => unknown) => Promise.resolve(res).then(ok);
      return q;
    };
    const failing = { from: (t: string) => (t === "liabilities" ? denied() : query(tables[t] ?? [])), rpc: () => Promise.resolve({ data: [], error: null }) } as never;
    await expect(getAccountingData(failing)).rejects.toThrow(/permission denied/);
  });

  it("balance sheet, trial balance and cash statement agree", async () => {
    const acc = await getAccountingData(db());
    const bs = acc.balanceSheet;
    const expected = 1500
      + 90000 - (70000 + 65000 + 30000)
      - (1200 + 23200 + 800) - 700
      - (4000 + 1000)            // supplier purchases (opening stock is not cash)
      - 10000                    // shed without a payment record
      + (200000 - 5000 - 1000)
      - 500 + (2000 - 1000)      // a profit advance out; a partner's loan in, half repaid
      + 400                      // still owed to the feed shop
      + (20000 - 5000) + (10000 - 10600);
    expect(bs.cashAndBank).toBeCloseTo(expected, 6);
    expect(acc.openingCash + cashNet(acc.cashLedger)).toBeCloseTo(bs.cashAndBank, 6);

    const cashLine = acc.trialBalance.lines.find((l) => l.code === "1100")!;
    expect(cashLine.balance).toBeCloseTo(bs.cashAndBank, 6);
    expect(acc.trialBalance.isBalanced).toBe(true);
    expect(bs.isBalanced).toBe(true);

    const st = cashStatement(acc.cashLedger, acc.openingCash, "2026-07-01", undefined);
    expect(st.closingBalance).toBeCloseTo(bs.cashAndBank, 6);
    expect(acc.businessName).toBe("Test Farm");
  });

  it("reads every page of the money tables (no silent stop at 1000 rows)", async () => {
    tables.cost_entries = Array.from({ length: 1500 }, (_, i) => ({ id: `x${i}`, category: "Labor", amount: 1, type: "fixed", recorded_at: "2026-06-05", description: null, entry_class: "expense", cattle_id: null, expense_categories: null }));
    const before = (await getAccountingData(db())).cashLedger.filter((r) => r.category === "Operating Cost").length;
    expect(before).toBe(1500);
  });
  it("a sold asset leaves the books: its money comes into cash, its value goes, the books still balance", async () => {
    const before = await getAccountingData(db());
    const f2 = before.fixedAssets.find((a) => a.id === "f2")!;
    (tables.fixed_assets as Record<string, unknown>[])[1] = { ...(tables.fixed_assets as Record<string, unknown>[])[1], is_active: false, disposed_at: "2026-09-01", disposal_value: 9000 };
    const acc = await getAccountingData(db());
    const sold = acc.fixedAssets.find((a) => a.id === "f2")!;
    const bookThen = sold.purchaseCost - sold.accumulatedDepreciation;
    expect(acc.balanceSheet.cashAndBank).toBeCloseTo(before.balanceSheet.cashAndBank + 9000, 6);
    expect(acc.cashLedger.some((r) => r.category === "Asset Sale" && r.amount === 9000 && r.date === "2026-09-01")).toBe(true);
    expect(acc.balanceSheet.netFixedAssets).toBeCloseTo(before.balanceSheet.netFixedAssets - (f2.purchaseCost - f2.accumulatedDepreciation), 0);
    expect(acc.balanceSheet.isBalanced).toBe(true);
    expect(acc.trialBalance.isBalanced).toBe(true);
    expect(acc.trialBalance.lines.find((l) => l.code === "1100")!.balance).toBeCloseTo(acc.balanceSheet.cashAndBank, 6);
    const sep = await getAccountingData(db(), "2026-09-01", "2026-09-30");
    expect(sep.incomeStatement.assetDisposalGain).toBeCloseTo(9000 - bookThen, 6);
    expect(sep.cashFlow.assetSaleProceeds).toBe(9000);
  });
});

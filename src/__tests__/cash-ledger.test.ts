import { buildCashLedger, cashNet, cashOnDate, cashStatement, type CashLedgerInput } from "@/lib/accounting/cash-ledger";
import { summarizeInventoryLedger } from "@/lib/accounting/inventory-ledger";
import { isTreatmentDuplicate } from "@/lib/expenses/treatment-duplicate";

const empty = (): CashLedgerInput => ({ partnerTx: [], sales: [], cattle: [], costs: [], treatments: [], invTx: [], fixedAssets: [], liabilities: [], loans: [] });

// A farm month with every kind of row the site records.
function farm(): CashLedgerInput {
  return {
    partnerTx: [
      { id: "p1", amount: "200000", type: "investment", recorded_at: "2026-06-01", partner_name: "Tanvir" },
      { id: "p2", amount: 5000, type: "withdrawal", recorded_at: "2026-07-01" },
      { id: "p3", amount: 1000, type: "profit", recorded_at: "2026-07-02" },
      { id: "p4", amount: 9999, type: "loss_allocation", recorded_at: "2026-07-03" },   // not cash
    ],
    sales: [{ id: "s1", sale_price_total: "90000", sold_at: "2026-08-01", tag: "T1" }],
    cattle: [{ id: "c1", purchase_price: 70000, purchase_date: "2026-06-02", tag_id: "T1" }, { id: "c2", purchase_price: "65000", purchase_date: "2026-06-02", tag_id: "T2" }],
    costs: [
      { id: "e1", amount: "1200", recorded_at: "2026-06-05", category: "Labor", entry_class: "expense" },
      { id: "e2", amount: 23200, recorded_at: "2026-08-06", category: "equipment", entry_class: "asset" },
      { id: "e3", amount: 300, recorded_at: "2026-06-06", category: "Transport", entry_class: null },
    ],
    treatments: [{ id: "t1", cattle_id: "c1", vet_fee: "500", additional_medical_cost: 200, treated_at: "2026-06-10", tag: "T1" }, { id: "t2", cattle_id: "c2", vet_fee: 0, additional_medical_cost: null, treated_at: "2026-06-11" }],
    invTx: [
      { id: 1, type: "purchase", movement_type: "purchase", qty: 100, unit_cost: 40, recorded_at: "2026-06-03", cattle_id: null },
      { id: 2, type: "purchase", movement_type: null, qty: 10, unit_cost: "50", recorded_at: "2026-06-04", cattle_id: null },           // legacy row
      { id: 3, type: "consumption", movement_type: "purchase_reversal", qty: 10, unit_cost: 50, recorded_at: "2026-06-04", cattle_id: null },
      { id: 4, type: "purchase", movement_type: "opening_balance", qty: 50, unit_cost: 30, recorded_at: "2026-06-01", cattle_id: null },
      { id: 5, type: "purchase", movement_type: "feed_mix_output", qty: 20, unit_cost: 35, recorded_at: "2026-06-08", cattle_id: null },
      { id: 6, type: "consumption", movement_type: "consumption", qty: 30, unit_cost: 40, recorded_at: "2026-06-09", cattle_id: null },
      { id: 7, type: "purchase", movement_type: "consumption_reversal", qty: 5, unit_cost: 40, recorded_at: "2026-06-09", cattle_id: null },
    ],
    fixedAssets: [
      { id: "f1", name: "Machine", category: "equipment", purchase_date: "2026-08-06", purchase_cost: 23200, source_cost_entry_id: "e2" },   // paid by e2
      { id: "f2", name: "Shed", category: "infrastructure", purchase_date: "2026-06-01", purchase_cost: "10000", source_cost_entry_id: null },
    ],
    liabilities: [
      { id: "l1", outstanding: 400, settled_at: null, recorded_at: "2026-06-03", lender: "Feed shop" },
      { id: "l2", outstanding: 999, settled_at: "2026-06-20", recorded_at: "2026-06-03" },   // settled: nothing owed
    ],
    loans: [{ id: "n1", principal_amount: 20000, loan_date: "2026-06-15", lender_name: "Bank", loan_payments: [{ id: "lp1", amount: 5000, paid_at: "2026-07-15" }] }],
  };
}

describe("cash ledger", () => {
  it("counts every cash movement once, with the right sign", () => {
    const rows = buildCashLedger(farm());
    const by = (id: string) => rows.find((r) => r.id === id);
    expect(by("p1")).toMatchObject({ direction: "in", amount: 200000, category: "Capital In" });
    expect(by("p2")).toMatchObject({ direction: "out", amount: 5000 });
    expect(by("p3")).toMatchObject({ direction: "out", amount: 1000 });
    expect(by("p4")).toBeUndefined();                                   // loss allocation moves no money
    expect(by("t1")).toMatchObject({ direction: "out", amount: 700, category: "Vet Fee" });
    expect(by("t2")).toBeUndefined();                                   // a free treatment is not a row
    expect(by("3")).toMatchObject({ direction: "in", amount: 500 });   // purchase reversal gives the cash back
    expect(by("4")).toBeUndefined();                                    // opening stock was never bought
    expect(by("5")).toBeUndefined();                                    // mixing is not cash
    expect(by("6")).toBeUndefined();                                    // eating feed is not cash
    expect(by("7")).toBeUndefined();
    expect(by("fa-f1")).toBeUndefined();                                // paid by cost entry e2
    expect(by("fa-f2")).toMatchObject({ direction: "out", amount: 10000 });
    expect(by("due-l1")).toMatchObject({ direction: "in", amount: 400, category: "Supplier Due" });
    expect(by("due-l2")).toBeUndefined();
    expect(by("loan-n1")).toMatchObject({ direction: "in", amount: 20000 });
    expect(by("loanpay-lp1")).toMatchObject({ direction: "out", amount: 5000 });
  });

  it("equals the balance-sheet cash formula the engine used before", () => {
    const f = farm();
    const inv = summarizeInventoryLedger(f.invTx);
    const expected =
      90000 - (70000 + 65000)                    // sales − cattle
      - (1200 + 300) - 23200                     // expenses + asset payments
      - 700                                      // treatment fees
      - inv.cashPurchases                        // supplier purchases net of reversals
      - 10000                                    // fixed asset without a payment record
      + (200000 - 5000 - 1000)                   // partners
      + 400                                      // still owed to the shop
      + (20000 - 5000);                          // loan received − repaid
    expect(inv.cashPurchases).toBe(4000);
    expect(cashNet(buildCashLedger(f))).toBeCloseTo(expected, 6);
  });

  it("the statement closes on the same cash as the balance sheet, for any period", () => {
    const rows = buildCashLedger(farm());
    const opening = 1500;
    const all = opening + cashNet(rows);
    for (const [from, to] of [[undefined, undefined], ["2026-06-01", "2026-06-30"], ["2026-07-01", undefined], ["2026-06-10", "2026-08-06"]] as const) {
      const st = cashStatement(rows, opening, from, to);
      expect(st.closingBalance).toBeCloseTo(cashOnDate(rows, opening, to ?? "9999-12-31"), 6);
      if (!to) expect(st.closingBalance).toBeCloseTo(all, 6);
    }
  });

  it("the owner's case: ৳1,400 two days ago, ৳12,000 put in today, then spending", () => {
    const f = empty();
    f.partnerTx.push({ id: "old", amount: 50000, type: "investment", recorded_at: "2026-09-01" });
    f.costs.push({ id: "c-old", amount: 48600, recorded_at: "2026-09-10", category: "Labor", entry_class: "expense" });
    f.partnerTx.push({ id: "today", amount: 12150, type: "investment", recorded_at: "2026-09-26" });
    f.costs.push({ id: "c-25", amount: 250, recorded_at: "2026-09-25", category: "Transport", entry_class: "expense" });
    f.treatments.push({ id: "vet", cattle_id: "a", vet_fee: 300, additional_medical_cost: 0, treated_at: "2026-09-26" });
    const rows = buildCashLedger(f);
    expect(cashOnDate(rows, 0, "2026-09-24")).toBe(1400);
    expect(cashOnDate(rows, 0, "2026-09-26")).toBe(1400 - 250 + 12150 - 300);
    const st = cashStatement(rows, 0, "2026-09-25", "2026-09-26");
    expect(st.openingBalance).toBe(1400);
    expect(st.transactions.map((r) => r.id)).toEqual(["c-25", "today", "vet"]);   // same day: money in first
    expect(st.closingBalance).toBe(13000);
  });

  it("a purchase memo with part left owing takes only the paid part out of cash", () => {
    const f = empty();
    f.invTx.push({ id: 1, type: "purchase", movement_type: "purchase", qty: 20, unit_cost: 50, recorded_at: "2026-09-20", cattle_id: null });
    f.liabilities.push({ id: "d", outstanding: 400, settled_at: null, recorded_at: "2026-09-20", lender: "Shop" });
    expect(cashNet(buildCashLedger(f))).toBe(-600);
  });
});

describe("paying a supplier due", () => {
  const bill = { id: 1, type: "purchase", movement_type: "purchase", qty: 20, unit_cost: 50, recorded_at: "2026-09-20", cattle_id: null };   // ৳1,000, all on credit
  it("the payment leaves cash on the day it was paid", () => {
    const f = empty();
    f.invTx.push(bill);
    f.liabilities.push({ id: "d", outstanding: 400, settled_at: null, recorded_at: "2026-09-20", lender: "Shop", notes: "Due for bulk purchase invoice on 2026-09-20\nPaid 600 on 2026-09-25." });
    const rows = buildCashLedger(f);
    expect(cashOnDate(rows, 0, "2026-09-24")).toBe(0);      // bought on credit: no cash moved yet
    expect(cashOnDate(rows, 0, "2026-09-25")).toBe(-600);   // paid the shop
    expect(rows.find((r) => r.id === "duepay-d-0")).toMatchObject({ date: "2026-09-25", direction: "out", amount: 600 });
  });
  it("a fully paid (settled) due has taken the whole bill out of cash", () => {
    const f = empty();
    f.invTx.push(bill);
    f.liabilities.push({ id: "d", outstanding: 0, settled_at: "2026-09-26", recorded_at: "2026-09-20", notes: "x\nPaid 600 on 2026-09-25.\nPaid 400 on 2026-09-26." });
    expect(cashNet(buildCashLedger(f))).toBe(-1000);
  });
});

describe("vet fees saved twice (C14)", () => {
  const treatments = [{ cattle_id: "c1", vet_fee: 1000, additional_medical_cost: 500, treated_at: "2026-07-01", tag: "12" }];
  it("recognises the duplicate cost entry of a treatment", () => {
    expect(isTreatmentDuplicate({ category: "Medical/Vet Fee", amount: "1500", recorded_at: "2026-07-01", cattle_id: "c1" }, treatments)).not.toBeNull();
    expect(isTreatmentDuplicate({ category: "Medical/Vet Fee", amount: 1500, recorded_at: "2026-07-01", cattle_id: null, description: "Vet visit #12 fever" }, treatments)).not.toBeNull();
  });
  it("leaves every other deleted expense restorable", () => {
    expect(isTreatmentDuplicate({ category: "Medical/Vet Fee", amount: 1500, recorded_at: "2026-07-02", cattle_id: "c1" }, treatments)).toBeNull();
    expect(isTreatmentDuplicate({ category: "Medical/Vet Fee", amount: 1400, recorded_at: "2026-07-01", cattle_id: "c1" }, treatments)).toBeNull();
    expect(isTreatmentDuplicate({ category: "Labor", amount: 1500, recorded_at: "2026-07-01", cattle_id: "c1" }, treatments)).toBeNull();
    expect(isTreatmentDuplicate({ category: "Medical/Vet Fee", amount: 1500, recorded_at: "2026-07-01", cattle_id: "c2" }, treatments)).toBeNull();
  });
});

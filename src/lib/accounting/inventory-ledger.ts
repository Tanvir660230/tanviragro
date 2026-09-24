/**
 * Accounting view of the inventory ledger — ONE path for every movement (pure, no I/O).
 *
 *  purchase                         → Inventory up, Cash down (the ONLY cash movement)
 *  opening_balance                  → Inventory up, opening equity (stock already owned)
 *  own_production                   → Inventory up at ৳0 (e.g. grass from leased land; the
 *                                     land cost is already an expense — Rent & Lease)
 *  purchase_reversal (OUT)          → undoes a mistaken purchase row: reduces cash purchases
 *  consumption_reversal             → undoes a consumption row: reduces the same account
 *                                     the consumption was booked to (never a gain)
 *  OUT row with a cattle_id         → capitalised into that animal (Livestock)
 *  consumption, no cattle_id        → expensed: feed → Feed Expenses, medicine → Vet & Medical
 *  wastage / adjustment_out         → expensed as a stock loss (General)
 *  adjustment_in / return           → stock gain (reduces General)
 *  feed_mix_input / feed_mix_output → internal transformation: nets to ~0, any
 *                                     difference is a mixing variance (General)
 *
 * The ration ESTIMATE is never booked: only recorded ledger rows move money.
 * Invariant: inventoryValue = cashPurchases + openingBalance + otherIn + reversals − outTotal.
 */

export type LedgerTxInput = {
  type: string;                       // "purchase" = IN, "consumption" = OUT
  movement_type?: string | null;      // missing on legacy callers → derived from type
  qty: number | string;
  unit_cost: number | string | null;
  cattle_id: string | null;
  category?: string | null;           // inventory item category
};

export type InventoryLedgerSummary = {
  cashPurchases: number;
  openingBalance: number;
  /** non-cash stock-in other than opening: mixing output, count gains, returns, own production */
  otherIn: number;
  /** value of consumption reversals (already netted into the expense/capitalised figures) */
  reversals: number;
  outTotal: number;
  /** OUT rows tied to an animal (capitalised into livestock) */
  outCapitalized: number;
  /** herd feed eaten (consumption, no animal, feed/roughage/other) */
  feedExpense: number;
  /** medicine/supplement used without an animal */
  medicineExpense: number;
  /** wastage + adjustment_out + mix inputs − mix outputs − adjustment_in − returns (may be < 0) */
  otherNet: number;
  /** signed: never clamped */
  inventoryValue: number;
};

const IN_NON_CASH = new Set(["feed_mix_output", "adjustment_in", "return", "own_production"]);
const MEDICINE = new Set(["medicine", "supplement"]);

// Exact row value. Rounding each row to cents before adding lost/added poisha across hundreds
// of rows (৳0.20 on the production ledger), so only the totals are rounded (see below).
function value(t: LedgerTxInput): number {
  return Number(t.qty) * Number(t.unit_cost ?? 0);
}

const cents = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;

export function summarizeInventoryLedger(rows: LedgerTxInput[]): InventoryLedgerSummary {
  const s: InventoryLedgerSummary = {
    cashPurchases: 0, openingBalance: 0, otherIn: 0, reversals: 0, outTotal: 0, outCapitalized: 0,
    feedExpense: 0, medicineExpense: 0, otherNet: 0, inventoryValue: 0,
  };
  for (const t of rows) {
    const v = value(t);
    const isIn = t.type === "purchase";
    const mt = t.movement_type ?? (isIn ? "purchase" : "consumption");
    if (isIn) {
      if (mt === "consumption_reversal") {
        // undo: take the value back out of the account the consumption went to
        s.reversals += v;
        if (t.cattle_id) s.outCapitalized -= v;
        else if (MEDICINE.has(String(t.category ?? ""))) s.medicineExpense -= v;
        else s.feedExpense -= v;
        continue;
      }
      if (mt === "opening_balance") s.openingBalance += v;
      else if (IN_NON_CASH.has(mt)) { s.otherIn += v; s.otherNet -= v; }
      else s.cashPurchases += v;
      continue;
    }
    if (mt === "purchase_reversal") { s.cashPurchases -= v; continue; }   // the purchase never happened
    s.outTotal += v;
    if (t.cattle_id) { s.outCapitalized += v; continue; }
    if (mt === "consumption") {
      if (MEDICINE.has(String(t.category ?? ""))) s.medicineExpense += v;
      else s.feedExpense += v;
    } else {
      s.otherNet += v;   // wastage, adjustment_out, feed_mix_input
    }
  }
  s.inventoryValue = s.cashPurchases + s.openingBalance + s.otherIn + s.reversals - s.outTotal;
  for (const k of Object.keys(s) as (keyof InventoryLedgerSummary)[]) s[k] = cents(s[k]);
  return s;
}

/** Everything that leaves inventory without going into an animal, net of stock gains and reversals. */
export function unallocatedInventoryCost(s: InventoryLedgerSummary): number {
  return s.feedExpense + s.medicineExpense + s.otherNet;
}

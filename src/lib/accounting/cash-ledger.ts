/**
 * THE cash ledger — every taka that came in or went out, one dated row each (pure, no I/O).
 *
 * Cash on hand = opening cash + Σ rows. The homepage, Finance, the balance sheet, the trial
 * balance, the report and the cash statement all read this one list (through
 * lib/accounting/engine.ts), so they cannot show different cash figures.
 *
 *  in   partner investment · partner loan · cattle sale · loan received · bill bought on credit (not paid then)
 *  out  … · supplier due paid later (on the day it was paid)
 *  out  partner withdrawal / profit paid · cattle bought · every cost entry (expense or asset)
 *       · vet fee on a treatment · supplier purchase (net of reversals) · loan repayment
 *       · fixed asset without a payment record
 *
 * Not cash: opening stock, feed eaten, mixing, count differences, depreciation, loss
 * allocations between partners, soft-deleted rows.
 */
import { inventoryCashOut } from "@/lib/accounting/inventory-ledger";

export type CashCategory =
  | "Capital In"
  | "Capital Out"
  | "Cattle Sale"
  | "Cattle Purchase"
  | "Inventory"
  | "Operating Cost"
  | "Vet Fee"
  | "Asset Purchase"
  | "Asset Sale"
  | "Supplier Due"
  | "Profit Advance"
  | "Partner Loan"
  | "Loan Received"
  | "Loan Repayment";

export type CashRow = {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  category: CashCategory;
  amount: number; // always ≥ 0; the sign is `direction`
  direction: "in" | "out";
};

/** Raw rows, already filtered to one business and to rows that are not soft-deleted. */
export type CashLedgerInput = {
  partnerTx: { id: string; amount: number | string; type: string; recorded_at: string; partner_name?: string | null }[];
  sales: { id: string; sale_price_total: number | string; sold_at: string; buyer_name?: string | null; tag?: string | null }[];
  cattle: { id: string; purchase_price: number | string | null; purchase_date: string; tag_id?: string | null }[];
  costs: { id: string; amount: number | string; recorded_at: string; description?: string | null; category: string; entry_class: string | null }[];
  treatments: { id?: string | null; cattle_id: string; vet_fee: number | string | null; additional_medical_cost: number | string | null; treated_at: string; diagnosis?: string | null; tag?: string | null }[];
  invTx: { id: string | number; type: string; movement_type: string | null; qty: number | string; unit_cost: number | string | null; recorded_at: string; cattle_id: string | null; item_name?: string | null }[];
  fixedAssets: { id: string; name: string; category: string; purchase_date: string; purchase_cost: number | string; source_cost_entry_id?: string | null;
    is_active?: boolean | null; disposed_at?: string | null; disposal_value?: number | string | null }[];
  liabilities: { id: string; outstanding: number | string; settled_at: string | null; recorded_at?: string | null; lender?: string | null; name?: string | null; notes?: string | null }[];
  loans: { id: string; principal_amount: number | string; loan_date: string; lender_name?: string | null; loan_payments: { id?: string | null; amount: number | string; paid_at: string }[] | null }[];
};

const day = (d: string) => String(d).slice(0, 10);

/** Payments of a supplier due, as noted by paySupplierDue: "Paid 500 on 2026-09-26." */
export function duePayments(notes: string | null | undefined): { amount: number; date: string }[] {
  const out: { amount: number; date: string }[] = [];
  for (const m of String(notes ?? "").matchAll(/^Paid (\d+(?:\.\d+)?) on (\d{4}-\d{2}-\d{2})\.?$/gm)) out.push({ amount: Number(m[1]), date: m[2] });
  return out;
}

export function buildCashLedger(input: CashLedgerInput): CashRow[] {
  const rows: CashRow[] = [];
  const push = (r: Omit<CashRow, "amount" | "direction"> & { signed: number }) => {
    if (!Number.isFinite(r.signed) || Math.abs(r.signed) < 0.005) return;
    rows.push({ id: r.id, date: r.date, description: r.description, category: r.category,
      amount: Math.abs(r.signed), direction: r.signed > 0 ? "in" : "out" });
  };

  for (const t of input.partnerTx) {
    const who = t.partner_name ?? "Partner";
    if (t.type === "investment") push({ id: t.id, date: day(t.recorded_at), description: `Investment — ${who}`, category: "Capital In", signed: Number(t.amount) });
    else if (t.type === "withdrawal") push({ id: t.id, date: day(t.recorded_at), description: `Withdrawal — ${who}`, category: "Capital Out", signed: -Number(t.amount) });
    else if (t.type === "profit") push({ id: t.id, date: day(t.recorded_at), description: `Profit paid — ${who}`, category: "Capital Out", signed: -Number(t.amount) });
    else if (t.type === "advance") push({ id: t.id, date: day(t.recorded_at), description: `Profit advance — ${who}`, category: "Profit Advance", signed: -Number(t.amount) });
    else if (t.type === "loan_in") push({ id: t.id, date: day(t.recorded_at), description: `Loan from partner — ${who}`, category: "Partner Loan", signed: Number(t.amount) });
    else if (t.type === "loan_repay") push({ id: t.id, date: day(t.recorded_at), description: `Loan repaid to partner — ${who}`, category: "Partner Loan", signed: -Number(t.amount) });
    // loss_allocation moves no money
  }

  for (const s of input.sales) {
    push({ id: s.id, date: day(s.sold_at), description: `Cattle sold — #${s.tag ?? "?"}${s.buyer_name ? ` (${s.buyer_name})` : ""}`, category: "Cattle Sale", signed: Number(s.sale_price_total) });
  }

  for (const c of input.cattle) {
    push({ id: c.id, date: day(c.purchase_date), description: `Cattle purchased — #${c.tag_id ?? "?"}`, category: "Cattle Purchase", signed: -Number(c.purchase_price ?? 0) });
  }

  for (const e of input.costs) {
    const isAsset = e.entry_class === "asset";
    push({ id: e.id, date: day(e.recorded_at), description: e.description || e.category || "Cost entry", category: isAsset ? "Asset Purchase" : "Operating Cost", signed: -Number(e.amount) });
  }

  // the vet fee lives on the treatment row only (the old form's duplicate cost entries were removed, C14)
  input.treatments.forEach((t, i) => {
    const fee = Number(t.vet_fee ?? 0) + Number(t.additional_medical_cost ?? 0);
    push({ id: t.id ?? `treatment-${t.cattle_id}-${t.treated_at}-${i}`, date: day(t.treated_at),
      description: `Vet / treatment — #${t.tag ?? "?"}${t.diagnosis ? ` (${t.diagnosis})` : ""}`, category: "Vet Fee", signed: -fee });
  });

  for (const t of input.invTx) {
    const out = inventoryCashOut(t);
    push({ id: String(t.id), date: day(t.recorded_at), description: t.item_name ?? "Inventory purchase", category: "Inventory", signed: -out });
  }

  // assets bought with a cost entry (source_cost_entry_id) were paid by that entry
  for (const a of input.fixedAssets) {
    if (!a.source_cost_entry_id)
      push({ id: `fa-${a.id}`, date: day(a.purchase_date), description: `${a.name} (${a.category})`, category: "Asset Purchase", signed: -Number(a.purchase_cost) });
    // money got for a sold asset comes in on its disposal day
    if (a.is_active === false && a.disposed_at && Number(a.disposal_value ?? 0) > 0)
      push({ id: `fa-sale-${a.id}`, date: day(a.disposed_at), description: `Asset sold — ${a.name}`, category: "Asset Sale", signed: Number(a.disposal_value) });
  }

  // a purchase memo books the whole bill above; what was owed to the shop had not left then.
  // Payments made later ("Paid <amount> on <date>" in the notes) leave on their own day.
  for (const l of input.liabilities) {
    const payments = duePayments(l.notes);
    const paid = payments.reduce((s, p) => s + p.amount, 0);
    const owedNow = l.settled_at ? 0 : Number(l.outstanding);
    const shop = l.lender ?? l.name ?? "supplier";
    push({ id: `due-${l.id}`, date: day(l.recorded_at ?? "0000-01-01"), description: `Bought on credit — ${shop}`, category: "Supplier Due", signed: owedNow + paid });
    payments.forEach((p, i) => push({ id: `duepay-${l.id}-${i}`, date: p.date, description: `Due paid — ${shop}`, category: "Supplier Due", signed: -p.amount }));
  }

  for (const l of input.loans) {
    push({ id: `loan-${l.id}`, date: day(l.loan_date), description: `Loan received — ${l.lender_name ?? ""}`, category: "Loan Received", signed: Number(l.principal_amount) });
    (l.loan_payments ?? []).forEach((p, i) => {
      push({ id: `loanpay-${p.id ?? `${l.id}-${i}`}`, date: day(p.paid_at), description: `Loan repayment — ${l.lender_name ?? ""}`, category: "Loan Repayment", signed: -Number(p.amount) });
    });
  }

  // chronological; on the same day money in before money out
  rows.sort((a, b) => a.date.localeCompare(b.date) || (a.direction === b.direction ? 0 : a.direction === "in" ? -1 : 1));
  return rows;
}

export const signedAmount = (r: CashRow) => (r.direction === "in" ? r.amount : -r.amount);

/** Net of all rows (not rounded; round once where shown). */
export function cashNet(rows: CashRow[]): number {
  return rows.reduce((s, r) => s + signedAmount(r), 0);
}

/** Rows before `from` fold into the opening balance; rows after `to` are left out. */
export function cashStatement(rows: CashRow[], openingCash: number, from?: string, to?: string) {
  let openingBalance = openingCash;
  const transactions: CashRow[] = [];
  for (const r of rows) {
    if (from && r.date < from) openingBalance += signedAmount(r);
    else if (!to || r.date <= to) transactions.push(r);
  }
  return { openingBalance, transactions, closingBalance: openingBalance + cashNet(transactions) };
}

/** Cash on hand at the end of `date` (inclusive). */
export function cashOnDate(rows: CashRow[], openingCash: number, date: string): number {
  return openingCash + cashNet(rows.filter((r) => r.date <= date));
}

/** Display names of the cash ledger categories (statement, Money page). */
export const CASH_CATEGORY_LABEL: Record<CashCategory, { bn: string; en: string }> = {
  "Capital In": { bn: "মূলধন জমা", en: "Capital in" },
  "Capital Out": { bn: "মূলধন তোলা / লাভ দেওয়া", en: "Capital out / profit paid" },
  "Cattle Sale": { bn: "গরু বিক্রি", en: "Cattle sold" },
  "Cattle Purchase": { bn: "গরু কেনা", en: "Cattle bought" },
  "Inventory": { bn: "খাবার/স্টক কেনা", en: "Feed & stock bought" },
  "Operating Cost": { bn: "খরচ", en: "Expenses" },
  "Vet Fee": { bn: "ডাক্তার/চিকিৎসা", en: "Vet & treatment" },
  "Asset Purchase": { bn: "সম্পদ কেনা", en: "Assets bought" },
  "Asset Sale": { bn: "সম্পদ বিক্রি", en: "Assets sold" },
  "Supplier Due": { bn: "দোকানে বাকি", en: "Supplier dues" },
  "Profit Advance": { bn: "লাভের অগ্রিম", en: "Profit advances" },
  "Partner Loan": { bn: "অংশীদারের ধার", en: "Partner loans" },
  "Loan Received": { bn: "ঋণ নেওয়া", en: "Loans received" },
  "Loan Repayment": { bn: "ঋণ শোধ", en: "Loan repayments" },
};

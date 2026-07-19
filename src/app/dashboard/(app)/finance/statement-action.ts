"use server";

import { createClient } from "@/lib/supabase/server";

export type TxnCategory =
  | "Capital In"
  | "Capital Out"
  | "Cattle Sale"
  | "Cattle Purchase"
  | "Inventory"
  | "Operating Cost"
  | "Asset Purchase";

export type TxnRow = {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  category: TxnCategory;
  amount: number;
  direction: "in" | "out";
};

export type StatementResult = {
  businessName: string;
  openingBalance: number;
  transactions: TxnRow[];
};

export async function getStatementData(
  from?: string,
  to?: string
): Promise<StatementResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { businessName: "", openingBalance: 0, transactions: [] };

  const { data: bizData } = await supabase
    .from("businesses")
    .select("id, name, opening_cash_balance")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!bizData) return { businessName: "", openingBalance: 0, transactions: [] };

  const biz = bizData as { id: string; name: string; opening_cash_balance: number | null };
  const businessId = biz.id;
  const openingCash = Number(biz.opening_cash_balance ?? 0);
  const businessName = biz.name ?? "Farm";

  const [
    { data: ptData },
    { data: salesData },
    { data: cattleData },
    { data: invData },
    { data: costData },
    { data: fixedAssetData },
  ] = await Promise.all([
    supabase
      .from("partner_transactions")
      .select("id, amount, type, recorded_at, partners!inner(business_id, name)")
      .eq("partners.business_id", businessId)
      .in("type", ["investment", "withdrawal", "profit"])
      .order("recorded_at", { ascending: true }),

    supabase
      .from("sales")
      .select("id, sale_price_total, sold_at, buyer_name, cattle!inner(business_id, tag_id)")
      .eq("cattle.business_id", businessId)
      .is("deleted_at", null)
      .order("sold_at", { ascending: true }),

    // Include soft-deleted cattle — their purchase was a real cash outflow
    // that must appear in the statement regardless of later soft-deletion.
    supabase
      .from("cattle")
      .select("id, purchase_price, purchase_date, tag_id")
      .eq("business_id", businessId)
      .order("purchase_date", { ascending: true }),

    supabase
      .from("inventory_transactions")
      .select("id, qty, unit_cost, recorded_at, inventory_items!inner(business_id, name)")
      .eq("inventory_items.business_id", businessId)
      .eq("type", "purchase")
      .not("unit_cost", "is", null)
      .order("recorded_at", { ascending: true }),

    supabase
      .from("cost_entries")
      .select("id, amount, recorded_at, description, category, entry_class")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("recorded_at", { ascending: true }),

    // Fixed assets (added via Fixed Assets page) are cash outflows not in cost_entries
    supabase
      .from("fixed_assets")
      .select("id, name, category, purchase_date, purchase_cost")
      .eq("business_id", businessId)
      .order("purchase_date", { ascending: true }),
  ]);

  type PtRow = { id: string; amount: number; type: string; recorded_at: string; partners: { name: string } | null };
  type SaleRow = { id: string; sale_price_total: number; sold_at: string; buyer_name: string | null; cattle: { tag_id: string } | null };
  type CattleRow = { id: string; purchase_price: number; purchase_date: string; tag_id: string };
  type InvTxnRow = { id: string; qty: number; unit_cost: number; recorded_at: string; inventory_items: { name: string } | null };
  type CostRow = { id: string; amount: number; recorded_at: string; description: string | null; category: string; entry_class: string | null };
  type AssetRow = { id: string; name: string; category: string; purchase_date: string; purchase_cost: number };

  const all: TxnRow[] = [];

  for (const t of (ptData ?? []) as PtRow[]) {
    all.push({
      id: t.id,
      date: t.recorded_at.slice(0, 10),
      description:
        t.type === "investment"
          ? `Investment — ${t.partners?.name ?? "Partner"}`
          : t.type === "profit"
          ? `Profit paid — ${t.partners?.name ?? "Partner"}`
          : `Withdrawal — ${t.partners?.name ?? "Partner"}`,
      category: t.type === "investment" ? "Capital In" : "Capital Out",
      amount: Number(t.amount),
      direction: t.type === "investment" ? "in" : "out",
    });
  }

  for (const s of (salesData ?? []) as SaleRow[]) {
    all.push({
      id: s.id,
      date: s.sold_at.slice(0, 10),
      description: `Cattle sold — #${s.cattle?.tag_id ?? "?"}${s.buyer_name ? ` (${s.buyer_name})` : ""}`,
      category: "Cattle Sale",
      amount: Number(s.sale_price_total),
      direction: "in",
    });
  }

  for (const c of (cattleData ?? []) as CattleRow[]) {
    all.push({
      id: c.id,
      date: c.purchase_date,
      description: `Cattle purchased — #${c.tag_id}`,
      category: "Cattle Purchase",
      amount: Number(c.purchase_price),
      direction: "out",
    });
  }

  for (const inv of (invData ?? []) as InvTxnRow[]) {
    all.push({
      id: inv.id,
      date: inv.recorded_at.slice(0, 10),
      description: inv.inventory_items?.name ?? "Inventory purchase",
      category: "Inventory",
      amount: Number(inv.qty) * Number(inv.unit_cost),
      direction: "out",
    });
  }

  for (const e of (costData ?? []) as CostRow[]) {
    const isAsset = e.entry_class === "asset";
    all.push({
      id: e.id,
      date: e.recorded_at.slice(0, 10),
      description: e.description || e.category || "Cost entry",
      category: isAsset ? ("Asset Purchase" as TxnCategory) : "Operating Cost",
      amount: Number(e.amount),
      direction: "out",
    });
  }

  for (const a of (fixedAssetData ?? []) as AssetRow[]) {
    all.push({
      id: `fa-${a.id}`,
      date: a.purchase_date,
      description: `${a.name} (${a.category})`,
      category: "Asset Purchase" as TxnCategory,
      amount: Number(a.purchase_cost),
      direction: "out",
    });
  }

  // Sort chronologically; same-day: in before out
  all.sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    return a.direction === b.direction ? 0 : a.direction === "in" ? -1 : 1;
  });

  // Split: transactions before `from` adjust the opening balance; the rest go into the statement
  let openingBalance = openingCash;
  const filtered: TxnRow[] = [];

  for (const txn of all) {
    if (from && txn.date < from) {
      // Before the period starts: adjust opening balance
      openingBalance += txn.direction === "in" ? txn.amount : -txn.amount;
    } else if (!to || txn.date <= to) {
      // Within the period: show in statement
      filtered.push(txn);
    }
    // After the period ends: intentionally excluded from both
    // (they don't affect the opening balance or the visible statement)
  }

  return { businessName, openingBalance, transactions: filtered };
}

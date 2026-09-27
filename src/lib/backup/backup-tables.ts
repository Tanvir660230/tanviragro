import type { SupabaseClient } from "@supabase/supabase-js";
import { selectAll } from "@/lib/supabase/select-all";

/**
 * Every table that holds this farm's own records — one list for the download and the weekly backup.
 * A table missing here is a table missing from the backup, so a new record table is added here too.
 *
 * `scope` says how a row belongs to a business: its own business_id, or its parent's id
 * (an animal, a stock item, a recipe, a partner or a feed period).
 */
type Scope = "business" | "cattle" | "items" | "recipes" | "partners" | "periods";
export const BACKUP_TABLES: { table: string; scope: Scope; column: string }[] = [
  { table: "cattle", scope: "business", column: "business_id" },
  { table: "cattle_purchase_groups", scope: "business", column: "business_id" },
  { table: "cattle_sale_groups", scope: "business", column: "business_id" },
  { table: "weight_logs", scope: "cattle", column: "cattle_id" },
  { table: "sales", scope: "cattle", column: "cattle_id" },
  { table: "cattle_death_records", scope: "business", column: "business_id" },
  { table: "health_events", scope: "business", column: "business_id" },
  { table: "cattle_treatments", scope: "cattle", column: "cattle_id" },
  { table: "cost_entries", scope: "business", column: "business_id" },
  { table: "cost_entry_audit", scope: "business", column: "business_id" },
  { table: "expense_categories", scope: "business", column: "business_id" },
  { table: "fixed_assets", scope: "business", column: "business_id" },
  { table: "market_prices", scope: "business", column: "business_id" },
  { table: "inventory_items", scope: "business", column: "business_id" },
  { table: "inventory_transactions", scope: "items", column: "item_id" },
  { table: "feed_recipes", scope: "business", column: "business_id" },
  { table: "recipe_ingredients", scope: "recipes", column: "recipe_id" },
  { table: "feed_mix_batches", scope: "business", column: "business_id" },
  { table: "feed_usage_periods", scope: "business", column: "business_id" },
  { table: "feed_usage_period_lines", scope: "periods", column: "period_id" },
  { table: "feed_usage_period_events", scope: "periods", column: "period_id" },
  { table: "partners", scope: "business", column: "business_id" },
  { table: "partner_transactions", scope: "partners", column: "partner_id" },
  { table: "partner_share_rules", scope: "business", column: "business_id" },
  { table: "partner_cycles", scope: "business", column: "business_id" },
  { table: "management_fee_rates", scope: "business", column: "business_id" },
  { table: "cash_counts", scope: "business", column: "business_id" },
  { table: "financial_locks", scope: "business", column: "business_id" },
  { table: "liabilities", scope: "business", column: "business_id" },
  { table: "loans", scope: "business", column: "business_id" },
];

// a long id list goes in the URL, so ask in slices
const ID_CHUNK = 150;

async function readTable(supabase: SupabaseClient, table: string, column: string, ids: string[] | null): Promise<Record<string, unknown>[]> {
  // every page, ordered by the unique id (a single read stops at 1,000 rows)
  if (ids === null) return selectAll<Record<string, unknown>>(() => supabase.from(table).select("*").order("id"));
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const part = ids.slice(i, i + ID_CHUNK);
    out.push(...await selectAll<Record<string, unknown>>(() => supabase.from(table).select("*").in(column, part).order("id")));
  }
  return out;
}

/**
 * Reads every backup table in full. With a business id, only that business's rows;
 * without one (the service-role weekly job), every row.
 */
export async function readBackupTables(supabase: SupabaseClient, businessId: string | null): Promise<Record<string, Record<string, unknown>[]>> {
  const idsOf = async (table: string): Promise<string[]> =>
    (await selectAll<{ id: string }>(() => supabase.from(table).select("id").eq("business_id", businessId!).order("id"))).map((r) => r.id);
  const parents: Record<Scope, string[] | null> = businessId
    ? {
        business: [businessId],
        cattle: await idsOf("cattle"),
        items: await idsOf("inventory_items"),
        recipes: await idsOf("feed_recipes"),
        partners: await idsOf("partners"),
        periods: await idsOf("feed_usage_periods"),
      }
    : { business: null, cattle: null, items: null, recipes: null, partners: null, periods: null };

  const out: Record<string, Record<string, unknown>[]> = {};
  for (const t of BACKUP_TABLES) out[t.table] = await readTable(supabase, t.table, t.column, parents[t.scope]);
  return out;
}

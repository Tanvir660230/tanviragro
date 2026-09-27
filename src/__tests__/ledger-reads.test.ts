/**
 * The Supabase API returns at most 1,000 rows per read. The stock ledger grows every day
 * (automatic feed deduction), so a read of it that is not paged would one day stop short and
 * every total built on it would be silently wrong — here every ledger read is checked.
 */
import fs from "fs";
import path from "path";
import { BACKUP_TABLES } from "@/lib/backup/backup-tables";

const SRC = path.join(__dirname, "..");
const files = (dir: string, out: string[] = []): string[] => {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { if (!/__tests__|node_modules/.test(p)) files(p, out); }
    else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
};

// a read that can only ever return a few rows: one row, a count, a write, a given list of ids, an expiry window
const BOUNDED = /\.(single|maybeSingle|limit|insert|update|delete|upsert)\(|head:\s*true|\.(in|eq)\("(id|reverses_id|idempotency_key)"|"expiry_date"/;

function unpagedLedgerReads(): string[] {
  const out: string[] = [];
  for (const f of files(SRC)) {
    const s = fs.readFileSync(f, "utf8");
    const re = /\.from\(\s*["'`](inventory_transactions)["'`]\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      // selectAll(() => supabase.from(…)  or  selectAll(() => { let q = supabase.from(…)
      const before = s.slice(Math.max(0, m.index - 200), m.index);
      if (/selectAll(<[^>]*>)?\(\s*\(\)\s*=>\s*(\{\s*(let|const) \w+ = )?\w+\s*$/.test(before)) continue;
      const chain = s.slice(m.index, m.index + 700).split(/;\s*\n|\n\s*\n|\n\s*(?:const|let|return|if|await)\b/)[0];
      if (!/\.select\(/.test(chain) || BOUNDED.test(chain)) continue;
      out.push(`${path.relative(SRC, f)}:${s.slice(0, m.index).split("\n").length}`);
    }
  }
  return out;
}

describe("the stock ledger is always read in full", () => {
  test("every open-ended read of inventory_transactions goes through selectAll", () => {
    expect(unpagedLedgerReads()).toEqual([]);
  });
});

describe("the backup carries every record table", () => {
  test("the farm's records are all in the backup list", () => {
    const tables = BACKUP_TABLES.map((t) => t.table);
    for (const t of [
      "cattle", "cattle_purchase_groups", "cattle_sale_groups", "weight_logs", "sales", "cattle_death_records", "health_events", "cattle_treatments",
      "cost_entries", "expense_categories", "fixed_assets", "market_prices",
      "inventory_items", "inventory_transactions", "feed_recipes", "recipe_ingredients", "feed_mix_batches",
      "feed_usage_periods", "feed_usage_period_lines", "feed_usage_period_events",
      "partners", "partner_transactions", "partner_share_rules", "partner_cycles", "cash_counts",
    ]) expect(tables).toContain(t);
    expect(new Set(tables).size).toBe(tables.length);
  });
  test("the download and the weekly job read the same list, page by page", () => {
    const route = fs.readFileSync(path.join(SRC, "app/api/backup/route.ts"), "utf8");
    const cron = fs.readFileSync(path.join(SRC, "app/api/backup/backup-helpers.ts"), "utf8");
    expect(route).toMatch(/readBackupTables/);
    expect(cron).toMatch(/readBackupTables/);
    expect(route + cron).not.toMatch(/\.from\("inventory_transactions"\)/);
  });
});

# Feed Costing & Inventory — Implementation Report

- **Date:** 2026-09-24
- **Branch:** `chore/phase0-baseline`. All changes are **uncommitted**.
- **Production:** read-only access only. **No production data or schema was changed by this work.** One incident is described in §8: 30 rows were written by the *old* code through a local dev server.
- **Design reference:** `docs/FEED_SYSTEM_ARCHITECTURE.md`.
- **Superseded in part by `docs/FEED_USAGE_FINAL_REPORT.md`** (usage periods, moving-average costing, weight-based allocation, reversal-based purchase edits). Where the two differ, the final report is current.

---

## 1. Summary

The feed system now has one ledger with explicit movement types, and one accounting path per movement. All costs use weighted-average cost as of the movement date, and every correction is audited.

| # | Change |
|---|---|
| 1 | Stock is never deducted automatically. |
| 2 | The ration plan and recorded consumption are separate numbers. |
| 3 | Negative stock is shown, not hidden. |
| 4 | Missing and ৳0 prices are labelled, never guessed. |
| 5 | Hay counted in pieces is never priced per kg without a known kg-per-piece. |
| 6 | Mixing is an internal transformation. |
| 7 | Only supplier purchases count as cash. |
| 8 | The ration estimate is no longer booked in accounting. |

The code is complete and verified locally:
- Database tests: 30/30. Concurrency test: PASS. Rollback test: PASS.
- tsc: clean. Lint: 0 errors. Jest: 421/421. Production build: OK.

**Production is not migrated yet.** The owner must run the SQL files in §9 (baseline, three migrations, corrections) **before** the new code is deployed.

## 2. Safety and scope

| Check | Result |
|---|---|
| Backup | Two full read-only exports of the 11 feed-related tables, kept outside the repo: 2026-09-24 15:20 (665 inventory rows) and 16:08 (695 rows). |
| Credentials | Only the current key from `.env.local` was used. `Data.txt` was not used. No key was printed, logged or written to any file in the repo. |
| Secret scan of changed and new files | No keys found. `.env.local` and `Data.txt` are git-ignored and untracked. |
| Production writes by me | None. All DDL, corrections and tests ran on local PostgreSQL 17 copies (`prodcopy`, `prodcopy_rb`) built from the export. |
| Commits, pushes, deploys | None. |
| Credential rotation | Not done. This is an owner action (§11). |
| The 6 production recipes | Unchanged. All balance exactly (Σ ingredients = batch size), so the new constraint accepts them. |

## 3. Database changes (new files, not yet applied to production)

1. **`supabase/migrations/20260925090000_baseline_drift_columns.sql`.** Records columns that exist in production but not in the migrations (`IF NOT EXISTS`). It is a no-op on production.
2. **`supabase/migrations/20260925100000_feed_inventory_ledger.sql`.** One transaction, idempotent, additive only. No row is deleted, and no existing qty, cost, date or note is changed. It adds:
   - **Movement types:** also `own_production` (grass from the leased land, ৳0, not cash) and `consumption_reversal` (audited undo of a consumption row).
   - **Ledger columns:** `movement_type`, `cost_source`, `is_estimate`, `idempotency_key` (unique), `reverses_id`, `created_by`. Existing rows are classified from type + notes, and every non-trivial classification is written to the new `inventory_ledger_audit` table.
   - **Constraints:**
     - `qty > 0`;
     - `unit_cost >= 0`;
     - direction must match `movement_type`;
     - valid enum values;
     - recipe quantities > 0;
     - active recipes must balance (deferred trigger).
   - **Costing:** `inventory_unit_cost_as_of()` computes WAC. The insert trigger values every OUT row at WAC, labels IN rows, takes a per-item advisory lock and rejects overdraws.
   - **Views and functions:**
     - `v_inventory_balance`: signed stock and value;
     - `record_herd_feeding()`: explicit, idempotent daily feeding;
     - `produce_feed_batch()`: atomic, idempotent mixing that scales by the ingredient total, values the output at input cost, and marks it `missing` if any input cost is unknown.
   - **Units:** `inventory_items.kg_per_unit`. It is 1 for kg items and NULL (unknown) for everything else.
3. **`supabase/migrations/20260925110000_expense_categories.sql`.** Configurable expense categories (utilities first), `cost_entries.category_id` / `attachment_path`, the automatic `cost_entry_audit` trigger, the generic `data_correction_audit` table, and the private `expense-bills` bucket (§12).
4. **`supabase/migrations/20260925120000_weight_types.sql`.** `cattle.initial_weight_type` and `weight_logs.weight_type` (measured / estimated) (§12).
5. **`supabase/corrections/20260925_feed_historical_corrections.sql`.** See §5.
6. **Rollbacks:** one per file in `supabase/rollback/` (corrections, ledger, expense categories, weight types). Tested together in §6.

## 4. Application changes

| Area | Before | After |
|---|---|---|
| Inventory page | `AutoEngineRunner` ran `runAutoFeedDeductions()` on every page view and back-filled formula consumption for every missing day | Component and engine deleted. Rendering writes nothing. |
| Recipe / roughage settings | Activating a recipe or roughage, or changing a recipe start date, ran the engine (back-dated consumption) | Only the plan changes |
| Daily feeding | "Daily Deduction" split the plan **equally** across items; roughage kg was entered against a piece item | **Record Feeding**: per-item quantities in each item's own unit, pre-filled from recipe proportions; piece roughage is filled only when kg/piece is known. Idempotent per date and item. |
| Mixing (2 UIs) | Scaled by `output_qty`; output inserted as a **purchase**; optional output (value lost); ingredients + output in 2 requests | RPC `produce_feed_batch` (one transaction, `feed_mix_input` / `feed_mix_output`, scaled by Σ ingredients, output item required, batch id prevents double submit) |
| Recipes | No balance check | Live check in the builder; server check on create and activate; DB constraint |
| Initial stock | Always a purchase (cash) | User chooses "Already on the farm" (**opening balance**, default) or "Bought now" (purchase) |
| Stock count / true-up | Written as purchase/consumption at FIFO cost | `adjustment_in` / `adjustment_out` / `wastage`, valued by the DB |
| Feed waste | Consumption | `wastage` |
| Feed session / quick dispense | Ledger row at the client's or latest price **plus** a `cost_entries` expense (feed counted twice) | Ledger row only, valued by the DB |
| ৳0 / missing price | Treated as free / 0 | Tick "really free" (`zero_confirmed`), else `zero_unconfirmed`; no price = `missing` ("Cost unknown") |
| `kg_per_unit` | — | Field in the Add and Edit item dialogs; empty = unknown |
| Stock display | `Math.max(0, …)` in page, engine, costing, optimistic UI | Signed; red "Negative stock — a purchase or count is missing" |
| Item cost | FIFO remaining layers / latest purchase price | WAC of IN rows with a known cost |
| Today's plan cost | Roughage kg × ৳/piece; missing prices = ৳0 | Unit-aware; unknown items listed as "Cost unknown"; labelled "Estimate (plan)" |
| Cattle page feed cost | Direct logs, else the **estimate** (৳/piece × kg, latest price) as if it were cost | **Actual**: own rows plus a head-day share of herd rows. **Estimate (plan)** shown separately. NOT RECORDED days, legacy formula rows and unpriced rows are disclosed. |
| Valuation, cost basis, finance, partners, global search | Estimate fallback per animal | Actual share of recorded herd feeding (`getHerdFeedShareByCattle`) |
| Accounting engine | Estimate capitalised into livestock (≈ ৳184k) **and** herd consumption expensed; inventory = max(0, purchases − consumption − estimate); every IN row counted as cash | Estimate removed; one path per movement (`inventory-ledger.ts`); only `purchase` is cash; opening stock → partner capital; herd feed → Feed Expenses 5200; losses / count differences / mixing variance → 6600; inventory = signed ledger value; all posted in the trial balance |
| Cash and spend views (cash, statement, analytics, dashboard, purchase history, activity, product page) | `type='purchase'` | `movement_type='purchase'` |
| Feed & Nutrition page | Four invented feeds (850 kg @ ৳42, 1,200 kg straw @ ৳8.5, mustard cake, mineral mix) with fake ids that made sessions fail | Real kg items, signed stock, WAC price or "No data"; nutrients marked "typical values, not measured" |
| `getFarmDailyFeedRequirement` | Selected a non-existent column (`roughage_type`), so the roughage start date was silently ignored | Reads `businesses.default_roughage_type`; returns plan lines |
| Workflow demo template | Invented stock numbers in labels | Numbers removed (the template is demo-only and writes nothing) |

New modules:
- `src/lib/inventory/recipe-math.ts`
- `feed-costing.ts`
- `feed-batch.ts`
- `herd-feed-share.ts`
- `src/lib/accounting/inventory-ledger.ts`
- `src/components/inventory/ledger-fields.tsx`

## 5. Historical corrections

Only mathematically supported corrections are applied. Each one writes to `inventory_ledger_audit` and each has a rollback.

| ID | Correction | How | Status |
|---|---|---|---|
| C1 | 2026-08-29 deducted twice (7 items) | `consumption_reversal` of the duplicate (same cost) + the same quantity recorded as consumption on 2026-09-03, linked by `reverses_id`. Value-neutral. | Applied by script |
| C2 | Opening hay ৳3,299.40 recorded as a purchase | Reclassified to `opening_balance` by the migration (audited). No longer counted as cash. | Applied by migration |
| C3 | 50 kg কুড়া at ৳0 (2026-08-25) | Owner confirmed it was received free: labelled `zero_confirmed` (৳0, no cash). Quantity and price unchanged. | Applied by script |
| C4 | Mix Feed consumption with no cost | Filled at WAC (৳45/kg) for the 122 kg actually bought: ৳5,490. | Applied by script |
| C5 | Straw consumption with no cost (12 rows) | Filled at WAC as of each date: ৳722.75 | Applied by script |
| C6 | WiFi bill ৳1,050 in category "feed" | Moved to Utilities › WiFi / Internet (category text and `category_id`); logged in `data_correction_audit` and `cost_entry_audit`. | Applied by script |
| C7/C8 | Per-animal and accounting overstatement | Fixed by code (§4); no data change needed | Done in code |
| C9 | 30 rows the removed engine wrote on 2026-09-24 (§8) | Each undone by a `consumption_reversal` (same qty and cost). The originals stay as evidence. Those 5 days show as NOT RECORDED. | Applied by script |
| C11 | Mix Feed deducted 34.38 kg more than ever existed | The only Mix Feed stock-in is the external purchase of 122 kg @ ৳45 on 2026-06-01 (an ordinary purchase row, correct as it is; the owner confirmed all Mix Feed came from it). The old engine kept deducting by formula to 156.38 kg. Exactly the excess (3.78 kg of 06-14, all of 06-15 and 06-16) is undone at ৳0, because it never existed. Balance: 0 kg. | Applied by script |
| C12 | C005 / C006 initial weights 180 / 250 kg were estimates | Labelled `estimated` (the values stay). The 2026-09-14 weighings (200 / 210 kg) are the measurements. | Applied by script |

**Not assumed and not changed:**
- no quantity or price was invented;
- the 22 days without recorded feeding stay NOT RECORDED;
- the straw physical count (the owner mentions about 128 pieces; the ledger shows 240) is not applied automatically, because it should be entered as a stock count on a known date (§11).

## 6. Tests

| Suite | Result |
|---|---|
| `supabase/tests/run_feed_ledger_tests.sh` (real Postgres, all migrations replayed): own production at ৳0, reversal rules (must reference a consumption row, not a new price), expense categories (seeded, unique, business-scoped), cost-entry audit (insert/update/soft delete), weight types; purchase, WAC, client cost ignored, idempotent feeding, no automatic rows, recipe balance, negative ingredient, mixing (12 + 8 kg, no purchase, cost 38/kg, duplicate batch rejected, unpriced input → output `missing`), overdraw rejected, legacy negative visible, WAC stable after later purchases and back-dating, ৳0 vs missing, opening and adjustment not cash, direction mismatch rejected, piece has no conversion | **39 / 39 pass** |
| `feed_ledger_concurrency.sh`: two sessions spend the same 10 kg at once | **PASS** (one succeeds, stock 0.00) |
| `feed_ledger_rollback.sh` on the current production copy (695 rows): 3 migrations + corrections (twice) → corrections rollback (twice) → weight, expense and ledger rollbacks | **PASS**: all original rows byte-identical, stock and value per item identical, cost entries and cattle identical, columns removed, old guard restored, audit trail kept. (This test found and fixed a missing enum cast in the corrections rollback.) |
| `src/__tests__/feed-costing.test.ts` (new): recipe balance and scaling, WAC (missing ≠ 0, explicit 0 included, not latest price), units (no ৳/piece × kg), estimate reports unknown roughage cost, head-day allocation, no double count, NOT RECORDED days, accounting paths (cash only purchases, mixing nets to 0, invariant, signed inventory), negative stock, source guards (no auto trigger, no fake feeds, no parallel cost entries, no estimate fallback) | **24 / 24 pass** |
| `src/__tests__/farm-records.test.ts` (new): C006 is not a 40 kg loss, growth from the first weighing, estimated logs ignored, utility account follows the kind (rename-safe), legacy WiFi → Utilities, category name rules, monthly summary, reversal reduces feed expense, own production ৳0/not cash, reversed day NOT RECORDED, form/source guards | **14 / 14 pass** |
| Full Jest | **435 / 435** (57 suites) |
| `tsc --noEmit` | clean |
| ESLint | 0 errors. 8 warnings, all in files not touched here. |
| `next build` (placeholder env) | success |

## 7. Reconciliation — before / after

"Before" = production today as the app shows it. "After" = the same production data (backup 2026-09-24 16:08, 695 rows) on a local copy with the migration and corrections applied, computed with `docs/sql/feed_ledger_reconciliation.sql` and the new app functions.

| Measure | Before | After |
|---|---:|---:|
| Automatic deductions | On every inventory page view | **None** |
| Per-animal feed cost shown (6 animals) | ৳180,599 (estimate presented as cost; > all feed ever acquired) | **Actual ৳94,060** (recorded, head-day allocated; equals recorded herd consumption ৳94,023.68 + ৳36.66 logged per animal). **Estimate (plan) ৳121,792**, shown separately; straw is costed per piece from recorded pieces, so it is not priced in the kg plan. |
| Hay unit error (৳/piece × kg) | ≈ ৳37,648 | **0** (straw costed per piece; ৳/piece is never multiplied by kg) |
| Latest-price error | ≈ ৳23,622 | **0** (WAC) |
| Feed brought in | ৳129,025, all counted as cash | Cash purchases **৳125,725.57** + opening balance **৳3,299.40** (not cash) + 50 kg bran received free (৳0, no cash) |
| Estimate capitalised into livestock | ≈ ৳184,314 | **৳0** |
| Feed cost in accounting | ৳109,889 expensed + ৳184k capitalised (double) | One path: herd feed ৳94,023.68 → Feed Expenses; ৳36.66 → animal; stock-count losses net ৳22,041.27 → General |
| Feed inventory on balance sheet | ৳0 (clamped) | **৳12,923.35** ledger value = qty × current moving-average cost (৳12,923.34). The earlier ৳11,498 came from a cumulative average that kept eaten lots in the price; it was wrong and has been replaced. |
| Mix Feed balance | Shown as 0, really −34.38 kg | **0 kg** (the 34.38 kg over-deduction undone, C11); any future negative stock is shown |
| Consumption rows without a cost | 28 | **0** |
| ৳0 purchase | Silently free | 1 row confirmed free (`zero_confirmed`) |
| Double-deducted day (2026-08-29) | 7 items twice | Reversed and re-dated, audited |
| 30 rows written by a page view on 2026-09-24 | Would count as feeding | Reversed (C9), audited, originals kept |
| Days with no recorded feeding | Hidden or back-filled by the engine | **22 days NOT RECORDED**: 06-15..19, 08-21, 09-07..17, 09-20..24 |
| WiFi bill | Counted as feed | Utilities › WiFi / Internet |
| C005 / C006 growth | 180→200 kg and 250→210 kg read as growth / a 40 kg loss | Initial weights labelled estimated; growth is shown from the first weighing once weighed again |
| Integrity checks (null meaning, qty ≤ 0, direction, duplicate keys, unbalanced active recipes) | — | **all 0** |

## 8. Incident: 30 rows written to production by the old engine (2026-09-24)

The second read-only check found **695** inventory rows instead of the 665 in the first backup.

**What was written:**
- **Rows:** 30 rows, all "Auto-Feed Deduction: 2026-09-20 … 2026-09-24".
- **Items:** 6 ingredients × 5 days, worth ৳5,487.63.
- **When:** created 09:27:17–09:27:30 UTC, 7 minutes after the first backup.
- **Everything else:** the other 665 rows and all other tables are byte-identical.

**How it happened:**
- **The request:** the local dev server started earlier for "run localhost" logged `GET /dashboard/inventory` followed by a 20-second `POST /dashboard/inventory`. That is the old `AutoEngineRunner` running the engine.
- **Why it reached production:** that dev server uses `.env.local`, which points at **production**.
- **Who opened the page:** I did not open a browser. The page was opened in a browser on this computer.

This is exactly the defect this work removes. Actions taken:
- I stopped the dev server.
- I took a new read-only backup.
- I re-ran every test and reconciliation on the new data (§6, §7).
- I did not delete any row.

**Classification:** automatic-deduction rows created by the faulty system (formula quantities, one page view, the last day not yet ended). They are not duplicates, not test data, and not a recording of feeding. Following the owner's instruction (accuracy first, keep the evidence), correction C9 undoes each one with an audited `consumption_reversal`, and the original rows stay in the ledger. Those 5 days show as NOT RECORDED until real feeding or a stock count is entered.

**Until the new code is deployed, every view of the Inventory page on the live site or on a local dev server can add more of these rows.** Please avoid that page until deployment, and do not run a local dev server against production.

## 9. Production deployment (owner steps, in order)

Do not deploy the code before step 3: the new code reads and writes the new columns.

1. **Backup.** Supabase Dashboard → Database → Backups (or `pg_dump`). Confirm it can be restored.
2. **Baseline.** In the SQL Editor, run `supabase/migrations/20260925090000_baseline_drift_columns.sql`. Expect no change.
3. **Ledger migration.** Run `supabase/migrations/20260925100000_feed_inventory_ledger.sql`. It is one transaction; if it errors, nothing changes.
   Then run `supabase/migrations/20260925110000_expense_categories.sql` and `supabase/migrations/20260925120000_weight_types.sql` (each one transaction).
4. **Check.** Run section 7 of `docs/sql/feed_ledger_reconciliation.sql`. All five numbers must be 0.
5. **Corrections.** Run `supabase/corrections/20260925_feed_historical_corrections.sql`. It is safe to re-run.
6. **Deploy the code.** Commit, push and deploy yourself. Do this soon after step 3: the old site still runs the auto-engine, and old-code mixing would be recorded as a purchase.
7. **Verification.** Tell me, and I will verify production read-only with the reconciliation queries.

- **Stop condition:** if step 3 or step 4 fails, stop and do not deploy.
- **Rollback:** run the corrections rollback first, then the weight-types, expense-categories and ledger rollbacks (`supabase/rollback/`).

## 10. Files

- **Database:**
  - `supabase/migrations/20260925090000_baseline_drift_columns.sql`
  - `supabase/migrations/20260925100000_feed_inventory_ledger.sql`
  - `supabase/migrations/20260925110000_expense_categories.sql`
  - `supabase/migrations/20260925120000_weight_types.sql`
  - `supabase/corrections/20260925_feed_historical_corrections.sql`
  - `supabase/rollback/*` (4 files)
  - `supabase/tests/feed_ledger.sql`
  - `supabase/tests/run_feed_ledger_tests.sh`
  - `supabase/tests/feed_ledger_concurrency.sh`
  - `supabase/tests/feed_ledger_rollback.sh`
- **App:** see `git status`. New since the first report: the Utility Expenses page (`/dashboard/finance/utilities`), `src/lib/expenses/categories.ts`, `src/lib/growth/baseline.ts`, `src/components/finance/UtilityExpensesClient.tsx`, `src/__tests__/farm-records.test.ts`.
- **Docs:**
  - this report
  - `docs/FEED_SYSTEM_ARCHITECTURE.md`
  - `docs/sql/feed_ledger_reconciliation.sql`
  - status row 9.8 in `docs/TANVIR_AGRO_REMEDIATION_PLAN.md`

## 11. Open decisions and remaining risks

**Owner decisions of 2026-09-24 — all applied (§5, §12).**

**Still for the owner:**
1. **Straw physical count.** The ledger shows 240 pieces on hand; you mention about 128. After deployment, enter a stock count (Inventory → Straw → Adjust stock, with the count date). The difference is recorded as an audited count adjustment, not as consumption.
2. **22 NOT RECORDED days.** Leave them, or record what was actually fed on a date you know (Record Feeding). From now on, record feeding daily.
3. **Grass.** Create a "Grass" item in its own unit and stock it in with "Harvested from own land". Record the land lease as a Rent & Lease expense.

**Security (owner):**
- Rotate the Supabase secret key that was pasted in chat.
- Revoke the personal access token in `Data.txt`, then delete the file.

**Remaining limits:**
- Medicine and vaccine rows are valued by the database trigger, but those writers still compute a FIFO cost that the trigger then ignores (harmless extra query).
- A few pages still fetch recipe and roughage data they no longer use (extra queries, no effect on numbers).
- Nutrient values on the Feed & Nutrition page are typical reference values. There are no per-item nutrient fields.
- The production migration history also lacks the separate phase-1 RLS migration (`20260924120000`). It is independent of this work.
- The cattle wizard stores 1 kg when no initial weight is entered (a placeholder). Set such animals' initial weight type to "estimated" when editing them.
- Offline-queued weight logs are saved as "measured" (the offline form has no type field).

## 12. Owner decisions of 2026-09-24 — how the system now handles them

| Decision | Implementation |
|---|---|
| Straw is bought and fed per piece | Items keep their own unit. Cost = pieces × WAC per piece. `kg per unit` is optional and never required; without it nothing is converted. |
| Grass from leased land is a separate feed source | New stock-in type **Harvested from own land** (`own_production`, ৳0, not cash) in the Add Item and Add Stock dialogs. The lease is an expense (Rent & Lease), so the land cost is counted once. |
| 50 kg bran was free | C3: `zero_confirmed`. Free, missing and wrong prices are now three different states: `zero_confirmed`, `missing`, and a correction through the purchase memo (audited). |
| Extra 34.38 kg Mix Feed | C11 (§5). The original purchase row was already correct; only the engine's excess deduction was undone. |
| The 30 rows of 2026-09-24 | Classified as automatic-deduction rows created by the faulty system, not duplicates, test data or real recordings. C9 reverses them, audited, with the originals kept. |
| Utility expense system | **Finance → Utility expenses**: <ul><li>monthly totals per utility and 12-month history;</li><li>add / correct / delete, each audited with an "Edited N×" history;</li><li>optional bill upload;</li><li>admin can add, rename, enable or disable utilities.</li></ul>Accounts follow the category *kind*, so utilities always post to 6300 Utilities and never touch feed, inventory or cattle cost. The WiFi bill was moved (C6). |
| C005 / C006 estimated weights | Weights are "measured" or "estimated" (initial weight and each weight log). Growth, ADG, FCR, the sell-ready alert, forecasts and exports use measured weights only. An estimated start is shown, labelled, but growth runs from the first weighing. C12 labels the two estimates. |


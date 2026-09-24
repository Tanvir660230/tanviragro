# Feed Costing: Reconciliation & Fix Plan (Tanvir Agro)

- **Date:** 2026-09-24
- **Branch inspected:** `chore/phase0-baseline`
- **Companion documents:** `docs/FEED_COSTING_AUDIT.md` (findings F-01 to F-22), `docs/sql/feed_reconciliation.sql`
- **Mode:** investigation only. No application code, production data or migrations were changed, and nothing was committed. Local throwaway databases were used for simulation. No secrets appear in this document.

> **Data labels.** Every number in this document is labelled as one of:
> - **[PROD]**: observed from production. Only the anon-key probes and the `dev.log` timings.
> - **[CODE]**: derived from reading the source.
> - **[SIM]**: a synthetic scenario that writes rows exactly as the app's code paths do, computed with the app's own ration calculator on a throwaway local PostgreSQL 17. **SIM numbers are not farm data.**

---

## 0. UPDATE 2026-09-24: PRODUCTION RESULTS NOW AVAILABLE

Production data was read (read-only) after the owner provided a current secret key. **The authoritative real-farm numbers are in `docs/PRODUCTION_FEED_RECONCILIATION.md`.** Headlines, all from production:

- Per-animal feed cost shown in the app: **৳180,599** vs **৳117,527** reconstructed from actual stock movements, **+৳63,072 (+54%)**.
- Causes:
  - roughage kg priced per straw **piece** (≈ ৳37,648);
  - latest price instead of the weighted average (৳23,622);
  - other (৳1,802).
- The ration quantity is accurate (within 3%).
- 592 of 665 stock movements are automatic estimates. There were 22 true-ups (৳22,041), 1 duplicated day (08-29), and 15 days with no deduction.
- Mix Feed is **−34.38 kg**, shown as 0. 38 rows are valued at ৳0. Opening stock is recorded as a purchase (৳3,299).
- **Not seen in production:**
  - F-01 (all recipes ratio 1);
  - mixing, daily button, feed sessions, adjustments, waste.

  Those findings remain code-level risks.

Sections below marked **SIMULATION — NOT PRODUCTION DATA** are the synthetic worked example. They illustrate the code paths and are **not** farm numbers.

## 1. Executive Summary

- **At the time of this section, production reconciliation could not be run.** (Superseded: see §0.)
  - The only production credential in the project with row access, the secret key in `.env.local`, is **rejected by Supabase** (HTTP 401, even with the correct header style). It has been revoked or rotated.
  - The publishable key works, but RLS correctly hides all rows from it.
  - No database URL or password exists anywhere in the repo.
  - A Supabase personal access token found in `Data.txt` could technically run SQL, but it is an account-wide admin credential already flagged for revocation (SEC-01). It was **deliberately not used** (§2).
- **The code-level diagnosis is complete, and a synthetic ledger reproduces it.** The feed system turns estimates into stock deductions, deducts the same ingredients through several paths, stores internal movements as purchases, and counts feed twice in the P&L.
- **SIMULATION — NOT PRODUCTION DATA.** In a 60-day, one-animal simulation built from the app's own logic:
  - "cash spent on feed" = **৳22,920** vs **৳14,800** actually paid (+55%);
  - P&L feed cost = **৳14,654** vs **৳12,546** correct (+17%; about 1.8× if the engine runs every day with a correct recipe);
  - **98.9 kg** of mixed feed that was eaten still shows as in stock;
  - the automatic engine **silently stopped on day 9**.
- **The daily ration formula is correct** (independently verified). The fix is structural (§12), not a formula change.
- **Next step:** one production read (§2.4) to size the historical damage, then Implementation Phase 1 (§15). Phase 1 removes page-load deductions and adds a recipe batch-size check; it can ship before reconciliation because it only stops **new** damage.

## 2. Production Data Access Status

### 2.1 What the local app is connected to [CODE / PROD]

| Setting | Finding |
|---|---|
| `.env.local` → `NEXT_PUBLIC_SUPABASE_URL` | The **production** Supabase project (same project ref as `supabase/.temp/project-ref`) |
| Publishable key (`sb_publishable_…`, new format) | **Valid.** HTTP 200; sees 0 rows because RLS blocks anonymous access |
| Secret key (`sb_secret_…`, new format, file last modified 2026-07-19) | **Invalid.** HTTP 401 "Unregistered API key", with both header styles. Most likely rotated or deleted in the dashboard after 2026-07-19 |
| Database URL / password (`DATABASE_URL`, `POSTGRES_*`, `SUPABASE_DB_*`) | **None** in `.env*`, source, scripts, CI or `supabase/config.toml` |
| `supabase/.temp/pooler-url` | Host and user only, **no password** |
| Supabase CLI / Docker | CLI not installed. Docker installed but the daemon isn't running. No `docker-compose`, Prisma, Drizzle or other ORM |
| Netlify env | Not accessible from the repo (no Netlify CLI/token). Production's current secret key is there |

**Consequences:**
- Locally, every service-role code path fails today: the accounting statements (`lib/accounting/engine.ts`), team invites, cron/backup routes, and `notify`.
- Anyone running the app locally sees broken accounting pages. That is not a production symptom.

### 2.2 Local data sources checked
- **Local PostgreSQL 17** (installed; the throwaway cluster from the RLS tests). Schema only; no farm data.
- **`.next/cache/fetch-cache`**: two entries, both font downloads. No query results cached.
- **`dev.log`** (2026-09-12) **[PROD usage evidence, no row data]**: `runAutoFeedDeductions()` ran at least 3 times in one session, taking **4.6 s, 4.8 s and 6.2 s**. That is consistent with a multi-day catch-up loop on each Inventory visit.
- **Git history and Cline checkpoints** (328 refs): no CSV, JSON backups or dumps.

### 2.3 Route not used, and why
`Data.txt` contains a Supabase **personal access token**. It can run arbitrary SQL through the Management API with full account privileges.
- It is not part of the app's configuration.
- It was flagged in the engineering audit as leaked and to be revoked (SEC-01).
- Using a leaked admin credential, even for SELECTs, is outside what an audit should do without the owner explicitly choosing that. So it was not used.

### 2.4 What would unlock the real reconciliation (any one of these)
1. Put the **current** secret key into `.env.local`. It's under Supabase → Project Settings → API Keys. Claude then runs `feed_reconciliation.sql` sections 1–7 through the REST API, read-only.
2. Or explicitly authorise one read-only use of the PAT for `feed_reconciliation.sql`, then revoke it.
3. Or run `feed_reconciliation.sql` in the SQL editor yourself. It is SELECT-only and validated on a local copy (§3.2).

## 3. Real Data Reconciliation

### 3.1 Status at the time of writing: not available [PROD] (superseded by §0 and PRODUCTION_FEED_RECONCILIATION.md)
No production row data could be read (§2). **No production reconciliation numbers are reported here, and none were estimated.**

What *was* observed in production [PROD]:
- `profiles` is readable by anonymous users (SEC-10).
- `cattle_sales`, `financial_transactions` and `orders` don't exist.
- The 9 tables from migration 026 exist.
- The auto-deduction timings in `dev.log`.

### 3.2 The reconciliation SQL is proven to work: SIMULATION — NOT PRODUCTION DATA
`feed_reconciliation.sql` was run against the synthetic ledger in §11. Every planted defect is detected:

| SQL section | Detects | SIM output |
|---|---|---|
| 1 Recipes | F-01 ratio | `SIM Fattening mix`: output 50, ingredient sum 100, **ratio 2.0000** |
| 2 Per item × source | F-02, F-03, F-07 | Corn: real purchase 200; auto 36.00; daily button 1.10; mixing 160.00 (**NULL cost ×1**) |
| 3 Reconciliation | F-03, F-06 | Mixed concentrate: **expected −1.10, system 98.90, phantom_in 100**; purchase value counted as cash ৳8,080 vs actual ৳0. Straw: phantom +5 (adjustment), cash ৳3,240 vs ৳3,200 |
| 4 Duplicate days | F-02 | `auto + mixing` on the same item-days (corn, soybean, premix) |
| 5 Auto vs recipe | F-01 | 2026-07-01: ingredients deducted **4.50 kg** for an implied need of **2.25 kg** |
| 7 Integrity | F-07 | 3 consumption rows with NULL cost; 1 active recipe |

### 3.3 Which findings need production data

| Finding | Proven from code | Needs production to size | SQL that resolves it |
|---|---|---|---|
| F-01 ratio ≠ 1 | Mechanism: yes | Whether any real recipe has ratio ≠ 1 | §1 |
| F-02 overlapping deductions | Yes | Which paths were actually used, and when | §2, §4 |
| F-03 fake purchases | Yes | Rows and ৳ counted as cash | §2, §3 (`phantom_in_qty`, `purchase_value_counted_as_cash`) |
| F-04 P&L double count | Yes | ৳ amount per period | §2 (`value_bdt` of unlinked consumption) + estimate |
| F-06 hidden negatives | Yes | Items with expected_stock < 0 | §3 |
| F-07 null/understated costs | Yes | Row counts | §2, §7 |
| F-09 placeholder items | Yes | Whether any session rows exist | §2 ("OUT feed session") |
| F-12 units | Mechanism only | Whether any item uses bags or grams | Item list (`unit` column) |
| F-18 engine stopped | Mechanism: yes | Last auto date vs today | §2 `last_date` for "auto-deduction" |
| F-19 duplicate auto days | Mechanism: yes | Occurrences | §4 plus a count of duplicate `Auto-Feed Deduction: <date>` rows per item |

## 4. Current System Architecture [CODE]

### 4.1 Data flow and source of each stage

| Stage | Table.field | Written by | Calculation | Read by (frontend) | Accounting impact |
|---|---|---|---|---|---|
| Purchase | `inventory_transactions` (`type='purchase'`, `qty`, `unit_cost`) | `inventory/purchase/actions.ts:111` (bulk purchase), `inventory/actions.ts:120,169` (add stock), `purchase/history/actions.ts:145-232` (edit/delete memo) | Landed cost via `CostingEngine.distributeLandedCost` | Purchase history, Inventory | Cash out (`cash-engine.ts:54`); inventory value (`engine.ts:373`); cash-flow "paid inventory" (`engine.ts:681`) |
| *Also stored as `purchase`* | same | Mixed output (`mix-feed/actions.ts:136`), count adjustment IN (`adjustment-engine.ts:33` → `actions.ts:120`), true-up (`markInventoryItemEmpty`), recipe `produceBatch` output (`recipe-actions.ts:286`) | FIFO of ingredients / estimate | same | **Counted as cash and purchases (F-03)** |
| Stock on hand | derived | — | **Four formulas:** (a) `StockLedgerEngine` (clamped ≥0, drops negatives); (b) `get_inventory_stats` RPC (signed, unclamped); (c) trigger `check_inventory_stock` (positive purchases only); (d) raw sums in `markInventoryItemEmpty` / `produceBatch` | Inventory cards and tables, advisor, alerts | none directly |
| Recipe | `feed_recipes` (`output_qty`, `is_active`, `active_from/until`\*), `recipe_ingredients` (`qty_per_batch`) | `recipe-actions.ts` `createRecipe` L42-58 | Nothing ties `output_qty` to Σ`qty_per_batch` (F-01) | Recipe builder, mix page | Indirect |
| Mixing | `inventory_transactions` consumption (ingredients) + purchase (output) | `mix-feed/actions.ts` `produceMixedBatch`; `recipe-actions.ts` `produceBatch` (second implementation) | `scale = target / output_qty` (F-01 applies); output cost by FIFO **after** consumption (F-07) | Mix page | Ingredient rows NULL cost when an output is set; output counted as purchase/cash |
| Planned ration | none (computed) | — | `utils/feed-calculator.ts` `calculateDailyFeedRequirement` (verified correct) | Cattle detail, feed page, daily button | — |
| **Auto consumption** | consumption rows, notes `Auto-Feed Deduction: <date>`, no `cattle_id` | `inventory/actions.ts` `runAutoFeedDeductions` L788-928 | Farm need (today's herd, Thursday lock) × recipe ingredients ÷ `output_qty`; FIFO cost | — | Expensed to 6600 General Expenses (`engine.ts:549-566`) |
| Daily button | consumption rows, notes `Daily batch deduction…`, no `cattle_id` | `dailyFeedDeduction` L273-330, UI `DailyFeedDeductButton.tsx` | Need ÷ count of feed items, equal split (F-15) | Inventory page | Expensed to 6600 |
| Feed session / quick dispense | consumption with `cattle_id` | `feed-session-actions.ts:134`, `feed-waste-actions.ts:71` | Client-supplied cost (session) / last purchase price (quick dispense) | Feed page (placeholder items, F-09) | Per-animal (direct) |
| Manual per-cow / waste / vaccine | consumption | `cattle/[id]/actions.ts:299,337`, `feed-waste-actions.ts:135`, `vaccination-actions.ts` | FIFO (after `3863e68`) | Cattle detail, feed page | Direct or unlinked |
| Animal feed cost | none (computed) | — | `directFeedCost > 0 ? direct : calculateAlgorithmicFeedCost(...)` using **latest purchase price per item** (`cattle/[id]/page.tsx:559-643`); same pattern in `queries/dashboard.ts:160-180` and `engine.ts:284-313` | Cattle detail, dashboard P&L, finance per-head, reports | Capitalized to livestock, then COGS (`engine.ts:810-812`) |
| Farm feed expense | consumption rows without `cattle_id` | (the auto, daily, mix paths above) | Σ qty × unit_cost | Income statement | 6600 General Expenses |
| Cash | derived | — | Σ all `purchase` rows × unit_cost | Dashboard cash card, cash flow | Cash position |
| Balance sheet | derived | — | Inventory = all purchases − consumption − **estimate**, clamped ≥0 (`engine.ts:381`); livestock includes the estimate | Balance sheet | — |

\* `active_from`, `active_until`, `roughage_active_*`, `is_discontinued` and others exist in production but in no migration (BUG-23 / DB-01).

### 4.2 Automatic deduction triggers (§7-A of the brief) [CODE]

| Trigger | Where | Runs |
|---|---|---|
| **Opening or refreshing `/dashboard/inventory`** | `AutoEngineRunner` (client `useEffect`, once per mount) in `inventory/page.tsx:264` | Every visit and refresh |
| Activating a roughage item | `setActiveRoughage` → `inventory/actions.ts:667` | On click |
| Activating a recipe | `setActiveRecipe` → `recipe-actions.ts:452-453` | On click |
| Changing a recipe's start date | `updateRecipeActiveFrom` → `recipe-actions.ts:479-480` | On save |
| Cron / API / dashboard load / date change | none | — |

- **Idempotency:** only "skip dates that already have `Auto-Feed Deduction` rows", checked once **before** the loop. Two concurrent triggers (two tabs, or page load plus recipe activation) both see the same gaps and both insert (F-19).
- **Failure handling:** a day's batch that fails the stock-guard trigger makes the function **return**. `AutoEngineRunner` swallows the error, so the catch-up silently stops and is retried on every visit (F-18).

### 4.3 What each consumption action does (§7-B, §7-C of the brief)

| Action | Creates consumption rows | Deducts stock | Expense / accounting | Per-animal cost | Creates purchase |
|---|---|---|---|---|---|
| Auto deduction | yes (ingredients) | yes | yes (6600, via rows) | no link → per-animal **estimate** also applied | no |
| Daily button | yes (every feed item, equal split) | yes | yes (6600) | same as above | no |
| Mixing (with output item) | yes (ingredients, **cost NULL**) | yes (ingredients) and **adds** mixed feed | ingredients ৳0; output counted as **purchase / cash** | — | **yes** |
| Mixing (no output item) | yes (ingredients, FIFO cost) | yes | yes (6600) | — | no |
| Count adjustment (up) | — | adds | counted as **purchase / cash** | — | **yes** |
| Count adjustment (down) | yes | yes | 6600 | — | no |
| True-up (stock > 0) | yes | yes | 6600 | — | no |
| True-up (stock < 0) | — | adds | counted as **purchase / cash** | — | **yes** |

**Overlap:** auto + daily button (same day, both estimates); auto + mixing (the same raw ingredients); auto/daily (farm level) + the per-animal estimate (P&L).

## 5. Root Cause Analysis
1. **Plan and actual are not separated.** The ration (a plan) is written straight into the stock ledger as consumption, automatically, on page load.
2. **The ledger has two movement types for about eight meanings.** Production, adjustment, true-up and waste reuse `purchase`/`consumption`. Meaning lives in free-text `notes`, and there are no source/reference/idempotency fields.
3. **Feed cost has no single source.** Stock rows (FIFO), per-animal estimates (latest price) and cash (all "purchases") each compute it, and the P&L adds two of them.
4. **Invariants live nowhere.** Recipe size vs ingredients, units, and negative stock (hidden in one formula, blocked in another) are not enforced in one place.
5. **Two implementations** of several operations: batch production (2), stock formulas (4), per-animal cost (3 places).

## 6. Findings F-01 to F-22

F-01 to F-17 are defined in `FEED_COSTING_AUDIT.md`. F-18 to F-22 are new and **[CODE]**-verified this round.

| ID | Current implementation | Root cause | Business impact (wrong number) | Data impact (affected records) | Fix type | Correct behaviour |
|---|---|---|---|---|---|---|
| F-01 | `output_qty` free input; auto **and mixing** scale by it | No invariant | Ingredient stock drops ×ratio; mixing uses ×ratio ingredients per kg of output | All `Auto-Feed Deduction` and `Feed mix` rows for recipes with ratio ≠ 1 | Calculation + constraint | Σ ingredients = batch size (or explicit yield); reject otherwise |
| F-02 | 6 consumption paths, auto on page load | Plan written as actual; no event model | Stock, feed expense, stock-out dates | Auto / daily rows overlapping mixing or other auto/daily rows | **Structural** | Plan never touches stock; one confirmed feeding event per day/pen |
| F-03 | Mixed output, count-up and negative true-up saved as `purchase` | Two-type ledger | Cash position, "purchased qty", cash-flow statement, inventory value | Rows with notes `Mixed feed produced…`, `Stock Adjustment…`, `True-Up…` | **Structural** | Separate movement types; only external purchases affect cash |
| F-04 | Farm-level rows expensed **and** per-animal estimate capitalized | Two cost sources added | Income statement, COGS, livestock value | All periods with unlinked feed rows | Calculation (short term), structural (long term) | Feed cost = Σ actual consumption cost, allocated to animals by stored allocation |
| F-05 | Per-animal cost = estimate at latest price | No allocation mechanism | Per-head cost, margin, ROI, sale decisions | None stored (computed) | Structural | Stored allocation from actual consumption |
| F-06 | Stock clamped at 0; negative rows dropped; true-up makes a fake purchase | Defensive UI code | Stock on hand, shortage visibility | Negative-qty rows; true-up purchase rows | Calculation | One signed stock formula; negative shown and blocked |
| F-07 | FIFO divides by the full qty; NULL when uncovered; mix output cost after consume; 1000-row cap | Edge cases, unpaginated reads | Consumption cost, mixed feed cost | Rows with NULL cost or wrong cost | Calculation → SQL | Weighted-average cost stored at movement time, computed in SQL |
| F-08 | Back-fill uses today's herd, Thursday lock | Requirement computed from current state | Historical auto quantities | Past auto rows | Structural (removed with F-02) | Plans computed from the herd as of each date |
| F-09 | Feed page placeholder items (fake stock and prices, non-UUID IDs) | Prototype data never replaced | What operators see; sessions can't save | None (sessions fail) | UI | Real items, stock and prices from the ledger |
| F-10 | No source/reference/idempotency columns | Schema | Traceability, duplicate prevention | All rows | **Structural** | `movement_type`, `source_table`, `source_id`, `idempotency_key` |
| F-11 | Two batch implementations | Duplication | Mixed-feed cost differs by screen | Mixed rows | Consolidate | One `produce_feed_batch` SQL function |
| F-12 | Units free text; no conversion | Schema | Any bag or gram item is wrong ×factor | Items with non-kg units | Structural | Base unit (kg) + conversion table |
| F-13 | Waste stored as consumption; session waste only in notes | Two-type ledger | Waste not reported; feed cost includes waste | Waste rows | Structural | `waste` movement type |
| F-14 | Tier jump at 300 kg | Domain choice | Ration step change | — | Decision | Owner confirms tiers (or smooth them) |
| F-15 | Daily button: need ÷ number of feed items | UI shortcut | Premix deducted like corn | Daily rows | Remove / rework | Allocation by recipe proportions (§7-G) |
| F-16 | Rounding | — | Negligible | — | — | Keep; round at display |
| F-17 | Local secret key revoked | Key rotated | Local accounting/cron fail | — | Ops | Update `.env.local` |
| **F-18** | A day that fails the stock guard makes `runAutoFeedDeductions` **return**; errors swallowed by `AutoEngineRunner`; retried on every visit | No error surfacing | Auto deductions silently stop (the [SIM] run stopped on day 9); page loads are slow (4–6 s in `dev.log` [PROD]) | Gap after the last auto date | Removed with F-02 | Confirmed feeding with visible errors |
| **F-19** | Duplicate protection checks existing dates once, before the loop; no unique key | Race | Duplicate auto days when two triggers overlap | Days with >1 set of auto rows per item | Structural | Unique `(business_id, feeding_date, pen)` on the feeding event |
| **F-20** | `setActiveRoughage` / recipe activation run the auto engine as a side effect | Convenience | Changing settings deducts stock | Auto rows created on settings changes | Remove | Settings never create movements |
| **F-21** | The recipe's first activation back-fills from the **earliest active animal's purchase date** when no auto rows exist and no `active_from` is set | Catch-up design | A one-time bulk deduction for past months | First auto run per business | Removed with F-02 | No back-fill of estimates |
| **F-22** | Four stock formulas disagree (§4.1) | Duplication | Different stock on different screens | — | Consolidate | One SQL view/function |

## 7. Inventory Reconciliation: SIMULATION — NOT PRODUCTION DATA (production: see PRODUCTION_FEED_RECONCILIATION.md §3)
- **Production:** pending (§2.4). Run `feed_reconciliation.sql` §3.
- **[SIM]**, from the reconciliation SQL:

| Feed | Purchased | Consumed | Wastage | Expected stock | System stock | Difference | Cause |
|---|---:|---:|---:|---:|---:|---:|---|
| SIM Corn | 200.00 | 197.10 | 0 | 2.90 | 2.90 | 0 | Balanced, but 160 kg of it was mixing at ratio 2 (should be 80) |
| SIM Soybean | 60.00 | 45.21 | 0 | 14.79 | 14.79 | 0 | as above |
| SIM Premix | 10.00 | 6.01 | 0 | 3.99 | 3.99 | 0 | 1.10 kg from the equal-split daily button (≈ 12× its recipe share of 0.09 kg) |
| SIM Mixed concentrate | 0 (produced 100) | 1.10 | 0 | **−1.10** | **98.90** | **+100** | Produced feed is recorded as purchase; the animal's real intake was never deducted |
| SIM Straw | 400.00 | 0 | 0 | 400.00 | 405.00 | +5 | Count adjustment recorded as purchase |

## 8. Feed Consumption Reconciliation: SIMULATION — NOT PRODUCTION DATA (production: see PRODUCTION_FEED_RECONCILIATION.md §2, §5)
One 300 kg animal, 60 days, ration by the app's calculator:
- concentrate need **253.125 kg**;
- roughage **290 kg**.

| Path | What the ledger shows | What happened physically (scenario) |
|---|---|---|
| Mixing 100 kg (ratio 2) | −200 kg ingredients, +100 kg mixed | 100 kg of ingredients mixed into 100 kg of feed |
| Auto (days 1–8, then stopped) | −45.02 kg ingredients (2× the need for 8 days) | Nothing: the animal ate mixed feed |
| Daily button (1 day) | −1.10 kg each of corn, soy, premix and mixed | One day of feeding, 4.5 kg of mixed feed |
| Feeding days 9–60 | nothing | ≈ 225 kg of concentrate eaten; not recorded |

**Result:** the ledger over-deducts ingredients, under-deducts the feed actually eaten, and stops recording after day 8. No stock number can be trusted, and the error direction differs per item.

## 9. Cost Reconciliation: SIMULATION — NOT PRODUCTION DATA (production: see PRODUCTION_FEED_RECONCILIATION.md §6)

| Measure | Correct | Current system | Difference |
|---|---:|---:|---:|
| Cash spent on feed | ৳14,800 (real purchase memos) | ৳22,920 (all `purchase` rows) | **+৳8,120 (+55%)**: mixed output ৳8,080 + adjustment ৳40 |
| Mixed feed cost per kg | ৳40.40 (recipe 80/18/2 at ৳34/60/120) | ৳80.80 (ingredients at ratio 2 ÷ 100 kg) | +100% (F-01) |
| P&L feed cost, 60 days | ৳12,546 (253.125 kg × ৳40.40 + 290 kg × ৳8) | ৳14,654 = ৳2,108 unlinked rows (6600) + ৳12,546 capitalized estimate | **+৳2,108 (+17%)**. If the engine had run all 60 days: ≈1.8× with a correct recipe, ≈2.6× at ratio 2 |
| Consumption cost recorded in the ledger | should equal the P&L feed cost | ৳2,108 (auto + daily) + ৳0 (mixing, NULL) | ledger ≠ P&L |

**Costing model in use:**
- stock rows: FIFO, with defects;
- per-animal: latest-price replacement cost;
- cash: every `purchase` row.

**Recommended:** moving weighted-average cost, stored per movement, with history never re-valued (Rule 8).

## 10. Accounting Impact [CODE]

| Statement / figure | Affected by | Direction |
|---|---|---|
| Cash balance (dashboard card, cash flow) | F-03 | Overstated outflow, so cash is understated |
| Income statement: General Expenses (6600) | F-02, F-15 (unlinked estimate rows) | Overstated; also depends on engine stop (F-18) |
| COGS / livestock (capitalized estimate) | F-04, F-05 | Adds on top of 6600 → feed double-counted |
| Balance sheet: feed inventory | F-03 (adds phantom purchases), F-04 (subtracts estimate), clamp at 0 | Unreliable; the balance can be forced by `Math.max(0,…)` |
| Balance sheet: livestock | F-04, F-05 | Includes the estimate at the latest price |
| Per-head ROI, margin, break-even, sell advice | F-05 | Estimate-based |
| Partner profit share (derived from P&L) | F-04 | Follows the P&L error |

## 11. Historical Data Impact

| Record group (identify with SQL §2) | Problem | Treatment |
|---|---|---|
| `Auto-Feed Deduction` rows | Estimates stored as actual; ×ratio; possible duplicate days | Reverse with offsetting `adjustment_in` rows referencing the original, then record actual feeding from farm records or a stock count |
| `Daily batch deduction` rows | Estimate; equal split | Same as above |
| `Feed mix` + `Mixed feed produced` pairs | Ratio error; output stored as purchase | Re-type the output as `production_in` (a new corrective row, with the original kept); correct ingredient qty by an offsetting entry if ratio ≠ 1 |
| `Stock Adjustment` rows (IN) | Stored as purchase | Re-classify via a corrective pair (reversal + `adjustment_in`) |
| `True-Up` rows | Purchase/consumption masking negatives | Same as above; surface the underlying shortage |
| Consumption rows with NULL cost | Valued at 0 | Re-cost at the weighted average as of their date (a corrective cost entry, not an edit) |
| Per-animal costs, P&L, balance sheet | Computed, not stored | Recomputed automatically once the ledger is corrected; closed periods need an explicit adjusting entry dated in the current open period |

## 12. Correct Target Architecture
- **Purchase:** `purchases` (header: supplier, date, invoice, landed costs) + `purchase_lines(item_id, qty, unit, qty_base, cost_total)`. The only source of cash out for inventory.
- **Inventory ledger:** `stock_movements(id, business_id, item_id, movement_date, movement_type, qty_base (signed), unit_cost, total_cost, source_table, source_id, idempotency_key unique, created_by, reverses_movement_id)`.
  - `movement_type` ∈ `purchase`, `purchase_return`, `production_out`, `production_in`, `feeding`, `waste`, `adjustment_in`, `adjustment_out`, `opening`.
  - Append-only; corrections are new rows (`reverses_movement_id`).
  - Stock = Σ `qty_base` (signed) from one SQL view. **Never clamped.**
  - Negative stock rejected by a trigger holding `pg_advisory_xact_lock(item)`, unless the business explicitly allows it.
- **Recipe:** `recipes(id, version, batch_size_kg, yield_pct default 100, valid_from, valid_to)` + `recipe_lines(item_id, qty_kg)`. Constraint (deferred): Σ `qty_kg` = `batch_size_kg`.
- **Feed batch:** `feed_batches(recipe_id, recipe_version, output_item_id, qty_kg, produced_on)`. One SQL function writes `production_out` per ingredient and one `production_in` at Σ ingredient cost. No purchase row, no cash.
- **Ration (plan):** `ration_rules` (tiers %, DM, ramp) + a computed `v_daily_ration(animal, date)`. Read-only; never writes movements.
- **Feeding (actual):** `feeding_events(business_id, pen_id, feeding_date, slot, item_id, qty_kg, confirmed_by)` with unique `(business_id, pen_id, feeding_date, slot, item_id)`.
  - Each event writes one `feeding` movement.
  - The UI pre-fills quantities from the plan; the user confirms.
- **Waste:** `waste` movements with a reason.
- **Adjustment:** `stock_counts` (counted vs system), then an `adjustment_in` or `adjustment_out` movement.
- **Costing:** moving weighted average per item, computed in SQL at movement time and stored in `unit_cost`.
- **Animal cost:** `feed_cost_allocations(feeding_event_id, animal_id, qty_kg, cost)`. It splits each feeding event across the animals present, by head-days or by ration share. Stored, so history is stable.
- **Accounting:** P&L feed = Σ `feeding` + `waste` cost; COGS = allocation of sold animals; cash = purchases only. Estimates live only in `v_projection_*` views, labelled "Estimated".

## 13. Source-of-Truth Matrix

| Concept | Source of truth (target) | Today | Violation |
|---|---|---|---|
| Purchase | `purchases` / `purchase_lines` | Any `inventory_transactions.type='purchase'` | Production, adjustments, true-ups counted as purchases (F-03) |
| Raw inventory | `stock_movements` via one view | 4 formulas | Disagreeing stock; negatives hidden (F-06, F-22) |
| Feed recipe | `recipes` + `recipe_lines` (versioned) | `feed_recipes` with free `output_qty` | Size ≠ Σ ingredients (F-01) |
| Feed batch | `feed_batches` + production movements | 2 implementations, output as purchase | F-03, F-11 |
| Actual consumption | `feeding_events` → `feeding` movements | Auto/daily estimates + sessions + manual | Plan written as actual (F-02) |
| Planned ration | `v_daily_ration` (computed) | Same calculator, also used to write stock | Plan leaks into actual |
| Wastage | `waste` movements | Consumption with a notes prefix | F-13 |
| Adjustment | `stock_counts` + adjustment movements | `purchase`/`consumption` rows | F-03 |
| Feed cost | Stored weighted average on movements | FIFO with defects, latest price, cash sum | Three models (F-05, F-07) |
| Animal cost | `feed_cost_allocations` | Estimate recomputed at view time | F-04, F-05 |
| Accounting | Ledger-derived statements | Recomputed from mixed sources | F-04 |

## 14. Historical Reconciliation Strategy
1. **Freeze new damage first** (Implementation Phase 1): stop page-load/settings deductions and add the recipe-size check.
2. **Snapshot:** back up (PITR confirmed), plus an export of `inventory_transactions`, `feed_recipes` and `recipe_ingredients` to a dated schema `recon_2026xx`.
3. **Classify** every historical row into the new `movement_type`, using the notes patterns in `feed_reconciliation.sql` §2. Store the classification in a mapping table, not by editing rows.
4. **Physical stock count** per feed item on a cut-over date. It is the only trustworthy anchor.
5. **Opening balances:** on the cut-over date, write `opening` movements = counted stock at the weighted-average cost as of that date. Earlier estimate rows are kept, but they are excluded from the new ledger view by the cut-over date.
6. **Prior periods:** do **not** edit closed periods. Record a single dated **prior-period adjustment** in the open period, equal to (old reported feed cost − corrected feed cost). It must be explainable line by line from the SQL output.
7. **Cash:** removing F-03 rows from cash is a presentation fix: no money moved. Document the before/after cash balance.
8. **Animal costs:** allocations start from the cut-over date. Pre-cut-over animal feed cost is either an explicitly labelled estimate or a one-off allocation of the corrected total. That is the owner's choice.
9. **Evidence file:** before/after reconciliation per item, and totals per statement, saved under `docs/reconciliation/`.

## 15. Detailed Implementation Plan
Each phase is its own branch/PR, and the gate (tsc, lint, tests, build) must pass.

| Phase | Files affected | Tables | Migration | API / actions | Frontend | Data migration | Risks | Rollback | Tests |
|---|---|---|---|---|---|---|---|---|---|
| **1. Source-of-truth freeze** | `components/inventory/AutoEngineRunner.tsx`; `inventory/page.tsx:264`; `inventory/actions.ts:667`; `recipe-actions.ts:452,479`; `DailyFeedDeductButton.tsx`; `recipe-actions.ts` `createRecipe` | none | none | Remove auto triggers; `runAutoFeedDeductions` becomes a confirm-only action returning a preview; recipe validation Σ = size (±0.01) | "Record today's feeding" button with preview; recipe form shows Σ and blocks mismatch | none | Farm relied on auto stock drop | Revert the PR (no data touched) | T3, T4, T8, T9 |
| **2. Inventory ledger** | new `lib/inventory/ledger.ts`; replace the 4 stock formulas; `stock-ledger.ts`; `inventory-repository.ts`; RPC | `inventory_transactions` (+ columns) | Add `movement_type`, `source_table`, `source_id`, `idempotency_key` (unique, nullable), `reverses_id`; backfill `movement_type` from notes into a **new** column; view `v_stock_on_hand` (signed); guard trigger with advisory lock | All writers set `movement_type` | Stock shows negative in red | Backfill classification only (reversible) | Mis-classification | Drop new columns/view | T1, T2, T10 |
| **3. Recipe** | `recipe-actions.ts`, `RecipeBuilderDialog.tsx` | `feed_recipes`, `recipe_ingredients` | Add `batch_size_kg`, `yield_pct`, `version`; deferred constraint Σ = size; `valid_from/to` captured in the migration (drift) | Validation server-side | Builder shows Σ and version | Existing recipes: flag ratio ≠ 1 for owner review (no auto change) | Existing recipes blocked | Constraint is `NOT VALID` first | T8, T9 |
| **4. Mixing** | `mix-feed/actions.ts` (keep), delete `recipe-actions.ts` `produceBatch` | `feed_batches` | New table + SQL function `produce_feed_batch()` (one transaction) | `produceMixedBatch` calls the RPC | Mix page | none | Output cost differs from history | Keep old action behind a flag | T6 |
| **5. Actual consumption** | new `feeding-actions.ts`; `feed-session-actions.ts`; `cattle/feed/page.tsx` (remove placeholders) | `feeding_events` | Table + unique key; `feeding` movements | `recordFeedingEvent` with idempotency | Daily feeding screen pre-filled from plan (recipe proportions, §7-G) | none | Workflow change for staff | Old manual paths remain until verified | T5, T7, T12 |
| **6. Ration** | `utils/feed-calculator.ts` (unchanged maths), `v_daily_ration` | none | View only | — | Plan vs actual per pen/animal | none | none | Drop view | T11 |
| **7. Costing** | `costing-engine.ts`, new SQL `weighted_avg_cost(item, as_of)` | `inventory_transactions.unit_cost` | Function; trigger fills cost on insert | Remove client-supplied cost | Show cost/kg source | Re-cost NULL-cost rows **in a new column** `recomputed_cost` for review | Cost changes visible | Keep original `unit_cost` | T13, T14 |
| **8. Accounting** | `lib/accounting/engine.ts`, `queries/cash.ts`, `cash-engine.ts`, `queries/dashboard.ts`, `cattle/[id]/page.tsx` | `feed_cost_allocations` | Table | — | Estimates labelled "Estimated" | none | Reported numbers change | Feature flag old vs new statements for one cycle | T13, T15 |
| **9. Historical reconciliation** | `docs/reconciliation/*`, SQL scripts | `recon_*` schema, `opening` movements | Snapshot schema; opening movements after the stock count | — | Reconciliation report page (read-only) | Classification, opening balances, prior-period adjustment | Wrong opening balance | Opening movements reversible by reversal rows; snapshot retained | Reconciliation SQL equals the count |
| **10. UI/UX** | Inventory, Feed, Cattle detail, Finance | — | — | — | Per-item ledger with source; plan vs actual; negative stock; recipe Σ | — | — | — | Browser checks |
| **11. Automated tests** | `src/__tests__/*`, `supabase/tests/*` | — | — | — | — | — | — | — | T1–T20 in CI; SQL tests on a replayed DB (harness exists) |
| **12. Production verification** | — | — | Apply migrations to staging, then production after backup | — | — | Run reconciliation SQL before/after | — | PITR restore point | Sign-off checklist (§18) |

## 16. Database Migration Plan
Order: `phase2_movement_types` → `phase3_recipe_integrity` → `phase4_feed_batches` → `phase5_feeding_events` → `phase7_costing` → `phase8_allocations` → `phase9_opening_balances`.

Rules:
- Additive first; no drops; constraints as `NOT VALID` until the data is clean; every migration idempotent.
- Tested on the local replay harness (`supabase/tests/run_rls_tests.sh` pattern) with the known replay defects handled (DB-11).
- **Prerequisite:** capture the drift columns (`active_from`, `roughage_active_*`, `is_discontinued`, `default_daily_gain_kg` …) in a baseline migration first (plan 0.3 / BUG-23), otherwise new migrations cannot be tested faithfully.

## 17. Regression Test Plan

| # | Scenario | Expected |
|---|---|---|
| T1 | Purchase 100 kg corn | Stock 100; cash −(cost) |
| T2 | Consume (feed) 10 kg | Stock 90; exactly 1 movement |
| T3 | Refresh the Inventory page | 0 new movements |
| T4 | Open the Inventory page 10 times | 0 new movements |
| T5 | Record one daily feeding | Exactly one event and its movements; recording it again for the same date/pen/slot is rejected |
| T6 | Mix 100 kg (recipe 40/20/10/15/15) | Ingredients −40/−20/−10/−15/−15; mixed +100; **0 purchase rows; cash unchanged** |
| T7 | Feed 20 kg mixed feed | Mixed −20; ingredients unchanged |
| T8 | Recipe Σ 100, size 50 | Rejected |
| T9 | Recipe Σ 100, size 100 | Accepted |
| T10 | Consume beyond stock | Rejected (or negative shown if allowed); never displayed as 0 |
| T11 | Ration 300 kg × 1.5% | 4.5 kg/day (plan view); no movement created |
| T12 | Two animals fed | Σ allocations = feeding event qty |
| T13 | P&L feed cost | = Σ feeding + waste cost; no estimate added |
| T14 | New purchase at a new price | Past movement costs unchanged; weighted average moves forward only |
| T15 | Stock count +5 | `adjustment_in`; cash and "purchased" unchanged |
| T16 | Activating a recipe or roughage | 0 movements |
| T17 | Two concurrent feeding confirmations | One succeeds, one rejected (idempotency) |
| T18 | Item stocked in 50 kg bags | 1 bag = 50 kg in every movement |
| T19 | Waste 3 kg | `waste` movement; reported separately |
| T20 | Reconciliation SQL on production after cut-over | Expected stock = system stock for every item |

## 18. Production Deployment Plan
1. Confirm PITR/backups (open item 0.4).
2. Deploy **Phase 1** (code only, no migration). Monitor that no `Auto-Feed Deduction` rows appear without confirmation.
3. Apply Phase 2–8 migrations to **staging** (a copy of production). Run the reconciliation SQL and the T-tests.
4. Owner does a physical stock count on the cut-over date.
5. Apply migrations to production during a quiet window. Run the classification and opening balances. Run the reconciliation SQL; expected = system for every item.
6. Switch statements to the new ledger behind a flag. Compare old vs new for one period. Owner signs off, then remove the old path.

## 19. Rollback Strategy
- **Phase 1:** revert the PR (code only).
- **Migrations:** additive columns/tables; rollback = drop the new objects (scripts shipped with each migration). Original rows are never edited.
- **Data corrections:** reversal rows (`reverses_movement_id`) undo any corrective or opening movement. The snapshot schema is kept for at least one full fiscal year.
- **Statements:** a feature flag returns the old calculation instantly.
- **Last resort:** PITR restore to the pre-migration point (requires the backup confirmation in step 1).

## 20. Final Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Production data differs from what the code implies (e.g. auto never used) | Medium | Plan over- or under-scoped | Run the reconciliation SQL before Phase 2 |
| The farm relies on auto stock deduction | High | Stock stops moving after Phase 1 | Phase 1 adds a one-click confirm with preview |
| Reported profit changes noticeably | High | Owner or partner concern | Before/after statement and a prior-period adjustment with line-by-line evidence |
| Negative stock surfaces after the fix | High | Looks like a new problem | Expected: it was hidden (F-06); resolved by the stock count |
| Migrations untestable due to drift (DB-11, BUG-23) | High | Migration failure | Baseline dump first (plan 0.3) |
| Staff workflow change (confirm feeding) | Medium | Missed entries | Pre-filled daily screen; reminder |
| Leaked PAT still valid | Unknown | Full account compromise | Revoke immediately (SEC-01) |

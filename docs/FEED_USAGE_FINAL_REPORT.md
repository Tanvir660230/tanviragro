# Tanvir Agro — Feed Inventory & Feed Costing: Final Report

- **Date:** 2026-09-24
- **Branch:** `chore/phase0-baseline`. **Everything is uncommitted.** Nothing was committed, pushed or deployed.
- **Production:** read-only. No production row or schema was changed by this work.
- **Companion documents:**
  - `FEED_USAGE_ARCHITECTURE.md` (design);
  - `FEED_SYSTEM_ARCHITECTURE.md` (ledger reference);
  - `FEED_USAGE_HISTORY_DRY_RUN.md` (history);
  - `FEED_COSTING_IMPLEMENTATION_REPORT.md` (the first phase).

---

## A. Summary

The farm no longer has to record feeding every day. For each feed, the owner enters three things when they happen, or later:
- what was bought, and on which date;
- the date the feed was opened;
- the date it ran out, with the count left.

The system then works out the rest:
- the feed actually eaten = opening + purchases − closing;
- its cost, at the moving-average cost;
- each animal's share, by body weight, for the days it was on the farm.

A purchase entered late is re-reconciled automatically. The acceptance case (purchase dated 01 Sep, entered 08 Sep) gives exactly the same result as entering it on time.

Every figure is labelled with one of three statuses, which are never added together:
- **ACTUAL** (closed periods and recorded rows);
- **ESTIMATED** (open periods);
- **UNRECONCILED** (a count that does not fit the recorded stock).

## B. Audit findings (before)

The full list is in `FEED_USAGE_ARCHITECTURE.md` §1.1.
- **A1:** feeding existed only if it was recorded daily.
- **A2:** "stock finished" was booked as a loss.
- **A3:** there was no usage period.
- **A4:** a late purchase broke history.
- **A5:** feed was split equally per head.
- **A6:** editing or deleting a purchase memo rewrote the ledger.
- **A7:** a recipe could be hard-deleted after use.
- **A8:** cost was calculated in several places.
- **A9:** the forecast ignored real usage.
- **A10:** "today" was taken in UTC.
- **A11:** money was summed as floats.

A further defect was found during this work: the "weighted average" was **cumulative** (see H).

## C. Design

- **One ledger** (`inventory_transactions`):
  - `type` = direction; `movement_type` = meaning;
  - `recorded_at` = business date; `created_at` = entry time.
- **Usage periods:** `feed_usage_periods`, lines per ingredient, and an events log.
- **One pure engine** (`src/lib/feed/usage-engine.ts`) for allocation, running estimate, forecast and variance. It is loaded once by `src/lib/feed/feed-data.ts` and used by the Feed Usage page, the cattle profile, the dashboard card and the herd share used by valuation and finance.

## D. Accounting model

| Movement | Entry |
|---|---|
| Purchase | DR Inventory / CR Cash (the only cash movement) |
| Purchase undo (`purchase_reversal`) | Reduces cash purchases and inventory |
| Opening stock | DR Inventory / CR Partner Capital |
| Own-land grass (`own_production`) | ৳0; the lease is a Rent & Lease expense (counted once) |
| Closed usage period | DR Feed Expense 5200 / CR Inventory (feed eaten, **not a loss**) |
| Real count difference / wastage | General Expenses 6600 |
| Mixing | Input and output net to 0 |
| Consumption undo | Reduces the account the original was booked to |

## E. Usage periods

- **Start using** (item or recipe, date, optional rule: % of live weight, per head, or weight share).
- **Finished**, with the closing count per ingredient; one tap also starts the next feed.
- **Close:** consumed = stock available at the end date − closing. One posting row per line, valued at the average cost as of the end date.
- **When the count is higher than the stock:** a **reconciliation gap**. Status becomes `unreconciled` and nothing is invented.
- **Late or back-dated movement:** a trigger re-reconciles every affected period. The old posting is reversed and the new one posted; nothing is edited.
- **Other rules:**
  - no overlapping periods for the same feed;
  - no future dates;
  - a correction of a closed period needs a reason and is logged;
  - opening is idempotent by key;
  - a cancelled period stays for audit.
- **Security:** writes go through `security definer` functions that check business membership (`feed_can_write_business`). RLS allows tenants to read only.
- **Mark empty:** the old "Mark empty" button now closes the open period with count 0. The feed becomes feed expense, not a loss.

## F. Allocation

- **Days:** herd feed is spread over the days it covers.
- **Animals:** on each day it is shared among the animals present that day, **by weight**. It is never split equally.
- **Weight used for a day:**
  1. the latest measured weight on or before the day;
  2. else the measured purchase weight;
  3. else the first later measurement;
  4. else the estimated purchase weight (labelled).
- **Rows recorded for a specific animal** stay with that animal.
- **Result:** the whole actual cost is allocated; nothing is lost or added (tested).

## G. Recipes

- A recipe period stores each ingredient's share in its lines (a snapshot), so later recipe edits do not change history.
- A recipe used by a period cannot be deleted.
- Mix Feed made through `produce_feed_batch` records ingredient consumption at their average cost. The output is valued at the input cost.

## H. Costing

- **One source:** `inventory_unit_cost_as_of` / view `v_inventory_unit_cost`, read by `loadUnitCostMap`. No page averages prices itself.
- **Method:** a perpetual moving average (value on hand ÷ quantity on hand).
- **Why the cumulative average was wrong:** it kept eaten lots in the price. On the production copy it left ৳1,425 of value on empty stock (ledger ৳12,923 vs qty × average ৳11,498). With the moving average, ledger value ৳12,923.35 = qty × cost ৳12,923.34.
- **Straw:** priced per piece (৳3000 / 128 = ৳23.4375, stored exactly).
- **Grass:** ৳0.
- **Missing vs free:** a missing price stays `missing`, never 0. A free item is `zero_confirmed`.
- **Precision:** `qty` numeric(14,4), `unit_cost` numeric(14,6). Money is rounded only when shown or posted.

## I. Ledger integrity

- **No edits or deletes of history:**
  - purchase memo edit/delete now inserts `purchase_reversal` rows (key `purchase-undo:{id}`) and new rows;
  - consumption undo is a `consumption_reversal` at the original cost;
  - history pages hide undone rows and show "Bought … · entered …".
- **Invariants checked in tests (U8):** available − consumed − closing + gap = 0 on every line, and each line has exactly its consumed quantity as its net posting.

## J. Concurrency and idempotency

- Per-item advisory lock on every insert; an overdraw is rejected (concurrency test: exactly one of two sessions succeeds).
- Unique `idempotency_key` on the ledger and on period opening.
- Mixing uses a batch id.

## K. Pages

- **Inventory → Feed Usage** (new):
  - active periods with running estimate and forecast;
  - "in stock but not in use";
  - history with expected vs actual (variance) and status;
  - per animal: actual, estimated, measured gain, cost per kg gain;
  - totals by month and by feed.
- **Cattle profile:** actual feed cost (weight-based), "+ running (not final)", and the ration plan labelled "reference". Days not covered show as NOT RECORDED.
- **Dashboard card:** actual this month, running estimate, needs attention, and near-depletion forecasts.
- **Dates:** all feed pages use the Asia/Dhaka date.

## L. Forecast, learned usage, variance

- **Learned daily usage:** from recent closed periods only.
- **Forecast:** stock ÷ daily usage → days left and depletion date. It never writes anything.
- **Variance:** expected vs actual per closed period, using only usage learned from earlier periods. No reason is assumed.

## M. Tests (all run 2026-09-24, all passing)

| Suite | Result |
|---|---|
| `supabase/tests/feed_ledger.sql` (real PostgreSQL 17, all migrations replayed) | **43 / 43** |
| `supabase/tests/feed_usage.sql` (U1–U8) | **27 / 27** |
| `feed_ledger_concurrency.sh` | **PASS** (one session ok, the other rejected, stock 0) |
| `feed_ledger_rollback.sh` on a fresh production copy (all 5 migrations + corrections, applied and rolled back) | **PASS** (every original value identical) |
| Jest (includes 21 engine tests in `feed-usage-engine.test.ts`) | **456 / 456**, 58 suites |
| `tsc --noEmit` | clean |
| ESLint | 0 errors (8 old warnings in untouched files) |
| `next build` (placeholder env) | success |

## N. Acceptance scenario

- **Database (U1):** a purchase with business date 01 Sep, entered after the period was closed:
  - it keeps its business date and entry time;
  - the period is re-reconciled automatically (the old posting is reversed, not edited);
  - quantity and cost are **identical** to on-time entry;
  - stock equals the closing count.
- **Engine:** with 5 cattle, allocation follows weight and covers every day of 01–08 Sep, with no unrecorded days. The whole cost is allocated.

## O. Reconciliation (production copy with everything applied)

| Measure | Value |
|---|---:|
| Integrity checks (null meaning, qty ≤ 0, direction, duplicate keys, unbalanced recipes) | all 0 |
| Cash purchases | ৳125,725.57 |
| Opening stock (not cash) | ৳3,299.40 |
| Herd feed expense | ৳94,023.68 |
| Feed logged per animal | ৳36.66 |
| Stock-count losses (history, not yet restated) | ৳22,041.27 |
| Stock on hand | ৳12,923.35 = qty × cost |

Per-animal actual feed cost (weight-based):

| Animal | ৳ |
|---|---:|
| C001 | 20,184 |
| C002 | 22,305 |
| C003 | 22,211 |
| C004 | 14,797 |
| C005 | 7,104 |
| C006 | 7,459 |
| **Total** | **94,060** (unallocated 0) |

## P. History (dry run, not applied)

See `FEED_USAGE_HISTORY_DRY_RUN.md`: 22 periods, 601 rows.
- **Totals:** current ৳108,423.60 vs proposed ৳108,683.96 (+৳260.35).
- **Reclassification:** the ৳22,041 now shown as "loss" is feed that was eaten.
- **Two data facts, reported and not fixed:**
  - the old recipe engine took ingredients the store did not have (about 5 kg per ingredient);
  - purchases dated on a True-Up day.
- **Approval:** history is not re-stated without the owner's approval.

## Q. Security

- **Tracked files, branches, remote:** no secret in any tracked file, branch or `origin/main`.
- **Client bundle** (`.next/static`, 198 files): 0 matches for the service-role key, the VAPID private key, the cron secret, the Gemini key or the text `service_role`. The single `sb_secret_` match is supabase-js's own prefix check, not a key.
- **Credentials used:** `Data.txt` was not used. No key was printed or written to the repo.
- **Owner action needed:**
  1. revoke the personal access token in `Data.txt`;
  2. rotate the secret key that was pasted in chat;
  3. approve deleting the 184 local `refs/cline/*` checkpoint commits that contain the token (they were never pushed).

## R. Build and deployment

- **Build:** passes. Deployment is **not done**, because production DDL needs an owner-authorised session.
- **Owner steps, in order, in the Supabase SQL Editor, after a backup:**
  1. `supabase/migrations/20260925090000_baseline_drift_columns.sql`
  2. `supabase/migrations/20260925100000_feed_inventory_ledger.sql`
  3. `supabase/migrations/20260925110000_expense_categories.sql`
  4. `supabase/migrations/20260925120000_weight_types.sql`
  5. `supabase/migrations/20260925130000_feed_usage_periods.sql`
  6. Check: section 7 of `docs/sql/feed_ledger_reconciliation.sql`. All must be 0; otherwise stop.
  7. `supabase/corrections/20260925_feed_historical_corrections.sql`
  8. Commit and deploy the code.
  9. Tell me, and I will verify production read-only.
- **Rollbacks:** in `supabase/rollback/`, run in reverse order.

## S. Remaining limits

- **History restatement:** waits for owner approval (P).
- **Unused queries:** some pages still run purchase queries they no longer use (no effect on numbers). `Animal360Hero` and `Financial360Panel` are unused.
- **Wizard placeholder weight:** the cattle wizard stores a 1 kg placeholder when no weight is entered.
- **Offline weight logs:** they are saved as "measured".
- **Nutrients:** values on Feed & Nutrition are typical reference values.

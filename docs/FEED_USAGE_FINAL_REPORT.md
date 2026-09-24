# Tanvir Agro — Feed Inventory & Feed Costing: Final Report

- **Date:** 2026-09-24
- **Status:** released to production and deployed on 2026-09-24 (§R). `main` = live code.
- **Companion documents:**
  - `FEED_USAGE_ARCHITECTURE.md` (design);
  - `FEED_SYSTEM_ARCHITECTURE.md` (ledger reference);
  - `FEED_COSTING_IMPLEMENTATION_REPORT.md` (the first phase: corrections C1–C12, the 2026-09-24 incident).

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

## O. Reconciliation (production, after the release and C13)

| Measure | Value |
|---|---:|
| Integrity checks (null meaning, qty ≤ 0, direction, duplicate keys, unbalanced recipes) | all 0 |
| Cash purchases | ৳125,725.57 |
| Opening stock (not cash) | ৳3,299.40 |
| Herd feed expense | ৳116,064.95 (৳94,023.68 recorded + ৳22,041.27 stock-finished remainders, C13) |
| Feed logged per animal | ৳36.66 |
| Stock-count losses | ৳0 (the ৳22,041.27 booked as loss was feed eaten, P) |
| Stock on hand | ৳12,923.35 = qty × cost |

Per-animal actual feed cost (weight-based, by the days each animal was on the farm):

| Animal | Before C13 ৳ | After C13 ৳ |
|---|---:|---:|
| C001 | 20,184 | 24,761 |
| C002 | 22,305 | 27,364 |
| C003 | 22,211 | 27,374 |
| C004 | 14,797 | 18,242 |
| C005 (arrived 07-31) | 7,104 | 8,956 |
| C006 (arrived 07-31) | 7,459 | 9,404 |
| **Total** | **94,060** | **116,102** (unallocated 0) |

## P. History: stock-finished remainders are feed (C13, applied)

- **Owner decision (2026-09-24):** marking an item finished means the cattle ate it.
- **Before:** the old app booked each remainder as a loss (22 "True-Up" rows, ৳22,041.27, General Expenses).
- **Correction C13** (`supabase/corrections/20260925_c13_trueup_is_feed.sql`, rollback in `supabase/rollback/`), per True-Up row:
  - an `adjustment_in` of the same qty and cost that points at it → the loss is cancelled;
  - a herd `consumption` of the same qty and cost covering the days since that item's previous count (`covers_from`, migration `20260925140000`).
- **Allocation:** the engine spreads such a row over the days it covers by the weight of the animals present, so C005/C006 (arrived 07-31) carry nothing for June–July.
- **Result:** loss ৳22,041.27 → ৳0; feed ৳94,023.68 → ৳116,064.95; stock and stock value unchanged. Nothing edited or deleted; idempotent; rollback tested.
- **Data facts, reported and not fixed:** the old recipe engine took ingredients the store did not have (about 5 kg per ingredient).

## Q. Security

- **Tracked files, branches, remote:** no secret in any tracked file, branch or `origin/main`.
- **Client bundle** (`.next/static`, 198 files): 0 matches for the service-role key, the VAPID private key, the cron secret, the Gemini key or the text `service_role`. The single `sb_secret_` match is supabase-js's own prefix check, not a key.
- **Credentials:** the old `Data.txt` token was already revoked (401) and the file is deleted. The release used a new owner token, stored DPAPI-encrypted outside the project for 24 h and deleted after use; it was never printed or written to the repo.
- **Owner action needed:**
  1. revoke the `claude-release` token at supabase.com → Account → Access Tokens;
  2. rotate the secret key that was pasted in chat (then update Netlify and `.env.local`).

## R. Build and deployment — DONE (2026-09-24)

| Step | Result |
|---|---|
| Backup | All 67 public tables (958 rows) exported and read back before any change |
| First release attempt | Failed with `business_users.is_active` missing (production drift: migration 032 was never fully applied). One transaction, so **nothing changed**; verified. |
| Fix | Membership check reads `is_active` only when the column exists. Re-tested on a copy made to match production exactly (applied twice, idempotent), DB tests 43/43 and 27/27. |
| Release | Migrations 090000–130000 and corrections C1–C12 applied in one transaction (the generated bundle was removed afterwards; the migration files are the source). Then migration 140000 and correction C13. |
| Production check (read-only) | Integrity checks all 0. Consumption without cost 0. Cash purchases ৳125,725.57, opening ৳3,299.40, stock ৳12,923.35 = qty × cost. 5 RPCs present. No stray rows written between release and deploy. |
| Code | Pushed to `main` (`24aa761`). CI (lint, tests, build) green after two pre-existing CI defects were fixed: Jest config needed `ts-node`, and `next.config.ts` imported a Sentry subpath missing from the locked version (this would also have failed the Netlify build). |
| Live site | https://caagro.netlify.app serves the new code. |

## S. Remaining limits

- **Unused queries:** some pages still run purchase queries they no longer use (no effect on numbers).
- **Wizard placeholder weight:** the cattle wizard stores a 1 kg placeholder when no weight is entered.
- **Offline weight logs:** they are saved as "measured".
- **Nutrients:** values on Feed & Nutrition are typical reference values.

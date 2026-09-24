# Feed Usage Architecture — Audit and Target Design

**Written for:** the farm owner and any developer changing feed, stock or cost code.
**Status:**
- Implemented locally and tested (§8).
- **Not yet applied to production.**
- The production deployment steps are in §9.

This document builds on `FEED_SYSTEM_ARCHITECTURE.md` (the inventory ledger) and replaces its "record feeding every day" workflow.

---

## 1. Audit: how the system works today

There are two different "todays".

**Production (live site)**
- Stock is deducted automatically: the old `AutoEngineRunner` runs a ration formula on every visit to the Inventory page.
- **Evidence:**
  - 592 of 665 stock movements were produced this way.
  - On 2026-09-24 one page view produced 30 more rows.
- **"True-Up" finish entries:**
  - They reset stock to zero.
  - They are booked as losses, not as feed.
- **Costs:**
  - Latest-price costing and piece × kg costing overstated animal feed cost by ≈ ৳63,000.
  - Accounting also capitalised a formula estimate on top of the expensed feed.
- Full evidence: `PRODUCTION_FEED_RECONCILIATION.md`.

**Uncommitted fix (branch `chore/phase0-baseline`)**
- The automatic engine is removed.
- Stock uses a signed, audited ledger with average costing (WAC; since this work, a moving average of the stock on hand, see §3.5).
- The system only knows about feeding that someone **records**: daily "Record Feeding", feed sessions, per-cow logs.

### 1.1 Conflicts with how the farm really runs

| # | Finding | Where | Effect |
|---|---|---|---|
| A1 | Consumption exists only when someone records it daily | `record_herd_feeding`, `recordDailyFeeding` | The owner does not record daily, so every unrecorded day looks like "not fed" (22 such days in production data) |
| A2 | "Stock finished" (True-Up) is booked as `adjustment_out` → General Expenses | `markInventoryItemEmpty` | Feed that was eaten is reported as a loss, not as feed cost |
| A3 | No concept of "this feed was in use from date X to date Y" | recipe `active_from/until` and roughage `roughage_active_from/until` are **plan settings only** | The owner's real inputs (purchase date, start date, finish date) do not drive cost |
| A4 | A late purchase can block or distort history | The stock guard checks the total balance; daily consumption needs stock that is "missing" until the purchase is entered | Late entry, normal on this farm, makes history wrong or rejected |
| A5 | Herd feed is split **equally per head** | `animalFeedShares`, `herdFeedCostShares` | A 500 kg and a 200 kg animal get the same cost |
| A6 | Purchase memo edit and delete **update or delete ledger rows** | `inventory/purchase/history/actions.ts` (`.update`, `.delete`) | History is rewritten silently, and consumption already valued on it becomes inconsistent |
| A7 | A recipe can be hard-deleted even after use | `permanentlyDeleteRecipe` | Historical costing loses its recipe |
| A8 | The per-animal feed cost is computed in several places | cattle page, cattle list, valuation, dashboard, finance, partners, global search | Numbers can disagree; one authoritative service is required |
| A9 | Forecast "days left" uses the ration plan or a 30-day history, not what was actually used | `inventory/page.tsx` | It ignores real usage |
| A10 | Some feed pages compute "today" in UTC | `inventory/page.tsx` (`toISOString().slice(0,10)`) | Before 06:00 Dhaka time the date is yesterday (BUG-08) |
| A11 | Money totals are summed in JavaScript floats in several views | many pages | Cent-level drift. Authoritative totals must come from PostgreSQL `numeric` |

**Already correct, and kept:**
- the immutable ledger with reversal-based corrections;
- average cost as of the business date (changed from a cumulative average to a moving average, §3.5);
- idempotency keys and the per-item advisory lock;
- items keep their own units (straw in pieces);
- own-land grass is recorded as `own_production` at ৳0;
- measured vs estimated weights;
- mixing through `produce_feed_batch`;
- configurable utility categories;
- the audit tables.

## 2. Accounting model (the concepts are never mixed)

| Concept | Stored as | Meaning |
|---|---|---|
| A. Purchase | ledger row `purchase` (business date = purchase date) | Feed was bought; cash out |
| B. Inventory | Σ ledger movements (signed) | Stock on hand and its value |
| C. Feed usage | **usage period** (start → end) | Feed was being eaten continuously |
| D. Feed cost | consumed quantity × WAC as of the period end | Economic cost of feed eaten |
| E. Cattle allocation | derived: day × animal, by live weight | Which animal "ate" which share |
| F. Cash expense | purchases only | Money paid |
| G. Accounting expense | closed-period consumption → Feed Expenses (5200) | Cost recognised |
| H. Estimated / running | derived for open periods (never stored as consumption) | "So far, probably…" |
| I. Actual / confirmed | closed and reconciled period | Measured by opening + purchases − closing |
| J. Entry timestamp | `created_at` / `created_by` | When it was typed in |

**Purchase vs consumption.** A purchase moves money into inventory (DR Inventory, CR Cash). Consumption moves inventory into expense (DR Feed Expense, CR Inventory). A purchase is therefore never also a feed expense.

**Business date vs entry time.**
- `inventory_transactions.recorded_at` is the **business date** (when it happened). The name is historical.
- `created_at` is **when it was entered**.
- The UI labels them "Purchase date" and "Entered on".

## 3. Target design: feed usage periods

```
start_date ───────────────────────────── end_date
feed in use (open: ESTIMATED)             closing count entered → ACTUAL
```

### 3.1 Data

- **`feed_usage_periods`:**
  - the business;
  - the target: an **item** (straw, grass, Mix Feed…) or a **recipe** (ingredients fed together);
  - start and end dates;
  - status: `open` / `closed` / `unreconciled`;
  - optional feeding rule;
  - audit fields.
- **`feed_usage_period_lines`:**
  - one line per item consumed by the period (one for an item period, one per ingredient for a recipe period);
  - each line keeps a **snapshot of the recipe share**, so later recipe changes never alter history (recipe versioning);
  - the closing count, the reconciled quantities and the gap.
- **No overlap.** One item cannot be in two periods that overlap in time; a database trigger enforces this.
- **Linked postings.** Every ledger row posted for a period carries its `period_line_id`.

### 3.2 Closing and reconciliation (database function, one transaction)

For each line:

```
available at end = Σ IN − Σ OUT   (business date ≤ end_date, excluding this line's own postings)
consumed          = available at end − closing count
```

- **`consumed ≥ 0`:** one `consumption` row is posted on `end_date`, valued at the moving-average cost as of `end_date`. It is ACTUAL.
- **`consumed < 0`:** the count is higher than recorded stock: a purchase was probably not entered yet. Nothing is posted. The line shows a **reconciliation gap** of exactly that quantity, and the period status becomes `unreconciled`.

**Automatic re-reconciliation.** Suppose a movement is entered later with a business date that falls inside, or before, a closed period of the same item; a late purchase is the typical case. The period is then re-reconciled automatically:
1. Its previous posting is reversed (`consumption_reversal`, audited).
2. The correct quantity and cost are posted.

This is how a purchase entered on 08 Sep for 01 Sep gives **the same result** as entering it on 01 Sep.

**Other rules:**
- **Purchases during a period** need no action. They are inside "available at end".
- **Optional manual feeding entries** inside a period are ordinary OUT rows. They reduce "available at end", so the period posts only the remainder and nothing is counted twice.
- **Mixing batches** (`produce_feed_batch`) stay as they are. Mix Feed is then just an item with its own period.

### 3.3 Daily and per-animal allocation (derived, not stored)

One authoritative service, `src/lib/feed/usage-engine.ts`.

**Presence**
- An animal is in the herd from its purchase date until its sale date, or its status change for dead/archived animals.
- No allocation falls outside that window.

**Weight on a given day**
1. The latest **measured** weight on or before that day.
2. Else the earliest measured weight after it.
3. Else the initial weight, **labelled estimated** when the owner marked it so.

Weights are never invented or stored.

**Expected need per animal and day**
- Depends on the period's feeding rule:
  - `pct_live_weight`: weight × %. For an item not in kg it needs `kg_per_unit`.
  - `per_head`: a fixed quantity per head per day.
- If there is no rule, allocation is proportional to **live weight**.

**Split of a closed period**
- The actual consumed quantity is split across its days by that day's total expected need.
- Each day's quantity is split between the animals by their expected need, which is weight-based. Recorded per-animal rows stay with their animal.

**Open period (running estimate)**
- Daily quantity:
  1. the feeding rule;
  2. else the learned average of this item's previous closed periods;
  3. else no estimate, shown as "not enough data".
- Valued at the current average cost (`v_inventory_unit_cost`) and labelled ESTIMATED.

**Forecast**
- Stock ÷ learned daily usage (or the rule) gives the days left and the depletion date.
- A forecast never writes to the ledger.

**Variance**
- Expected (rule or learned average) vs actual, per closed period, in quantity and %.
- No reason is assumed.

### 3.4 Status everywhere

Every total is reported in three parts, which are **never added into one unlabelled number**:
- **ACTUAL:** closed periods and recorded consumption.
- **ESTIMATED:** open periods.
- **UNRECONCILED:** gaps, and legacy rows with unknown cost.

### 3.5 Costing: one authoritative unit cost

- `inventory_unit_cost_as_of(item, date)` = value on hand ÷ quantity on hand (perpetual moving average), with the last stock-in price as a fallback when nothing is on hand. `v_inventory_unit_cost` exposes today's figure. Every page reads it through `loadUnitCostMap`; no page averages prices itself.
- **The old cumulative average was wrong.** It kept already-eaten lots in the price, which understated the cost after restocking and left value on an empty store. On the production copy it showed ৳12,923 of ledger value against ৳11,498 of qty × average. With the moving average, ledger value = qty × cost = **৳12,923.35**.
- **Undo keeps the average.** A `consumption_reversal` returns stock at the original row's cost. A `purchase_reversal` removes stock at the purchase's cost.
- **Precision:** `qty` numeric(14,4), `unit_cost` numeric(14,6). Straw ৳3000 / 128 pieces = ৳23.4375 is stored exactly.

## 4. What changes in the existing code

| Area | Change |
|---|---|
| Stock finished (True-Up) | Replaced by **End usage period**. With count 0 the consumption goes to Feed Expense, not to losses. The old adjustment remains only for real count corrections outside a period. |
| Daily "Record Feeding" | Kept as **optional**. It never double-counts with periods. |
| Purchase memo edit/delete | Now **reversal-based**: the old rows stay; a correction row undoes them, and new rows are posted. |
| Recipes | A recipe used by a period cannot be deleted; its snapshot lives in the period lines. |
| Per-animal feed cost | Every page uses `usage-engine`: weight-based, with ACTUAL / ESTIMATED / UNRECONCILED. |
| Forecast | Uses learned actual usage. |
| Dates | Feed pages use the Asia/Dhaka calendar date. |

## 5. Historical data (dry run only, not applied)

- **Legacy rows:** the 565 legacy formula rows and the True-Ups can be read as periods that end at each True-Up.
- **What would change and what would not** (measured on the production copy, 22 periods, 601 rows):
  - The total barely moves: ৳108,423.60 today vs ৳108,683.96 proposed (+৳260.35, a revaluation from legacy FIFO row costs to one average per period).
  - True-Up amounts (৳22,041) move from "losses" to "feed expense".
  - Animal allocation becomes weight-based (already true in the app for all feed).
- **Before any rewrite:** the dry-run report (`docs/FEED_USAGE_HISTORY_DRY_RUN.md`) shows the current data, the proposed interpretation, the new totals, the differences and the affected rows.
- **Approval required:** nothing historical is rewritten without the owner's approval.

## 6. Invariants (checked automatically)

1. **Stock balance:** opening + purchases + other IN − consumption − other OUT = closing, for every item and every closed period line.
2. **Cost:** a closed line's posted value = consumed quantity × moving-average cost as of end date, and ledger value on hand = qty on hand × current cost.
3. **One effect per event:**
   - each purchase has exactly one ledger row;
   - each period line has at most one net posting (reversed postings net to zero).
4. **No double counting:** manual feeding plus a period posting never exceeds the stock available.
5. **No allocation outside presence:** feed is allocated only while the animal is in the herd.
6. **Growth:** only measured weights produce ADG or gain.
7. **Recipes:** historical usage uses the recipe share snapshot.
8. **Corrections:** a correction never deletes or edits an original row.

## 7. Security findings

| Finding | Status |
|---|---|
| **Account-wide Supabase access token (`Data.txt`)** | Git-ignored, never pushed. It is present in 184 **local** Cline checkpoint commits (`refs/cline/*`), not on GitHub. **It must be revoked in the Supabase dashboard.** Deleting the local checkpoint refs is prepared but needs the owner's OK, because it removes Cline's local undo history. |
| **Supabase secret key pasted in chat** | Stored only in the git-ignored `.env.local`. It must be rotated in the Supabase dashboard, and the new value put in Netlify and `.env.local`. |
| **Source, branches and remote** | No secrets in any tracked file, any branch or `origin/main`. |
| **Client bundle** | Checked after build (§8): no service-role or secret key strings. |
| **Service-role usage** | Server-only (`accounting/engine.ts` cache, backup, cron). |

## 8. Verification

§8 of `FEED_COSTING_IMPLEMENTATION_REPORT.md` records the tests, reconciliation and build results.

## 9. Deployment

Deployment has three steps:
1. The owner applies the migrations in the Supabase SQL Editor.
2. The owner deploys the code.
3. The system is verified read-only.

No production write can be made from this machine without the account-wide token, which the owner has forbidden.

# Feed System Architecture

How feed stock, feed cost and feed accounting work after migration `20260925100000_feed_inventory_ledger.sql`. Read this before changing any code that writes to or reads from `inventory_transactions`.

## 1. One ledger, two columns for meaning

Every stock movement is one row in `inventory_transactions`.

| Column | Meaning |
|---|---|
| `type` | **Direction only.** `purchase` = stock IN, `consumption` = stock OUT. Kept for compatibility. |
| `movement_type` | **What happened.** Required. The table below lists the values. |
| `cost_source` | Where `unit_cost` came from: `invoice`, `wac`, `mix_inputs`, `zero_confirmed`, `zero_unconfirmed`, `missing`, `manual`, `legacy`, `correction`. |
| `is_estimate` | `true` = the quantity came from a formula (the removed auto-deduction engine), not from a person recording it. |
| `idempotency_key` | Unique when set. One physical event produces exactly one row. |
| `reverses_id` | Points to the row that a correction reverses. |

| movement_type | Direction | Cash? | Accounting |
|---|---|---|---|
| `purchase` | IN | **Yes. The only cash movement.** | DR Inventory / CR Cash |
| `opening_balance` | IN | No | DR Inventory / CR Partner Capital (stock owned before the books started) |
| `own_production` | IN | No | Harvest from own or leased land (e.g. grass) at ৳0. The land rent is booked once, as Rent & Lease. Valuing the grass as well would count that cost twice. |
| `consumption_reversal` | IN | No | Audited undo of a consumption row (`reverses_id` required, same item, qty ≤ original). It returns the quantity at the original row's cost, so the average does not move. It reduces the account the consumption was booked to. It is not a gain and not a new price. |
| `feed_mix_output` | IN | No | Internal transformation, valued at the inputs' cost |
| `adjustment_in` | IN | No | Stock gain (reduces General Expenses) |
| `return` | IN | No | Stock gain |
| `consumption` | OUT | No | Feed eaten. With a `cattle_id`, capitalised into that animal. Without one, Feed Expenses (5200). Medicine goes to Vet & Medical. |
| `feed_mix_input` | OUT | No | Internal transformation (offsets `feed_mix_output`) |
| `wastage` | OUT | No | Stock loss (General Expenses) |
| `adjustment_out` | OUT | No | Stock loss from a physical count (General Expenses) |
| `purchase_reversal` | OUT | Reduces cash purchases | Audited undo of a purchase row (`reverses_id` required, same item, qty ≤ original), at the purchase's own cost. Editing or deleting a purchase memo creates these; the original row is never edited or deleted. |

A check constraint enforces that `type` matches `movement_type`. `qty > 0` and `unit_cost >= 0`. The pure function `src/lib/accounting/inventory-ledger.ts` implements the accounting table, and the accounting engine uses it.

## 2. Costing: moving average of the stock on hand, as of the date

- `inventory_unit_cost_as_of(item, date)` returns (value on hand) ÷ (quantity on hand), using every priced row on or before that date: IN rows add qty × cost, OUT rows subtract qty × the cost they were valued at. If nothing is on hand, it returns the last stock-in price.
- **Why not a cumulative average of all purchases?** A cumulative average keeps old, already-eaten lots in the price forever. Example: 100 kg @ ৳40 eaten, then 100 kg @ ৳60 bought. The cumulative average says ৳50, but the only stock is ৳60 stock. On the production copy, that left ৳1,425 of "value" on an empty store (৳12,923 ledger vs ৳11,498 qty × average). With the moving average, value on hand = qty × cost: **৳12,923.35 = ৳12,923.34**.
- **One source for every page:** the view `v_inventory_unit_cost` (current cost per item), read by `src/lib/inventory/unit-cost.ts → loadUnitCostMap`. The inventory page, portfolio, cattle profile, Feed & Nutrition, Feed Usage and dashboard card all use it. The app no longer averages prices itself.
- Money precision: `qty` numeric(14,4) and `unit_cost` numeric(14,6), so straw at ৳3000 / 128 = ৳23.4375 is stored exactly. Money is rounded to 2 decimals only when it is displayed or posted.
- The insert trigger `trg_inventory_tx_before_insert` sets `unit_cost` on every OUT row to that value. The client's cost is ignored, unless `cost_source = 'manual'`, which only corrections use.
- A later purchase never changes the cost of an earlier movement.
- If no priced stock-in exists, `unit_cost` stays NULL with `cost_source = 'missing'`. It is never 0, never the latest price and never guessed.
- A ৳0 price is saved as `zero_unconfirmed` unless the user ticks "really free", which saves it as `zero_confirmed`.
- "Latest purchase price" maps are gone. `weightedAverageUnitCost` in `src/lib/inventory/feed-costing.ts` remains only as a fallback for callers that pass no unit-cost map.

## 3. Stock

- **Stock is signed.** Stock = Σ IN − Σ OUT. The view `v_inventory_balance` and the app never clamp it. Negative stock is shown in red as "a purchase or count is missing".
- **Concurrency.** The insert trigger takes `pg_advisory_xact_lock` per item and rejects an OUT row that would take the balance below 0 (`23514`). Two concurrent sessions cannot both spend the same stock (`supabase/tests/feed_ledger_concurrency.sh`).
- **Legacy data.** Legacy negative balances stay visible. Only new overdraws are blocked.

## 4. Units

- **Each item keeps its own unit.** Straw is bought, stocked, fed and costed per piece: cost = pieces × average cost per piece. No item has to be in kg.

- `inventory_items.kg_per_unit` is **optional**. It is 1 for kg items and empty for everything else. Fill it only if you want kg-based ration plans shown in that item's unit.
- **When it is empty, nothing is converted.**
  - The kg ration plan is not priced for that item.
  - A ৳/piece price is never multiplied by kg.
  - The actual cost still comes from the pieces recorded.
- **Grass from the leased land** is a separate item, in whatever unit is practical (e.g. bundle). It is stocked in with **Harvested from own land** (`own_production`).
- Feed sessions on the Feed & Nutrition page dispense kg, so only kg items are offered there. Piece items are recorded with **Record Feeding** in their own unit.

## 5. Plan versus actual

| | Source | Writes stock? | Shown as |
|---|---|---|---|
| **Ration plan** | `utils/feed-calculator.ts` (weight × requirement) | **Never** | "Plan" / "Estimate (plan)" |
| **Actual consumption** | A closed **feed usage period** (opening + stock-in − closing count), or rows a person records: Record Feeding, feed session, quick dispense, per-cow log | Yes | "Actual" / "Recorded" |
| **Running estimate** | An open usage period: rule or learned daily usage × days so far | **Never** | "Running (not final)" |

- **No automatic deduction.** The old `AutoEngineRunner` and `runAutoFeedDeductions` are deleted. Opening a page, activating a recipe or roughage, or changing a recipe's start date never writes to the ledger.
- **Record Feeding** (`recordDailyFeeding` → RPC `record_herd_feeding`). The user confirms per-item quantities in each item's own unit. The plan only pre-fills suggestions, split by the recipe's proportions. The idempotency key `herd-feeding:{business}:{date}:{item}` makes a second save for the same date and item fail. To correct a saved day, use a stock adjustment.
- **Daily entry is not required.** The normal way is a usage period: *Inventory → Feed Usage → Start using* on the date the feed was opened, and *Finished* with the count left when it ran out. See `docs/FEED_USAGE_ARCHITECTURE.md`.
- **Days covered by neither a usage period nor a recorded row are NOT RECORDED.** They are never back-filled. Use `daysNotRecorded()` in `feed-costing.ts`, or section 5 of `docs/sql/feed_ledger_reconciliation.sql`.

## 6. Feed mixing

The RPC `produce_feed_batch(business, recipe, output_item, output_qty, date, batch_id)` does everything in one transaction:

- Inputs = `qty_per_batch / Σ ingredients × output_qty`. It scales by the ingredient total, never by the stored batch size.
- Each input is a `feed_mix_input` row at the input's average cost as of the batch date.
- The output is a `feed_mix_output` row at Σ input cost / output qty (`cost_source = 'mix_inputs'`). If any input has an unknown cost, the output cost is `missing` and the batch is never undervalued.
- Idempotency: `feed-batch:{batch_id}:in:{item}` and `feed-batch:{batch_id}:out`. The client generates `batch_id` once per form, so a double click cannot deduct twice.
- An output item is required, otherwise the mixed feed would disappear.

Both UIs (Produce Batch dialog, Feed Mixer) call the RPC through `src/lib/inventory/feed-batch.ts`.

## 7. Recipes

- Σ `qty_per_batch` must equal `output_qty`, within 0.01 kg. Quantities must be > 0 and no ingredient may appear twice.
- The rule is checked in three places:
  - in the recipe builder (live check; Save is disabled otherwise);
  - in `createRecipe` / `setActiveRecipe` (`src/lib/inventory/recipe-math.ts`);
  - in the database, for active recipes (deferred constraint triggers).

## 8. Per-animal feed cost

- **Actual.** Rows with the animal's `cattle_id` count in full. Herd feed (herd rows and closed usage periods) is spread over the days it covers and shared among the animals present each day **by body weight** (latest measured weight on or before the day → measured purchase weight → first later measurement → estimated purchase weight, labelled). It is never split equally. See `computeFeedSnapshot` in `src/lib/feed/usage-engine.ts`, loaded by `src/lib/feed/feed-data.ts` and `src/lib/inventory/herd-feed-share.ts`. Totals, valuation, cost basis and the cattle page use this figure only.
- **Running.** The open periods' estimate, shown separately as "+ running (not final)". It is never added to the actual.
- **Estimate (plan).** `calculateAlgorithmicFeedCost` = ration × current average cost, unit-aware. It is shown beside the actual on the cattle page and labelled "Estimate (plan)". It is **never** added to the actual or booked in accounting.
- **Legacy rows.** Rows created by the old engine (`is_estimate`) are real stock movements, so they count as actual. The cattle page says how many there are.
- **Stock-count adjustments.** Adjustments (true-ups) are farm-level. They are not attributed to animals.

## 9. Corrections and audit

- **History is preserved.** Nothing is deleted or rewritten. Corrections insert reversing or re-dating rows (`cost_source = 'correction'` or `manual`, `reverses_id`), or fill a NULL cost only when priced stock actually existed.
- **Audit trail.** Every classification, fill and correction writes a row to `inventory_ledger_audit` (read-only for tenants).
- **Scripts and rollback.** Scripts live in `supabase/corrections/`. Every script has a rollback in `supabase/rollback/`, tested by `supabase/tests/feed_ledger_rollback.sh`.

## 10. Utility expenses (configurable)

- **Categories are data, not code.** Utilities are rows in `expense_categories`, managed at **Finance → Utility expenses** (or **Settings → Utility Categories & Expenses**).
  - An admin (`settings:edit`) can add, rename, enable or disable a utility.
  - Defaults are seeded for every business: Electricity, WiFi / Internet, Gas, Water, Telephone, Other utilities.
- **Categories are never deleted.** A disabled utility keeps its history.
- **The account follows the kind, not the name.** `kind` decides the account (`utility` → 6300 Utilities; also `labor`, `rent`, `transport`, `repair`, `veterinary`, `general`), so a rename never moves money between accounts. See `src/lib/expenses/categories.ts`.
- **Utilities stay separate from feed.** They are `cost_entries` linked to a utility category, and never touch inventory, feed consumption or cattle cost.
- **Audit trail.** Every insert, correction and soft delete of a cost entry is written to `cost_entry_audit` by a trigger, with the old and new row. The page shows "Edited N×" with the details.
- **Bills.** An optional bill (PDF or image, ≤ 5 MB) goes to the private `expense-bills` bucket, under the business's folder, and opens through a 5-minute signed link.

## 11. Weights: estimated vs measured

- **Two kinds of weight.** `cattle.initial_weight_type` (measured / estimated / unknown) and `weight_logs.weight_type` (measured / estimated). The forms ask for it.
- **Growth uses measurements only** (`src/lib/growth/baseline.ts`):
  - The baseline is the purchase weight when it was weighed, otherwise the first measured weight log.
  - Estimated logs are never used as growth points.
  - Example: C006 (250 kg estimated, 210 kg measured) shows no gain or loss until it is weighed again.
- **Current weight** is the latest measured weight.
- **Nothing is overwritten.** The estimate stays on record, labelled "Estimated", in the profile and the timeline.

## 12. Where things live

| Concern | File |
|---|---|
| Schema, triggers, RPCs | `supabase/migrations/20260925100000_feed_inventory_ledger.sql` |
| Expense categories, cost-entry audit, bills | `supabase/migrations/20260925110000_expense_categories.sql` |
| Weight types | `supabase/migrations/20260925120000_weight_types.sql` |
| Production-only columns captured | `supabase/migrations/20260925090000_baseline_drift_columns.sql` |
| Feed usage periods (schema, reconciliation, RPCs) | `supabase/migrations/20260925130000_feed_usage_periods.sql` |
| Allocation, running estimate, forecast (pure) | `src/lib/feed/usage-engine.ts`, loader `src/lib/feed/feed-data.ts` |
| Current unit cost (single source) | view `v_inventory_unit_cost`, `src/lib/inventory/unit-cost.ts` |
| Historical corrections | `supabase/corrections/20260925_feed_historical_corrections.sql` |
| Stock-finished remainders re-booked as feed (C13) | `supabase/migrations/20260925140000_consumption_covers_from.sql`, `supabase/corrections/20260925_c13_trueup_is_feed.sql` |
| Rollbacks | `supabase/rollback/*` |
| DB tests | `supabase/tests/feed_ledger.sql`, `feed_ledger_concurrency.sh`, `feed_ledger_rollback.sh` |
| Costing rules (pure) | `src/lib/inventory/feed-costing.ts`, `recipe-math.ts`, `src/lib/accounting/inventory-ledger.ts` |
| App tests | `src/__tests__/feed-costing.test.ts`, `src/__tests__/farm-records.test.ts` |
| Reconciliation (read-only SQL) | `docs/sql/feed_ledger_reconciliation.sql` |

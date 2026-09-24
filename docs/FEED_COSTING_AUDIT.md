# Feed Consumption & Cost Audit — Tanvir Agro

- **Date:** 2026-09-24
- **Scope:** code on branch `chore/phase0-baseline` (@ `1aeab46`), plus independent maths
- **Mode:** read-only. No code, migrations or data were changed.
- **Status of real-data sections:** **pending**. The read-only extraction could not run: the Supabase API returned `401 Unregistered API key` for the service-role key in `.env.local` (see F-17). All reconciliation tables below are therefore templates. `docs/sql/feed_reconciliation.sql` fills them from production. It contains read-only SELECT statements only and has been validated on a local copy of the schema.

Finding IDs (F-xx) are referenced by the SQL script.

> **Update, 2026-09-24 (reconciliation round).** See `docs/FEED_COSTING_RECONCILIATION.md`.
> - **F-17 diagnosed:** both keys use the new format (`sb_publishable_` / `sb_secret_`). The secret key is rejected (401) even with the correct header style, so it was rotated or deleted after 2026-07-19. No other read route exists in the repo.
> - **F-01 also affects mixing:** `produceMixedBatch` scales ingredients by `target / output_qty`, so a ratio of 2 uses 200 kg of ingredients per 100 kg of feed.
> - **F-02 triggers:** the automatic deduction runs on (1) opening or refreshing the Inventory page, (2) activating a roughage item, (3) activating a recipe, (4) changing a recipe's start date. There is no cron.
> - **New findings F-18 to F-22:**
>   - F-18: the engine stops silently when the stock guard rejects a day, and retries on every visit.
>   - F-19: a race can create duplicate automatic days.
>   - F-20: changing settings deducts stock.
>   - F-21: the first activation back-fills from the oldest animal's purchase date.
>   - F-22: four different stock formulas.
> - **The reconciliation SQL was validated on a synthetic ledger** and detected every planted defect.
>
> **Production verification, 2026-09-24.** See `docs/PRODUCTION_FEED_RECONCILIATION.md`.
> - **CONFIRMED in production:**
>   - F-02 (estimates as actual: 592 of 665 rows) and F-19 (a duplicated day on 08-29);
>   - F-05 (per-animal cost +৳63,072 / +54% vs actual);
>   - **F-12** (straw stocked in *pieces*, priced per piece against kg quantities, ≈ ৳37,648 of the overstatement);
>   - F-06 (Mix Feed −34.38 kg displayed as 0);
>   - F-07 (38 rows at ৳0);
>   - F-18 (15 undeducted days);
>   - F-03 in one form (opening stock stored as a purchase, ৳3,299);
>   - F-04 (≈ ৳184,314 of estimated feed capitalized by the accounting engine; ESTIMATED).
> - **NOT observed in production:** F-01 (all 6 recipes have ratio 1), and mixing, daily-button, feed-session, waste and adjustment paths (never used). They remain code-level risks.

---

# Executive Summary

The daily **ration maths is correct**. Independent calculations match the application exactly; for example, 300 kg × 1.5% = 4.5 kg/day.

The **accounting around feed is not correct**. Feed quantity and feed cost enter the books through several independent paths that overlap:

1. Estimated rations are turned into real stock deductions **automatically**. This happens every time anyone opens the Inventory page, and a manual button can deduct the same day again.
2. The same raw ingredients can be deducted **twice**: once when a feed batch is mixed, and again when the automatic engine "feeds" them through the recipe.
3. The recipe's batch size is not checked against its ingredient total. When they differ, the automatic engine deducts that ratio × the real need (2×, 100×…).
4. Several things that are not purchases are saved as `purchase`: produced mixed feed, stock-count corrections, and "true-ups". Cash and accounting then count them as money spent on feed.
5. The per-animal "feed cost" is a **theoretical estimate** (ration × days × latest price), not the feed actually used. In the income statement it is added **on top of** the real farm-level consumption, which is already expensed.
6. The stock figure is clamped at zero and ignores negative quantities, so the moment consumption exceeds purchases becomes invisible.

Any one of 2, 3 or 4 is enough to make "feed consumed/spent" larger than "feed bought". Item 5 makes reported feed cost in the P&L roughly double the real figure whenever both paths are active.

## Current Problem

"Consumption higher than purchased quantity" is possible for three reasons:

- **Consumption is not measured; it is generated.** The automatic engine and the daily button create consumption from a formula, not from what was physically fed (F-02). If the formula or the recipe scaling is off, stock is deducted by that amount regardless of what exists (F-01, F-15).
- **One physical kg can be deducted by more than one path** (F-02), and nothing links a deduction to the physical event it represents (F-10).
- **The reported "feed cost" is not derived from the purchased feed at all.** Per animal it is ration × days × the most recent price found (F-05). In the accounting it is that estimate **plus** the recorded farm-level consumption (F-04). On the cash side, internal movements are counted as purchases (F-03).

---

## Findings

| # | Issue | Severity | Location | Financial Impact |
|---|---|---|---|---|
| F-01 | Recipe batch size (`output_qty`) not validated against ingredient total; automatic deduction scales by `output_qty` | **CRITICAL** | `inventory/recipe-actions.ts` `createRecipe` (L42-58); `inventory/actions.ts:896-898` | Ingredient stock deducted ×(ingredient sum ÷ batch size) every day; inflated feed cost |
| F-02 | Up to 6 independent consumption paths, no de-duplication; mixing and auto-deduction consume the same raw ingredients | **CRITICAL** | `inventory/actions.ts` `runAutoFeedDeductions` (L788-928), `dailyFeedDeduction` (L273-330); `inventory/mix-feed/actions.ts:121`; `cattle/feed-session-actions.ts`; `cattle/feed-waste-actions.ts`; `cattle/[id]/actions.ts` | The same kg deducted 2× or more; cost counted per deduction |
| F-03 | Non-purchase inflows stored as `type='purchase'` (mixed-feed output, count adjustments, true-ups) and counted as cash spent | **CRITICAL** | `mix-feed/actions.ts:136-143`; `lib/inventory/adjustment-engine.ts:33`; `inventory/actions.ts` `markInventoryItemEmpty`; `lib/financial/cash-engine.ts:54`; `lib/supabase/queries/cash.ts:61-66`; `lib/accounting/engine.ts:373, 546, 681` | Mixed feed = a second payment for already-paid ingredients; corrections appear as spend; "purchased quantity" inflated |
| F-04 | P&L counts feed twice: farm-level consumption expensed, **and** the algorithmic estimate capitalized per animal | **CRITICAL** | `lib/accounting/engine.ts:549-566` (expense), L284-313 and L810-812 (capitalized estimate) | Feed cost in the income statement / COGS up to ~2× |
| F-05 | Per-animal feed cost is an estimate priced at the latest purchase row (which may be a mixed-feed, adjustment or true-up row) and re-values history at today's price | HIGH | `cattle/[id]/page.tsx:559-643`; `lib/supabase/queries/dashboard.ts:160-180`; `utils/feed-calculator.ts` `calculateAlgorithmicFeedCost` | Per-head cost, margin and ROI unreliable; changes when prices change |
| F-15 | Daily-deduction button splits the concentrate need **equally across all non-roughage feed items**, ignoring the recipe | HIGH | `components/inventory/DailyFeedDeductButton.tsx:61-63` | Premix/minerals deducted like corn; wrong items and costs |
| F-06 | Stock formula clamps at 0 and ignores negative quantities; "mark empty" turns negative stock into a fake purchase | HIGH | `lib/inventory/stock-ledger.ts:51-64`; `inventory/actions.ts` `markInventoryItemEmpty` | Over-consumption hidden; phantom purchases |
| F-07 | FIFO cost wrong at the edges: divides by the full quantity even when only partly covered; `null` (free) when stock is exhausted; mixed-feed cost read after the ingredients are consumed; row-capped queries | HIGH | `lib/inventory/costing-engine.ts:48-66`; `mix-feed/actions.ts:121-133`; `lib/inventory/inventory-repository.ts:102-132` | Consumption cost under/over-stated; worsens over time (1000-row cap) |
| F-09 | Feed page (nutrition workspace) uses hard-coded placeholder items: fake stock (850/1200/320/45 kg), fallback prices (৳42/8.5/48/120), non-database IDs | HIGH | `app/dashboard/(app)/cattle/feed/page.tsx` L181-230; `components/cattle/EnterpriseNutritionWorkspace.tsx:154` | Operators see invented stock/prices; feed sessions from this screen cannot save; session cost is client-supplied |
| F-08 | Auto-deduction back-fills past days using **today's** active herd; farm total uses a "Thursday lock" that per-animal estimates don't | MEDIUM | `inventory/actions.ts:516-612` | Historical deductions wrong when animals were sold/died; farm total ≠ Σ animals |
| F-10 | No movement source / reason / reference columns; source inferred from free-text `notes`; no idempotency | MEDIUM | `inventory_transactions` schema | Cannot trace or prevent duplicates (Rule 10) |
| F-11 | Two different batch-production implementations with different costing | MEDIUM | `mix-feed/actions.ts` vs `inventory/recipe-actions.ts` `produceBatch` | Same action, different cost depending on the screen |
| F-12 | Units are free text; no conversion anywhere (recipe quantities have no unit) | MEDIUM (data-dependent) | `inventory_items.unit`, `recipe_ingredients.qty_per_batch` | If any item is stocked in bags or grams, kg-based deductions are wrong by that factor |
| F-13 | Wastage saved as `consumption` (only a notes prefix distinguishes it); feed-session waste lives only in the notes text | MEDIUM | `cattle/feed-waste-actions.ts:136`; `cattle/feed-session-actions.ts:114` | Waste not reportable; mixed into feed cost |
| F-14 | Concentrate tier jump: 299 kg → 5.98 kg/day, 300 kg → 4.5 kg/day | LOW (domain decision) | `utils/feed-calculator.ts:82-87` | A 1 kg weight change moves the ration by 1.48 kg/day |
| F-16 | Rounding: per-ingredient `toFixed(4)`, totals `toFixed(2)` | LOW | several | Negligible (< 0.01 kg/day) |
| F-17 | Service-role key in `.env.local` rejected by Supabase ("Unregistered API key") | HIGH (ops) | `.env.local` | Local accounting/cron/invite code paths fail; blocked this audit's data extraction |

---

## Detailed Technical Findings

### F-01: Batch size is not tied to the ingredients (CRITICAL)
- **Current behaviour:** `createRecipe` saves `output_qty` exactly as typed and checks only that each ingredient is > 0. The automatic engine computes, per ingredient per day:
  `deducted = qty_per_batch × (farm concentrate need ÷ output_qty)` (`inventory/actions.ts:896-898`).
- **Expected:** a recipe defines finished-feed weight = Σ ingredients (or explicitly records a yield/loss factor), and deductions scale by that.
- **Proof** (independent maths vs the transcribed formula; ingredients 40 + 20 + 10 + 15 + 15 = 100 kg; farm need 45 kg):

  | `output_qty` | Correct deduction | App deduction |
  |---|---:|---:|
  | 100 | 45 kg | 45 kg |
  | 50 | 45 kg | **90 kg** |
  | 1 | 45 kg | **4,500 kg** |

- **Why it matters:** the per-animal estimate prices the recipe by the ingredient **sum**, and the stock engine scales by `output_qty`. When they differ, stock and cost disagree with each other and with reality.
- **Fix:** enforce Σ ingredients = batch size (or store `yield_pct`) in the database and the form; recompute affected auto-deductions after reconciliation.

### F-02: Overlapping consumption paths (CRITICAL)
Paths that create feed consumption, and what each represents:

| Path | Trigger | Items deducted | Real or estimate | Linked to animal |
|---|---|---|---|---|
| A. `runAutoFeedDeductions` | **Any visit to the Inventory page** (`AutoEngineRunner`), back-fills every missing day | Recipe **raw ingredients**, scaled from the estimated farm concentrate need | Estimate → stored as actual | No |
| B. `dailyFeedDeduction` (button) | Manual | Concentrate need split **equally** across all feed items (F-15), plus roughage | Estimate → actual | No |
| C. Mixing (`produceMixedBatch` / `produceBatch`) | Manual | Recipe raw ingredients | Actual | No |
| D. Feed session / quick dispense | Manual (nutrition workspace) | Selected item | Actual | Yes |
| E. Manual per-cow feed log | Manual | Selected item | Actual | Yes |
| F. Feed waste | Manual | Selected item | Actual (waste) | Optional |

- Path A only skips days where **A itself** already ran. It does not look at B–F.
- **A + C:** if feed is mixed (C consumes corn, DORB…) and a recipe is active, A consumes the **same** corn, DORB… again for the same animals' concentrate.
- **A + B** on the same day: two estimates of the same feeding.
- Violates Rule 2 (no double deduction) and Rule 6 (planned must not silently become actual).

### F-03: "Purchase" is used for things that are not purchases (CRITICAL)
- Mixed-feed output: `type='purchase'` with `unit_cost` = ingredient cost (`mix-feed/actions.ts:136-143`).
- Stock-count increase: `AdjustmentEngine` returns `"purchase"` when the count goes up (`adjustment-engine.ts:33`).
- True-up of negative stock: `markInventoryItemEmpty` inserts `type='purchase'`.
- Cash balance: `CashEngine` sums `qty × unit_cost` of **all** purchase rows as money out (`cash-engine.ts:54`, fed by `queries/cash.ts:61-66`). The accounting engine does the same (`engine.ts:373` inventory value, `:546` period purchases, `:681` cash paid for inventory).
- **Example:** buy 100 kg corn at ৳40 (৳4,000 paid) and mix it into 100 kg feed. The mixed-feed row is valued at ~৳4,000, so the system reports **৳8,000** of feed "purchases" and cash out.

### F-04: Feed counted twice in profit & loss (CRITICAL)
- Farm-level consumption rows (A, B, C without an output item) have no `cattle_id`. They are expensed to account 6600 General Expenses (`engine.ts:549-566`).
- Every animal with **no animal-linked feed rows** (which is every animal fed only through A/B/C) gets `calculateAlgorithmicFeedCost(...)`. That estimate is capitalized into livestock and flows to COGS on sale (`engine.ts:284-313, 810-812`).
- **Result:** the same feeding appears once as a real expense and once as an estimated capitalized cost.

### F-05: Per-animal feed cost is an estimate at "latest price" (HIGH)
- `cattle/[id]/page.tsx:643`: `totalFeedCost = directFeedCost > 0 ? directFeedCost : allocatedFeedCost`. Without animal-linked rows (the normal case), it is the estimate.
- The price map comes from the most recent purchase row per item (`:559-562`). That may be a mixed-feed, adjustment or true-up row (F-03), and it re-values all past days at today's price (Rule 8).
- The estimate never checks that the feed existed. Σ(estimates over the herd) can exceed total purchases, which is exactly the reported symptom.

### F-06: Over-consumption is hidden (HIGH)
- `StockLedgerEngine.calculateItemStockOnHand` uses `Math.max(0, qty)` per row and `Math.max(0, balance)` at the end. Negative rows are ignored and negative stock displays as 0.
- The database trigger (`20260626_fix_stock_guard_trigger.sql`) uses yet another formula (counts only positive purchases), and several pages compute stock their own way. There are **at least three stock formulas**.
- `markInventoryItemEmpty` resolves a negative balance by inserting a fake purchase instead of flagging an error.

### F-07: FIFO edge cases (HIGH)
- `computeFIFOCost` returns `totalCost / consumeQty`, even when purchases cover only part of the quantity. The uncovered part is priced at 0. If nothing is covered it returns `null`, so the row is saved at no cost.
- `produceMixedBatch` inserts the ingredient consumption first, **then** asks FIFO for the cost, which skips past the layer just consumed and prices the next purchase layer.
- `getEstimatedFifoUnitCost` reads all purchases and consumptions without pagination (1000-row cap), so the result drifts once an item has more than 1000 movements.

### F-09: Placeholder data on the Feed page (HIGH)
The nutrition workspace receives four hard-coded items (`feed-mix-01`, `feed-straw-01`, `feed-protein-01`, `feed-min-01`):
- stock fixed at 850 / 1200 / 320 / 45 kg;
- prices fall back to ৳42 / 8.5 / 48 / 120 per kg.

`executeFeedingSessionAction` looks the item up by ID in `inventory_items`. The placeholder IDs are not UUIDs, so sessions started there should fail. Real data (SQL section 2, "OUT feed session") will confirm. The cost per kg of a session is taken from the browser payload, not the server.

### F-15: Daily button ignores the recipe (HIGH)
`DailyFeedDeductButton` pre-fills `totalConcentrateKg ÷ (number of non-roughage feed items)` for **each** item. With 5 feed items and a 45 kg need, it proposes 9 kg of each: 9 kg of mineral premix as well as 9 kg of corn. The operator can edit the numbers, but the default is wrong, and it stacks with F-02 A.

### Other items
- **F-08:** past days are back-filled with today's herd and today's projected weights. Animals sold since then are missing from those days.
- **F-10:** there is no `source`, `reference_id`, `batch_id` or idempotency key.
- **F-11:** two batch implementations.
- **F-12:** units are free text.
- **F-13:** waste is treated as consumption.
- **F-14:** the tier jump is a domain decision.
- **F-16:** rounding is negligible.
- **F-17:** the service-role key is invalid locally.

---

## Feed Quantity Reconciliation
**Pending real data.** Run `docs/sql/feed_reconciliation.sql`, section 3.

| Feed | Purchased | Consumed | Wastage | Expected Stock | System Stock | Difference |
|---|---:|---:|---:|---:|---:|---:|
| *(section 3: `purchased`)* | real purchases only | all non-waste consumption | waste rows | purchased − consumed − waste | app formula (all "purchase" rows, clamped at 0) | system − expected (includes `phantom_in_qty`) |

Section 2 breaks each item down by source (auto / daily-button / mixing / session / waste / true-up / adjustment). That is the direct evidence for F-02 and F-03.

## Cattle Consumption Validation
Independent maths vs the app's `feed-calculator` (computed 2026-09-24; straw roughage, 90% DM):

| Case | Weight | Feeding % | Expected Daily Feed | System Daily Feed | Difference |
|---|---:|---:|---:|---:|---:|
| A: day 30 | 300 kg | 1.5% | 4.500 kg | 4.500 kg | 0 |
| A: roughage as-fed | 300 kg | (2.8 − 1.35)% ÷ 0.9 | 4.833 kg | 4.833 kg | 0 |
| B: day 5 (ramp 0.679) | 250 kg | 2.0% | 3.393 kg | 3.393 kg | 0 |
| C: tier edge | 299 kg | 2.0% | 5.980 kg | 5.980 kg | 0 |
| C: tier edge | 300 kg | 1.5% | 4.500 kg | 4.500 kg | 0 |
| D: 60 days incl. 14-day ramp, ৳48/kg | 300 kg | 1.5% | 253.125 kg / ৳12,150 | 253.125 kg / ৳12,150 | 0 |

For the brief's example (300 kg × 1.5% × 30 days × ৳48 = ৳6,480), the app gives less **by design**, because the first 14 days ramp from 50% to 100%.

**Real animals:** pending. SQL section 6 lists weight, days on farm and linked feed rows for 10 active animals, to be checked against this table.

## Cost Validation
**Pending real data.** Use SQL section 3.

| Feed | Actual Purchase Cost | Expected Consumption Cost | System Cost | Difference |
|---|---:|---:|---:|---:|
| *(per item)* | `actual_purchase_cost` | consumed × `avg_cost_per_unit` | `consumption_cost_recorded` (stock rows) and `purchase_value_counted_as_cash` (cash side) | shows F-03 / F-07 |

**Costing model actually in use:**
- **Stock rows:** FIFO, with the defects in F-07.
- **Per-animal and P&L estimates:** latest-price replacement cost (F-05).
- **Cash:** every "purchase" row, including internal movements (F-03).

These three models are mixed in the same reports. For a small farm, weighted-average cost on real purchases only is the appropriate model.

## Root Causes
1. **Estimates are written as facts.** A ration formula generates stock movements with no confirmation step (F-02 A/B).
2. **One movement type for many meanings.** `purchase` / `consumption` also encode production, correction, true-up and waste (F-03, F-13), with no source/reference fields (F-10).
3. **No single source of truth for feed cost.** Stock rows, per-animal estimates and cash each compute feed cost differently, and the P&L adds two of them (F-04, F-05).
4. **Missing invariants.** Recipe size is not tied to its ingredients (F-01), units are not modelled (F-12), and negative stock is hidden rather than blocked or flagged (F-06).

## Data Integrity Issues
To confirm with SQL section 7:
- consumption rows with `unit_cost` NULL (valued as free);
- negative-quantity rows (ignored by the stock formula);
- more than one active recipe or roughage item;
- transactions on deleted items;
- item-days with more than one consumption source (section 4);
- recipes whose ingredient ratio ≠ 1 (section 1).

## Recommended Architecture
- **Purchase:** `feed_purchases` / `purchase_lines` (supplier, date, qty in a base unit, total cost including landed cost). The only source of money spent.
- **Inventory:** `stock_movements(item_id, qty_base_unit, direction, movement_type ∈ {purchase, production_in, production_out, consumption, waste, adjustment_in, adjustment_out, transfer}, source_table, source_id, recorded_at, unit_cost, idempotency_key)`, with a DB constraint on `(source_table, source_id)`. Stock = Σ movements, computed in SQL; negative stock is blocked by a lock-protected trigger.
- **Formulation:** `recipes(batch_size_kg, yield_pct)` + `recipe_lines(item_id, qty_kg)` with a constraint that Σ lines = batch size × yield. Versioned (`valid_from`/`valid_to`).
- **Production:** one function `produce_batch(recipe_id, qty)`, one transaction: `production_out` rows for ingredients and a `production_in` row for mixed feed at the ingredients' cost. Never `purchase`.
- **Ration (plan):** `feed_plans` / daily targets computed from the ration rules. **Planned only**; never touches stock.
- **Consumption (actual):** a confirmed feeding event (per animal or per pen) creates consumption movements of the **item actually fed**. The automatic engine becomes "suggest"; the user confirms.
- **Wastage:** `waste` movements with a reason, reported separately.
- **Costing:** one method (weighted average recommended), computed at movement time and stored. History is not re-valued.
- **Profitability:** per-animal feed cost = Σ its consumption movements (or its pen's, allocated by head-days, as a stored allocation). Estimates appear only in a labelled "projection" view.

## Recommended Fix Plan
- **Phase 1: critical calculation fixes.** Disable automatic deduction on page load (make it a confirmed action). Validate recipe size (F-01). Stop saving mixed feed, adjustments and true-ups as `purchase`; exclude existing ones from cash (F-03). Remove the capitalized estimate from P&L when real farm-level consumption exists (F-04).
- **Phase 2: inventory reconciliation.** Run the SQL script. Classify every existing row by source. Decide per item which duplicate deductions to reverse (offsetting entries, no deletes). Confirm with a physical stock count.
- **Phase 3: formulation.** One batch-production function (F-11), `production_in/out` movement types, recipe versioning, units (F-12).
- **Phase 4: ration.** Planned-vs-actual separation, back-fill only with the herd as it was on each date (F-08), recipe-proportional defaults in the daily button (F-15), remove the placeholder items (F-09).
- **Phase 5: costing.** A single weighted-average cost computed in SQL, FIFO edge cases (F-07), per-animal cost from actual movements, estimates labelled.
- **Phase 6: UI/UX.** A stock ledger per item showing source per row; a "purchased vs consumed vs waste vs on hand" card; warnings for negative stock and recipe mismatch.
- **Phase 7: automated validation.** The tests below, plus a nightly reconciliation query that alerts when any item's consumption exceeds purchases.

## Regression Test Plan
1. Recipe with ingredients 40+20+10+15+15 must have batch size 100; saving batch size 50 is rejected.
2. Farm need 45 kg with a 100 kg recipe deducts exactly 45 kg of ingredients in recipe proportion (18/9/4.5/6.75/6.75).
3. Mixing 100 kg of feed then feeding it deducts ingredients **once**. Total ingredient consumption = 100 kg; mixed-feed stock goes +100 then −100.
4. Mixing produces **no** `purchase` row; the cash balance is unchanged by mixing.
5. A stock-count increase or true-up does not change cash or "purchased quantity".
6. Opening the Inventory page twice on the same day creates no deduction without confirmation. After confirmation, a second confirmation for the same date is rejected (idempotency).
7. Consuming more than on-hand stock is rejected (or shows negative stock explicitly if allowed).
8. P&L feed cost for a period = Σ consumption movement cost in that period, **not** plus an estimate.
9. Per-animal feed cost = Σ that animal's (or allocated pen) consumption; unchanged by a later purchase at a new price.
10. 300 kg, 1.5%, 30 days, ৳48/kg: plan view shows 135 kg / ৳6,480 without ramp, and the documented ramp value with ramp.
11. Waste appears as waste, not consumption, in reports.
12. A unit of "bag (50 kg)" converts to 50 kg in every deduction.

## Final Conclusion
- **What is wrong:** feed consumption is generated from estimates and deducted by overlapping paths. Recipe scaling is unchecked. Internal movements are recorded as purchases. The P&L counts feed twice.
- **Why:** the data model has only `purchase`/`consumption` and free-text notes, with no separation between plan and actual, purchase and production, or consumption and waste. Several screens compute cost with their own formulas.
- **Unreliable numbers (until fixed):**
  - feed stock on hand;
  - "purchased" quantities and inventory purchase spend;
  - cash balance (feed portion);
  - per-animal feed cost, total cost, margin and ROI;
  - income-statement feed / COGS / general expenses;
  - balance-sheet inventory and livestock values.

  The ration itself (kg/day per animal) **is** reliable.
- **Fix first:** stop automatic deductions from running on page load, and enforce recipe batch size = ingredient sum (F-01, F-02). Then stop writing non-purchases as purchases (F-03) and remove the P&L double count (F-04).
- **Historical data:** **yes, it needs reconciliation.** Run the read-only SQL, classify existing rows by source, and correct with offsetting entries after a physical stock count. Nothing should be deleted.

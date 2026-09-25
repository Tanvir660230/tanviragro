# Automatic daily feed deduction, count-based adjustment and a weight-based feeding chart

**Owner request:**
- Feed in use should be deducted automatically every day.
- When the feed is finished, or counted, the stock should adjust automatically if it does not match the running figure.
- The farm must be able to add and change, in the system, how much each weight of animal is fed.
- Feed may be bought for a whole year, so the system must stay right over long periods.

## 0. Today (before this change)
| | Today |
|---|---|
| Open usage period | **Nothing is posted.** The stock does not go down until "Finished", and the app shows only a running estimate. |
| Finished (closing count) | One consumption row for the whole period: stock available − count. |
| How much each animal eats | Rule per period: weight share, % of live weight, or a fixed amount per head. Otherwise usage is learned from earlier periods. The old ration plan has fixed percentages in code (<180 kg: 1.5 %, 180–300 kg: 2 %, ≥300 kg: 1.5 %) and cannot be edited. |
| Manual "Record feeding" | Separate rows. |

## 1. The new flow (what the owner sees)
1. **Feeding chart** (new page, Inventory → "Feeding chart"). The chart has one row per weight band, for each feed or recipe, for example:

   | Weight | Dana mix (recipe) | Straw |
   |---|---|---|
   | 0–180 kg | 1.5 % of weight | 3 kg |
   | 180–300 kg | 2 % | 4 kg |
   | 300+ kg | 1.5 % | 5 kg |

   - An amount can be **kg (or the item's unit) per head per day**, or **% of live weight**.
   - Saving creates a **new version from a date**. Old versions are kept, so earlier days are never rewritten.
   - A **preview** shows today's need for each animal (tag, weight, amount) and the farm total.
   - A **"Start from the standard chart"** button fills in the current fixed percentages, which can then be edited.
2. **Start using** a feed: the rule defaults to **"By feeding chart"** when a chart exists. The earlier options (learned, % of weight, per head) stay. The rule of a running period can be changed.
3. **Every day, automatically:** for each running feed, the day's amount is **deducted from stock**. The amount comes from the chart × each animal's weight on that day, or from the learned usage when there is no chart. One row is posted per feed, per day, for completed days (up to yesterday).
   - Today is shown as a running estimate until the day is over.
   - The stock and the "days left" figure are therefore always current.
4. **Count check without stopping** ("Count & continue"). For feed bought for a year, the farm can count at any time, for example once a month. The period is then closed at that date with the count, the difference is adjusted automatically, and the same feed continues from the next day with the same rule. There is nothing else to do.
5. **Finished (final count).** The system compares the count with what was auto-deducted and posts **one adjustment** for the difference:
   - counted less than expected: more was eaten, so an extra deduction is posted;
   - counted more than expected: less was eaten, so part is returned to stock (an audited reversal).

   The dialog shows this before saving: *"By the chart there should be 38 kg left; you counted 30 kg → 8 kg extra will be deducted."* The period then shows **chart vs actual (%)**, so the chart can be corrected; the dialog links to the chart.

## 2. Accounting rules (unchanged principles)
- **Actual use of a period** = stock available at the end − the closing count. The count is the truth.
- **Daily auto rows** are ordinary consumption rows linked to the period line (`period_line_id`), valued at the moving average cost when they are posted.
  - They lower stock value and count as feed cost day by day.
  - They are marked **"auto, final at count"**.
- **At the count** the total of the line becomes exactly the actual: `adjustment = actual − (auto rows + earlier adjustments)`. Auto rows dated after the end date are reversed, because the period ended earlier.
  - History is never deleted. Every change is a new row, and reversals point to what they undo.
- **Purchases entered late** still re-reconcile closed periods automatically, using the same rule of one adjustment for the difference.
- **Stock never goes negative.** An auto row is capped at the stock on hand; when it is capped, the card says *"stock ran out by the chart — count or enter the purchase"*.
- **A manual "Record feeding" row** (for example extra feed for one animal) is fine. It already lowers "stock available", so the count at the end does not charge it twice.
- **Financial lock:** no auto row is posted on a locked date.

## 3. Build plan
| # | Part | What |
|---|---|---|
| D1 | Migration `20260926090000_feed_auto_deduct.sql` (additive) | `feed_charts` (version: target, effective_from) + `feed_chart_bands` (min/max kg, amount, basis); RLS read for the tenant, writes via `save_feed_chart()`; rule type `chart`; `feed_usage_periods.auto_posted_through`; `post_feed_auto_usage()` (idempotent key `auto:<line>:<date>`, open period, date in range, capped at stock, advances `auto_posted_through`); `set_feed_usage_rule()` (open period only); `checkpoint_feed_usage_period()` (count & continue); `reconcile_feed_usage_period()` → lines with auto rows are corrected by a single difference row. Rollback file. |
| D2 | Engine (`usage-engine.ts`) | `need()` for `chart` (band by weight on the day, per-head or % of weight, recipe share, unit conversion); the lowest band for an animal with no weight (flagged). Auto rows of an open period count as **actual (auto)** for their days; today stays an estimate. |
| D3 | `feed-data.ts` | Loads charts and auto rows. Days left = stock on hand ÷ daily (the stock already includes the auto rows, so it is not subtracted twice). |
| D4 | `auto-usage.ts` + dashboard layout | `syncFeedAutoUsage()`. A cheap check ("is any open period behind yesterday?") runs on each page load; only then are the days computed with the engine and posted. The result is the same numbers the pages show, and no cron is needed: whoever opens the app first catches up, and the rows are dated correctly. |
| D5 | UI | "Feeding chart" page (editor, versions, preview, standard chart); chart rule in Start and change-rule; in-use card: "deducted daily · last on …", "Count & continue", link to the chart; Finished dialog: expected vs counted → adjustment preview; period history: chart vs actual %. bn + en. |
| D6 | Tests | Engine (chart bands, % of weight, recipe share, pieces), sync rows; SQL on the production copy: 10-day auto, then count less, count more, end date earlier than the auto rows, late purchase, stock cap, idempotency (two syncs at once), count & continue. |
| D7 | Verify | Screenshots (mobile bn, desktop), tsc/jest/lint/build, local commit. **No deploy**: the migration is applied to production only at deploy time, with the owner's go-ahead. |

## 4. Out of scope (later, if wanted)
- A per-animal override (for example a sick animal on a special feed).
- A daily "fed today?" confirmation.
- Automatic chart correction from the variance. For now it is shown as a suggestion.

## 5. Verification results (local production copy)
- **Database** `supabase/tests/feed_auto_deduct.sql`: 23/23, run in a transaction that is rolled back.
  - Daily rows are posted once only (idempotent) and the progress is recorded.
  - The count adjusts in both directions with one difference row; a recount is corrected the same way.
  - Count & continue works: automatic rows after the count date are undone.
  - Stock is capped at zero, and nothing is posted for today or later.
  - A late purchase keeps stock equal to the count.
  - A rule or chart change fills the missed days again.
  - The chart is validated.
- **Existing checks:** `feed_usage.sql` 27/27. Migration applied twice (idempotent); the rollback was tested and the migration re-applied.
- **Real UI flow (Bangla):**
  1. A recipe was started 10 days back with no chart, so nothing was deducted.
  2. A chart was saved. Its start date defaulted to the day the feed started (the standard chart was used).
  3. The rule was changed to "by chart" and the past days were deducted automatically, each ingredient stopping at zero stock.
  4. "Count & continue" closed the period at the count, and the same feed continues from the next day.
  5. The adjustment preview texts were correct ("3 kg less eaten → back to stock", "matches").
- **Mobile, 390 px:** the chart page and the inventory page have no horizontal overflow.
- **Pages:** home, cattle and finance load without errors.
- **Test data:** removed from the local copy (stock value back to ৳12,923.35).
- **Checks:** `tsc` clean, jest 512/512, eslint shows no new warnings, and `next build` succeeds.
- **Deploy:** none. At deploy time, migration `20260926090000_feed_auto_deduct.sql` must be applied to production, together with C14/C15.

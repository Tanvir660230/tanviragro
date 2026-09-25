# Feed: one final system (buy → mix → feed daily → count)

**How the farm really works** (from its data, 2026-06 → 2026-09):
- Separate ingredients are bought (ভুট্টা, DORB, কুড়া, ভুষি, খৈল, লবণ, supplement), and most of each purchase is mixed together.
- Every "recipe" so far is a copy of one purchase memo. For example, "Nadim Agro Recipe" (21 Jun) = the 17 Jun memo, and "New Recipe" (4 Sep) = the 3 Sep memo.
- Each time, a new recipe was made and the old one deleted (6 recipes).
- The recipe-scaled feed mixer was never used (no `feed_mix_*` rows). Supplement rules are empty.

**What the owner asked for:** the mix recipe must change by date, without having to re-edit a recipe every time.

## 1. The final model
| Step | Screen | What is stored |
|---|---|---|
| **Buy** | Purchase memo | Ingredient stock in (unchanged). |
| **Mix** (new) | Inventory → **Mix** | One dated mix: ingredient kg → mix kg. Ingredients go out (`feed_mix_input`, at average cost), the mix comes in (`feed_mix_output`, at the inputs' cost). Each mix *is* that date's recipe, so the recipe changes by date automatically. Pre-fill from the last mix, a purchase memo, or "everything in stock". A mix entered by mistake can be undone (audited reversals). |
| **Feed** | In-use card + feeding chart | The mix item (and straw) is "in use". It comes off stock every day by the feeding chart (kg of mix per animal by weight). |
| **Count** | "Count check" / "Finished" | Count how many kg of mix are left. The difference is adjusted in one row. |

## 2. Keep / remove
| Existing | Decision | Why |
|---|---|---|
| Purchase memo, history, movements, adjustments, reports, products, warehouse, AI | Keep | — |
| Usage periods, daily deduction, count, feeding chart | Keep | This is the core of feeding. |
| All stock (per-item add stock, log use, edit, stock finished, discontinue…) | Keep | "Log use" stays for exceptions. |
| **Recipes section** (create, activate, from/until dates) | **Removed from the page** | Replaced by dated mixes. Old recipes are shown read-only in the mix history as "earlier recipes". |
| **Feed mixer** (recipe × kg) | **Removed** (its link now opens Mix) | Never used; Mix covers it, with free quantities. |
| **Ration plan card** (active recipe / roughage dates, "plan only") | **Removed from the page** | It deducted nothing and contradicted the daily deduction. The flags stay in the database: the cattle profile's plan reference still reads them. |
| **Record feeding button** (daily manual) | **Removed** | Daily deduction does this. Per-item "log use" remains for extras. |
| "Set roughage" item action + "Active roughage" badges | **Removed** | They are plan-only flags. |
| "Not started" suggestions for mix ingredients | **Changed** | Ingredients are mixed, not fed directly. They are shown as "waiting to be mixed", with a Mix button (inventory page and homepage). |
| Recipes as a usage target (Start dialog, chart page) | **Hidden** | The mix item is fed instead. Existing recipe periods still work (engine unchanged). |

## 3. Database (migration `20260926100000_feed_mix.sql`, additive)
- **`feed_mix_batches`** (id = batch id, business, output item, mix date, output kg, cost, note, undone_at/by/reason).
- **`produce_feed_mix(business, output item, date, lines[{item_id, qty}], batch_id, output_qty?, note?)`** (security definer): write access, date ≤ today, financial lock, output in kg, no ingredient equal to the output, idempotent batch id.
- **`undo_feed_mix(batch_id, reason)`:** reverses every input and the output. Refused if the mix has already been eaten (stock guard); "count check" then covers it.
- **Ledger trigger:** a `purchase_reversal` may also reverse a `feed_mix_output`.
- **Daily deduction, stronger:**
  - Each row brings the day up to its planned amount. A day capped earlier by empty stock is topped up later.
  - A stock-in dated in the past (a late purchase or late mix) re-opens those days for its running periods.

## 4. Verification
- **SQL tests:** mix, idempotency, cost per kg of mix, undo, undo refused after eating, lock/date checks, the late mix fills the capped days.
- **Engine tests:** role detection and top-up rows.
- **UI in the browser (Bangla):**
  1. Mix from a memo.
  2. The mix item is started with the chart.
  3. Daily deduction runs.
  4. Count check.
  5. Undo.
- 390 px mobile; tsc / jest / lint / build.
- Local commit. **No deploy.**

## 5. Verification results (local production copy)
- **SQL tests:**
  - `feed_mix.sql` 22/22: mix, cost per kg, value unchanged, double submit, every refusal case, undo, undo refused after feeding, a short day topped up after a late mix, running again posts nothing.
  - `feed_auto_deduct.sql` 23/23 and `feed_usage.sql` 27/27.
  - `feed_ledger.sql`: T23 (cost-entry audit) fails with the old functions too, so it is not caused by this change.
- **Browser flow (Bangla):**
  1. Inventory showed "waiting to be mixed (6)"; recipes, the ration plan and Record feeding are gone.
  2. Mix page: "Everything in stock" dated 18 Sep gave 182.36 kg at ৳37.97/kg into the new item "দানাদার মিক্স". The old "Mix Feed" item is discontinued, so it is not used. The total stock value is unchanged (৳12,923.35).
  3. The standard chart for the mix was saved from 18 Sep.
  4. "Start using" chose "by chart" by itself, and 7 days were deducted, capped at the mix in stock.
  5. Undo of an eaten mix was refused with a clear message.
  6. Mobile at 390 px: no overflow. The homepage loads.
- **Found and fixed on the way:** the 1000-rows-per-request API limit. Stock, accounting, feed and purchase totals now read every row (`selectAll`).
- **Checks:** `tsc` clean, jest 529/529, eslint shows no new warnings, `next build` succeeds.
- **Test data:** removed from the local copy.
- **Deploy:** none. At deploy time, apply `20260926090000` and then `20260926100000`, followed by C14/C15.

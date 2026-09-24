# Numerical Accounting Audit — Tanvir Agro

- **Date:** 2026-09-24
- **Scope:** feed, straw, supplements, medicine, cattle cost, inventory, expenses, cash, monthly totals, dashboards
- **Method:** every figure is recomputed **independently** from raw rows and compared with what the **application's own code** produces on the same data.
- **Rule:** nothing was "fixed" by editing numbers.

## 0. How the audit was done

| Step | Detail |
|---|---|
| Data | `auditdb`: the full production export taken just before the release (67 tables, 958 rows), plus exactly the SQL that ran on production (release, migration 140000, C13). Production was verified directly: 786 ledger rows, stock ৳12,923.35, no other writes. The copy's schema was aligned column-for-column with production's. |
| Independent calculation | A standalone script over the raw rows. It uses exact decimal arithmetic (BigInt), its own moving-average replay, its own reconciliation and its own weight allocation. **No application code is imported.** |
| Application result | The real service code (feed engine, inventory portfolio, accounting engine, cash service, dashboard queries, valuation, analytics) run against `auditdb` through a local PostgREST gateway. Pages compute from these services; where a page does its own arithmetic (cattle profile, Feed Usage, Analytics) that code was read and reproduced. |
| Scenarios | Late purchase and correction tests ran on throwaway copies, **never** on production. |
| Production | Read-only. Nothing in production was changed by this audit. |

---

## 1. Inventory reconciliation per item

Opening + purchases + other in − consumption − adjustments = closing. Quantities are in each item's own unit (straw in **pieces**).

| ITEM | UNIT | OPENING | PURCHASES | OTHER IN | TOTAL AVAILABLE | AUTO CONS. (old engine) | MANUAL CONS. | STOCK-FINISHED (C13) | TOTAL CONS. | ADJ./WASTAGE (net) | CLOSING (DB / app) | CALCULATED CLOSING | STOCK VARIANCE | STATUS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Straw (খড়) | piece | 180 | 588 | 0 | 768 | 37.43 | 2.00 | 488.57 | 528.00 | 0 | 240 / 240 | 240 | 0 | **UNRECONCILED** (owner counts ≈128; §3) |
| Mix Feed | kg | 0 | 122 | 0 | 122 | 122.00 | 0 | 0 | 122.00 | 0 | 0 / 0 | 0 | 0 | PASS |
| DORB | kg | 0 | 307 | 0 | 307 | 264.81 | 0 | 25.47 | 290.28 | 0 | 16.72 / 16.72 | 16.72 | 0 | PASS |
| কুড়া | kg | 0 | 498 | 0 | 498 | 331.63 | 0 | 120.79 | 452.42 | 0 | 45.58 / 45.58 | 45.58 | 0 | PASS |
| ভুট্টা (corn) | kg | 0 | 919 | 0 | 919 | 678.19 | 0 | 149.63 | 827.82 | 0 | 91.18 / 91.18 | 91.18 | 0 | PASS |
| ভুষি | kg | 0 | 354 | 0 | 354 | 327.48 | 0 | 15.88 | 343.36 | 0 | 10.64 / 10.64 | 10.64 | 0 | PASS |
| সয়াবিন খৈল (soybean cake) | kg | 0 | 257 | 0 | 257 | 201.87 | 0 | 38.41 | 240.28 | 0 | 16.72 / 16.72 | 16.72 | 0 | PASS |
| নাদিম এগ্রো Suppliment | kg | 0 | 69 | 0 | 69 | 68.11 | 0 | 0.89 | 69.00 | 0 | 0 / 0 | 0 | 0 | PASS |
| লবণ (salt, mineral) | kg | 0 | 24 | 0 | 24 | 18.62 | 0 | 3.86 | 22.48 | 0 | 1.52 / 1.52 | 1.52 | 0 | PASS |
| Grass, rice husk, pulse husk | — | — | — | — | — | — | — | — | — | — | — | — | — | **MISSING DATA** (no such item exists) |

**Value (৳).**

| ITEM | OPENING | PURCHASE COST | CONSUMPTION COST (ledger) | APPLICATION FEED COST (engine) | COST VARIANCE | CLOSING (DB) | CALCULATED CLOSING | QTY × CURRENT COST | STATUS |
|---|---|---|---|---|---|---|---|---|---|
| Straw | 3,299.40 | 12,803.40 | 10,103.30 | 10,103.30 | 0.00 | 5,999.50 | 5,999.50 | 5,999.50 | PASS* |
| Mix Feed | 0 | 5,490.00 | 5,490.00 | 5,490.00 | 0.00 | 0.00 | 0.00 | 0.00 | PASS |
| DORB | 0 | 13,249.45 | 12,446.92 | 12,446.92 | 0.00 | 802.53 | 802.53 | 802.53 | PASS |
| কুড়া | 0 | 7,626.80 | 6,943.12 | 6,943.12 | 0.00 | 683.68 | 683.68 | 683.68 | PASS |
| ভুট্টা | 0 | 34,236.00 | 30,497.66 | 30,497.66 | 0.00 | 3,738.34 | 3,738.34 | 3,738.34 | PASS |
| ভুষি | 0 | 17,846.00 | 17,314.04 | 17,314.04 | 0.00 | 531.96 | 531.96 | 531.96 | PASS |
| সয়াবিন খৈল | 0 | 16,664.50 | 15,527.57 | 15,527.57 | 0.00 | 1,136.93 | 1,136.93 | 1,136.93 | PASS |
| Supplement | 0 | 17,349.97 | 17,349.96 | 17,349.95 | 0.00 | 0.01 | 0.01 | 0.00 | PASS* |
| লবণ | 0 | 459.45 | 429.05 | 429.05 | 0.00 | 30.40 | 30.40 | 30.40 | PASS |
| **Total** | **3,299.40** | **125,725.57** | **116,101.61** | **116,101.61** | **0.00** | **12,923.35** | **12,923.35** | **12,923.34** | **PASS** |

\* **Legacy rounding residuals**, immaterial:
- **Straw:** old rows were valued ৳0.50 above what the lots cost, so today's 240 pieces carry ৳24.9979 each instead of ৳25.00.
- **Supplement:** ৳0.01 is left on 0 kg.

**Purchase vs consumption:** 125,725.57 bought + 3,299.40 opening = 116,101.61 eaten + 12,923.35 in stock. A purchase is never expensed in full; only what is eaten becomes feed cost.

**Unit cost:** an independent moving-average replay equals `inventory_unit_cost_as_of` and the app's unit-cost map for all 9 items, to 6 decimals. **PASS.**

## 2. Straw (piece-based)

| Lot | Pieces | ৳/piece | ৳ |
|---|---|---|---|
| Opening 2026-06-01 | 180 | 18.33 | 3,299.40 |
| Bought 2026-06-25 | 348 | 19.55 | 6,803.40 |
| Bought 2026-08-27 | 240 | 25.00 | 6,000.00 |

- **First two lots:** 528 pieces were eaten by 08-18, when the item was marked finished. The ৳10,103.30 is booked as **feed** (C13), spread over 06-01…08-18 by the weight of the animals present.
- **Units:** `kg_per_unit` is NULL, so straw is never converted to kg and never needs kg. Kg plans are not priced for straw.
- **No double count, and nothing consumed on purchase:**
  - no straw rows exist in cost entries;
  - no straw purchase is expensed on the purchase date;
  - the "খড় কাটা / Khor kata" cost entries (৳1,200) are **cutting labour**, not straw.
- **Open issue:** no straw consumption has been recorded since the 08-27 purchase, so the system still shows 240 pieces; the owner reports about 128. → **UNRECONCILED** until the straw usage period is closed with the physical count on the Feed Usage page.

## 3. Grass / own land

- There is no grass item and there are 0 `own_production` rows, so no fake cash purchase exists. The own-land flow (৳0, not cash) is implemented and tested (U6).
- **Land lease:** no Rent & Lease entry exists (the P&L shows ৳0) → **MISSING DATA**, since the lease has not been recorded.

## 4. Mix Feed and recipes

**Recipe totals.** Every recipe's ingredients sum to exactly 100 % of the batch (6/6 PASS):

| Recipe | Active | Output kg | Σ ingredients | Share |
|---|---|---|---|---|
| First Recipe | 06-01…06-18 (deleted) | 122.00 | 122.000 | 100.0000 % |
| Nadim Agro | 06-21…08-01 (deleted) | 579.50 | 579.500 | 100.0000 % |
| Bashundia Mor | 07-21…08-29 (deleted) | 569.36 | 569.360 | 100.0000 % |
| Nadim Agro | 08-22…09-07 (deleted) | 274.00 | 274.000 | 100.0000 % |
| New Recipe | 09-04…09-18 (deleted) | 446.50 | 446.500 | 100.0000 % |
| Neww | 09-18… (active) | 240.00 | 240.000 | 100.0000 % |

**Mix Feed item.** It was bought, not produced: 122 kg @ ৳45. There are no `feed_mix_input` or `feed_mix_output` rows, so there is **no two-stage flow and no double consumption**. Mix Feed rows (06-01…06-16) and ingredient rows (from 06-20) never overlap.

**Old automatic deductions, ingredient split vs the recipe in force that day.**
- **86 of 101 days PASS:** the deviation is ≤ 0.03 % (4-decimal rounding).
- **15 days FAIL:**
  - **06-01…06-11:** Mix Feed only, no recipe dated yet.
  - **06-20:** a day before the recipe's start date.
  - **09-04…09-06:** split per the 08-22 recipe, although "New Recipe" is dated from 09-04.
- **Root cause:** the removed engine used whichever recipe was active **when it ran**, not the recipe in force on the historical date.
- **Impact:** only the split between ingredients on those days. Stock per item was reset by the physical counts (now C13), so item totals are right.
- **Current system:** usage periods snapshot the recipe shares (tested U4); the engine is removed.

## 5. Daily automatic consumption

- **Current system:** there is **no automatic consumption.** Feed is actual from usage periods or recorded rows. A running estimate (a rule such as % of live weight, or learned usage) is shown separately as ESTIMATED and never posted. No feeding percentage is assumed: there is no hard-coded 1.5 %.
- **Legacy auto rows:**
  - their implied rate is 1.76–2.0 % of herd body weight per day;
  - 4.0 % on 09-03, which is the original row plus the intended C1 re-dated row, not a double count (§8).
  - They are historical facts; all are superseded by the physical counts.

## 6. Weight-based allocation

- **Formula:** each day's feed × (animal's weight that day ÷ weight of all animals present that day).
- **Weight used for a day:**
  1. the latest measured weight on or before that day;
  2. else the purchase weight, unless it is labelled estimated;
  3. else the first later measurement;
  4. else the estimated purchase weight.
- Multi-day rows (C13) are spread over the days they cover.

| Animal | Arrived | Independent ৳ | Application ৳ | Diff | Status |
|---|---|---|---|---|---|
| C001 | 06-01 | 24,761.32 | 24,761.32 | 0.00 | PASS |
| C002 | 06-01 | 27,363.65 | 27,363.65 | 0.00 | PASS |
| C003 | 06-10 | 27,374.47 | 27,374.47 | 0.00 | PASS |
| C004 | 06-11 | 18,241.60 | 18,241.60 | 0.00 | PASS |
| C005 | 07-31 | 8,956.38 | 8,956.38 | 0.00 | PASS |
| C006 | 07-31 | 9,404.19 | 9,404.19 | 0.00 | PASS |
| **Σ** | | **116,101.61** | **116,101.61** | unallocated **0** | **PASS** |

- **Checks:**
  - no allocation outside an animal's presence (C005/C006 get nothing before 07-31);
  - no equal split;
  - no double scaling;
  - no accumulated rounding: the totals match to the paisa.
- **Data caveat:** C001–C004's purchase weights are labelled **"unknown"** (not measured, not estimated).
  - The engine treats them as usable, which is sensible: a June weight is better than a September weight for June.
  - It labels them "measured".
  - If they were treated as unusable, up to ৳3,963 per animal would move between animals; the total would not change.
  - **Owner decision:** label these four weights.

## 7. Late purchase (Day 1 bought, entered Day 8)

- **Scenario:** on a throwaway copy, a straw usage period opened 08-27. A 100-piece purchase dated **09-01** was entered either **on time** or **after closing on 09-08**, with a count of 250.

| | On time | Entered late |
|---|---|---|
| Before the late entry | — | Status `unreconciled`, gap 10 pieces; nothing invented |
| Consumed | 90 pieces, ৳2,249.87 | 90 pieces, ৳2,249.87 |
| Posting rows | 1 | 1 (the old posting reversed, not edited) |
| Stock after | 250 | 250 |
| Business date / entry time | 09-01 / 09-01 | 09-01 / 09-08 (both kept) |
| Fake purchases or feeding rows | 0 | 0 |

**PASS:** identical accounting result. Days 08-27…09-08 are covered by the period, so they do not show as unfed.

## 8. Usage periods, and manual vs automatic double counting

- **Usage periods:** none exist in production yet. On copies, 27/27 checks pass (U1–U8), including: available − consumed − closing + gap = 0 on every line.
- **Same item, same day (only two dates found):**
  - **08-29:** 7 duplicate automatic rows; each was reversed by C1. **PASS.**
  - **09-03:** the original row plus the C1 row moved from 08-29. This is intentional, value-neutral re-dating. **PASS.**
- **Manual and automatic rows on one day:** never both.
- **Periods vs manual rows:** a period posts only the remainder after manual rows, so the two never exceed what left the store (tested U3).

## 9. Medicine, veterinary, supplements, minerals

- **Medicine:** there is no medicine inventory item, so medicine is recorded as cost entries or treatments, not as stock.
  - Per-animal medicine entries: ৳1,160 (a vaccine at ৳800 split over 4 animals, plus ৳360).
  - These are capitalised into the animal **once**.
- **Supplement and salt:** both are **feed ingredients** (category feed, in recipes). They are consumed only through recipe usage or counts, never separately expensed.
  - The "Ada fitkeri koel" cost entry (৳200) is a separate purchase, not in stock. The owner should confirm whether it is feed or medicine.
- **Vet fees: FAIL (fixed in code; historical correction C14 ready).**
  - Every clinical visit was saved **twice**: a `cattle_treatments` row with the fee, **and** a "Medical/Vet Fee" cost entry.
  - Production has 5 such pairs: ৳1,700 + ৳1,700 + ৳350 + ৳350 + ৳400 = **৳4,500**, identical amount and date, created within 1 second of each other.
  - The accounting engine capitalised the treatment **and** expensed the cost entry, and the balance-sheet cash deducted it twice.
  - Also found: a visit with N medicines stored the fee on **every** medicine row (fee × N).

## 10. Cattle-level cost (direct costs only; overheads are not spread to animals)

| Animal | Purchase ৳ | Direct cost entries ৳ | Vet treatments ৳ | Feed ৳ | Total ৳ |
|---|---|---|---|---|---|
| C001 | 76,000 | 633.33 | 2,050.00 | 24,761.32 | 103,444.65 |
| C002 | 85,600 | 560.00 | 2,450.00 | 27,363.65 | 115,973.65 |
| C003 | 108,000 | 2,070.33 | 0 | 27,374.47 | 137,444.80 |
| C004 | 74,500 | 433.33 | 0 | 18,241.60 | 93,174.93 |
| C005 | 72,000 | 0 | 0 | 8,956.38 | 80,956.38 |
| C006 | 99,000 | 1,640.00 | 0 | 9,404.19 | 110,044.19 |
| **Σ** | **515,100** | **5,336.99** | **4,500** | **116,101.61** | **641,038.60** |

- **Valuation check:** the application's herd cost basis is **৳641,038.60**. **PASS.** It uses the treatment as the vet record; the duplicate cost entries have no animal, so they are not added here.
- **Separation:** feed, medicine, rent, utilities and labour are not double-counted per animal. Rent, utilities and general costs stay farm overhead.

## 11. General expenses: each entry in exactly one account

| Category (as entered) | ৳ | Account now | Finding |
|---|---|---|---|
| utilities: WiFi | 1,050 | Utilities | PASS (C6) |
| utilities: **খড় কাটার machine** | 23,200 | Utilities | **FAIL (data):** a machine is a fixed asset, not a utility |
| utilities: torch 650, basket 200, finish 120 | 970 | Utilities | FAIL (data): small tools/supplies |
| utilities: DORB আনার ভাড়া | 300 | Utilities | FAIL (data): feed transport |
| infrastructure: shed construction | 103,280 | General | **FAIL (policy/data):** capital expenditure booked as expense |
| equipment: CCTV, tools | 10,410 | General | FAIL (policy/data): assets |
| feed: straw cutting ×3, ginger/alum/oil, 850 misc | 2,250 | was General → **Feed (fixed)** | FAIL → fixed in code (§14) |
| transport | 5,745 | Transport | PASS |
| salary / labor | 1,500 | Labour (1,000) / capitalised to C003 (500) | PASS |
| doctor_fee, medicine (per animal) | 3,699.99 | Capitalised to the animal | PASS |
| Medical/Vet Fee (5 duplicates) | 4,500 | Vet & Medical **and** also in the animal | **FAIL → C14** |
| other | 11,325 | General | PASS (unclassified by the owner) |
| rent / land lease | 0 | — | **MISSING DATA** |

## 12. Cost per kg of gain (measured weights only)

Correct formula: feed eaten **between** the start weight and the last measured weight ÷ the kg gained in that same window.

| Animal | Start | End (measured) | Gain kg | Feed ৳ in window | ৳/kg (correct) | Pages showed | Analytics page gain |
|---|---|---|---|---|---|---|---|
| C001 | 198 kg 06-01 (unknown-type) | 313 kg 09-14 | 115 | 23,987.13 | **208.58** | 215.32 | 115 |
| C002 | 230 kg 06-01 | 333 kg 09-14 | 103 | 26,539.99 | **257.67** | 265.67 | 103 |
| C003 | 280 kg 06-10 | 355 kg 09-14 | 75 | 26,496.38 | **353.29** | 364.99 | 75 |
| C004 | 170 kg 06-11 | 230 kg 09-14 | 60 | 17,672.70 | **294.55** | 304.03 | 60 |
| C005 | 180 kg **estimated** | 200 kg 09-14 | — | — | **not calculated** | — | **+20 (from an estimate)** |
| C006 | 250 kg **estimated** | 210 kg 09-14 | — | — | **not calculated** | — | **−40 (from an estimate)** |

**FAIL → fixed.** There were two defects:
- **Feed Usage and cattle profile pages:** they divided feed up to **today** by the gain up to the **last weighing**, overstating cost per kg by 3–4 %.
- **Cattle Analytics page:**
  - its gain came from **any** latest weight minus the purchase weight, **including estimates** (C006's "−40 kg loss" is an estimated 250 against a measured 210);
  - its feed cost counted only rows logged against one animal (৳36.66 for the herd).

## 13. Monthly reconciliation

**Inventory value roll-forward (independent).** It closes at ৳12,923.35, equal to the database.

| Month | Opening | Opening stock added | Purchases | Feed eaten (by row date) | Adj. net | Closing |
|---|---|---|---|---|---|---|
| 2026-06 | 0.00 | 3,299.40 | 41,591.11 | 16,352.60 | 0 | 28,537.91 |
| 2026-07 | 28,537.91 | 0 | 24,745.09 | 28,008.43 | 0 | 25,274.57 |
| 2026-08 | 25,274.57 | 0 | 30,597.98 | 51,074.34 | 0 | 4,798.21 |
| 2026-09 | 4,798.21 | 0 | 28,791.39 | 20,666.25 | 0 | 12,923.35 |

**Feed per month.**

| Month | Eaten, spread over days covered (independent) | Feed engine | Finance page, before | Finance page, after fix |
|---|---|---|---|---|
| 06 | 19,789.13 | 19,789.13 | 16,352.60 | 16,352.60 |
| 07 | 33,335.89 | 33,335.89 | 28,066.19 (+57.76) | 28,008.43 |
| 08 | 42,679.70 | 42,679.70 | 65,950.52 (**+14,876.19**) | 51,074.34 |
| 09 | 20,296.89 | 20,296.89 | 34,508.50 (**+13,842.25**) | 20,666.25 |

- **Two views of the same feed:** the Finance page books by posting date (accounting); Feed Usage spreads stock-finished catch-ups over the days eaten. The totals are equal (৳116,101.61).
- **Before the fix,** the Finance page, reports and dashboard chart **overstated feed by ৳28,776.20.** Two causes:
  - `get_monthly_consumptions` counted every OUT row: stock-count losses, so C13 amounts were counted twice (as the old True-Up loss and again as the C13 feed row);
  - it ignored the audited undo rows.

**Dashboard monthly cost chart:**

| Month | Expected | Before | After fix + C14 |
|---|---|---|---|
| 06 | 495,612.59 | 500,112.59 (+4,500 vet duplicate) | 495,613 |
| 07 | 200,698.43 | 200,756.19 | 200,698 |
| 08 | 77,814.34 | 92,690.52 | 77,814 |
| 09 | 25,306.24 | 39,148.50 | 25,306 |

## 14. Database vs service vs dashboard

| Metric (where shown) | Independent | Before | After code fix | After fix + C14 |
|---|---|---|---|---|
| Cash: Finance header, dashboard cash card, reports, AI | **4,697.45** | **−809,055.55** | 197.45 | **4,697.45** |
| Cash: balance sheet | 4,697.45 | 197.44 | 197.45 | **4,697.45** |
| Cash: cash-flow statement | 4,697.45 | 4,697.44 | 197.45 | **4,697.45** |
| Feed inventory (balance sheet) | 12,923.35 | 12,923.15 | **12,923.35** | 12,923.35 |
| Feed expense (P&L) | 116,064.95 herd + 2,250 feed-type cash costs | 116,065.16 (and ৳2,250 in General) | **118,314.95** | 118,314.95 |
| Vet & medical (P&L) | 0 (capitalised to animals once) | 4,500 (and in livestock) | 4,500 | **0** |
| Total expenses (P&L) | 274,457.95 | 278,958.16 | 278,957.95 | **274,457.95** |
| Livestock asset | 524,973.65 | 524,973.65 | 524,973.65 | 524,973.65 |
| Herd cost basis (valuation) | 641,038.60 | 641,038.60 | 641,038.60 | 641,038.60 |
| Monthly feed (Finance page) | 116,101.61 | 144,877.81 | **116,101.61** | 116,101.61 |
| Realised P/L (dashboard hero) | 0 (no sales) | 0 | 0 | 0 |
| Per-animal feed, Feed Usage card | §6 | = | = | = |

Why the cash figure was wrong:
- `cash.ts` asked PostgREST for partner transactions with a type `"draw"` that the enum does not have, so the whole query failed and **৳813,753 of partner capital disappeared.**
- The balance sheet took the 5 duplicate vet fees out of cash **twice**.

## 15. Rounding

| Where | Finding | Status |
|---|---|---|
| `inventory-ledger.ts` `value()` | Rounded **every row** to cents before adding. Inventory lost ৳0.20 and feed expense gained ৳0.21 over 786 rows. | **FAIL → fixed** (exact sum, round totals) |
| `consumption-stats` buckets | Rounding each month/category bucket gave a ৳0.02 total error | fixed (no bucket rounding) |
| DB `unit_cost numeric(14,6)`, `qty numeric(14,4)` | Straw ৳23.4375 stored exactly | PASS |
| Legacy rows stored at 2-decimal costs | ৳0.50 straw residual, ৳0.01 supplement residual | Immaterial, reported |
| Page displays (`toFixed` on totals) | Display only | PASS |

## 16. Final audit table

| AUDIT AREA | EXPECTED | ACTUAL (before) | DIFFERENCE | STATUS | ROOT CAUSE |
|---|---|---|---|---|---|
| Straw | 528 pcs eaten, 240 on hand per records, ৳5,999.50 | same | 0 (owner count ≈128) | **UNRECONCILED** | No count since 08-27; close the straw period with the physical count |
| Grass | own-land item at ৳0 | no item | — | MISSING DATA | Not set up |
| Corn | 827.82 kg, ৳30,497.66 | same | 0 | PASS | — |
| DORB | 290.28 kg, ৳12,446.92 | same | 0 | PASS | — |
| Rice husk / pulse husk | — | no item | — | MISSING DATA | Not in the system |
| Soybean cake | 240.28 kg, ৳15,527.57 | same | 0 | PASS | — |
| Mix Feed | 122 kg in = 122 out; recipes 100 % | same | 0 | PASS | (15 legacy days split per the wrong recipe; history only) |
| Feed purchase | ৳125,725.57 cash + ৳3,299.40 opening | same | 0 | PASS | — |
| Feed consumption | ৳116,101.61 | engine same; Finance page 144,877.81 | +28,776.20 | **FAIL → fixed** | `get_monthly_consumptions` summed all OUT rows, ignored undos |
| Feed inventory | ৳12,923.35 | balance sheet 12,923.15 | −0.20 | **FAIL → fixed** | Per-row rounding |
| Feed cost (P&L) | 116,064.95 + 2,250 | 116,065.16; 2,250 in General | +0.21; misclassified | **FAIL → fixed** | Rounding; legacy "feed" category mapped to General |
| Weight-based allocation | Σ = 116,101.61 | same, per animal | 0 | PASS | — |
| Cattle entry/exit | no feed before arrival | same | 0 | PASS | — |
| Medicine | once per animal | once | 0 | PASS | — |
| Supplements | feed ingredient | same | 0 | PASS | — |
| Minerals (salt) | feed ingredient | same | 0 | PASS | — |
| Veterinary costs | ৳4,500 once | twice (expensed + capitalised; cash twice) | +4,500 | **FAIL → fixed + C14** | Medical form wrote treatment **and** cost entry; fee × medicines |
| Rent / lease | lease recorded | none | — | MISSING DATA | Not entered |
| Utilities | ৳1,050 (WiFi) | ৳25,520 | +24,470 misclassified | **FAIL (data)** | Machine, tools and transport entered as "utilities" |
| WiFi | Utilities | Utilities | 0 | PASS | (C6) |
| Total farm expenses | 274,457.95 | 278,958.16 | +4,500.21 | **FAIL → fixed + C14** | Vet duplicate + rounding |
| Capital items | shed ৳103,280, equipment ৳10,410, machine ৳23,200 as assets | expensed | 136,890 | **FAIL (policy)** | Entered as expenses; owner decision |
| Cash | ৳4,697.45 | −809,055.55 / 197.44 / 4,697.44 | up to −813,753 | **FAIL → fixed + C14** | Invalid enum in query; vet fee paid twice |
| Cattle-level costing | ৳641,038.60 | same | 0 | PASS | — |
| Cost/kg gain | window-matched, measured only | +3–4 %; −40 kg from an estimate | see §12 | **FAIL → fixed** | Window mismatch; estimates used; herd feed ignored |
| Monthly totals | §13 | +14,876 Aug, +13,842 Sep, +4,500 Jun | | **FAIL → fixed** | As above |
| Dashboard totals | §14 | cash −809k, chart overstated | | **FAIL → fixed** | As above |
| Late purchase | same as on time | same as on time | 0 | PASS | — |
| Manual + auto double count | none | none (08-29 already reversed) | 0 | PASS | — |
| Batch cost allocation / revaluation | real weights | query fails; defaults 250 kg / ৳50,000 | — | **FAIL → fixed** | Non-existent `current_weight`; invented defaults |
| Broken queries (column scan) | 0 | 50 references / 26 sites | | 46 / 23 left, **none in money paths** | Breeding, AI and custom-report pages use columns production lacks |

## 17. Every FAIL: calculation, source, code, correct formula, corrected result, history, plan

| # | Exact calculation and code | Source data | Correct formula | Corrected result | History affected? | Plan |
|---|---|---|---|---|---|---|
| F1 | `src/lib/supabase/queries/cash.ts` `.in("type", [... "draw"])` → PostgREST 22P02 → `capitalIn = 0` | 24 partner investments ৳813,753 | capital in − out − cattle − expenses − net stock bought | ৳4,697.45 (৳197.45 until C14) | No; a read-side bug | **Fixed in code** |
| F2 | `inventory-ledger.ts` `value()` rounds each row | 786 ledger rows | Σ qty × unit_cost, rounded once | 12,923.35 / 116,064.95 | No | **Fixed** |
| F3 | `medical-actions.ts` wrote treatment + cost entry; `engine.ts` capitalised the treatment, expensed the cost entry and took cash twice | 5 pairs, ৳4,500 | one record per visit (the treatment) | vet ৳0 expense, ৳4,500 in the animals once, cash 4,697.45 | **Yes:** 5 duplicate cost entries | **Code fixed; C14** (`supabase/corrections/20260925_c14_vet_fee_once.sql`: soft-delete with audit, tested, idempotent, rollback) |
| F4 | `get_monthly_consumptions` / `get_inventory_stats` (SQL) summed `type='consumption'` | 22 True-Up rows, 22 C13 rows, reversals | consumption − consumption_reversal | Finance feed ৳116,101.61 | No (read side) | **Fixed:** callers now use `src/lib/inventory/consumption-stats.ts`; the SQL functions are unused |
| F5 | `analytics.ts getMonthlyRevenueVsCost` used `type='consumption'` | same | same | chart §13 | No | **Fixed** |
| F6 | Legacy category "feed" mapped to General (6600) | 5 entries ৳2,250 | feed-related cash costs → Feed 5200 | Feed 118,314.95; General 125,015 | No | **Fixed** (`categories.ts`, engine) |
| F7 | Cost/kg gain: usage page, profile page, `cattle/analytics/page.tsx` | weights, feed | feed within [baseline, last measured] ÷ measured gain | §12 | No | **Fixed** (`feedCostBetween`, `feedKgBetween`, measured growth only) |
| F8 | `financial-engine-actions.ts` selected `cattle.current_weight`; `\|\| 250`, `\|\| 50000` | — | real weights (`loadHerdWeights`), purchase date; refuse when missing | — | No | **Fixed** |
| F9 | `lifecycle-actions.ts` selected `health_events.dosage, cost_bdt` → the lifecycle timeline had no health events | 52 events | existing columns | events shown | No | **Fixed** |
| F10 | Utilities / capex classification | 7 entries | machine, shed, tools → fixed assets; transport → Transport/Feed | Utilities ৳1,050; assets ৳136,890; expenses −৳136,890 (+ depreciation) | Yes (data) | **Owner decision:** reclassify each entry (audited) |
| F11 | Straw count | 240 recorded vs ≈128 counted | close the straw usage period with the count | ≈112 pieces eaten since 08-27 | — | **Owner action:** Feed Usage → Straw → Finished, count |

## 18. Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 1 | Inventory reconciles | **PASS** (quantities and value, all items; straw awaits its count) |
| 2 | Purchase ≠ consumption | **PASS** |
| 3 | Straw piece costing | **PASS** (৳0.50 legacy residual, immaterial) |
| 4 | Grass / own land | Implemented and tested; **no data** |
| 5 | Recipes 100 % | **PASS** |
| 6 | No ingredient double count | **PASS** |
| 7 | Automatic daily feed | No automatic posting exists; estimates are separate. **PASS** |
| 8 | Allocation sums exactly | **PASS** (0 unallocated) |
| 9 | Entry/exit respected | **PASS** |
| 10 | Late purchases reconcile | **PASS** (identical result) |
| 11 | Manual + auto never double | **PASS** |
| 12 | Medicine / vet reconcile | **PASS after code fix + C14** |
| 13 | Supplements / minerals classified | **PASS** (1 cost entry to confirm) |
| 14 | No double-counted expenses | **PASS after C14**; classification of capex/utilities needs owner decision |
| 15 | Actual vs estimated separated | **PASS** |
| 16 | Measured vs estimated weights | **PASS** for growth. Allocation treats "unknown" purchase weights as measured, which is labelled; the owner should classify them. |
| 17 | Monthly totals reconcile | **PASS after fix** |
| 18 | Dashboard = raw transactions | **PASS after fix + C14** |
| 19 | Corrections auditable | **PASS** (C1–C14 audited, with rollbacks) |
| 20 | No fake transactions | **PASS** (none created; the invented weight/price defaults were removed) |

## 19. Tests added

`src/__tests__/accounting-audit.test.ts` has 17 regression tests, one per proven defect:
- exact inventory value;
- feed eaten = consumption − undo;
- cash enum and treatments;
- vet fee recorded once;
- feed category mapped to Feed;
- window-matched cost per kg;
- no invented weights.

Full suite: **474 / 474**. tsc clean. Lint 0 errors. Clean production build.

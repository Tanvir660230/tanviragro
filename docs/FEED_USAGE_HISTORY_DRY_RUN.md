# Feed history — dry run as usage periods (read-only, NOT applied)

Query: `docs/sql/feed_usage_history_dry_run.sql` (read-only).
Run on: the local production copy (snapshot `prod_backup_20260924-160827`), with migrations 100000–130000 and `supabase/corrections/20260925_feed_historical_corrections.sql` applied.
**Nothing in production was changed.** This report exists so the owner can decide whether history should be re-stated. Until then, history stays exactly as recorded.

## 1. Current data → proposed interpretation

| | Current (what the ledger says today) | Proposed (usage-period view) |
|---|---|---|
| Period boundary | none — daily rows plus a "True-Up: Physical stock finished" row whenever stock ran out | each True-Up is a real observation that the item was **counted empty** on that date → the end of a usage period with closing count 0 |
| What was fed | daily `consumption` rows (feed expense) + the True-Up quantity (booked as a **loss**) | everything that left the store in the period = feed actually eaten (opening + stock-in − closing) |
| Cost | each row's own cost (legacy rows: FIFO / last price) | one average per period: (value carried in + stock-in value) ÷ (qty carried in + stock-in qty); the remainder is carried into the next period at that same average |

## 2. Totals

| | ৳ |
|---|---|
| Current feed expense (consumption rows in the 22 periods) | 86,382.34 |
| Current "loss" expense (True-Up rows) | 22,041.26 |
| **Current total** | **108,423.60** |
| **Proposed feed expense** (0 loss) | **108,683.96** |
| **Difference** | **+260.35 (+0.24 %)** |
| Affected records | 601 rows in 22 periods, across 7 items |

The total cost barely moves. The real change is **classification**: ৳22,041 now shown as "loss" is feed the cattle actually ate. It becomes feed expense, so cost per animal and cost per kg gain go up and "losses" go to ~0.

The +৳260 is only a revaluation: legacy rows used FIFO / last-price costs, and the proposal uses one average per period. For example, the supplement's first period was charged at ৳152/kg, the old lot. The period average is ৳214.29/kg. The second period is correspondingly cheaper, so the two nearly cancel (+2,257.86 / −2,100.45).

## 3. Per period

| Item | Period | Rows | Qty used | Current feed ৳ | Current loss ৳ | Proposed ৳ | Difference ৳ | Qty left after |
|---|---|---|---|---|---|---|---|---|
| DORB | 06-17 → 08-22 | 64 | 190.28 | 7,052.98 | 783.38 | 7,810.17 | −26.19 | −5.28 |
| DORB | 08-23 → 09-03 | 16 | 71.79 | 3,208.50 | 93.84 | 3,322.17 | +19.83 | 22.93 |
| DORB | 09-04 → 09-17 | 4 | 22.93 | 760.38 | 294.40 | 1,080.47 | +25.69 | 22.00 |
| Straw (piece) | 06-01 → 08-18 | 13 | 528 | 722.75 | 9,380.54 | 10,102.80 | −0.50 | 0 |
| কুড়া | 06-17 → 08-22 | 64 | 291.28 | 3,464.52 | 844.90 | 4,388.96 | +79.54 | −5.28 |
| কুড়া | 08-23 → 09-03 | 16 | 71.79 | 641.56 | 0.00 | 1,143.90 | +502.34 | 74.93 |
| কুড়া | 09-04 → 09-17 | 4 | 74.93 | 391.76 | 1,384.08 | 1,162.82 | −613.02 | 60.00 |
| নাদিম এগ্রো Suppliment | 06-20 → 07-21 | 33 | 38.00 | 5,827.24 | 57.76 | 8,142.86 | +2,257.86 | 14.50 |
| নাদিম এগ্রো Suppliment | 07-22 → 09-03 | 47 | 28.76 | 10,551.44 | 90.83 | 8,541.82 | −2,100.45 | 2.24 |
| নাদিম এগ্রো Suppliment | 09-04 → 09-17 | 4 | 2.24 | 727.19 | 95.49 | 665.29 | −157.39 | 0 |
| ভুট্টা | 06-17 → 08-22 | 64 | 510.56 | 17,231.20 | 1,213.56 | 18,435.30 | −9.46 | −10.56 |
| ভুট্টা | 08-23 → 09-03 | 16 | 143.57 | 5,215.26 | 150.96 | 5,415.83 | +49.61 | 144.87 |
| ভুট্টা | 09-04 → 09-17 | 4 | 144.87 | 1,255.14 | 4,249.92 | 5,679.98 | +174.92 | 120.00 |
| ভুষি | 06-17 → 08-22 | 64 | 273.70 | 13,264.68 | 536.76 | 13,833.00 | +31.56 | −3.70 |
| ভুষি | 08-23 → 09-03 | 16 | 50.23 | 2,352.90 | 59.64 | 2,509.98 | +97.44 | 16.07 |
| ভুষি | 09-04 → 09-17 | 4 | 16.07 | 669.90 | 262.16 | 803.24 | −128.82 | 14.00 |
| লবণ | 06-20 → 08-22 | 64 | 14.32 | 249.77 | 26.80 | 277.65 | +1.08 | −0.32 |
| লবণ | 08-23 → 09-03 | 16 | 4.29 | 73.16 | 1.92 | 79.21 | +4.13 | 3.39 |
| লবণ | 09-04 → 09-17 | 4 | 3.39 | 19.80 | 48.00 | 64.52 | −3.28 | 2.00 |
| সয়াবিন খৈল | 06-17 → 08-22 | 64 | 158.17 | 9,412.13 | 842.94 | 10,264.21 | +9.14 | −3.17 |
| সয়াবিন খৈল | 08-23 → 09-03 | 16 | 43.09 | 2,646.58 | 73.78 | 2,750.56 | +30.20 | 33.74 |
| সয়াবিন খৈল | 09-04 → 09-17 | 4 | 33.74 | 643.50 | 1,549.60 | 2,209.22 | +16.12 | 22.00 |

## 4. Data facts found (reported, not "fixed")

1. **More used than was in stock (negative "qty left").** The first Mix-Feed-ingredient period of each item ends slightly negative (DORB/কুড়া −5.28, ভুট্টা −10.56, ভুষি −3.70, খৈল −3.17, লবণ −0.32). The proportions match one Mix Feed batch. The old app let the recipe take ingredients the store did not have. The True-Up then removed the rest, so the ledger booked more out than in.
   - Nothing was invented to cover it.
   - The proposed method carries the shortfall into the next period, so no value is created or lost.
2. **Purchases on a True-Up day.** The 09-17 purchases (e.g. ভুট্টা 120 kg, কুড়া 60 kg) are dated on the same day the old stock was counted empty. They fall inside the period and show as "qty left after". They are the stock of the next period, and the proposed method carries them forward at their own cost.
3. **Straw:** 528 pieces. Only ৳723 was recorded as feed; ৳9,381 was recorded as "loss". In the proposed view all ৳10,102.80 is feed, which is the correct answer for roughage the herd ate.

## 5. What would change if the owner approves

Nothing is edited or deleted. Each period would be recorded as a closed `feed_usage_period` (closing 0 on the True-Up date), and the old rows would be neutralised with `consumption_reversal` counter-entries, carrying the audit reason "history re-stated as usage period". The proposed values in §3 are what the reconciliation would post.

The owner must first confirm that every True-Up really meant "the store was empty that day". **Until then this stays a dry run.**

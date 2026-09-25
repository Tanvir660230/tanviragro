# Whole-site audit and plan for one central system

**Method:**
- The local copy was synced to production on 2026-09-25 (861 ledger rows, 25 partner transactions and so on).
- A crawler opened all 73 pages, signed in, in Bangla, and recorded errors, console exceptions and screenshots.
- Every database query in the code was checked against the real table and column list.
- Row counts were taken from the production tables.

## 1. What the farm actually uses
Measured by the rows in production:

| In use | Empty (never used) |
|---|---|
| cattle 6, weights 10, health tasks 52, treatments 5, expenses 104, partners 5 / 25 transactions, feed and stock 861 rows, recipes and mixes, fixed assets 6, market prices 3, expense categories 12 | **53 tables**: breeding / heat / pregnancy / calving / semen, commerce orders / invoices / contracts, analytics dashboards / widgets / snapshots, budgets, journals, cost centres, pens / farms, disease / death records, vendors, loans, sales (none sold yet), custom reports, API keys and others |

## 2. Problems found

### A. Numbers wrong or missing (a bug in a function)
| # | Where | What the user sees | Root cause | Fix |
|---|---|---|---|---|
| A1 | Finance | Two summaries that disagree: cash **৳16,782** vs **৳−1,15,922**; cost/kg ৳332; bio value ৳16,84,200 | A second, older calculation (`lib/financial`, "Enterprise workspace") runs beside the audited accounting engine. | Remove the old workspace; the Finance page reads only the accounting engine. |
| A2 | Health reports / timeline | Treatments **0**, vet cost **৳0** (real: 5 treatments, ৳4,500) | `cattle_treatments` has no `business_id`; the query fails silently (hidden by `supabase as any`). | Filter through the animal (`cattle!inner(business_id)`). |
| A3 | Homepage, AI health | "20 health tasks overdue" (real: **32**) | `limit(20)` on the list is also used as the count. | Count separately from the list. |
| A4 | Homepage | "Straw আর **2.7272727272727275** দিন চলবে" | Days left not rounded. | Round to whole days. |
| A5 | Backup (`/api/backup`) | The cattle and item backup fails. | `order("recorded_at")` on tables that have no such column. | Order by `created_at`. |
| A6 | Purchase / mix / finance lock | The financial lock is never enforced. | `lib/financial/financial-lock.ts` reads `lock_date`; the column is `locked_until`. | One lock check (`locked_until`) for all actions. |
| A7 | Products list and product detail | The page loops: "Maximum update depth exceeded". | A `useMemo` / state loop in the product list client. | Remove the list (duplicate of the stock list); fix the detail page. |
| A8 | FCR / cost per kg of gain | 5.6 (analytics) · 7.2 (growth) · 9.08 (feed plan) · ৳214 / ৳285 / ৳332 per kg | Four pages each compute their own. | One source: the home model (the cattle list and profile already use it); the duplicate pages go. |
| A9 | AI hub | Revenue ৳48,50,000, "426 cattle", herd value ৳1,82,50,000 | Hard-coded demo numbers. | Remove the page. |
| A10 | Warehouses | "3 warehouses: Silage Bunker, Veterinary Cabinet" | Hard-coded demo list. | Remove the page. |
| A11 | Breeding pages, AI recommendations, custom analytics | Always empty or erroring. | Columns that do not exist (`tag_number`, `current_stock`, `status` …). | Remove (the feature is not used). |
| A12 | Balance sheet | Assets ৳6,75,017.40 vs equity ৳6,75,017.39 | Rounding each line before adding. | Add unrounded, round once. |

### B. The same thing in several places
- **Vaccination / health tasks:** 5 pages (`/cattle/health`, `/cattle/vaccinations`, `/health`, `/health/records`, `/health/vaccinations`), plus `/health/timeline` and `/health/reports`.
- **Growth / FCR:** `/cattle/analytics`, `/cattle/growth`, `/cattle/feed`, besides the cattle list and profile.
- **Stock:** `/inventory` (the stock list), `/inventory/products` and `/inventory/reports`.
- **Money:**
  - `/finance` shows two summaries;
  - `/report` "Enterprise Report Center" shows a third view of the same money (with a "Cash runway 3 days CRITICAL" alert).
- **Two feeding systems:** `/cattle/feed` "Feeding sessions" (the old ration plan, which writes stock on its own) vs the daily deduction and feeding chart.

### C. Menus that confuse
- **Sidebar:** 7 groups and 14 links in English (Core, Operations, Commerce, Insights, Administration, Support…). "Support" goes to **`/dashboard/help`, which does not exist (404)**.
- **Top bar:** an "Enterprise Online" badge. The "Create" menu:
  - "Receive feed" opens *Add item* (not the purchase memo);
  - "Daily feed log" belongs to the retired system;
  - "Health / vaccination" opens the cattle list.
- **Bottom menu "More":** it lists Vendors and Operations (a developer tool).

## 3. The target: one central system

### 3.1 One menu (Bangla first; the same on the sidebar and the phone)
| Section | Page(s) | Contents |
|---|---|---|
| **হোম** (Home) | `/dashboard` | What to do today, cattle, money, feed, Eid. |
| **গরু** (Cattle) | `/dashboard/cattle`, `/cattle/[id]`, `/cattle/qurbani` | List, profile (weight, health, cost), Qurbani board. |
| **স্বাস্থ্য** (Health) | `/dashboard/health` (tasks + vaccines, one page), `/health/treatments`, `/compliance` (DLS vaccine status, printable) | |
| **খাবার ও স্টক** (Feed and stock) | `/inventory` (+ purchase, mix, feed usage, feeding chart, movements, adjustments, purchase history, product detail) | |
| **টাকা-পয়সা** (Money) | `/finance` (expenses + summary), `/finance/utilities`, `/finance/loans`, `/partners`, `/accounting` (statements, fixed assets) | |
| **রিপোর্ট** (Reports) | `/report` | Exports and printables; reads the same engines. |
| **সেটিংস** (Settings) | `/settings` (+ team, trash, activity), `/notifications` | |

### 3.2 One source for every number
| Number | Single source |
|---|---|
| Herd, weight, growth, cost per animal, profit per animal | `lib/home` (home model) |
| Feed usage, feed cost, stock days left | `lib/feed` (feed engine) |
| Cash, expenses, profit, balance sheet, fixed assets | `lib/accounting` (accounting engine) |
| Stock quantity and value | `v_inventory_balance` and `v_inventory_unit_cost` |
| Health tasks due / overdue | `health_events` (one query helper) |

Parallel engines that go: `lib/financial` (except the pieces the accounting engine uses), `lib/analytics`, `lib/ai`, `lib/reproduction`, `lib/workflow-engine` / `workflows`, `lib/commerce`, the warehouse engine. Each is deleted only after the unused-file scan and the type check prove nothing needs it.

### 3.3 One page shell
- Every page has the same header (title, one-line purpose, main action), the section's sub-menu, then content.
- Remove "Enterprise …" titles and badges.
- Bangla and English from the dictionary.

## 4. Delete list
| Pages | Why |
|---|---|
| `/breeding` + 9 sub-pages, `/cattle/breeding` | Fattening farm: breeding never used (all tables empty; the pages query columns that do not exist). |
| `/commerce`, `/vendors` | Never used (tables empty). Supplier dues already live with the purchase memo. |
| `/workflows`, `/operations` | A demo workflow engine and a developer monitoring page. |
| `/ai`, `/health/ai`, `/inventory/ai` | Demo numbers; recommendations query columns that do not exist. |
| `/health/audit`, `/health/diseases`, `/health/mortality`, `/health/quarantine`, `/health/timeline`, `/health/reports`, `/health/records` | Empty, or duplicates of the health page. |
| `/cattle/health`, `/cattle/vaccinations` | Duplicates of the health page. |
| `/cattle/analytics`, `/cattle/growth`, `/cattle/feed`, `/cattle/pens` | Duplicate or contradictory growth figures; an old feeding system; pens never used. |
| `/inventory/warehouse`, `/inventory/products` (list), `/inventory/reports`, `/inventory/mix-feed` | Demo data, duplicate / looping, duplicate, retired redirect. |
| API: `/api/ai/*`, `/api/analytics/*` (custom reports) | Broken queries; only the deleted pages call them. |

**The database is not touched in this step** (empty tables stay; dropping them can be a separate, reversible migration later).

## 5. Phases
1. **Delete** the pages above and everything only they use (unused-file scan until 0; tsc).
2. **Fix** A1–A8 and A12. A9–A11 disappear with the deletions.
3. **One menu:**
   - sidebar and phone "More" from one Bangla-first config;
   - the Create menu points to the right pages;
   - remove the "Enterprise Online" badge;
   - no dead links.
4. **One shell:** consistent headers and sub-menus on the kept pages; Bangla labels.
5. **Verify:**
   - crawl all kept pages again: no errors, no console exceptions, no dead links;
   - the numbers agree across Home / Cattle / Finance / Feed;
   - tsc, jest, lint, build; local commit, **no deploy**.

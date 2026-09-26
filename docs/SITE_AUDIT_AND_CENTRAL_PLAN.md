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

## 6. Phases 3–5: what was done and verified (2026-09-25)

**One menu, from one file.** `src/components/navigation/site-map.ts` is the only list of sections and pages. Everything below is built from it:
- the sidebar (desktop and collapsed);
- the phone menu drawer;
- the bottom bar and its "More" sheet;
- each section's tab row (`SectionSubNav`);
- the breadcrumb;
- search (Ctrl+K);
- page titles (`SitePageTitle`, in Bangla or English).

**Bugs fixed while doing it**
- **The phone menu drawer could never open.** It sat inside the desktop sidebar box, which is hidden on phones, and before that it rendered an empty layer that blocked the screen.
- **Health could not be reached from the phone.** It was in neither the bottom bar nor "More".
- **Search:** it loaded only 20 animals, deleted animals included, and linked to `?selected=`, which does nothing. It now finds every animal and opens its page. Its page list came from a hard-coded list with dead pages.
- **The Create menu pointed to the wrong pages.** Health went to the cattle list, and "Receive feed" went to a dialog. Each item now opens the right form.
- **Business looked up by `owner_id` only.** This affected report, partners (3 pages), notifications, the statement, market price, the budget panel and the top bar. A manager or team member would have seen empty pages. They now all use the central resolver (`getCachedBusinessId`). Settings stays owner-only on purpose.
- **Health overview:**
  - it used the server's UTC date, which is off by one day before 06:00 in Dhaka;
  - it linked to 5 deleted pages;
  - it showed an "Active diseases" card for data nothing can add.
- **Desktop layout:** a blank strip about 90px wide sat between the sidebar and the page, because the sidebar did not fill its column.
- **Titles:** 15 page titles were English in Bangla mode. "Enterprise" text was removed. The finance page had no title.

**Deleted (junk):**
- 93 more files that no page used. Only tests kept them: the old financial engines, analytics, growth, governance, monitoring, workflow-engine, the "Universal CRUD" and enterprise-ui kits, 8 unused hooks, and the layout templates.
- 13 tests that exercised only that code.
- The duplicate `SearchBox`, and the recent-cattle tracker nobody read.
- The old breadcrumb label map (it still listed deleted pages).

**Verified**
- `tsc`: clean.
- `eslint src`: clean.
- `jest`: 41 suites, 358 tests pass. The new `site-map.test.ts` checks that every menu link has a real page.
- Clean `next build`: succeeds.
- Dead-link scan (every `/dashboard/...` string in `src` checked against real pages): 0.
- Unreachable-code scan (tests excluded as users): 0, apart from the data-grid barrel that its tests import.
- Crawl of all 36 kept pages plus old URLs in Bangla:
  - no error screens;
  - no console errors or exceptions;
  - every title is Bangla;
  - `/dashboard/vendors` and `/dashboard/help` redirect.
- The same numbers on every page (local copy of production):
  - cash ৳16,782 on Home, Finance, Report and the Balance Sheet;
  - operating result −৳1,54,120 on Finance and Accounts;
  - assets ৳6,75,017 on Report, the Balance Sheet and Accounts.
- Phone screenshots: bottom bar, "More" sheet and menu drawer all work.

## 7. Leftovers finished (2026-09-26)

**Every screen in Bangla and English, from one mechanism.**
- `L("বাংলা", "English")` for client pages (`src/i18n/text.ts`, `useL()`), `getL()` for server pages (`src/i18n/server-text.ts`), `<Tr bn en />` for pieces shared by both.
- Shared label sources: expense categories/types `lib/expenses/labels.ts`, partner and transaction types `lib/partners/labels.ts`, status badges `components/ui/status-badge.tsx`.
- Page titles come from the site map; the back arrow is hidden on pages that are on the site map (the tabs lead everywhere).
- English UI strings seen on pages in Bangla mode: 1,211 → only data left (names, notes, units, dates).

**Settings is one page.** The second tab row is gone (profile, accounts, herd and feed, preferences, security). Removed settings nothing used: VAT/tax rate and "equity unit price".

**Bugs fixed while translating**
- What-if calculator started from ৳1,000/kg (the old "unit share" value) → now the latest market price from the log.
- Vaccines: "Record details" on a task used the first animal and FMD instead of the tapped task, and recording a dose added a second completed copy while the task stayed overdue → rebuilt; a dose now closes its task.
- Vaccine page: stock computed with a wrong sign rule and a 1,000-row limit → stock ledger view. Fake "campaigns" tab and fixed-dose "adverse" advice removed.
- Treatments: totals stopped at the last 100 rows; month count used UTC → all rows, Dhaka date.
- Vaccine report and print report: "hs"/"bq" matched inside other words ("months"); made-up legal citations removed from the print report.
- Dhaka date (not UTC) on health, vaccines, notifications and the top-bar alerts.
- ৳ sign showed as "?" on "Add several"; delete dialogs said "permanently" for soft deletes; notes pointed to Settings for the market price (it is on the Money page); health certificate printed "Tanvir Agro" instead of the farm's name.
- The animal form in use (wizard) never asked whether the purchase weight was measured or estimated (only an unused form did) → asked and saved.

**More unused code removed:** vaccination engine, 9 cattle components that were imported but never shown, an unused 480-line cattle form, unused imports in 80 files, 5 database queries whose results were never used (partners 4, money 1).

**Left as is, on purpose:** the partners page computes profit on a "realised" basis (cost of animals still on the farm is excluded) for profit sharing; that is a business rule, not a display bug. Data (names, notes, units like "piece", English month names in some dates) stays as entered.

## 8. One cash ledger (2026-09-26)

**Problem.** Cash was computed in two places that disagreed:
- the accounting engine (Home, Finance, Report, Balance Sheet);
- the cash statement (`finance/statement-action.ts`), which queried the tables on its own. It:
  - left out vet fees on treatments, which became visible after C14;
  - ignored supplier dues;
  - counted soft-deleted partner entries and deleted animals;
  - stopped at 1,000 stock rows.

The trial balance also credited cash for feed eaten by an animal. That feed was already paid when it was bought.

**Now.** `src/lib/accounting/cash-ledger.ts` builds one dated list of every cash movement.
- Engine: `cashAndBank = opening cash + Σ rows`.
- Statement: it shows those same rows (`cashStatement`), so its closing balance is the cash on every other page.
- Trial balance: its Cash line equals the balance sheet (`accounting-cash.test.ts`).
- Loans: the cash of every loan is principal received − payments made (was clamped / zeroed for paid loans).

**Fixed at the same time**
- **Dhaka dates everywhere "today" is used** (36 files). Before 06:00 in Dhaka the UTC date is yesterday, which:
  - dated new entries a day early;
  - hid today's rows from the statement and the Finance filter;
  - rejected today as "in the future".
- **Money tables read page by page.** Costs, partners, sales and treatments were plain selects that stop at 1,000 rows.
- **Vet fees shown in the expense list.** They are on the treatment rows.
- **Trash:** the C14 duplicates say why they were removed, and restore is off. Restoring one would take the same money twice.
- **Accounting failures are logged.** The home cash tile and the money summary used to hide them as "—".
- **Cache refreshed** after cattle bulk and status actions (`revalidateTag("accounting")`).
- **Serwist wrapper removed.** It never ran under Turbopack and only printed a build warning. `public/sw.js` is the hand-written push worker.

**Supplier dues can be paid.** Before this, a due could only grow: nothing could record paying the shop, so the amount stayed in cash for ever.
- The purchase page has a "দোকানের বাকি" card with a pay form (`paySupplierDue`).
- A payment lowers the due and notes `Paid <amount> on <date>`. The cash ledger takes it out of cash on that day.
- The due arithmetic now coerces the numeric columns to numbers.

**Still open:** confirm the production cash against the owner's count. The production read was not allowed in this session.

## 9. Partners: one calculation, no loss before a sale (2026-09-26)

**Problems found**
- **"Loss" before any sale.** The three partner pages each computed their own "realized P&L": sales − purchases − every running cost − feed. With nothing sold, wages, electricity and feed showed as a partner loss. On a fattening farm these are the cost of the cattle, not a loss.
- **Half of every loss went nowhere.** Loss was split by the profit shares. Mohiuddin holds 50% of profit and bears no loss, and his half of the loss was not given to anyone.
- **Omor and Sumaiya showed a profit.** Partners who joined later had an "entry P&L" snapshot subtracted. It came from the old formula (−৳1,33,153), so it produced a profit out of nothing.
- **The late-joiner valuation counted the herd twice.** "Pre-money valuation" = capital + P&L + cattle value + assets, but the capital had already been spent on those cattle.
- **The three pages disagreed.** The profile left vet fees out of costs and the statement counted them. The weights used 0.6 kg/day instead of the growth engine the Home page uses.
- **The "bears loss" box on the add-partner form was never saved.**
- **Money could be paid out that did not exist.** Distribution had no server check: an estimate could be paid out, and losses were "distributed" as records.
- **The running balance counted profit payouts as capital.**

**Now: `src/lib/partners/position.ts` (pure) and `load-positions.ts` (one loader, used by all three pages)**

*Result by animal.* Each animal has a full cost:
- purchase;
- its own costs (vet, its own feed, its own expenses);
- running costs × its days on the farm ÷ all head-days.

The result of an animal is:
- **realized**, for animals sold or dead: price − full cost;
- **estimate**, for animals on the farm: today's value (Home model: weight × latest price) − full cost.

Realized + estimate equals the accounts' figure: retained earnings + profit paid + (herd value − livestock at cost).

*Split (the owner chose "taka × days").*
- **Profit.** The management fee comes off first. Fixed-share partners take their percent. The rest goes to the other partners by capital-days.
- **Loss.** 100% is carried by the partners who bear loss, by the same rule.
- **Per animal.** A sold or dead animal is split with the weights on the day it left. The estimate is split with today's weights.
- **Late joiners.** A partner shares only from the day their money came in, so no entry valuation is needed.

*Payouts.* Only realized profit not yet paid can be paid out, and the server checks each amount.

**Production figures, 26 Sep (read-only)**
- Nothing sold.
- Running costs ৳1,54,120, which is ৳270.86 per head per day.
- Herd full cost ৳6,79,094; value ৳7,06,805.
- Estimated result **+৳27,711**, the same as the accounts' figure.
- Split of the estimate:

  | Partner | Profit share | Estimated share |
  |---|---|---|
  | Mohiuddin | 50% | ৳13,856 |
  | Tanvir | 31.3% | ৳8,685 |
  | Nanu | 11.8% | ৳3,258 |
  | Omor | 4.0% | ৳1,119 |
  | Sumaiya | 2.9% | ৳794 |

- C006 weighed 210 kg on 14 Sep against an estimated 250 kg at purchase. It shows −৳28,150; the purchase weight was probably overestimated.

**UI**
- The partners page is rebuilt:
  - the farm today (capital, cattle full cost, value, result if sold today);
  - an animal-by-animal table;
  - "how it is split";
  - one row per partner.
- The profile and the statement show the same figures.
- Removed:
  - the duplicate add-transaction dialog and capital summary cards;
  - the partner card and equity chart;
  - the old equity functions and the pass-through service.

## 10. Partner shares that can change over time, and results that stay settled (2026-09-27)

**Share rules with a start date** (`partner_share_rules`, migration 20260927090000).
- On the profile, "Share rules" → "Change share" sets:
  - from which date (past, today or future);
  - fixed % of profit, or taka × days;
  - whether the partner bears loss;
  - a note.
- A rule runs until the partner's next rule; earlier days keep the earlier rule.
- Checked before saving (on screen and on the server):
  - not on or before the locked books;
  - not before the join date;
  - fixed shares may never pass 100% on any day, counting other partners' later rules and later joiners.
- The first rule (join day) cannot be removed. A rule inside locked books cannot be removed.
- The partner's own share fields follow the rule in force today (older screens read them).
- The edit form no longer changes the share.

**The calculation (`lib/partners/position.ts`)**
- **Running costs are shared day by day** among the animals on the farm that day. A sold or dead animal's result never changes after it leaves. Costs on a day with no animal are a realized loss.
- **Each part is settled on its NET** (realized, estimate). A loss on one animal is set against profit on another, so a fixed 50% is 50% of the net.
- **Taka × days count only during the animals' days.** Withdrawn money stops counting.
- **Days are cut only where terms really change:**
  - a share rule;
  - the management fee (its own dated rates);
  - a fixed-share partner joining;
  - anyone leaving.

  Example: a 50% → 40% change on 1 Aug splits an animal kept Jun–Sep by its days (61 days at 50%, 61 days at 40%).
- **The dead date** comes from `cattle_death_records`.

**Leaving and paying out**
- A partner with money history cannot be deleted; they **retire** (`partners.left_at`). They get no share from that day and keep their history. They can be made active again.
- Profit payout offers to **lock the books up to the payout day** (financial lock, on by default).
- An overpaid share (after a later correction) is shown.
- A negative account is shown as "owes the farm".

**Checked on production data (read-only snapshot)**
- Running costs by day ৳1,54,120, the same as the accounts.
- Estimate +৳27,711, the same as the accounts.
- Mohiuddin: ৳13,856, which is 50% of the net. If 40% applied from 1 Sep, it would be ৳13,096.
- The migration was dry-run on production inside a rolled-back transaction: it backfills five rules and nothing stayed.

**Found:** production does not have migration 20260924120000 (`is_business_member`); every policy is owner-only. The new migration works either way.

**To deploy:** apply migration 20260927090000. Until then the pages use each partner's current setting and the rule panel says the update is needed.

## 11. Partner money types, expenses paid by a partner, cycles (2026-09-27)

These are the owner's answers:
- cycles are closed by the owner on a date;
- the labour partner takes money whenever needed. That is a **profit advance**, not a salary.

**Migration 20260927100000 (needs 20260927090000)**
- **New transaction types:**
  - `advance` (a profit advance);
  - `loan_in` / `loan_repay` (a partner's loan to the farm: repayable, no share of profit).
- **`partner_transactions.cost_entry_id`:** links a partner's credit to an expense they paid from their own pocket.
- **The `partner_cycles` table.**

Both migrations were dry-run together on production and rolled back. They create the 5 rules, the table, the column and the new types; nothing stayed.

**The calculation**
- **Cycles.** Every final result (a sale, a death, a day's cost with no animal) falls in the cycle of the day it happened. Each closed cycle is settled on its own net and stored.
- **The open cycle** is settled twice:
  - its final results alone;
  - together with the herd valued today.

  Only the smaller share is paid out, so a profit on sales can never be paid while the herd is down.
- **Advances** come off the partner's settled profit. An advance taken beyond it is shown as "comes off the next profit".
- **Partner loans** are liabilities in the accounts. They are kept apart from capital and earn no share.
- **Shares are rounded to the paisa** by largest remainder, so they add up exactly.

**The accounts**
- The cash ledger has "Profit advance" and "Partner loan" rows.
- The engine counts advances as drawings and partner loans as liabilities. The balance sheet and trial balance stay balanced (`accounting-cash.test.ts`).

**Safety checks**
- The entry form takes only: capital in/out, advance, loan in/repay. Profit goes out only through a payout.
- **Dates:**
  - no capital or loan before joining;
  - after retiring, only money going back.
- **Going beyond the account or the cash:**
  - a withdrawal above what can be taken out (capital + settled profit − paid), or any payout above the farm's cash, needs a confirmation and a note;
  - a loan repayment cannot exceed the loan.
- **Expenses paid by a partner:**
  - an expense marked as paid by a partner also credits that partner (capital or loan), so cash is unchanged;
  - editing the expense moves the credit with it, and deleting or restoring the expense does the same;
  - the credit cannot be deleted on its own.

**UI**
- **One entry form** is used on the partners page and the profile. It shows capital, what can be taken out, advances, the loan and the farm's cash.
- **A "Cycles" panel** shows the open cycle and lets the owner close one on a date:
  - a preview first;
  - closing locks the books to that date;
  - each closed cycle lists every partner's share;
  - the last cycle can be reopened unless a payout came after it.
- **Partner rows** show "advance not yet earned" and "lent to the farm".
- **The expense form** has "Paid by" (the farm's cash, or a partner as capital or as a loan).

**CSV:** one helper (`lib/csv.ts`, a Blob with a BOM). A "#" in a note no longer cuts the file, and Bangla opens correctly in Excel.

## 12. Finished before the next deploy (2026-09-27)

**Speed**
- Taka × days is read from a per-partner running sum (two binary searches per window) instead of adding every entry.
- 500 animals, 2,000 entries, 2 years of daily costs and 3 cycles take about 0.2 s (`partner-scale.test.ts`). The same test checks the result against adding every entry by hand.

**Partners page**
- **Result tile:** also shows the result at a market price ±10%.
- **Animal table** (`AnimalResultsTable`):
  - tabs: on the farm / sold / died / all;
  - sort: losses first, longest on the farm, or by tag;
  - 25 per page, with a total;
  - an animal at a loss says "weigh again to check".

**Profile**
- "How it is worked out" lists the partner's share of every closed cycle, the open cycle's final results and the estimate. Profit paid, advances and a loan to the farm are listed separately.
- **Entries list:**
  - tabs: profit and advances, and loans;
  - a date range;
  - 25 per page;
  - money in and out totals.

**Capital ledger:** the latest five, then every entry, with a partner filter and 25 per page.

**Dates:** the same everywhere on partner pages ("২৬ সেপ্টেম্বর ২০২৬" / "26 Sep 2026", `fmtDay`).

**Team access**
- Production never ran 20260924120000. Even with it, every core table stays owner-only, because it covered only the 026 tables. So managers and workers saw empty pages.
- Migration **20260927110000_team_member_access** adds one "team members" policy per table next to the owner's:
  - business tables: by business;
  - child tables: through their parent.

  Nothing is dropped. Role limits stay in the app.
- Dry-run on production with the other migrations, rolled back: the owner sees everything as before, a stranger sees nothing, and a test manager sees the farm's rows.

### Deploy runbook (when the owner says so)
1. **Read-only check before:**
   - cash ৳16,782 (or later);
   - 5 partners, 25+ partner entries;
   - no rows in `partner_share_rules` / `partner_cycles`.
2. **Apply the migrations in this order.** **Done on production on 2026-09-27**, on the owner's word ("Database update kora lagle koro"), with auto mode off. Deploy is later.
   - After them: 161 policies, 70 "team members", 0 tables without RLS, and 5 share rules (Mohiuddin manual 50%, no loss).
   - The owner still sees 5 partners / 25 entries / 53 costs / 861 stock rows / 6 cattle; a stranger sees 0.
   1. `20260924120000_phase1_rls_hardening`
   2. `20260927090000_partner_share_rules`
   3. `20260927100000_partner_cycles_money_types`: the three `alter type … add value` lines run before its `begin`.
   4. `20260927110000_team_member_access`
3. **Push `main`** (fast-forward) and wait for Netlify.
4. **Read-only check after:**
   - 5 share rules, with Mohiuddin manual 50% and no loss;
   - `is_business_member` exists;
   - the home cash tile and the partners page load;
   - the estimate is about +৳27,711 at the current price.
5. **Rollback files** for each migration are in `supabase/rollback/`.

## 13. UI polish after a visual check (2026-09-27)

The partners page and profile were rendered with the production numbers and a demo set: a sold animal, a closed cycle, an advance, a loan and an upcoming rule. They were checked at 1440 px and 390 px through a temporary local preview, since removed.

**Partners page**
- **Order:** the farm → the partners → cycles → the rules.
- **Result tile:** the price ±10% range is on its own line.
- **The rules** are a one-line summary that opens, with an "a change is coming" badge.
- **"Close a cycle"** is quiet (outline) while the open cycle has nothing final.
- **Dates** use `fmtDay`.
- **Each partner's account line** shows advances, profit paid and "can be paid now" separately (an advance was shown as profit paid).

**Profile**
- On a phone the name no longer truncates; the actions wrap under it.
- A labour partner without capital sees "Advances taken" instead of "Capital in ৳0", and no "Put in +৳0" line.
- "How it is worked out" is one ordered column, amounts do not break over two lines, and the loan is a note under the total.
- The capital chart is hidden when there never was capital.
- The capital column shows "—" on advance and loan rows.
- The record count is in Bangla.

**Bug found during the check**
- The session proxy sent `/sw.js`, `/manifest.webmanifest`, `/icon` and `/apple-icon` to `/login` for signed-out browsers. So the service worker could not register and the install icon broke.
- They are now excluded by exact name. `/dashboard` and every other path still require a session.

## 14. The Money page rebuilt on one money model (2026-09-27)

**One source for every figure.** `lib/money/money-model.ts`, through `buildMoneyModel`, works out every figure on `/dashboard/finance`. It only puts together results the rest of the site already computes:
- the engine (`getAccountingData`), for the cash ledger, expenses, assets and dues;
- the partner position engine (`loadPartnerData`), for each animal's full cost and the farm's result;
- the home model, for weights, measured ADG and the value today.

As a result, cash, the running costs, "if sold today" and the farm's worth are the same numbers as the homepage and the partners page.
- `lib/money/money-data.ts` (`loadMoneyData`) fetches the data once: all time, the chosen period, this month, last month and the last six months.
- `lib/money/period.ts` (`financePeriod`) turns the period query into dates.
- `lib/money/summary.ts` (`capitalSummary`) moved here from the old analytics file.
- `CASH_CATEGORY_LABEL` in `cash-ledger.ts` is the one name list for cash categories.

**Layout**
- **Money today**, four tiles:
  - cash, with the 30-day average spend and how many days it lasts;
  - this month's running costs against last month;
  - the result if every animal were sold today, with its ±10% price range;
  - the farm's worth.

  A strip below shows the market price used and links to change it.
- **Period bar:** chosen once, above the tabs. It applies to the overview and the expenses tab.
- **Tabs**
  - **Overview:** running costs by kind; the final result from animals sold or dead; cash in and out by category; six months of running-cost bars, with cash in and out as figures.
  - **Expenses:** one line of totals; filters by category; CSV.
  - **Cash statement.**
  - **Per animal:** the sale planner (price, days, projected weight = weight + ADG × days, cost = full cost + cost per head per day × days); the per-animal cost detail folded underneath.
  - **Assets:** the engine's register, plus asset payments that have no register entry.

**Removed, because each repeated or contradicted a central figure**
- BreakEvenCard, BudgetForecastPanel/BudgetPeriodPicker, CapitalSummaryCard, CashFlowForecast
- CostBreakdownChart, FinanceAnalyticsPanel/WithFilter, FinanceTabs, PLSummary, PLTrendChart
- PerHeadROITable, SellTodaySummary, WhatIfCalculator
- `lib/cattle-weight.ts`, `lib/supabase/queries/analytics.ts`
- in CostList: the second date filter, the asset register, the fixed/variable chips

**Tests:** `__tests__/money-model.test.ts`. The asset source guard now checks the new page.

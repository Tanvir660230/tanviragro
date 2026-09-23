# TANVIR AGRO ENGINEERING AUDIT REPORT

- **Audit date:** 2026-09-24
- **Scope:** local working tree at `tanviragro-main` (branch `main`, HEAD `6336805`, plus **216 modified and 263 untracked files** that are not committed)
- **Method:** read-only static review of the source, the migrations and the config, plus local `tsc --noEmit`, `eslint src`, `jest` and `npm audit`. Nothing was changed, committed, deployed or migrated. No secrets are reproduced here.
- **Not done:** live-database inspection (policies, applied migrations, auth settings), a logged-in browser walkthrough, and responsive/device testing. Findings that depend on these are marked **Needs verification**.

> **Read this first.** The working tree differs a lot from `origin/main`. It also contains migrations (`026`–`032`, `20260912`) that were never committed. The migration `20260616234914_journal_lines_rls.sql` says in its own comments that production has policies "created outside of a committed migration". **Neither git nor `supabase/migrations/` is a reliable record of production.** Every database and RLS finding below must be confirmed against the live `pg_policies`, `pg_proc` and `information_schema` before anyone acts on it.

Finding IDs (e.g. `SEC-02`) match `docs/TANVIR_AGRO_REMEDIATION_PLAN.md`.

---

## 1. Executive Summary

Tanvir Agro is a single-codebase Next.js 16 and Supabase ERP for a cattle-fattening business. It is large (about 135k lines of TypeScript, 68 dashboard routes, about 70 tables), and most of it was generated in AI-assisted "phases". The core daily loop is mostly implemented and type-checks almost cleanly: register cattle, log weights, feed, record costs, sell, view finance.

However:

1. **Tenant isolation and RBAC are not trustworthy.** The committed RLS policies allow a team member to rewrite their own membership row, including role and business. Nine tables have no RLS in any migration. Four `SECURITY DEFINER` functions take a caller-supplied business or user ID with no check. Finance and accounting pages have no server-side role check, and about half of the server-action files have no permission check. A Supabase **personal access token** sits in plaintext in the project folder.
2. **Financial numbers are not reliable.**
   - Every aggregate is computed in JavaScript from unpaginated queries, and the API is capped at 1000 rows, so totals will silently truncate as the farm grows.
   - Estimated (algorithmic) feed costs are booked into realized P&L, COGS and the balance sheet.
   - Several consumption paths record cost as zero.
   - The official statements come from a 30-day cache that several write paths never invalidate.
   - At least eight different modules compute "profit" in different ways.
3. **The engineering baseline gives false confidence.** 346 of 347 unit tests pass. But they test "enterprise engine" libraries, many of which are **not used by the running app**. The code that produces the numbers users see (`lib/accounting/engine.ts`, `lib/supabase/queries/*`, server actions) has no tests. Builds ignore TypeScript errors. The CI workflow is untracked, so it has never run.

No rewrite is justified. The architecture (App Router, server actions, Supabase and RLS) is sound. The problems are missing enforcement, duplicated calculation paths, and schema drift. All of them can be fixed step by step.

---

## 2. Technology Stack (as found)

| Area | Actual implementation | Evidence |
|---|---|---|
| Framework | Next.js **16.2.7**, App Router, `src/proxy.ts` (the Next 16 name for middleware) | `package.json`, `src/proxy.ts` |
| Runtime | Node 20 on Netlify (`netlify.toml`); local is Node 24.18 | `netlify.toml:6` |
| Language | TypeScript 5 in `strict` mode, but `ignoreBuildErrors: true` | `next.config.ts:15-17` |
| UI | React 19.2, Tailwind v4, shadcn/`@base-ui/react`, lucide, recharts, sonner | `package.json` |
| Data | Supabase (Postgres 17, RLS) through `@supabase/ssr`. `pg` is a dependency (usage not found in the request path) | `src/lib/supabase/*` |
| Auth | Supabase email/password and magic link. Session cookies refreshed in the proxy | `src/lib/supabase/middleware.ts` |
| Authorization | App-level `ROLE_PERMISSIONS` matrix + `getBusinessContext()`, applied inconsistently. RLS is tenant-scoped only | `src/constants/roles.ts`, `src/lib/context/business-context.ts` |
| Validation | zod v4 (partial), react-hook-form | `src/lib/validation/*`, `src/lib/validate.ts` |
| Client state | TanStack Query, React context. Most data comes from Server Components | |
| Storage | Supabase Storage (`avatars`, `logos`, cattle photos, a backup bucket) | `006_*.sql`, `backup-helpers.ts` |
| Background jobs | Two Netlify Scheduled Functions call `/api/backup` (weekly) and `/api/notify/check` (daily) with `CRON_SECRET`. `/api/cron/daily-alerts` exists but has no scheduler | `netlify/functions/*.mts` |
| Notifications | Web Push (VAPID), WhatsApp, Resend email | `src/lib/notifications.ts` |
| "AI" | Local rule engines (`provider: "local_rules"`). No LLM call was found in the request path. `GEMINI_API_KEY` is set but its usage was not found | `src/app/api/ai/*` |
| PWA | Serwist; `public/sw.js` is generated and committed | `next.config.ts:5-9` |
| Observability | Sentry (DSN commented out in `.env.local`), in-memory telemetry | `sentry.*.config.ts`, `src/lib/monitoring/telemetry.ts` |
| Tests | Jest 30 + ts-jest, 49 suites, all unit-level. Playwright is installed but unused | `jest.config.ts` |
| Hosting | Netlify (`@netlify/plugin-nextjs`). The README says Vercel. No Docker, VPS or reverse-proxy config exists in the repo | `netlify.toml`, `README.md:190` |
| Package manager | **Both** `package-lock.json` (tracked) and `pnpm-lock.yaml` (untracked) | repo root |

Not present: a payment gateway, a public marketing site (`/` redirects to `/dashboard`), Docker, VPS config.

---

## 3. System Architecture

```
Browser ──> Netlify (Next.js server functions)
   │            ├─ src/proxy.ts → updateSession(): refresh cookie, redirect to /login,
   │            │                 coarse admin-path gate using user_metadata.role
   │            ├─ Server Components (src/app/dashboard/(app)/**/page.tsx)
   │            │     └─ user-scoped Supabase client (anon key + cookie JWT) → RLS
   │            │     └─ lib/accounting/engine.ts → SERVICE-ROLE client inside unstable_cache (30 days)
   │            ├─ Server Actions (~45 files, "use server") → user-scoped client, ad-hoc checks
   │            └─ Route Handlers (src/app/api/**) → authenticateApiRoute() (session or CRON_SECRET)
   │                  └─ cron/notify/backup → SERVICE-ROLE client
   └─ Browser Supabase client (search, realtime)
Netlify Scheduled Functions ──(Bearer CRON_SECRET)──> /api/backup, /api/notify/check
```

**Tenant model:** `businesses.owner_id` is the owner. Team members live in `business_users` (`role user_role`). An older, unused `business_members` table also exists. `getBusinessContext()` resolves the owned business first, then membership, then the `get_user_business_role` RPC.

**Business flows, as implemented:**

- **Livestock:** `cattle` (purchase_price, initial_weight_kg, purchase_date) → `weight_logs` → health (`health_events`, `cattle_treatments`, vaccinations) → feed (`inventory_transactions` of type `consumption`, with or without `cattle_id`) → per-animal costs (`cost_entries` with `cattle_id`, type `variable`) → sale (`sales` row + `cattle.status='sold'`) or death (`status='dead'`).
- **Feed:** ingredient purchase (`inventory_transactions` `purchase` with `unit_cost`) → `feed_recipes` / `recipe_ingredients` → batch production (ingredient consumptions + an output "purchase" at FIFO cost) → feed sessions or manual logs (consumption) → per-animal cost via the `get_cattle_consumptions` RPC. **If no feed is logged, an algorithmic estimate is used instead** (`utils/feed-calculator.ts`).
- **Finance:** there are no journal postings for core operations. Statements are **recomputed from operational tables** on every request (`lib/accounting/engine.ts`). Commerce actions write `journal_entries` separately, so a second, parallel ledger exists. The cash balance is a separate computation (`lib/supabase/queries/cash.ts`).
- **Partners, loans, fixed assets, liabilities:** separate tables feed into cash and the balance sheet.

---

## 4. Critical Findings (P0 / P1)

### [P0] SEC-01 Supabase personal access token stored in plaintext and in local git objects
- **Category:** Security / secrets
- **Location:** `Data.txt:1` (untracked, **not** in `.gitignore`). Also present in dozens of local commits under `refs/cline/checkpoints/*` (Cline "untracked files on cline checkpoint" snapshots).
- **Evidence:** the file holds one 44-character token with the `sbp_` prefix, which is Supabase's account-level personal access token format. `main` and `origin/main` do **not** contain it (verified with `git grep` over `git rev-list main`). The project folder is inside OneDrive, so the file is synced to the cloud.
- **Problem:** a PAT grants Management-API control over **every project in the Supabase account**: SQL, keys, deletion. One `git add .` or a push of the checkpoint refs would publish it.
- **Impact:** full takeover of the production database and project.
- **Recommended direction:** revoke the token in Supabase → Account → Access Tokens **now**. Delete `Data.txt`. Delete the `refs/cline/checkpoints/*` refs and run `git gc --prune=now`. Add `Data.txt`, `*.txt` scratch files and `supabase/.temp/` to `.gitignore`. Enable GitHub secret scanning.
- **Dependencies:** none. Do this first.

### [P0 — Needs verification] SEC-02 `business_users` RLS lets any member rewrite their own role or business
- **Category:** Security / RLS / privilege escalation
- **Location:** `supabase/migrations/032_enterprise_identity_organization.sql:184-190`
- **Evidence:** `CREATE POLICY "business_users team isolation" ON business_users FOR ALL USING (business_id IN (…owner…) OR user_id = auth.uid());` There is no `WITH CHECK`, so Postgres reuses `USING` as the check. A member can therefore `UPDATE` their own row's `role` to `'owner'`, or `INSERT` or `UPDATE` a row with `user_id = auth.uid()` and **any** `business_id`. Any client with the public anon key and a valid session can do this directly through PostgREST.
- **Problem:** `getBusinessContext()` trusts `business_users.role` (`business-context.ts:48-49`). `role='owner'` makes `isOwner = true`, which grants all permissions. Every tenant table's RLS (`cattle`, `cost_entries`, …, `032:192-212`) grants access to any `business_id` listed in `business_users` for the caller.
- **Impact:** a worker becomes an owner. Any authenticated user who learns a business UUID can join that tenant. Sign-up is enabled in `config.toml:175` (local; the live setting needs verification), and `handle_new_user` gives every new account a session.
- **Recommended direction:** replace the policy with a `SELECT`-only self policy plus owner/admin-only `INSERT`/`UPDATE`/`DELETE`, each with an explicit `WITH CHECK`. Perform membership changes only through a `SECURITY DEFINER` RPC that verifies the caller is owner/admin. Add a `pg_policies` regression test.
- **Dependencies:** DB-01 (dump live policies first).

### [P0 — Needs verification] SEC-03 Nine tables are created without RLS
- **Category:** Security / RLS
- **Location:** `supabase/migrations/026_livestock_domain_architecture.sql` (lines 5, 21, 39, 52, 71, 90, 113, 128, 142)
- **Evidence:** `farms`, `pens`, `animal_breeds`, `animal_categories`, `disease_records`, `breeding_records`, `cattle_death_records`, `document_attachments` and `livestock_audit_logs` are created with no `ENABLE ROW LEVEL SECURITY` and no policies in any migration (policy map computed over all 44 migrations).
- **Problem:** in Supabase, a public-schema table without RLS is fully readable and writable by the `anon` role through the REST API, using the key shipped in the browser bundle.
- **Impact:** anyone on the internet can read, modify or delete this data, for all tenants.
- **Recommended direction:** confirm with `select relname, relrowsecurity from pg_class where relnamespace='public'::regnamespace`. Enable RLS on every table and add tenant policies. Also add a CI check that fails on any public table with `relrowsecurity = false`.
- **Dependencies:** DB-01.

### [P1] SEC-04 SECURITY DEFINER functions trust caller-supplied IDs
- **Category:** Security / IDOR
- **Location:** `015_enterprise_architecture.sql:51-78` (`get_user_business_role(p_user_id)`), `015:80-140` (`get_finance_summary(p_business_id)`), `032:227-258` (`log_audit(...)`, `revoke_user_sessions(...)`)
- **Evidence:** all four are `SECURITY DEFINER`, bypass RLS, never compare their arguments with `auth.uid()`, and there is no `REVOKE EXECUTE ... FROM anon, public` anywhere in the migrations (the only `GRANT` is for `get_data_quality_report`).
- **Impact:** role and business lookup for any user; forged audit-log rows for any business; revocation of other users' sessions; and, if `get_finance_summary` works in production, any tenant's P&L. As committed, it references `it.inventory_item_id`, which does not exist (`015:118`), so it throws at runtime (see DB-03).
- **Recommended direction:** add `auth.uid()` checks inside each function, `SET search_path = ''`, and `REVOKE EXECUTE ON FUNCTION … FROM anon, public`. Drop `get_finance_summary`, which is unused (the app never calls it).

### [P1] SEC-05 Finance, accounting and report pages depend on a spoofable middleware hint
- **Category:** Security / RBAC
- **Location:** `src/lib/supabase/middleware.ts:97-117`; pages `finance/page.tsx`, `accounting/*.tsx`, `report/page.tsx`, `partners/page.tsx` (0 role checks each); `src/lib/accounting/engine.ts:162-165`
- **Evidence:** the middleware reads `user.user_metadata.role`. Users can change `user_metadata` themselves through `supabase.auth.updateUser({ data })`. A **missing** role passes ("Owners have no role metadata — they pass through"). The pages themselves never check role. Accounting data is fetched with the **service-role key**, so RLS provides no backstop.
- **Impact:** a worker can see the full P&L, balance sheet, partner capital and loans by clearing or changing their metadata. Combined with SEC-07 (the Next.js proxy-bypass advisory), the middleware gate may be skippable altogether.
- **Recommended direction:** enforce `requirePermission(ctx, FINANCE_VIEW / ACCOUNTING_VIEW / …)` in each page or in a shared server layout. Stop reading `user_metadata` for authorization. Store roles in `app_metadata` (not user-writable) or read them from the database.

### [P1] SEC-06 About half the server-action files do not check permissions
- **Category:** Security / RBAC
- **Location:** permission-check count of 0 in: `cattle/actions.ts` (11 exported functions, including `deleteCattle` at :300, `markAsDeceased` at :214, `undoMarkAsDeceased` at :265 and `updateCattle`), `settings/trash/actions.ts` (`permanentlyDelete` at :72, which **hard-deletes** cost entries), `inventory/actions.ts` (14), `inventory/recipe-actions.ts` (12), `health/actions.ts` (8), `cattle/bulk-actions.ts`, `cattle/lifecycle-actions.ts`, `cattle/medical-actions.ts`, `cattle/vaccination-actions.ts`, `cattle/pens/actions.ts`, `cattle/[id]/health-actions.ts`, `cattle/[id]/photo-actions.ts`, `vendors/actions.ts`, `inventory/purchase/history/actions.ts`, `market-price-actions.ts`, `finance/statement-action.ts`, `global-actions.ts`, `advisor-actions.ts`.
- **Evidence:** these files check only that the row's `business_id` matches the caller's business. A permission wrapper already exists, `createProtectedAction` in `src/lib/auth/action-pipeline.ts:36`, but **no file uses it**.
- **Impact:** a `viewer` or `worker` can delete animals, rewrite purchase prices, permanently delete financial records, or reverse deaths. The RLS policies for members are `FOR ALL` (`032`), so the same actions are also possible directly through PostgREST.
- **Recommended direction:** move every action onto `createProtectedAction` (or one equivalent) with an explicit permission. Tighten RLS so writes to financial tables need a role (see SEC-02).

### [P1] SEC-07 Next.js 16.2.7 has a critical proxy/middleware-bypass advisory
- **Category:** Security / dependencies
- **Location:** `package.json` (`"next": "16.2.7"`)
- **Evidence:** `npm audit` reports critical "Middleware / Proxy bypass in App Router applications using Turbopack and single locale", fixed in `next@16.3.6`. There are 17 advisories in total (1 critical, 9 high, 5 moderate, 2 low), including `@serwist/next` (high; the fix is a major-version change), `postcss`, `sharp`, `fast-uri`, `ip-address` and `js-yaml`.
- **Impact:** the auth redirect in `proxy.ts` is the only gate for several pages (SEC-05).
- **Recommended direction:** upgrade `next` and `eslint-config-next` to `16.3.6` (a patch-level change within 16.x), run the full verification, and treat the `@serwist/next` major upgrade separately.

### [P1] SEC-08 Team-invite redirect points at a guessed `vercel.app` host
- **Category:** Security / auth flow
- **Location:** `src/app/dashboard/(app)/settings/team/actions.ts:41`
- **Evidence:** `redirectTo: NEXT_PUBLIC_SUPABASE_URL.replace("supabase.co", "vercel.app") + "/auth/callback"`. This produces `https://<project-ref>.vercel.app/auth/callback`, but the app runs on Netlify.
- **Impact:** if that host is in Supabase's redirect allowlist (**needs verification**), invite tokens go to a domain someone else could claim, which means account takeover of invitees. If it is not in the allowlist, invites fall back to `site_url`, and the flow is broken anyway (see DB-07).
- **Recommended direction:** use `NEXT_PUBLIC_APP_URL`. Audit the Supabase Auth → URL configuration.

### [P1] DB-01 Migrations, types and production have drifted apart
- **Category:** Database / process
- **Evidence:**
  - Production has policies created outside migrations (admitted in `20260616234914_journal_lines_rls.sql:8-11`).
  - Migrations `026`–`032` and `20260912` are **untracked** in git.
  - The code queries tables that no migration creates: `cattle_sales` (`cattle/lifecycle-actions.ts:287`), `financial_transactions` (`api/ai/nl-query/route.ts:28`), `orders` (`lib/analytics/aggregation-service.ts:88`), `management_fee_rates` (settings and partners, 9 call sites).
  - `src/types/database.ts` is hand-written, not generated. It declares `UserRole` values `veterinarian | staff | viewer` and `CattleStatus` values `quarantined | culled | archived`, but the DB enums are `user_role ('owner','manager','worker')` (`001:11`) and `cattle_status (active, sold, dead, stolen)` (`001:12`, `014:6`).
  - Code roles `admin`, `viewer`, `veterinarian` and `staff` cannot be stored in `business_users.role`.
  - Two migration naming schemes (`NNN_` and timestamps) are mixed.
- **Impact:** nobody can say what production looks like. New migrations may fail or silently diverge. Role-based features for four of the seven roles cannot work.
- **Recommended direction:** `supabase db dump --schema-only` from production → commit it as a baseline → generate types with `supabase gen types` → reconcile, then enforce "all schema changes via committed migrations".

### [P1] DB-07 — Needs verification: team-member onboarding is broken by design
- **Category:** Bug / auth / tenant model
- **Location:** `supabase/migrations/023_auto_create_business.sql:6-33`; `settings/team/actions.ts:39-53`; `business-context.ts:29-57`; RLS on `businesses` is owner-only (`001:109-110`)
- **Evidence:**
  - `handle_new_user` creates a **new business owned by every new auth user**, including users created by `inviteUserByEmail`, and names it "Chowdhury Agro" by default.
  - `getBusinessContext()` looks for an owned business **first**, so an invited worker resolves to their own empty business, not the employer's.
  - Even without the trigger, a member cannot `SELECT` from `businesses` (owner-only policy), so `getBusinessContext()` would throw `NotFoundError`.
- **Impact:** multi-user operation (owner + manager + workers) cannot work as intended. Either the farm runs on the owner's account only, or production differs from the migrations (DB-01).
- **Recommended direction:** decide on the tenancy model. For a single farm with staff: invite-only sign-up, no auto-business for invited users, a member `SELECT` policy on `businesses`, and deterministic business selection.

### [P1] BUG-01 Silent 1000-row truncation in every aggregate
- **Category:** Bug / data correctness / performance
- **Location:** `supabase/config.toml:18` (`max_rows = 1000`). There are **241** `.from(...)` call sites on high-volume tables (`inventory_transactions`, `weight_logs`, `cost_entries`, `sales`, `partner_transactions`, `journal_entries`) and **zero** uses of `.range()` in `src/`.
- **Evidence:**
  - `lib/supabase/queries/cash.ts:36-98`: the cash balance sums all capital, sales, cattle, inventory purchases and costs.
  - `lib/accounting/engine.ts:172-188`: all statements.
  - `api/cron/daily-alerts/route.ts:28-34`: stock computed from all transactions.
  - `inventory/recipe-actions.ts:199-204`: FIFO stock and cost.
  - `cattle/page.tsx:106-113`: per-head feed cost.
  - `api/backup/backup-helpers.ts:88-93`: backups.
- **Impact:** once any table passes 1000 rows (daily feed logs reach this within months), the cash balance, stock levels, FIFO costs, statements and backups become silently wrong, with no error. The live `max_rows` value needs verification (the local config is 1000, which is also the Supabase default).
- **Recommended direction:** move aggregations into SQL (views and RPCs returning sums) and paginate true listings. Add a helper that fails loudly if a result equals the cap.

### [P1] BUG-02 Estimated feed cost is booked as realized cost
- **Category:** Bug / financial correctness
- **Location:** `lib/supabase/queries/dashboard.ts:160-180`; `lib/accounting/engine.ts:308-337, 404-405, 549-553, 834-836`
- **Evidence:** when an animal has no logged feed (`feedCostByCattle[id] === 0`), the code computes `calculateAlgorithmicFeedCost(...)` from **current** unit prices (the latest 300 purchases, `engine.ts:186`) and an assumed average daily gain. That estimate is then capitalized into livestock, flows into COGS, is subtracted from inventory value (`Math.max(0, …)`, which hides imbalances), and appears as dashboard "Net P/L".
- **Problem:** estimated, market and historical values are mixed in the official books. The income statement and balance sheet are not reproducible, because they change when purchase prices change. Farm-level feed (consumption without a `cattle_id`) is expensed separately, so feed can be counted twice: once as an unallocated expense and again as an estimate on animals with no logs.
- **Recommended direction:** keep estimates in a clearly labeled "projection" layer. The books should use only recorded transactions, with explicit allocation postings (farm-level feed → animals) stored as data.

### [P1] BUG-03 Sale and sale-reversal are not atomic, and reversal hard-deletes history
- **Category:** Bug / financial integrity
- **Location:** `src/app/dashboard/(app)/cattle/[id]/actions.ts:104-119` (recordSale), `:150-154` (revertSale)
- **Evidence:** the `sales` insert and the `cattle.status='sold'` update are two separate requests. A failure between them leaves a sale on an "active" animal. There is no unique constraint on `sales.cattle_id` (none in any migration), and eligibility is checked before the insert without a lock, so concurrent submissions can create two sales. `revertSale` runs `DELETE FROM sales WHERE cattle_id = …` (all sales, a hard delete), **skips `checkFinancialLock`**, and records no reason. Atomic RPCs `sell_cattle` / `revert_cattle_sale` (soft delete with a reason) exist in `20260618_acid_transactions.sql` but are **never called**.
- **Impact:** duplicate revenue, sales reversed inside locked periods, and lost audit trail.
- **Recommended direction:** call the RPCs (add `business_id` and lock checks inside them). Add a partial unique index on `sales(cattle_id) WHERE deleted_at IS NULL`.

### [P1] BUG-04 Consumption rows recorded at zero cost
- **Category:** Bug / costing
- **Location:** consumption inserts with no `unit_cost`: `cattle/[id]/actions.ts:238` and `:274` (manual per-cow feed), `cattle/vaccination-actions.ts:67` and `:212` (vaccine stock), `cattle/feed-waste-actions.ts:129`, `lib/offlineQueue.ts:23`. For comparison, `feed-session-actions.ts`, `medical-actions.ts` and `inventory/actions.ts` do set it.
- **Evidence:** `get_cattle_consumptions` sums `qty * COALESCE(unit_cost, 0)` (`20260611203700_finance_rpcs.sql`). The accounting engine does the same (`engine.ts:398-402`).
- **Impact:** feed, waste and vaccine costs disappear from per-animal cost and P&L, and inventory value is overstated. This also *triggers* BUG-02: zero logged feed activates the estimate.
- **Recommended direction:** value every consumption through one costing function (FIFO or weighted average, chosen and documented) at insert time, ideally in a DB function.

### [P1] BUG-05 Official statements served from a 30-day cache that is not always invalidated
- **Category:** Bug / staleness
- **Location:** `lib/accounting/engine.ts:157-225` (`unstable_cache`, `revalidate: 30 days`, tag `accounting`). Writers that never call `revalidateTag("accounting")`: `cattle/wizard-actions.ts` (the primary add-animal path), `cattle/feed-session-actions.ts`, `cattle/feed-waste-actions.ts`, `cattle/bulk-actions.ts`, and `deleteCattle` (`cattle/actions.ts:300-322`).
- **Impact:** the balance sheet and income statement omit new animals, feed and deletions until some other action clears the tag. They also disagree with the (uncached) dashboard cash card.
- **Recommended direction:** centralize invalidation in the action pipeline (the tag list is already supported at `action-pipeline.ts:98`), or drop the long-lived cache once aggregation moves into SQL.

### [P1] BUG-06 Backups are incomplete, and the manual backup drops sales
- **Category:** Bug / data safety
- **Location:** `src/app/api/backup/route.ts:38`; `src/app/api/backup/backup-helpers.ts:88-93`
- **Evidence:**
  - The user backup filters `sales` with `.eq("cattle.business_id", …)` without embedding `cattle`. PostgREST rejects this, the error is ignored, and the backup returns `sales: []`.
  - The weekly cron backup exports only 6 tables (cattle, sales, cost_entries, weight_logs, inventory_items, inventory_transactions), each capped at 1000 rows (BUG-01), with no tenant filter.
  - Partners, capital, loans, fixed assets, liabilities, health, treatments, breeding, commerce and settings are **not backed up**.
- **Impact:** false confidence in a backup that cannot restore the business.
- **Recommended direction:** rely on Supabase PITR or daily backups (**verify the plan**), plus a scheduled `pg_dump` to off-site storage. Keep the CSV export as a convenience feature only.

### [P1] ARCH-01 Parallel implementations of core logic
- **Category:** Architecture
- **Evidence:**
  - "Profit" is computed independently in at least `lib/accounting/engine.ts`, `lib/supabase/queries/dashboard.ts`, `lib/supabase/queries/analytics.ts`, `lib/financial/profitability-engine.ts`, `lib/reports/report-engine.ts`, `lib/analytics/kpi-engine.ts`, `components/finance/PLSummary.tsx`, `app/dashboard/(app)/finance/page.tsx` and `advisor-actions.ts`.
  - Business resolution is implemented four ways: `getBusinessContext`, `getCurrentBusinessId`, a local `getBizId` (`recipe-actions.ts:170`), and an inline owner/member lookup (`engine.ts:241-270`).
  - There are two growth engines (`lib/growth/growth-engine.ts`, which is unused, and `lib/livestock/growth-engine.ts`), two workflow engines (`lib/workflows`, `lib/workflow-engine`), two membership tables, and two ledgers (`journal_entries`, written only by commerce actions, versus the recomputed statements).
  - Seven component names are duplicated across folders (`ErrorBoundary`, `PageHeader`, `StatCard`, `PrintButton`, `CurrencyInput`, `FormField`, `ActivityTimeline`).
- **Impact:** screens disagree with each other, and every fix has to be repeated in several places.
- **Recommended direction:** one financial read model (SQL views/RPCs) with one TypeScript facade, one business-context resolver, and deletion of unused engines once they are proven dead.

### [P1] TEST-01 Tests do not cover the code that produces users' numbers
- **Category:** Testing
- **Evidence:**
  - `jest` gives 49 suites and 347 tests, with 1 failure (`health-medical-engine.test.ts:150`, expected ≥ 2 alerts, received 1).
  - No test imports `lib/accounting/engine.ts`, `lib/supabase/queries/{cash,dashboard,analytics,valuation}.ts`, `utils/feed-calculator.ts` or any server action.
  - Several tested modules have **no production consumer**: `lib/financial/ledger`, `lib/governance/engine`, `lib/governance/reconciliation-engine`, `lib/growth/growth-engine`, `lib/inventory/batch-engine`, `lib/inventory/reservation-engine`.
  - There are no RLS or authorization tests, and no end-to-end tests.
  - `next.config.ts:15-17` has `ignoreBuildErrors: true`. ESLint disables `no-explicit-any` and `no-unused-vars`.
  - `.github/workflows/ci.yml` is **untracked**, so CI has never run.
- **Recommended direction:** see the remediation plan, Phase 0 and Phase 8.

### [P1] DEPLOY-01 Deployed code and repository state are unknown
- **Category:** Deployment
- **Evidence:** 216 modified and 263 untracked files, including migrations, the CI workflow and 40+ test files. The last commit is 2026-08-29. Netlify builds from the connected repository (**needs verification**: branch and whether production is at `6336805`). There is no migration step in any pipeline. The README describes a Vercel deployment and a nonexistent `.env.local.example`.
- **Impact:** nothing can be rolled back or reproduced, and schema and code may be deployed out of sync.
- **Recommended direction:** Phase 0: back up the working tree, commit it in reviewed logical chunks on a branch, and record which commit and which migrations are live.

---

## 5. Bugs (confirmed from code)

| ID | Pri | Bug | Location |
|---|---|---|---|
| BUG-01 | P1 | 1000-row truncation of aggregates | see §4 |
| BUG-02 | P1 | Estimated feed cost booked as actual | see §4 |
| BUG-03 | P1 | Non-atomic sale; reversal hard-deletes and ignores the lock | `cattle/[id]/actions.ts:104-154` |
| BUG-04 | P1 | Zero-cost consumptions | see §4 |
| BUG-05 | P1 | Stale 30-day accounting cache | see §4 |
| BUG-06 | P1 | Backup drops sales; cron backup incomplete | see §4 |
| BUG-07 | P2 | Dashboard `totalCattle` is always 0: it reads `.length` of a `head: true` count query, so `data` is null. The hero falls back to the valuation count, but `cattleTrend` in `dashboard.service.ts` compares 0 with the previous period | `lib/supabase/queries/dashboard.ts:65-69, 187` |
| BUG-08 | P2 | "Today" derived in UTC in **229** places (`toISOString().slice(0,10)` and similar). Only 20 references to a timezone. From 00:00 to 05:59 Asia/Dhaka, which is prime feeding time, records land on the previous day | repo-wide, e.g. `cattle/[id]/actions.ts:278`, `cattle/page.tsx:78` |
| BUG-09 | P2 | AI NL-query reads a nonexistent table (`financial_transactions`) and nonexistent columns (`current_stock`, `reorder_threshold`, `purchase_weight_kg`, `scheduled_at`) through `as any`. Errors are dropped, so answers are based on empty data | `api/ai/nl-query/route.ts:26-31` |
| BUG-10 | P2 | AI automation proposals live in a static in-memory `Map`, so they are lost between serverless invocations. `approveAndExecute(proposalId)` does not check `businessId` | `lib/ai/automation-engine.ts:8, 47` |
| BUG-11 | P2 | `deleteWeightLog` checks ownership of `cattleId` but deletes by `logId` alone, as a hard delete, even though `weight_logs.deleted_at` exists and the trash UI restores weight logs | `cattle/[id]/actions.ts:176-178` |
| BUG-12 | P2 | Cash balance counts `purchase_price` of **soft-deleted** cattle as an outflow but excludes their sales. Any of its 10 queries failing is silently treated as 0 | `lib/supabase/queries/cash.ts:49-59` |
| BUG-13 | P2 — Needs verification | The middleware forces `httpOnly` on refreshed Supabase auth cookies. The browser client (`GlobalCommandSearch`, `CommandPalette`, `SearchBox`, `RealtimeRefresher`) reads the session from `document.cookie`, so search and realtime likely stop working after the first token refresh | `lib/supabase/middleware.ts:56-64` |
| BUG-14 | P2 | Stock guard trigger ignores negative-quantity purchase rows ("true-up" adjustments) and takes no lock, so concurrent consumptions can overdraw | `20260626_fix_stock_guard_trigger.sql:20-27` |
| BUG-15 | P2 | Batch production is not atomic: ingredients are consumed before the output insert, and a failure loses stock. Without an output item selected, ingredient cost disappears | `inventory/recipe-actions.ts:219-260` |
| BUG-16 | P2 | `lifecycle-actions.ts` queries `cattle_sales` with a `business_id` column; that table exists in no migration | `cattle/lifecycle-actions.ts:287-290` |
| BUG-17 | P3 | "Go to Onboarding" links to `/onboarding`, which has no route | `app/dashboard/(app)/page.tsx:44` |
| BUG-18 | P3 | **FIXED 28bc895.** Typecheck error: missing keys in a `Record<…>` literal (hidden by `ignoreBuildErrors`) | `components/finance/TransactionStatement.tsx:9` |
| BUG-19 | P3 | **FIXED 28bc895 (fixture dates had expired).** Failing unit test (overdue vaccine and withdrawal alert count) | `src/__tests__/health-medical-engine.test.ts:150` |
| BUG-20 | P3 | A literal U+FFFD (`�`) character in page titles and messages | `(auth)/login/page.tsx:5`, `forgot-password/page.tsx`, `reset-password/page.tsx`, `global-error.tsx`, `api/cron/daily-alerts/route.ts` |
| BUG-22 | P2 | Service worker never rebuilt: Serwist does not support Turbopack (the Next 16 default build), so `public/sw.js` (last committed 2026-07-19) is stale in production | `next.config.ts:5-9`, `public/sw.js` |
| BUG-21 | P3 | Login ignores the `redirectTo` query parameter that the middleware sets | `(auth)/login/actions.ts:38` vs `middleware.ts:82` |

---

## 6. Security Findings

| ID | Pri | Finding | Location |
|---|---|---|---|
| SEC-01 | P0 | Supabase PAT in plaintext and in local git refs | `Data.txt`, `refs/cline/checkpoints/*` |
| SEC-02 | P0 (verify) | Self-editable `business_users` rows (role and tenant escalation) | `032:184-190` |
| SEC-03 | P0 (verify) | 9 tables without RLS | `026` |
| SEC-04 | P1 | SECURITY DEFINER functions with caller-supplied IDs | `015`, `032` |
| SEC-05 | P1 | Finance and accounting pages gated only by `user_metadata.role`; service-role data access | `middleware.ts:97-117`, `engine.ts:162` |
| SEC-06 | P1 | ~20 action files with no permission checks; `permanentlyDelete` hard-deletes finance rows | see §4 |
| SEC-07 | P1 | Next.js critical advisory plus 16 more | `package.json` |
| SEC-08 | P1 | Invite `redirectTo` goes to a `*.vercel.app` host | `team/actions.ts:41` |
| SEC-09 | P2 | Open redirect: `${origin}${next}` with unvalidated `next`. `next=@evil.com` produces `https://host@evil.com` | `app/auth/callback/route.ts:9, 32` |
| SEC-10 | P2 | `profiles` `SELECT USING (true)` (all names and phones readable with the anon key). Storage `avatars`/`logos` `UPDATE` allowed for any authenticated user on any object | `006:19-21, 78-93` |
| SEC-11 | P2 | `updateMemberRole(memberId, role: UserRole)` does not validate `role`, so an admin can grant `owner` | `team/actions.ts:62-81` |
| SEC-12 | P2 | Rate limiter is in-memory per serverless instance, keyed on a client-controlled `X-Forwarded-For`, and all API routes share one `api:${ip}` bucket | `lib/rate-limit.ts`, `lib/security.ts:21-28`, `api-guard.ts:38-40` |
| SEC-13 | P2 | Cron paths without `CRON_BUSINESS_ID` read **all tenants** with the service role and send one combined WhatsApp or email. Any user with `SETTINGS_VIEW` (managers) can trigger `/api/cron/daily-alerts` and `/api/notify/check` without a rate limit, spamming WhatsApp | `api/cron/daily-alerts/route.ts:10-34`, `api/notify/check/route.ts:19-38` |
| SEC-14 | P3 | Raw `error.message` returned to clients from API routes and actions (DB and internal details); Forbidden messages disclose role names | e.g. `api/ai/*`, `api-guard.ts:85-97` |
| SEC-15 | P3 | QR route sends `Cache-Control: public, s-maxage=86400` on an authenticated response and builds its URL from `x-forwarded-host` | `api/qr/[id]/route.ts:34-52` |
| SEC-16 | P3 | `minimum_password_length = 6` and `enable_confirmations = false` in the local auth config; live settings need verification | `supabase/config.toml:181, 225` |

**Checked and found acceptable:**

- The CI workflow's JWTs are mock values (empty payload, not the project's keys).
- `main` and `origin/main` contain no secrets.
- The cron bearer check is timing-safe.
- `api/*` is excluded from the session proxy on purpose, and each route calls `authenticateApiRoute`.
- The settings actions are owner-scoped (`.eq("owner_id", user.id)`).
- Security headers (HSTS, XFO, nosniff, COOP) are set.
- The robots config is `noindex`.

---

## 7. Database Findings

| ID | Pri | Finding |
|---|---|---|
| DB-01 | P1 | Schema drift across migrations, git, generated types and production (see §4) |
| DB-02 | P2 | Duplicate membership tables: `business_members` (004, never used in code) vs `business_users` (015) |
| DB-03 | P1 | `get_finance_summary` references the nonexistent `it.inventory_item_id` (`015:118`); broken and unused, so drop it |
| DB-04 | P1 | No uniqueness guard on sales per animal; the atomic RPCs are unused (see BUG-03) |
| DB-05 | P2 | Inconsistent tenant keys: `weight_logs`, `sales` and `inventory_transactions` have no `business_id`, so every policy and query needs a join. This drives complex `!inner` filters and was the root cause of BUG-06 |
| DB-06 | P2 | Two accounting models: `journal_entries`/`journal_lines` (005; `journal_lines` has RLS **with no policy** in migrations, so it relies on a live-only policy) plus unused `animal_financial_ledgers`, `cost_allocations`, `financial_budgets` and `cost_centers` (030), while statements are recomputed from raw tables |
| DB-07 | P1 | The auto-create-business trigger conflicts with team invites; `businesses` is owner-only (see §4) |
| DB-08 | P2 | Soft-delete is inconsistent: `deleted_at` exists on cattle, cost_entries, weight_logs, sales and inventory_items, but deletes are sometimes hard (`revertSale`, `deleteWeightLog`, `permanentlyDelete`, `removeMember`); `deleteLoan` is correctly soft. No `ON DELETE` review has been done: `cattle` → `weight_logs` is `CASCADE`, `sales` is `RESTRICT` |
| DB-09 | P2 | Missing indexes to verify for hot paths: `inventory_transactions(item_id, type, recorded_at)`, `inventory_transactions(cattle_id)`, `weight_logs(cattle_id, recorded_at desc)` (008 adds some; confirm with `pg_indexes`) |
| DB-10 | P3 | Tables defined but never referenced by code: `analytics_alert_rules`, `analytics_dashboards`, `analytics_snapshots`, `analytics_widgets`, `animal_breeds`, `animal_categories`, `animal_financial_ledgers`, `api_keys`, `cost_centers`, `document_attachments`, `financial_budgets` |

---

## 8. API Findings

- **Inconsistent response shapes.** Some routes return `{ ok: false, error }`, some `{ error }`, some `{ success: true, … }`, and QR returns plain text. There is no request ID. Errors return raw messages (SEC-14).
- **Input validation.** API route bodies are destructured without schema validation (`api/ai/automation/route.ts:85-97`, `identity/*`). Most server actions use manual `parseFloat` checks rather than the existing zod schemas (`recordSale`, `cattle/[id]/actions.ts:85-96`).
- **Idempotency.** Mutations have no idempotency keys. Double submits of sales, purchases or payments rely on UI disabling (see BUG-03). The offline queue (`lib/offlineQueue.ts`) replays inserts without a dedupe key.
- **Service-role use in request paths.** `lib/accounting/engine.ts`, `settings/team/actions.ts`, `api/cron/*`, `api/notify/check` and `api/backup` all bypass RLS, so correctness depends entirely on manual `business_id` filters.
- **Duplicated action surface.** `commerce/actions.ts` only re-exports `order-`, `payment-`, `logistics-` and `ownership-actions.ts`, which gives two import paths for the same actions.
- **`/api/cron/daily-alerts`** has no scheduler (only `backup` and `notify/check` are scheduled). It is dead or duplicate code.

---

## 9. Frontend Findings

- **Oversized components:** `VaccinationPlatformWorkspace.tsx` (1353 lines), `cattle/[id]/page.tsx` (1190 lines, 32 queries), `PartnerProfileClient.tsx` (1062), `HealthWorkspace.tsx` (807), `EnterpriseDecisionIntelligenceHub.tsx` (769), `settings/page.tsx` (822), `finance/page.tsx` (672, 18 queries).
- **ESLint (`eslint src`)** reports 16 errors and 26 warnings:
  - `react-hooks/purity` (`Date.now` during render in `LivestockWorkspace.tsx:103`)
  - `react-hooks/set-state-in-effect` (`dashboard/engine/PersonalizationContext.tsx:53`)
  - `react-hooks/refs` ×10, `exhaustive-deps` ×8
  - 11 stale `eslint-disable` directives
  - 66 `eslint-disable` comments in total.
- **Type safety:** 234 `as any`, 220 `: any`, 24 `as unknown as`, 1 `@ts-*` directive. Supabase calls often go through `(supabase as any)`, which is how the missing-table bugs (BUG-09, BUG-16) got past the compiler.
- **Silent failures:** 14 `.catch(() => {})` and 16 empty `catch {}` blocks. For example, `LivestockEventBus.publish(...).catch(() => {})` in every livestock action, and the dashboard analytics fallback at `page.tsx:62`.
- **Duplicated UI primitives:** see ARCH-01.
- **Accessibility (static signals only):** 18 `size="icon"` buttons without `aria-label`, 7 clickable `<div onClick>` elements without a role, 3 `window.confirm`/`alert` calls. 20 components do use the shared `ConfirmDialog`. **Needs verification:** keyboard, focus and contrast checks in a browser.
- **i18n:** a rough heuristic finds about 164 hard-coded English JSX strings against about 174 dictionary lookups, so Bangla coverage is partial. **Needs verification.**
- **Responsive design:** not verified in a browser (no credentials were used, and the app is fully auth-gated). The code uses mobile bottom nav and card views (`CattleCards`, `DataGridCardView`). **Needs verification** on 360 px, 768 px, 1280 px and 1920 px viewports.

---

## 10. Performance Findings

- **Unbounded full-table reads computed in JavaScript on every request:** cash balance (10 queries), dashboard (19 queries in `queries/dashboard.ts` plus 24 in `queries/analytics.ts`, plus `AnalyticsAggregationService` again at `page.tsx:60`), and the cattle list (all animals, all weight logs, all feed consumptions).
- **Large `.in("cattle_id", activeIds)` filters:** PostgREST puts these in the URL, so with a few hundred active animals the request line can exceed limits (**needs verification**).
- **Dashboard duplication:** the dashboard computes P&L three times (`getDashboardStats`, `getMonthlyRevenueVsCost`, `getPreviousPeriodStats`) plus the analytics pipeline.
- **`revalidate = 0` on the dashboard** means no caching, while the accounting pages use a 30-day cache. The caching strategy is inconsistent.
- **In-memory state** (telemetry, rate limits, AI proposals) does nothing on serverless and grows memory on warm instances.
- **Recommended direction:** SQL aggregation RPCs and views, pagination, and a single dashboard read model.

---

## 11. Testing Findings

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **1 error** (`TransactionStatement.tsx:9`). Builds ignore it (`ignoreBuildErrors: true`) |
| `npx eslint src` | **16 errors, 26 warnings** (exit 1). `npm run lint` runs `eslint` with no path |
| `npx jest --runInBand` | **346 / 347 passed**, 1 failed (`health-medical-engine`), 9.7 s |
| `npm run build` | **Not run.** It would need production env values; run it in Phase 0 against a non-production project |
| E2E | None (Playwright installed, unused) |
| RLS and authorization tests | None |
| Financial golden tests | None for `accounting/engine.ts`, `queries/cash.ts` or `feed-calculator.ts` |
| CI | `.github/workflows/ci.yml` exists but is **untracked**, so it has never run. It uses `npm ci` while an untracked `pnpm-lock.yaml` also exists |

**Conclusion:** there is no reliable verification gate. This is a **major engineering gap**.

---

## 12. Deployment Findings

- **Platform:** Netlify with `@netlify/plugin-nextjs`. There is **no Docker or VPS configuration** in the repo, so "Docker/VPS" in the brief does not apply unless it exists outside the repo (**needs verification**).
- **Lockfiles:** `package-lock.json` is tracked and `pnpm-lock.yaml`/`pnpm-workspace.yaml` are untracked. Netlify picks a package manager based on lockfiles (**needs verification** of which one production uses).
- **Node version:** Node 20 pinned in `netlify.toml`, Node 24 used locally.
- **No migration automation.** Migrations are applied manually (the file headers say "Run in Supabase SQL Editor"), which is the root cause of DB-01.
- **Scheduled functions** depend on `URL` and `CRON_SECRET`. Their results are only logged, so a failure goes unnoticed.
- **Backups:** see BUG-06. Supabase platform backups and PITR status need verification.
- **Monitoring:** Sentry is optional (DSN commented out locally; production status unknown). `/api/operations/health` reports in-memory telemetry only.
- **Repo hygiene:**
  - `dev.log` (135 KB), `lint-report.txt`, `temp.txt` (a UTF-16 code dump), `Data.txt` and `tsconfig.tsbuildinfo` (1 MB) sit in the root.
  - `supabase/.temp/*` is tracked. It holds the project ref and pooler host; no password.
  - There is no `.gitattributes`, and git warns about CRLF on 200+ files.
  - `.vscode/settings.json` auto-approves a command for a different path (`d:\Final Website\Tanvir Agro`).

---

## 13. Technical Debt Register

| Level | Debt | Why it exists | Impact | Risk if left | Complexity | Depends on |
|---|---|---|---|---|---|---|
| CRITICAL | RLS and RBAC not enforced consistently (SEC-02/03/04/05/06) | Features added in phases without a central auth layer | Data exposure and tampering | Breach, fraud | M | DB-01 |
| CRITICAL | Schema drift and untracked migrations (DB-01) | Manual SQL-editor changes | Nothing is reproducible | Failed deploys, silent divergence | M | none |
| HIGH | Aggregations in JS with a row cap (BUG-01) | Quick client-side sums | Wrong money figures at scale | Bad business decisions | L | DB-01 |
| HIGH | Estimate/actual mixing, 8 P&L paths (BUG-02, ARCH-01) | Each "phase" added its own engine | Inconsistent reports | Loss of trust in numbers | L | BUG-01 |
| HIGH | Non-atomic multi-step writes (BUG-03, BUG-15) | Client-orchestrated writes | Partial or double records | Financial integrity | M | none |
| HIGH | No meaningful test or CI gate (TEST-01) | Tests written against unused engines | Regressions ship | Every change is risky | M | none |
| MEDIUM | 454 `any` usages, `ignoreBuildErrors`, hand-written DB types | Speed over safety | Missing-table bugs compile | Silent breakage | M | DB-01 |
| MEDIUM | UTC date handling (BUG-08) | `toISOString()` shortcut | Wrong-day records | Feed and lock errors | M | none |
| MEDIUM | Dead "enterprise" modules and duplicate components | AI-generated scaffolding | ~20–30% of the code is not on user paths (estimate) | Maintenance drag | M | TEST-01 |
| LOW | Branding leftovers ("Chowdhury Agro", `caagro.netlify.app`, 46 references) | Template reuse | User confusion; emails may fail (unverified sending domain) | Brand trust | S | none |
| LOW | Repo hygiene, CRLF, stray files | No conventions | Noise, accidental commits | Secret leakage (see SEC-01) | S | none |

---

## 14. UX Problems (grounded in code)

1. **Wrong brand on entry points.** The login, forgot-password and reset-password pages, the `<title>`, Twitter metadata, backup emails and the default business name all say "Chowdhury Agro ERP" (`(auth)/login/page.tsx:5, 28`; `app/layout.tsx:42, 53`; `backup-helpers.ts:34, 139`; `023:26`).
2. **Information-architecture sprawl.** There are 68 dashboard routes with overlapping modules: `cattle/health` vs `health/*`; `cattle/breeding` vs `breeding/*`; `cattle/vaccinations` vs `health/vaccinations`; finance vs accounting vs report vs commerce vs partners. An operator looking for "record a vaccination" or "see profit" has several competing places to go.
3. **The same number differs by screen.** Dashboard Net P/L (estimate-based, sold animals only), accounting income statement (cached up to 30 days), cash card (uncached, soft-delete asymmetry) and the finance page (its own computation) can all disagree (BUG-02, BUG-05, BUG-12).
4. **Dead ends.** The "Go to Onboarding" link returns a 404 (BUG-17). Login drops the page the user was trying to reach (BUG-21). Invited team members land in an empty business (DB-07).
5. **Early-morning work is recorded on the wrong day** (BUG-08).
6. **Destructive actions:** "Undo sale" silently deletes all sale records and works even in locked periods (BUG-03). Three places use native `confirm()` instead of `ConfirmDialog`.
7. **Needs verification in a browser:** clicks per daily task (add animal through the 8-step wizard, weigh, feed session, sell), mobile table overflow and modal overflow.

---

## 15. Architecture Problems

- **Business logic is not centralized.** Calculations live in pages, components (`PLSummary.tsx`), actions, `lib/supabase/queries/*` and `lib/**/engine.ts`, each duplicated in places (ARCH-01).
- **No enforced action or route layer.** `createProtectedAction` exists but is unused. Every action rebuilds auth, validation, lock checks and revalidation by hand, inconsistently.
- **Database access leaks into UI modules.** Server Components issue 18–32 queries each.
- **Financial locks exist but are optional** (`checkFinancialLock` is called in some writers and missing from `revertSale`, `permanentlyDelete`, `markAsDeceased` and others).
- **Scalability:** fine for one farm at small scale; it breaks at the row cap (BUG-01) long before compute becomes a limit.
- **Verdict:** the architecture is **maintainable, and a rewrite is not justified**. What is missing is (1) a single authorization and action pipeline, (2) a single SQL-backed financial read model, and (3) schema-as-code discipline.

---

## 16. Positive Findings

- Strict TypeScript, and the typecheck is almost clean (1 error across about 135k lines).
- A clear, centralized permission matrix (`constants/roles.ts`) and a solid `getBusinessContext()` resolver (request-memoized), ready to be enforced everywhere.
- `assertResourceOwnership()` tenant checks are used in the newer actions (e.g. `cattle/[id]/actions.ts`).
- A financial-lock concept (`financial_locks`, `checkFinancialLock`) is already modeled.
- Soft-delete plus a trash/restore UI for key entities.
- A DB-level negative-stock trigger, and ACID sale RPCs already written, ready to wire up.
- The API guard has timing-safe cron auth. The proxy correctly excludes `/api/*`. Security headers are configured. Sentry scrubbing and `noindex` are in place.
- Per-route `loading.tsx` and `error.tsx` boundaries, a shared `ConfirmDialog`, a Bangla/English i18n scaffold, and a PWA/offline banner fit a farm-field context.
- 346 passing unit tests. The engines that *are* used (FIFO costing, loan utilities, partner statements) have tests that can be extended.
- `main`/`origin/main` history contains no secrets, and the CI YAML uses only mock keys.

---

## 17. Dependency Map

```
SEC-01 rotate PAT  (independent, do first)
        │
Phase 0 baseline: commit/branch working tree ─► DEPLOY-01
        │                      └─► TEST-01 (CI gate: tsc + lint + jest + build)
        ▼
DB-01 dump live schema → baseline migration → generated types
        │
        ├─► SEC-02 / SEC-03 / SEC-04 / SEC-10 (RLS + function hardening, with RLS tests)
        │        └─► DB-07 (tenant/member model)  ─► SEC-08, SEC-11 (invite/role flows)
        │
        ├─► SEC-05 / SEC-06 (single action pipeline + page guards)
        │
        └─► DB-04 / BUG-03 / BUG-14 / BUG-15 (atomic RPCs, constraints)
                 │
                 ▼
        BUG-04 (costing at insert) ─► BUG-01 (SQL aggregation RPCs/views)
                 │                         │
                 └────────► BUG-02 / ARCH-01 (single financial read model; estimates separated)
                                           │
                                           ├─► BUG-05 (cache/invalidations) ─► BUG-12, BUG-07
                                           └─► Frontend consolidation (UX-2/3), performance
SEC-07 Next upgrade  (after CI gate exists; before/with Phase 1)
BUG-06 backups       (verify Supabase PITR immediately; pg_dump job after DB-01)
BUG-08 timezone      (after action pipeline, since fix is a shared helper)
```

---

## 18. Recommended Fix Order

| Phase | Goal | Contents |
|---|---|---|
| **0 — Baseline** | Make the current state safe and reproducible | Rotate the PAT (SEC-01). Snapshot and commit the working tree on a branch. Dump the live schema and policies. Record the live commit and applied migrations. Commit CI. Verify Supabase backups and PITR. Fix the one TS error and the one failing test. Remove `ignoreBuildErrors` once green |
| **1 — Critical security** | Close data-exposure paths | SEC-02, SEC-03, SEC-04, SEC-05, SEC-07, SEC-08, SEC-10, with RLS tests |
| **2 — Core architecture** | One way to do things | Adopt `createProtectedAction` for all actions (SEC-06, SEC-11), one business resolver, generated DB types, shared Dhaka date helper (BUG-08) |
| **3 — Database and business logic** | Correct money | Atomic sale RPCs and constraints (BUG-03), costing at insert (BUG-04), stock guard (BUG-14), batch atomicity (BUG-15), tenant model (DB-07), drop dead tables and functions (DB-03, DB-10) |
| **4 — API** | Consistent contracts | zod on all inputs, a uniform error envelope with request IDs, idempotency keys for sales and payments, cron tenant scoping and rate limits (SEC-12, SEC-13, SEC-14) |
| **5 — Frontend** | One read model per number | Single financial read model (BUG-01, BUG-02, BUG-05, BUG-07, BUG-12); remove duplicate components and engines (ARCH-01) |
| **6 — UX** | Coherent product | Branding, IA consolidation, dead links, redirectTo, confirm dialogs, a11y fixes |
| **7 — Performance** | Fast at 10× data | SQL aggregation, pagination, dashboard query consolidation |
| **8 — Testing** | Trustworthy gate | Golden financial tests, RLS tests, Playwright smoke flows (login, add animal, weigh, feed, sell, statements) |
| **9 — Deployment hardening** | Repeatable releases | Migration pipeline, single package manager, Node version alignment, real backups (BUG-06), monitoring and alerting on cron failures |
| **10 — Final verification** | Sign-off | Full regression, reconciliation of statements against a manual ledger sample, security retest |

---

# TOP 10 PRIORITIES (in dependency order)

1. **Revoke the Supabase personal access token** in `Data.txt`, delete the file and the `refs/cline/checkpoints/*` refs, and fix `.gitignore` (SEC-01).
2. **Freeze and baseline:** commit the 479-file working tree to a branch, record what is deployed, and verify Supabase backups and PITR (DEPLOY-01, BUG-06).
3. **Dump the live schema, policies and functions** and commit them as the authoritative baseline; generate types (DB-01).
4. **Fix RLS:** `business_users` self-escalation, the 9 tables without RLS, SECURITY DEFINER functions, profiles and storage policies, backed by automated RLS tests (SEC-02, SEC-03, SEC-04, SEC-10).
5. **Turn on a real CI gate:** tsc, lint, jest and build on every push; fix the TS error and failing test; remove `ignoreBuildErrors` (TEST-01).
6. **Upgrade Next.js to 16.3.6** behind that gate (SEC-07).
7. **Enforce authorization server-side:** page guards for finance, accounting, reports and partners; every server action through `createProtectedAction`; stop trusting `user_metadata` (SEC-05, SEC-06, SEC-11).
8. **Make sales atomic and auditable:** use the existing `sell_cattle`/`revert_cattle_sale` RPCs, add a unique active-sale index, and apply lock checks (BUG-03).
9. **Fix costing at the source:** every consumption valued at insert; separate estimates from actuals in the books (BUG-04, BUG-02).
10. **Replace JS aggregation with SQL aggregation** in a single financial read model used by the dashboard, finance, accounting and cash screens; remove the 30-day stale cache (BUG-01, BUG-05, ARCH-01).

# SAFE NEXT STEP

In the next session, **Phase 0 only, with no application logic changes:**

1. (User, manually) Revoke the `sbp_` token in the Supabase dashboard. Confirm that Supabase PITR or daily backups are enabled for the production project.
2. (Claude) Create branch `chore/phase0-baseline`. Add `Data.txt`, `dev.log`, `temp.txt`, `lint-report.txt` and `supabase/.temp/` to `.gitignore`. Add `.gitattributes` (`* text=auto eol=lf`). Commit the existing working tree in logical, reviewable commits (migrations; tests; CI; app code), with no edits to their contents.
3. (User, with Claude's help) Run `supabase db dump --schema-only` and a `pg_policies`/`pg_proc` export against production (read-only), and commit the output under `supabase/baseline/` so every P0 "Needs verification" item can be confirmed or dismissed.
4. (Claude) Run `tsc`, `eslint`, `jest` and `next build` against a **non-production** Supabase project, and record the results in `docs/BASELINE_STATUS.md`.

Do not start Phase 1 until step 3 confirms the actual live RLS state.

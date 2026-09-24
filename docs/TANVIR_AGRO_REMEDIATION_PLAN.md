# Tanvir Agro: Master Remediation Plan

Source: `docs/TANVIR_AGRO_AUDIT_REPORT.md` (audit of 2026-09-24). Finding IDs match that report.

**How to use this file (for future Claude sessions)**

- Work **one task at a time**, in `Order`. Do not start a task until its `Depends on` items are marked done.
- For every task: read the files listed, confirm the evidence still holds (the code may have changed), write a short plan, make the **smallest** change, then run the task's `Verify` steps **plus** the standard gate: `npx tsc --noEmit`, `npx eslint src`, `npx jest --runInBand`, and `npm run build` against a non-production env.
- A task is **done** only when it is verified. Update the Status column in the table below and add a one-line note with the commit hash.
- Anything touching production (DB, Supabase settings, Netlify env) is a **user action**. Claude prepares SQL and scripts and the user runs them after a backup.

## Status tracker

| Order | ID | Pri | Title | Status |
|---|---|---|---|---|
| 0.1 | SEC-01 | P0 | Revoke leaked Supabase PAT; purge local refs | PARTIAL: Data.txt now gitignored (8801920); revoke + ref purge need owner |
| 0.2 | DEPLOY-01 | P1 | Baseline the working tree in git | DONE on branch chore/phase0-baseline (8801920..d539892), not pushed; live deploy state still unknown |
| 0.3 | DB-01 | P1 | Dump live schema/policies; baseline migration; generated types | BLOCKED: production read not permitted; run docs/sql/live_security_snapshot.sql |
| 0.4 | BUG-06a | P1 | Verify Supabase platform backups/PITR | BLOCKED: owner to check dashboard |
| 0.5 | TEST-01a | P1 | Green gate: fix TS error, failing test, lint errors; commit CI | DONE (28bc895, 3653627): tsc 0, lint 0 errors, 356/356 tests, build passes with TS checks; CI committed but never run (not pushed) |
| 1.1 | SEC-02 | P0 | Fix `business_users` RLS self-escalation | WRITTEN + TESTED, NOT APPLIED (1e3ffc3): 19/19 local RLS checks; exploit reproduced on pre-migration schema |
| 1.2 | SEC-03 | P0 | Enable RLS on 9 unprotected tables | WRITTEN + TESTED, NOT APPLIED (1e3ffc3) |
| 1.3 | SEC-04 | P1 | Harden/drop SECURITY DEFINER functions | WRITTEN + TESTED, NOT APPLIED (1e3ffc3); get_finance_summary confirmed live, broken, anon-callable |
| 1.4 | SEC-10 | P2 | Profiles + storage policies | WRITTEN + TESTED, NOT APPLIED (1e3ffc3); profiles anon-readable CONFIRMED LIVE |
| 1.5 | SEC-07 | P1 | Upgrade Next.js to ≥16.3.6 | DONE (a391214): next 16.3.6, 0 critical in npm audit |
| 1.6 | SEC-05 | P1 | Server-side page guards; stop trusting user_metadata | DONE (7a58e2d): 17 pages guarded; accounting DAL checks role; middleware no longer trusts user_metadata |
| 1.7 | SEC-08 | P1 | Fix invite redirect URL | DONE (7a58e2d): uses NEXT_PUBLIC_APP_URL / Netlify URL |
| 1.8 | SEC-09 | P2 | Fix open redirect in auth callback | DONE (7a58e2d): safeRedirectPath + tests; login honours redirectTo safely |
| 2.1 | SEC-06 | P1 | All server actions through `createProtectedAction` | PARTIAL (7a58e2d): 83 actions guarded via actionPermissionError; move to createProtectedAction pipeline still open |
| 2.2 | SEC-11 | P2 | Validate role changes | DONE (7a58e2d) |
| 2.3 | ARCH-02 | P2 | Single business-context resolver | TODO |
| 2.4 | BUG-08 | P2 | Asia/Dhaka date helper | PARTIAL (e10eb0f): lib/dates.ts + tests; 30 write-path sites, auto feed deduction and advisor use Dhaka dates; ~200 read-path sites remain |
| 3.1 | DB-07 | P1 | Tenant/team-member model | TODO (decision needed) |
| 3.2 | BUG-03 | P1 | Atomic, auditable sale + reversal | PARTIAL (0f31c19): no second active sale, conditional status flip + orphan cleanup, undo = soft delete + lock check; atomic RPC still pending (needs DB) |
| 3.3 | BUG-04 | P1 | Value every consumption at insert | TODO |
| 3.4 | BUG-14 | P2 | Stock guard: adjustments + locking | TODO |
| 3.5 | BUG-15 | P2 | Atomic batch production | TODO |
| 3.6 | BUG-11 | P2 | Weight-log delete scoping + soft delete | DONE (0f31c19): soft delete scoped to animal; 10 weight_logs reads now skip deleted rows |
| 3.7 | DB-03/DB-10/DB-02 | P2 | Drop broken/unused DB objects | TODO |
| 3.8 | BUG-16/BUG-09 | P2 | Remove references to non-existent tables | PARTIAL (d06272e): cattle_sales/financial_transactions/orders fixed; column-level issues tracked as BUG-23 |
| 4.1 | API-01 | P2 | zod input validation + uniform error envelope | TODO |
| 4.2 | SEC-12/13/14 | P2 | Rate limiting, cron tenant scoping, error leakage | TODO |
| 4.3 | BUG-10 | P2 | AI automation proposals: persist or remove | TODO |
| 5.1 | BUG-01 | P1 | SQL aggregation RPCs (no JS sums over capped rows) | TODO |
| 5.2 | BUG-02/ARCH-01 | P1 | Single financial read model; estimates separated | TODO |
| 5.3 | BUG-05 | P1 | Remove/repair 30-day accounting cache | PARTIAL (0f31c19): TTL 30d -> 60s; wizard + deleteCattle revalidate tag; service-role removal waits on 5.1 |
| 5.4 | BUG-07/BUG-12 | P2 | Dashboard count + cash asymmetry | PARTIAL (0f31c19): BUG-07 count fixed; BUG-12 cash asymmetry open |
| 5.5 | BUG-13 | P2 | Auth cookie httpOnly override | TODO |
| 6.1 | UX-01 | P2 | Branding cleanup ("Chowdhury Agro") | DONE (bfd776c) except signup-trigger default name (migration, with 3.1) and email sender domain (needs owner) |
| 6.2 | UX-02 | P2 | IA consolidation plan (no code until approved) | TODO |
| 6.3 | UX-03 | P3 | Dead links, redirectTo, confirm dialogs, a11y, U+FFFD | PARTIAL (bfd776c, 7a58e2d): dead onboarding link, U+FFFD, redirectTo done; confirm dialogs / a11y open |
| 7.1 | PERF-01 | P2 | Pagination + dashboard query consolidation | TODO |
| 8.1 | TEST-01b | P1 | Golden financial tests, RLS tests, Playwright smoke | TODO |
| 9.1 | DEPLOY-02 | P2 | Migration pipeline, single package manager, Node version | TODO |
| 9.2 | BUG-06b | P1 | Real off-site DB backups | PARTIAL (0f31c19): manual backup includes sales again; real off-site DB backup still open |
| 9.3 | DEPLOY-03 | P3 | Repo hygiene | TODO |
| 9.4 | CLEAN-01 | P3 | Remove dead engines/components after coverage exists | TODO |
| 9.5 | BUG-22 | P2 | Service worker never rebuilt (Serwist + Turbopack) | TODO |
| 9.6 | DB-11 | P1 | Committed migrations cannot replay on a fresh DB (003, 032 order bugs; health_events.deleted_at never created) | TODO: fix via baseline dump (0.3); harness patches temp copies |
| 9.7 | BUG-23 | P1 | Queries select columns missing from migrations (110 refs / 65 sites; e.g. cattle.tag_number, health_events.status); some are silent failures, some drift | TODO: run snapshot query 10, then fix code or add migrations; tool: scripts/check-query-columns.cjs |
| 10 | VERIFY | — | Full regression + ledger reconciliation + security retest | TODO |

---

## Phase 0: Establish baseline (no behavior changes)

### 0.1 SEC-01: Revoke the leaked Supabase personal access token
- **Priority / Category:** P0 / Security
- **Problem:** a Supabase PAT (`sbp_…`, account-wide Management API access) is stored in plaintext.
- **Evidence:** `Data.txt:1` (untracked, not ignored). The same token is in local commits under `refs/cline/checkpoints/*`. The folder is synced by OneDrive. `main`/`origin/main` are clean.
- **Files:** `Data.txt`, `.gitignore`, `.git/refs/cline/`
- **Depends on:** none
- **Solution:**
  1. User: Supabase Dashboard → Account → Access Tokens → revoke. Also review the account's audit log for unknown activity.
  2. Delete `Data.txt`, and check OneDrive version history and recycle bin.
  3. `git for-each-ref --format='%(refname)' refs/cline | xargs -n1 git update-ref -d`, then `git reflog expire --expire=now --all && git gc --prune=now`. This deletes local-only refs; confirm with the user first.
  4. Add to `.gitignore`: `Data.txt`, `temp.txt`, `dev.log`, `lint-report.txt`, `supabase/.temp/`.
- **Verify:** `git log --all -p | grep -c sbp_` returns 0. `git check-ignore Data.txt` matches. The old token fails against `https://api.supabase.com/v1/projects`.
- **Risk:** low. Removing the Cline refs removes Cline's checkpoint history.

### 0.2 DEPLOY-01: Baseline the working tree in git
- **Priority / Category:** P1 / Deployment
- **Problem:** 216 modified and 263 untracked files, including migrations `026`–`032` and `20260912`, the CI workflow and tests. It is unknown what is deployed.
- **Files:** whole repo
- **Depends on:** 0.1
- **Solution:** make a filesystem backup of the folder. Create branch `chore/phase0-baseline`. Add `.gitattributes` (`* text=auto eol=lf`). Commit in logical commits without changing content: (a) repo hygiene and ignore rules, (b) migrations, (c) tests, (d) CI, (e) app code. Do **not** push to `main`. Ask the user which branch and commit Netlify deploys, and whether migrations 026–032 were applied to production.
- **Verify:** `git status` is clean. `git diff origin/main --stat` is reviewable. Record the answers in `docs/BASELINE_STATUS.md`.
- **Risk:** low. Never force-push.

### 0.3 DB-01: Authoritative schema baseline
- **Priority / Category:** P1 / Database
- **Problem:** migrations, git, `src/types/database.ts` and production disagree.
- **Evidence:**
  - `20260616234914_journal_lines_rls.sql:8-11` says live policies were created outside migrations.
  - The code uses tables that exist in no migration: `cattle_sales`, `financial_transactions`, `orders`, `management_fee_rates`.
  - `UserRole`/`CattleStatus` TS types don't match the DB enums (`001:11-12`).
- **Files:** `supabase/migrations/*`, `src/types/database.ts`
- **Depends on:** 0.2
- **Solution:**
  1. User runs (read-only): `supabase db dump --schema-only -f supabase/baseline/schema.sql`. Also export `select * from pg_policies where schemaname in ('public','storage')`, `select proname, prosecdef, proacl from pg_proc where pronamespace='public'::regnamespace`, `select relname, relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r'`, and the list of applied migrations (`supabase_migrations.schema_migrations`).
  2. Claude compares these with the migrations and writes `docs/SCHEMA_DRIFT.md`.
  3. Run `supabase gen types typescript --linked > src/types/supabase.generated.ts`. Keep `database.ts` as thin aliases over the generated types, and migrate gradually.
- **Verify:** every P0 "Needs verification" item in the audit is marked confirmed or dismissed in `SCHEMA_DRIFT.md`.
- **Risk:** none if read-only.

### 0.4 BUG-06a: Verify platform backups
- **Problem:** the app's own "backup" is not a restorable backup (see BUG-06).
- **Solution:** User: Supabase → Database → Backups. Confirm daily backups or PITR are active on the production plan, and record the retention period. Optionally do a test restore into a scratch project.
- **Verify:** screenshot or notes in `docs/BASELINE_STATUS.md`.

### 0.5 TEST-01a: Green verification gate
- **Priority / Category:** P1 / Testing
- **Problem:** `tsc` has 1 error, `jest` 1 failure, `eslint src` 16 errors. `ignoreBuildErrors: true`. CI is untracked.
- **Evidence:** `src/components/finance/TransactionStatement.tsx:9` (TS2739); `src/__tests__/health-medical-engine.test.ts:150`; `LivestockWorkspace.tsx:103` (`react-hooks/purity`); `dashboard/engine/PersonalizationContext.tsx:53`; `EnterpriseDecisionIntelligenceHub.tsx:588`; `EnterpriseDashboardLayout.tsx:129`; `inventory/ReportsClient.tsx:59`; `next.config.ts:15-17`
- **Depends on:** 0.2
- **Solution:**
  - Fix the Record literal.
  - Decide whether the failing test or the engine is wrong (read `lib/livestock/health-engine.ts`); do not weaken the assertion without a reason.
  - Fix the lint errors and remove the stale disables.
  - Change `"lint": "eslint src"`.
  - Commit `.github/workflows/ci.yml` using only mock env values.
  - Set `ignoreBuildErrors: false`.
- **Verify:** all four gate commands exit 0 locally, and CI goes green on the branch.
- **Risk:** low.

---

## Phase 1: Critical security and data exposure

> All SQL goes into **new** migrations (`supabase/migrations/2026MMDD_<name>.sql`). The user applies them to **staging first**, then production after a backup. Every policy change gets a test in `supabase/tests/rls/*.sql` (pgTAP) or a Node script that uses two test users against a local `supabase start`.

### 1.1 SEC-02: `business_users` self-escalation
- **Problem:** the policy `FOR ALL USING (… OR user_id = auth.uid())` has no `WITH CHECK`, so a member can change their own `role` and `business_id`, or insert themselves into any business.
- **Evidence:** `supabase/migrations/032_enterprise_identity_organization.sql:184-190`; trusted by `src/lib/context/business-context.ts:41-49`
- **Files:** new migration; `src/app/dashboard/(app)/settings/team/actions.ts`
- **Depends on:** 0.3 (confirm the live policy text)
- **Solution:**
  - Drop both `business_users` policies (`"Owners can manage business_users"` from `015` and `"business_users team isolation"` from `032`).
  - Create `SELECT USING (user_id = auth.uid() OR business_id IN (owned businesses))`.
  - Create `INSERT`/`UPDATE`/`DELETE` policies `USING` and `WITH CHECK (business_id IN (select id from businesses where owner_id = auth.uid()))`.
  - If admins must manage the team, add a `SECURITY DEFINER` function `is_business_admin(biz uuid)` with `set search_path=''` and use it in the policies.
- **Verify:** RLS test: a worker's session attempting `update business_users set role='owner' where user_id = auth.uid()` is rejected; inserting a row for another business is rejected; the owner can still invite, update and remove.
- **Risk:** medium. It could lock out the team UI if policies are wrong, so test on staging.

### 1.2 SEC-03: Tables without RLS
- **Evidence:** `026_livestock_domain_architecture.sql` creates `farms`, `pens`, `animal_breeds`, `animal_categories`, `disease_records`, `breeding_records`, `cattle_death_records`, `document_attachments` and `livestock_audit_logs` with no RLS.
- **Depends on:** 0.3
- **Solution:** `alter table … enable row level security` on each. Add tenant policies using the same membership predicate as the other tables: owner, or an active `business_users` member. `animal_breeds` and `animal_categories` may be global reference data; if so, use a `SELECT USING (true)` policy for `authenticated` and no write policy. Add a CI SQL check that lists public tables with `relrowsecurity = false`, which must be empty.
- **Verify:** the anon key cannot `select * from farms`; members of business A cannot read business B's pens; the app's pen, farm and health pages still work.
- **Risk:** medium (may hide data the UI currently relies on).

### 1.3 SEC-04: SECURITY DEFINER functions
- **Evidence:** `get_user_business_role(p_user_id)` in `015:51-78`, `get_finance_summary(p_business_id)` in `015:80-140` (also broken: `it.inventory_item_id`), `log_audit(...)` in `032:227-245`, `revoke_user_sessions(...)` in `032:248-258`. There are no REVOKEs.
- **Files:** new migration; callers `src/lib/context/business-context.ts:61`, `src/lib/logging/audit.ts` (or wherever `log_audit` is called; grep `rpc("log_audit"`), `src/app/api/identity/sessions/route.ts`
- **Depends on:** 0.3
- **Solution:**
  - Drop `get_finance_summary` (never called; `grep -rn get_finance_summary src` returns nothing).
  - `get_user_business_role`: ignore the parameter and use `auth.uid()`, or raise if `p_user_id <> auth.uid()`.
  - `log_audit`: take `p_business_id` but verify membership, and force `user_id = auth.uid()`.
  - `revoke_user_sessions`: require the caller to be the owner of `p_business_id` or the target user.
  - Give all of them `set search_path = ''` and `revoke execute … from public, anon`.
- **Verify:** calling each function as a user of business A with business B's IDs raises an error or returns null.
- **Risk:** low.

### 1.4 SEC-10: Profiles and storage policies
- **Evidence:** `006_profiles_and_business_details.sql:19-21` (`select using (true)`) and `:78-93` (any authenticated user may update any avatar or logo object)
- **Solution:** profiles `SELECT` limited to self plus members of the same business. Storage `UPDATE`/`DELETE`/`INSERT` restricted to `(storage.foldername(name))[1] = auth.uid()::text` (avatars) or the business ID folder (logos). Check the upload code paths use that folder layout (`grep -rn "storage.from(\"avatars\"\|logos" src`).
- **Verify:** user B cannot overwrite user A's avatar, and the anon key cannot list profiles.

### 1.5 SEC-07: Next.js security upgrade
- **Evidence:** `npm audit` reports critical "Middleware / Proxy bypass …" for `next@16.2.7`, fixed in `16.3.6`.
- **Depends on:** 0.5 (gate must be green first)
- **Solution:** `npm i next@16.3.6 eslint-config-next@16.3.6` (use whichever single package manager 9.1 settles on). Read `node_modules/next/dist/docs/` for any 16.3 changes, as AGENTS.md requires. `@serwist/next` is a major-version upgrade, so do it as a separate task with PWA testing. Run `npm audit fix` only for non-major transitive fixes.
- **Verify:** gate green. `npm audit` shows no critical. Manual smoke: login, logout, redirect when logged out, dashboard loads.
- **Risk:** low-medium.

### 1.6 SEC-05: Server-side page guards
- **Evidence:** `src/lib/supabase/middleware.ts:97-117` uses `user_metadata.role` (user-writable; a missing role passes). There are no checks in `finance/page.tsx`, `accounting/**/page.tsx`, `report/page.tsx`, `partners/**/page.tsx` or `settings/activity/page.tsx`. `lib/accounting/engine.ts:162` uses the service role.
- **Depends on:** 1.1 (the role source must be trustworthy)
- **Solution:**
  - Add `src/lib/auth/page-guard.ts` exporting `requirePagePermission(permission)`, which calls `getBusinessContext()` and `hasPermission`, then `redirect("/dashboard")` or `notFound()` if denied.
  - Call it at the top of each sensitive page, or in a `layout.tsx` per segment (`accounting/layout.tsx`, `finance/layout.tsx`, `report/layout.tsx`, `partners/layout.tsx`).
  - Remove the `user_metadata` check from the middleware (keep auth redirects only), and remove the `user_metadata.role` write in `team/actions.ts:86-89`.
- **Verify:** a test user with role `worker` gets redirected from every finance, accounting, report and partners URL even after `supabase.auth.updateUser({data:{role:'admin'}})`. Owner and admin access still works.
- **Risk:** low.

### 1.7 SEC-08: Invite redirect URL
- **Evidence:** `src/app/dashboard/(app)/settings/team/actions.ts:41` builds `…supabase.co → vercel.app`.
- **Solution:** `redirectTo: \`${process.env.NEXT_PUBLIC_APP_URL}/auth/callback\``, and fail if the env var is unset. User: in Supabase Auth → URL Configuration, set Site URL to the Netlify production domain and remove unknown redirect URLs.
- **Verify:** the invite email link points to the production domain.

### 1.8 SEC-09: Open redirect in the auth callback
- **Evidence:** `src/app/auth/callback/route.ts:9, 32` does `${origin}${next}` with an unvalidated `next`.
- **Solution:** accept `next` only if it matches `/^\/(?!\/)[\w\-/?=&.%]*$/`; otherwise use `/dashboard`. Reuse the same helper for the login `redirectTo` (UX-03).
- **Verify:** a unit test on the helper covering `//evil.com`, `@evil.com`, `https://evil.com` and `/dashboard/cattle`.

---

## Phase 2: Core architecture (one way to do things)

### 2.1 SEC-06: All server actions through one pipeline
- **Problem:** about 20 action files have no permission checks. `createProtectedAction` (`src/lib/auth/action-pipeline.ts:36`) is used by 0 files.
- **Evidence (no-check files):**
  - `cattle/actions.ts` (`deleteCattle` :300, `markAsDeceased` :214, `undoMarkAsDeceased` :265, `updateCattle`)
  - `settings/trash/actions.ts` (`permanentlyDelete` :72, a hard delete)
  - `inventory/actions.ts`, `inventory/recipe-actions.ts`, `health/actions.ts`
  - `cattle/{bulk,lifecycle,medical,vaccination,wizard,feed-session,feed-waste}-actions.ts`, `cattle/pens/actions.ts`, `cattle/health/actions.ts`
  - `cattle/[id]/{health,photo}-actions.ts`, `vendors/actions.ts`, `inventory/purchase/history/actions.ts`
  - `market-price-actions.ts`, `finance/statement-action.ts`, `global-actions.ts`, `advisor-actions.ts`, `breeding/actions.ts`
- **Depends on:** 1.1, 1.6
- **Solution:**
  1. Read `action-pipeline.ts`. Extend it if needed so it does: auth, `getBusinessContext`, `requirePermission`, zod parse, optional `checkFinancialLock(date)`, handler, `revalidatePath`/`revalidateTag` list, and a uniform `{ ok, error, data }` result.
  2. Migrate **one file per commit**, starting with the destructive actions: `permanentlyDelete`, `deleteCattle`, `markAsDeceased`/`undo`, `updateCattle` (purchase price), then inventory, health and the rest.
  3. Suggested permission mapping: delete cattle → `CATTLE_DELETE`; edit → `CATTLE_EDIT`; death and undo → `HEALTH_MANAGE` + `CATTLE_EDIT`; trash purge → owner/admin only (`SETTINGS_EDIT`); inventory CRUD → `INVENTORY_*`; recipes → `FEED_MIX`; vendors → `INVENTORY_PURCHASE`; market prices → `FINANCE_VIEW` for read and `COST_ENTRY_CREATE` for write.
  4. Add a lint-style unit test that imports every `*actions.ts` and asserts each exported function is wrapped (e.g. the pipeline tags wrapped functions with a symbol).
- **Verify:** per migrated action, a unit test with a mocked context: denied role returns an error, allowed role succeeds. Manual smoke of each migrated form.
- **Risk:** medium, because of the large surface. Do it incrementally.

### 2.2 SEC-11: Validate role changes
- **Evidence:** `settings/team/actions.ts:62-81` accepts any `UserRole`.
- **Solution:** a zod enum of assignable roles that excludes `owner`. Only the owner may assign `admin` (once the DB enum supports it; see 0.3/DB-01). Block self-demotion of the last owner or admin.
- **Verify:** unit tests.

### 2.3 ARCH-02: Single business-context resolver
- **Evidence:** four implementations: `getBusinessContext` (`lib/context/business-context.ts`), `getCurrentBusinessId` (`lib/supabase/get-business.ts`), local `getBizId` (`inventory/recipe-actions.ts` ~:170), and inline lookups (`lib/accounting/engine.ts:241-270`). Also `business_users.maybeSingle()` errors if a user belongs to two businesses (`business-context.ts:41-45`).
- **Solution:** keep `getBusinessContext` (memoized) and make the others thin wrappers or delete them. Make multi-membership explicit (a selected-business cookie validated against membership) or enforce one membership per user with a unique index. This depends on the 3.1 decision.
- **Verify:** `grep -rn "getBizId\|owner_id\", user" src/app` shows only the wrappers.

### 2.4 BUG-08: Asia/Dhaka date helper
- **Evidence:** 229 `toISOString().slice(0,10)` / `split("T")[0]` derivations; about 20 timezone-aware uses.
- **Solution:** `src/lib/dates.ts` exporting `todayDhaka()`, `toDhakaDate(d)` and `startOfDayDhaka()` via `Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka'})`. Replace uses in **write paths first** (actions: `recorded_at`, `sold_at`, feed sessions, lock checks), then reads. For DB `timestamptz` columns keep UTC instants; only calendar `date` columns use Dhaka dates.
- **Verify:** unit tests at 23:30 UTC (05:30 next day in Dhaka) and 18:30 UTC. Grep count goes down in each commit.

---

## Phase 3: Database and business logic

### 3.1 DB-07: Tenant and team-member model (**decision required from the user**)
- **Problem:** `handle_new_user` (`023_auto_create_business.sql:6-33`) creates a business for **every** new user, including invitees, with default name "Chowdhury Agro". `getBusinessContext` picks the owned business first. `businesses` RLS is owner-only (`001:109-110`), so members can't read their employer's business.
- **Question for the user:** is this a single-farm app (one business, staff accounts) or multi-tenant SaaS? And is public sign-up needed?
- **Recommended (single farm):**
  - Disable public sign-up in Supabase Auth.
  - Change the trigger to create a business only when `raw_app_meta_data->>'invited_business_id'` is null. Set it through the admin invite: `inviteUserByEmail(..., { data })` sets **user** metadata, so use `admin.updateUserById(id, { app_metadata })` right after the invite.
  - Add a member `SELECT` policy on `businesses`.
  - Clean up orphan auto-created businesses (reviewed SQL; the user runs it after a backup).
- **Verify:** invite a test worker on staging, log in as them, and confirm they see the owner's herd with worker permissions.
- **Risk:** medium-high (auth flow). Staging only until verified.

### 3.2 BUG-03 / DB-04: Atomic, auditable sale and reversal
- **Evidence:**
  - `src/app/dashboard/(app)/cattle/[id]/actions.ts:104-119`: two-step insert and update.
  - `:150-154`: `delete from sales where cattle_id=…`, with no lock check and no reason.
  - The RPCs `sell_cattle` / `revert_cattle_sale` in `20260618_acid_transactions.sql` are unused.
  - There is no unique index on active sales.
- **Solution:**
  1. New migration: `create unique index sales_one_active_per_cattle on sales(cattle_id) where deleted_at is null`. Check for existing duplicates first and report them to the user; do not auto-delete.
  2. Recreate both RPCs as `SECURITY INVOKER` (RLS applies). Add `p_business_id` validation, a financial-lock check (`financial_locks.locked_until >= p_sold_at` → raise), and a check that the sale belongs to the cattle. Make the reversal require a non-empty reason.
  3. Replace the action bodies with `supabase.rpc("sell_cattle", …)` / `rpc("revert_cattle_sale", …)`. Update `UndoSaleButton.tsx` to collect a reason.
  4. Revalidate the `accounting` tag (it already does).
- **Verify:** unit test (mock rpc) plus manual staging: a double-click sale creates one row; reverting inside a locked period fails; after a revert the sale row is soft-deleted with the reason.
- **Risk:** medium.

### 3.3 BUG-04: Value every consumption at insert
- **Evidence:** inserts with no `unit_cost`: `cattle/[id]/actions.ts:238, 274`; `cattle/vaccination-actions.ts:67, 212`; `cattle/feed-waste-actions.ts:129`; `lib/offlineQueue.ts:23`. Costs are summed as `COALESCE(unit_cost,0)` in `20260611203700_finance_rpcs.sql` and `lib/accounting/engine.ts:398-402`.
- **Decision:** choose the costing method (FIFO is already used in `lib/inventory-fifo.ts` and `recipe-actions.ts:229-260`; weighted average is simpler). Document it in CLAUDE.md business rules.
- **Solution:**
  - Put one function `computeIssueUnitCost(itemId, qty, date)` in SQL (preferred, e.g. `inventory_issue_cost(item_id, qty)`) or in `lib/inventory-fifo.ts`.
  - Call it from every consumption writer. Better: a `BEFORE INSERT` trigger that fills `unit_cost` when it is null.
  - Backfill script (review, then user runs): compute `unit_cost` for historical null-cost consumptions and write a before/after report.
- **Verify:** `select count(*) from inventory_transactions where type='consumption' and unit_cost is null` returns 0 after the backfill. A per-cattle feed-cost report for 3 sample animals matches a manual calculation.
- **Depends on:** 3.4 (so the trigger ordering is known).

### 3.4 BUG-14: Stock guard correctness
- **Evidence:** `20260626_fix_stock_guard_trigger.sql:20-27` counts only `purchase and qty > 0`, ignores negative-qty purchases (true-ups), and takes no lock.
- **Solution:** net stock = `sum(case when type='purchase' then qty else -qty end)` (consistent with the app's true-up model; confirm how adjustments are written in `inventory/actions.ts`). Add `perform pg_advisory_xact_lock(hashtext(NEW.item_id::text))` before summing. Exclude soft-deleted rows if `inventory_transactions.deleted_at` exists (verify).
- **Verify:** a SQL test where two concurrent transactions each consume the full stock: exactly one succeeds.

### 3.5 BUG-15: Atomic batch production
- **Evidence:** `inventory/recipe-actions.ts:219-260` inserts ingredient consumptions, computes FIFO in JS, then inserts the output separately.
- **Solution:** move this into an RPC `produce_feed_batch(recipe_id, qty, recorded_at, output_item_id)` in one transaction. Require `output_item_id` so ingredient cost is transferred, not lost.
- **Verify:** force the output insert to fail (bad item ID) and confirm no ingredient rows remain.

### 3.6 BUG-11: Weight-log delete scoping
- **Evidence:** `cattle/[id]/actions.ts:176-178` deletes by `logId` only, as a hard delete. The trash UI (`settings/trash/actions.ts:51`) expects soft-deleted weight logs.
- **Solution:** `.update({deleted_at: now}).eq("id", logId).eq("cattle_id", cattleId)`, and check the affected row count.
- **Verify:** unit test; the trash page shows the log; restore works.

### 3.7 DB-02 / DB-03 / DB-10: Drop broken or unused DB objects
- **Items:** `get_finance_summary` (broken, unused); the `business_members` table (unused); unused tables `analytics_*`, `animal_financial_ledgers`, `api_keys`, `cost_centers`, `financial_budgets`, `document_attachments`, `animal_breeds`, `animal_categories`.
- **Solution:** for each, prove there is no usage (`grep`) and that live row count is 0 (the user runs the count). Then drop it in a migration, **or** keep it with a comment if a feature is planned. Never drop a table that has rows without explicit user approval and a backup.
- **Depends on:** 0.3, 1.2

### 3.8 BUG-16 / BUG-09: References to non-existent tables
- **Evidence:**
  - `cattle/lifecycle-actions.ts:287` → `cattle_sales`
  - `api/ai/nl-query/route.ts:27-30` → `financial_transactions`, `current_stock`, `reorder_threshold`, `purchase_weight_kg`, `scheduled_at`
  - `lib/analytics/aggregation-service.ts:88` → `orders`
  - `management_fee_rates` (9 sites) exists in no migration. Check the live DB (0.3); if it exists there, add a migration capturing it.
- **Solution:** point queries at real tables (`sales`, `cost_entries`, `commerce_orders`, …) and remove `as any` casts on those calls so the generated types catch mistakes.
- **Verify:** `tsc` with generated types; each affected screen shows data on staging.

---

## Phase 4: API contracts

### 4.1 API-01: Validation and a uniform envelope
- **Evidence:** route bodies are destructured without validation (`api/ai/automation/route.ts:85-97`, `api/identity/*`). Response shapes are inconsistent (`{ok,error}` vs `{error}` vs `{success}`). Actions do manual `parseFloat` checks (`cattle/[id]/actions.ts:85-96`) even though zod schemas exist in `src/lib/validation/*`.
- **Solution:** `src/lib/api/respond.ts` with `ok(data)` and `fail(status, code, message)` that include a `requestId` (from `crypto.randomUUID()`, also logged). Use zod schemas from `lib/validation` for every route and action input.
- **Verify:** unit tests per route for 400, 401, 403 and 200.

### 4.2 SEC-12 / SEC-13 / SEC-14: Rate limits, cron scope, error leakage
- **Evidence:**
  - `lib/rate-limit.ts` is in-memory. `lib/security.ts:21-28` trusts the first `X-Forwarded-For` value. `api-guard.ts:38` uses one shared key for all routes.
  - `api/cron/daily-alerts/route.ts` and `api/notify/check/route.ts` read all tenants when `CRON_BUSINESS_ID` is unset, and managers can trigger them.
  - Raw `error.message` is returned to clients.
- **Solution:**
  - Key rate limits by `userId + route`. On Netlify, use the platform client-IP header (`x-nf-client-connection-ip`). Move the store to Supabase (a table with TTL) or Upstash **only if** the user approves a new dependency.
  - Cron routes: iterate businesses explicitly, with one message per business owner, and require the cron path (`allowCron`) for fan-out. Users may trigger only their own business, with a rate limit.
  - Delete `/api/cron/daily-alerts` if `/api/notify/check` covers it (they overlap; confirm).
  - Return generic messages and log details server-side.
- **Verify:** unit tests; staging cron run log shows per-business scoping.

### 4.3 BUG-10: AI automation proposals
- **Evidence:** `lib/ai/automation-engine.ts:8` uses a static `Map`; `approveAndExecute(proposalId)` (:47) doesn't check `businessId`.
- **Solution:** either persist proposals in a tenant-scoped table and check `businessId` on approve, or remove the automation endpoints if the feature isn't used (ask the user).

---

## Phase 5: One financial read model

### 5.1 BUG-01: SQL aggregation instead of JS sums over capped rows
- **Evidence:** `supabase/config.toml:18` has `max_rows = 1000`; 241 unpaginated query sites; no `.range()` anywhere. Key consumers: `lib/supabase/queries/cash.ts:36-98`, `lib/accounting/engine.ts:172-188`, `lib/supabase/queries/dashboard.ts`, `lib/supabase/queries/analytics.ts`, `app/dashboard/(app)/cattle/page.tsx:81-113`, `api/cron/daily-alerts/route.ts:28-34`, `inventory/recipe-actions.ts:199-204`.
- **Solution:**
  1. Add SQL functions (`SECURITY INVOKER`, RLS applies) returning aggregates: `fin_cash_position(biz, as_of)`, `fin_income_statement(biz, from, to)`, `fin_balance_sheet(biz, as_of)`, `inv_stock_levels(biz)`, `cattle_cost_summary(biz)` (purchase + feed + direct + treatments per animal).
  2. Replace JS sums one screen at a time, keeping the old function in a test to compare results on a fixture DB.
  3. Add a guard helper `assertNotTruncated(rows)` that throws if `rows.length === 1000`, and use it on any remaining list reads until they are paginated.
- **Verify:** golden tests (8.1) produce identical numbers before and after on a fixture under 1000 rows, and correct numbers on a fixture with 5000 rows.
- **Depends on:** 3.2, 3.3 (costs must be recorded correctly first)

### 5.2 BUG-02 / ARCH-01: Separate estimates from actuals; one P&L
- **Evidence:**
  - The algorithmic feed estimate is booked into P&L, COGS and inventory: `lib/supabase/queries/dashboard.ts:160-180`; `lib/accounting/engine.ts:308-337, 404-405, 549-553, 834-836`.
  - Eight or more profit implementations (see audit ARCH-01).
- **Solution:**
  - **Books (accounting pages, cash, dashboard "Net P/L"):** recorded transactions only. Farm-level feed allocation to animals becomes an explicit, stored allocation (e.g. a daily or period allocation job writing `cost_allocations`, a table that already exists in `030`), not a render-time estimate.
  - **Projections (valuation, break-even, what-if, "estimated feed to date"):** keep `utils/feed-calculator.ts`, but label every output "Estimated" in the UI and never mix it into statement totals.
  - Choose `lib/accounting/engine.ts`, rebuilt on 5.1's RPCs, as the only P&L. Make dashboard, finance page, reports, PLSummary and advisor call it. Delete the others after their tests pass.
- **Verify:** the same period shows the same Net P/L on the dashboard, finance, the income statement and reports (a Playwright assertion in 8.1).
- **Risk:** high visibility, since reported numbers will change. Tell the user before and after, and provide a reconciliation table.

### 5.3 BUG-05: Accounting cache
- **Evidence:** `lib/accounting/engine.ts:157-225` uses `unstable_cache` for 30 days with the service role. Writers missing `revalidateTag("accounting")`: `cattle/wizard-actions.ts`, `cattle/feed-session-actions.ts`, `cattle/feed-waste-actions.ts`, `cattle/bulk-actions.ts`, `deleteCattle` (`cattle/actions.ts:300-322`).
- **Solution:** after 5.1, remove `unstable_cache` and the service-role client from the request path (SQL aggregation is fast enough), which also removes the RLS bypass. If a cache is still needed, the action pipeline (2.1) must revalidate `accounting-${businessId}` on every financial write.
- **Verify:** add an animal, and the balance sheet reflects it immediately.

### 5.4 BUG-07 / BUG-12: Dashboard count and cash asymmetry
- **Evidence:** `lib/supabase/queries/dashboard.ts:65-69, 187` reads `.length` of a `head:true` query, so the result is always 0. `lib/supabase/queries/cash.ts:49-59` counts soft-deleted cattle purchases but not their sales, and ignores query errors.
- **Solution:** use `count`. Define the soft-delete rule (a soft-deleted animal is excluded **everywhere**, or its cash movements remain everywhere) and apply it consistently. Throw on query errors. Mostly superseded by 5.1.

### 5.5 BUG-13: Auth cookie `httpOnly` override (**verify first**)
- **Evidence:** `lib/supabase/middleware.ts:56-64` forces `httpOnly: true` and a 30-day `maxAge` on refreshed cookies. The browser client (`components/layout/GlobalCommandSearch.tsx`, `components/shared/{CommandPalette,SearchBox,RealtimeRefresher}.tsx`) needs to read them.
- **Solution:** first reproduce in a browser (log in, wait for token refresh or force one, then use search). If confirmed, pass `options` through unchanged (the `@supabase/ssr` defaults), or move search to a server action.
- **Verify:** search works after a token refresh.

---

## Phase 6: UX

### 6.1 UX-01: Branding cleanup
- **Evidence:** 46 references to "Chowdhury Agro" / `caagro.netlify.app`, e.g. `(auth)/login/page.tsx:5, 28`, `(auth)/forgot-password/page.tsx`, `(auth)/reset-password/page.tsx`, `app/layout.tsx:42, 53`, `api/backup/backup-helpers.ts:34, 139`, `supabase/migrations/023_auto_create_business.sql:26`. Also a literal `�` in 5 files.
- **Solution:** a single `APP_NAME` constant in `src/constants/config.ts`; replace all references (`grep -rniE "chowdhury|caagro"`). The backup email `from` must use a Resend-verified domain; ask the user which one.
- **Verify:** grep count is 0 and the auth pages render "Tanvir Agro".

### 6.2 UX-02: Information-architecture consolidation (**plan only, get approval**)
- **Evidence:** 68 dashboard routes with overlapping modules (`cattle/health` vs `health/*`, `cattle/breeding` vs `breeding/*`, `cattle/vaccinations` vs `health/vaccinations`, finance/accounting/report/commerce/partners).
- **Solution:** produce a route map with usage (ask the user which screens the farm actually uses daily) and a proposal to merge or redirect. No deletions without approval.

### 6.3 UX-03: Small fixes
- Remove or fix the `/onboarding` link (`app/dashboard/(app)/page.tsx:44`).
- Honor `redirectTo` on login (`(auth)/login/actions.ts:38`) using the safe-path helper from 1.8.
- Replace the 3 `window.confirm` calls with `ConfirmDialog`.
- Add `aria-label` to the 18 `size="icon"` buttons.
- Convert the 7 clickable divs to buttons.
- Remove the U+FFFD characters (5 files).
- **Browser verification required** at 360, 768, 1280 and 1920 px for: add animal, weigh, feed session, record sale, finance.

---

## Phase 7: Performance

### 7.1 PERF-01
- **Evidence:** `cattle/[id]/page.tsx` issues 32 queries; `finance/page.tsx` 18; dashboard 19 + 24 + analytics again (`app/dashboard/(app)/page.tsx:54-60`); the cattle list loads all animals and all consumptions with a large `.in()` list (`cattle/page.tsx:81-113`).
- **Solution:** after 5.1, use one RPC per screen section. Paginate lists (cattle, costs, transactions, movements) with `.range()` plus a count. Compute the dashboard P&L once and reuse it for trends.
- **Verify:** record query counts and server timing before and after (log with `performance.now()` in dev).

---

## Phase 8: Testing

### 8.1 TEST-01b: Tests on the real money paths
- **Golden financial tests:** a fixture business (JSON) run through `lib/accounting/engine.ts` (or the new RPCs via local `supabase start`), asserting exact income statement, balance sheet, cash and per-animal cost, including soft-deleted rows, dead animals, reverted sales, locked periods and more than 1000 rows.
- **RLS tests:** two businesses, owner/manager/worker/anon; assert read and write matrices for every table (generated from `pg_class`).
- **Action authorization tests:** see 2.1.
- **Playwright smoke** (Playwright is already a devDependency): login, add animal (wizard), log weight, feed session, record sale, undo sale (with lock), view statements. Run against a local or staging Supabase with seeded data. **Never against production.**
- **Remove or retarget** tests for engines with no production consumer (see 9.4).

---

## Phase 9: Deployment hardening

### 9.1 DEPLOY-02: Pipeline
- Choose **one** package manager. npm matches the tracked lockfile and CI; delete `pnpm-lock.yaml` and `pnpm-workspace.yaml` if the user agrees. Confirm what Netlify uses.
- Align Node: `.nvmrc` = 20 (or upgrade Netlify to 22/24 deliberately).
- Migrations: CI job running `supabase db lint` and applying migrations to a staging project. Production migrations are applied by the user through `supabase db push` after a backup. Record them in `docs/BASELINE_STATUS.md`.
- Update the README (Netlify, `.env.example`, commands).

### 9.2 BUG-06b: Real backups
- **Evidence:** `api/backup/route.ts:38` (sales dropped); `api/backup/backup-helpers.ts:88-93` (6 tables, capped, cross-tenant).
- **Solution:** rely on Supabase PITR or daily backups (0.4). Add a weekly `pg_dump` (GitHub Action with a DB URL secret, output to encrypted off-site storage), subject to user approval. Rename the in-app feature to "Export CSV", fix the sales query (`cattle!inner(business_id)`), and export all business tables with pagination.
- **Verify:** a restore drill into a scratch project.

### 9.3 DEPLOY-03: Repo hygiene
- Remove `dev.log`, `lint-report.txt`, `temp.txt`, `tsconfig.tsbuildinfo` (already ignored) and `supabase/.temp/` from tracking (`git rm --cached`).
- Fix `.vscode/settings.json` (it auto-approves a command for `d:\Final Website\Tanvir Agro`).
- Move the prior AI reports (`PRODUCT_AUDIT.md`, `MASTER_UX_BLUEPRINT.md`, `PHASE_0_IMPLEMENTATION_REPORT.md`, `DATA_GOVERNANCE.md`, `src/components/data-grid/IMPLEMENTATION-REPORT.md`) into `docs/archive/` with a note that they are not authoritative.

### 9.4 CLEAN-01: Dead code
- **Candidates** (no production consumer found; re-verify first): `lib/financial/ledger.ts`, `lib/governance/engine.ts`, `lib/governance/reconciliation-engine.ts`, `lib/growth/growth-engine.ts`, `lib/inventory/batch-engine.ts`, `lib/inventory/reservation-engine.ts`, `lib/integrations/integration-platform.ts`, `lib/imageCompression.ts`, `lib/tokens.ts`, `lib/workflows/*` vs `lib/workflow-engine/*` (keep one). Also the duplicate components `ErrorBoundary` (`components/shared` vs `components/ui`), `PageHeader` (`components/shared` vs `components/layout`), `StatCard`, `PrintButton` ×3, `CurrencyInput`, `FormField` and `ActivityTimeline`.
- **Rule:** delete only after 8.1 gives coverage of the replacing path, one module per commit, with the gate green.

---

### 9.5 BUG-22: The service worker is never rebuilt
- **Evidence:** `npm run build` prints "`@serwist/next` … doesn't support Turbopack" and leaves `public/sw.js` unchanged. That file was last committed 2026-07-19 (`next.config.ts:5-9`, Next 16 builds with Turbopack by default). Production serves a stale service worker whose precache list points at chunks that no longer exist.
- **Solution:** either build with webpack (`next build --webpack`, and check what this does to build time), or move to Serwist's Turbopack-compatible integration (read the current Serwist docs first). Stop committing `public/sw.js` if it becomes a build output.
- **Verify:** after a build, `public/sw.js` has changed and its precache URLs exist in `.next`. In a browser: install, go offline, and reload a cached page.

## Phase 10: Final verification
- The full gate is green in CI.
- Playwright smoke passes on staging.
- Reconciliation: pick one month and compare the income statement, cash and per-animal cost with a hand-built ledger from raw rows (a SQL script checked into `docs/reconciliation/`).
- Security retest: the anon key cannot read any table; worker escalation attempts fail; `npm audit` shows no critical or high issues in the runtime dependency tree (or they are documented as accepted).
- Update `CLAUDE.md` with any new rules and commands.

# Baseline Status

Last updated: 2026-09-24 (Phase 0 session)

## Git
- Work branch: `chore/phase0-baseline`, **local only, not pushed**. `main` is untouched at `6336805`.
- The previously uncommitted working tree (216 modified and 263 untracked files) is now committed as-is in logical commits:
  - `8801920`: ignore scratch/secret files; untrack `supabase/.temp/`
  - `1d6f49f`: migrations 026–032, 20260912, supabase config
  - `3725b81`: CI workflow
  - `befbd71`: test suites
  - `d34236c`: prior planning notes (not authoritative)
  - `a6c8470`: audit, remediation plan, proposed CLAUDE.md
  - `d539892`: all remaining application changes
- Phase 0.5 gate fixes: `28bc895`. New tests: `3653627`.
- Still untracked on purpose: `pnpm-lock.yaml`, `pnpm-workspace.yaml` (package-manager decision pending, see below); `.env.example` (contains what looks like a real phone number; replace it with a placeholder before tracking).
- Not done: purging `refs/cline/checkpoints/*`, which still contain the leaked PAT in local git objects. This deletes Cline's checkpoint history, so it needs the owner's go-ahead.

## Verification gate (on `chore/phase0-baseline` @ `3653627`)
| Check | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | **0 errors** |
| Lint | `npm run lint` | **0 errors**, 8 warnings (`react-hooks/exhaustive-deps`) |
| Unit tests | `npx jest --runInBand` | **51 suites, 356 tests, all pass** (also all pass with the clock shifted to 2027-06, so no further date time bombs) |
| Build | `npm run build` with mock Supabase env | **passes**, now **with** TypeScript checking (`ignoreBuildErrors` removed) |

## New findings from this session
- **BUG-22 (P2): the service worker is never rebuilt.** `@serwist/next` warns that it does not support Turbopack, which is the Next 16 default. `npm run build` leaves `public/sw.js` unchanged; it was last committed 2026-07-19. Production therefore serves a stale service worker whose precache list points at old build chunks. Fix options: build with `next build --webpack`, or switch to Serwist's Turbopack-compatible setup (check the current Serwist docs), then verify offline behavior in a browser.
- **The local install uses pnpm** (`node_modules/.pnpm/…`) while the tracked lockfile and CI use npm. `npm ci` in CI has not been proven to succeed, because CI has never run (the branch is not pushed).
- **Corrected claim:** the "stale pinned list" issue suspected in `PersonalizationContext` does not occur in practice. The refactor there was for lint conformance, and tests confirm behavior is unchanged.

## Confirmed against production (2026-09-24)
Read-only probes with the **public anon key**; no data rows were read and nothing was written. A follow-up count probe using the service-role key was blocked by the permission system, and Claude did not retry it.

| Finding | Live result |
|---|---|
| SEC-10 `profiles` readable by anyone | **CONFIRMED**: the anon key sees 2 profile rows |
| SEC-04 `get_user_business_role` | **CONFIRMED** callable by anon (returned null for a random ID) |
| DB-03 `get_finance_summary` | **CONFIRMED** it exists, anon can call it, and it is broken (`column it.inventory_item_id does not exist`) |
| BUG-09 / BUG-16 / DB-01 | **CONFIRMED** missing in production: `cattle_sales`, `financial_transactions`, `orders`. Code that queries them silently gets nothing |
| DB-01 `management_fee_rates` | Exists in production but in no migration (drift) |
| SEC-03 the 9 tables from migration 026 | They **exist**. The anon key sees 0 rows, which is consistent with RLS being on **or** with empty tables; the SQL snapshot is still needed to tell which |

## Phase 1 (this session, branch `chore/phase0-baseline`)
- `7a58e2d`: server-side role checks on 17 pages and 83 server actions; safe redirects; invite URL fix; role validation.
- `a391214`: Next.js 16.3.6 (critical advisory fixed); Sentry and edge-runtime deprecations cleared.
- `1e3ffc3`: RLS hardening migration **(not applied)** plus a local test harness. On a throwaway PostgreSQL 17 with all migrations replayed:
  - **before** the migration, a worker can set their own role to `owner` and move their membership to another business;
  - **after** it, **19/19** checks pass;
  - the migration is idempotent.
- Gate after all changes: tsc 0 errors, lint 0 errors, **381/381 tests**, build passes.

## New findings this session
- **DB-11 (P1): the committed migrations cannot build a fresh database.**
  - `003_new_features.sql` adds FKs to `vendors` before creating it.
  - `032_enterprise_identity_organization.sql` has section 1 (`organization_units`) after the sections that reference it.
  - No migration creates `health_events.deleted_at`, yet 57 queries filter on it.
  - Production was built some other way (SQL editor). The harness patches these in a temp copy only; the real fix is the schema baseline (plan 0.3).
- **Behavior change to confirm:** under the declared role matrix, `manager` has `FINANCE_VIEW` but not `ACCOUNTING_VIEW`. Managers can see Finance but are now redirected away from Accounting pages; the old middleware let them in. If managers should see Accounting, add `ACCOUNTING_VIEW` to `manager` in `src/constants/roles.ts`.
- **Behavior change to confirm:** workers lack `HEALTH_MANAGE`, so they can no longer record vaccinations or treatments; only owner, admin, manager and veterinarian can. If field workers record vaccines, grant it to `worker`.

## Phase 2–3 progress (continued session)
| Commit | What changed |
|---|---|
| `0f31c19` | Safer sale and undo-sale (no double sale, orphan cleanup, soft-delete undo, lock check). Soft-deleted weight logs, now hidden everywhere. Accounting cache 30 days → 60 s. Dashboard cattle count. Four queries that always failed silently: commerce sales, manual-backup sales, **products-page stock**, **top-bar low-stock alert** |
| `e10eb0f` | Bangladesh-time (Asia/Dhaka) dates in all write paths, the automatic feed deduction, and the advisor |
| `bfd776c` | "Tanvir Agro" branding everywhere; link fallbacks point at tanviragro.com; corrupted characters removed; dead onboarding link fixed |
| `d06272e` | Stopped querying the 3 tables missing in production (animal timeline sales, AI query, analytics orders) |

Gate: tsc 0 errors, lint 0 errors, **397/397 tests** (plus 8 sale-action tests that fail on the old code), build passes.

### New finding BUG-23 (P1)
A scan of every `.from(...).select(...)` in `src/` against the migration schema found **110 references to 27 columns that no migration creates**, across 65 query sites. Tool: `scripts/check-query-columns.cjs`.
- Some are **drift**: the column exists in production and the page works (likely `roughage_active_from`, `default_daily_gain_kg`, `is_discontinued`).
- Some **don't exist anywhere**, so the query fails silently and the screen shows empty data. Likely examples: `cattle.tag_number` (the app uses `tag_id`), `cattle.name`, `cattle.current_weight_kg`, `health_events.status` (a code comment in `daily-alerts` says this column doesn't exist). Affected: the dashboard attention banner, `/api/analytics/kpis`, `/api/ai/recommendations`, custom reports, and the 7 breeding pages that select `cattle.name`.
- **Section 10 of `docs/sql/live_security_snapshot.sql` answers this for each column.** Run it before rewriting those screens.

## Blocked: needs the owner
These steps touch production or the owner's accounts. An automated permission rule blocked Claude's attempt to run read-only queries against the production Supabase API, and Claude did not try to work around it.

| Item | Why it matters | What is needed |
|---|---|---|
| **SEC-01**: revoke the `sbp_` token in `Data.txt` | Account-wide Supabase control | Supabase → Account → Access Tokens → Revoke. No API exists to revoke a PAT with itself. Then delete `Data.txt`. |
| **DB-01 / SEC-02 / SEC-03 / SEC-04**: confirm live RLS state | Decides whether the P0 findings are live | Either (a) allow Claude read-only production access in this session, or (b) run `docs/sql/live_security_snapshot.sql` in the Supabase SQL editor and save the output to `supabase/baseline/`. |
| **0.4**: backups and PITR | The in-app backup is not restorable | Check Supabase → Database → Backups and note the retention period here. |
| Live deploy state | Which commit production runs | Netlify → Deploys: note the branch and commit, and whether migrations 026–032 were applied. |
| Browser check of dashboard and forms | UX/a11y findings are static-analysis only | Test login credentials for a **non-production** project, or permission to run the dev server against production read-only. |

### Recorded answers
- Supabase backups/PITR: _pending_
- Netlify production branch/commit: _pending_
- Migrations applied in production: _pending_

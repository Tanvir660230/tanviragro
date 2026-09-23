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

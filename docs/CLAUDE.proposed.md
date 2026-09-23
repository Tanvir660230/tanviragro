@AGENTS.md

# Tanvir Agro ERP: rules for Claude sessions

Cattle-fattening ERP for one farm in Bangladesh (Asia/Dhaka, BDT, Bangla and English). Production data is real money. **Correctness and safety beat speed.**

## Stack
- Next.js 16 App Router (`src/proxy.ts` is the middleware). Read `node_modules/next/dist/docs/` before using any Next API (see AGENTS.md).
- React 19, TypeScript strict, Tailwind v4, shadcn/`@base-ui`.
- Supabase (Postgres, RLS, Auth, Storage) via `@supabase/ssr`. Hosted on **Netlify** (`netlify.toml`, `netlify/functions/*` for cron). Not Vercel.
- Tests: Jest (`src/__tests__`). Playwright is available for e2e.

## Where things live
- `src/app/dashboard/(app)/**`: pages (Server Components) plus `*actions.ts` server actions.
- `src/app/api/**`: route handlers; always call `authenticateApiRoute()` from `src/lib/auth/api-guard.ts`.
- `src/lib/context/business-context.ts`: `getBusinessContext()`, the **only** way to get tenant, role and permissions.
- `src/constants/roles.ts`: the permission matrix. `src/lib/auth/permissions.ts` has `requirePermission`.
- `src/lib/auth/action-pipeline.ts`: `createProtectedAction`, which every server action must use.
- `src/lib/accounting/engine.ts`: the financial statements (target: the single P&L source).
- `src/utils/feed-calculator.ts`: feed **estimates** only.
- `supabase/migrations/`: the schema. `docs/`: the audit, the remediation plan and baseline status.

## Commands (run before saying "done")
```
npx tsc --noEmit            # must be 0 errors
npx eslint src              # must be 0 errors
npx jest --runInBand        # must pass
npm run build               # with NON-production env values
```
Frontend change: also check it in a browser at 360 px and 1280 px (use the `run` skill).

## Workflow (every task)
1. Read `docs/TANVIR_AGRO_REMEDIATION_PLAN.md`, and find or record the task there.
2. Inspect the relevant code, and confirm the evidence still holds.
3. Plan the **smallest** safe change, then implement it.
4. Run the commands above, review `git diff`, and check for regressions.
5. Update the plan's status table. "Done" means verified, not just written.

## Security rules (non-negotiable)
- Every server action: `createProtectedAction` with an explicit permission, zod-validated input, and `checkFinancialLock` for dated financial writes.
- Every sensitive page (finance, accounting, report, partners, settings): server-side permission check. **Never** authorize from `user_metadata` (users can edit it).
- Never use `SUPABASE_SERVICE_ROLE_KEY` in a user request path. It is allowed only in cron and admin routes, which must scope by `business_id` explicitly.
- Every new table: `enable row level security` plus tenant policies with `WITH CHECK`, in the same migration.
- `SECURITY DEFINER` functions: validate `auth.uid()`, `set search_path = ''`, and `revoke execute … from public, anon`.
- Never print, log or commit secrets. `.env*`, `Data.txt` and `supabase/.temp/` stay untracked.

## Database rules
- Schema changes **only** via a new file in `supabase/migrations/` (timestamped `YYYYMMDDHHMMSS_name.sql`). Never edit an applied migration. Never change production through the SQL editor.
- Claude writes migrations. **The user applies them**: staging first, production after a backup.
- No destructive SQL (DROP, DELETE, TRUNCATE, data backfills) without explicit user approval and a confirmed backup.
- Use generated Supabase types. Do not add `(supabase as any)`.
- Aggregate in SQL (RPCs/views). The API caps results at **1000 rows**, so never sum unpaginated rows in JS.
- Multi-step writes (sale, batch production, reversal) go in one SQL function or transaction.

## Business rules
- **Actual vs estimate:** books (P&L, balance sheet, cash, dashboard Net P/L) use recorded transactions only. Algorithmic feed or weight projections must be labeled "Estimated" and never enter statement totals.
- **Costing:** every inventory consumption stores `unit_cost` at insert time, using the documented method (update this line once it is decided: FIFO or weighted average).
- **Animal cost basis:** purchase price + allocated feed + direct `cost_entries` (with `cattle_id`, type `variable`) + treatments.
- **Sales:** at most one active sale per animal. A reversal is a soft delete with a reason, blocked inside locked periods.
- **Deletes:** financial and livestock records are soft-deleted (`deleted_at`). Hard deletes are owner-only, from Trash.
- **Dates:** calendar dates are Asia/Dhaka (`src/lib/dates.ts` once it exists). Never use `new Date().toISOString().slice(0,10)` for "today".
- **Money:** BDT, stored as `numeric`. Round only for display.
- **Branding:** the product is "Tanvir Agro". There must be no "Chowdhury Agro" strings.

## Git and deploy
- Work on a branch. Commit only when asked. Never force-push or rewrite history. Never commit to `main` directly.
- Netlify deploys from the repository. **Never deploy, change Netlify or Supabase settings, or edit env vars.** Document the required action for the user instead.
- Do not add dependencies without a stated reason and user approval. Use one package manager (npm, `package-lock.json`).

## Protected files: ask before editing
`supabase/migrations/*` (existing files), `.env*`, `netlify.toml`, `next.config.ts` security headers, `src/lib/auth/*`, `src/lib/context/business-context.ts`, `src/constants/roles.ts`, `public/sw.js` (generated).

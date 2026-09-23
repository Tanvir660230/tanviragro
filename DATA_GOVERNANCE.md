# Tanvir Agro ERP — Data Governance, Data Quality & Business Continuity (Phase 3.3)

> Status: **Implemented (code+tooling) · Deployment gated behind DBA review**  
> Scope: Read-only inspection only — **no production mutations, migrations, or destructive commands were run** during this phase.

---

## 1. Executive Summary

This phase hardens the ERP's data layer so the system can be **audited, verified, and recovered** without exposing live production data to risk. No new writes to any table are added here; the deliverables are:

1. **`get_data_quality_report(p_business_id)`** — a read-only Postgres RPC that audits tenant integrity (duplicates, orphans, negative stock, cross-tenant anomalies, missing required fields).
2. **`src/lib/governance/data-quality-auditor.ts`** — an app-level, Supabase-client-based auditor producing the same style of report without requiring DB changes.
3. **`src/lib/governance/backup-verifier.ts`** — manifest generation + restore dry-run verification for the existing weekly CSV backups.
4. **`/api/operations/data-quality`** — an owner/admin-authenticated read-only endpoint.
5. **This document** — the governance runbook (ownership map, relationship map, RPO/RTO, retention, migration safety, BC plan).

---

## 2. Data Ownership & Map

| Domain | Core tables | Owner-canonical FK | Soft-deleted |
|---|---|---|---|
| Identity & tenants | `businesses`, `profiles`, `business_users`, `business_settings` | `business_id` | — |
| Livestock | `cattle`, `weight_logs`, `breeding_records`, `cattle_treatments` | `cattle.business_id` | `cattle.deleted_at` |
| Health | `health_events`, `disease_records` | `health_events.business_id` | — |
| Inventory | `inventory_items`, `inventory_transactions` | `inventory_items.business_id` | — |
| Finance & accounting | `cost_entries`, `sales`, `journal_entries`, `journal_lines`, `loans`, `fixed_assets` | `business_id` (or via cattle) | `sales.deleted_at` |
| Partners & equity | `partners`, `partner_transactions`, `partner_units` | `business_id` | `partners.deleted_at` |
| Audit | `audit_logs`, `livestock_audit_logs` | `business_id` | — |
| Commerce | `product_catalog`, `orders`, e-commerce tables | `business_id` | — |

## 3. Relationship / Referential Integrity Map

| Parent | Child | Guard |
|---|---|---|
| `businesses` | `cattle`, `inventory_items`, `cost_entries`, `partners`, `audit_logs` | RLS policies (`ON DELETE CASCADE` at FK level) |
| `cattle` | `weight_logs`, `sales`, `health_events`, `breeding_records` | RLS scopes by parent business |
| `inventory_items` | `inventory_transactions` | RLS + `check_inventory_stock()` trigger |

**Key integrity controls already live:**
- **RLS on every tenant table** — cross-tenant reads are impossible for authenticated callers (policies `*_in own business`).
- **Negative stock guard trigger** (`trg_check_inventory_stock`) — atomic TOCTOU-safe consumption guard.
- **ACID RPCs** — `sell_cattle` / `revert_cattle_sale` lock rows `FOR UPDATE` inside a single transaction.
- **Soft-delete conventions** — `deleted_at` on `cattle`, `partners`, `sales`; active queries filter `deleted_at IS NULL`.

---

## 4. Data Quality — Deliverable Details

### 4.1 SQL RPC (`supabase/migrations/20260912_data_quality_governance.sql`)

```sql
SELECT * FROM public.get_data_quality_report('<business_id>');
```

Returns a JSON object: `overall_healthy`, `total_issue_count`, and a `checks[]` array. Each check includes a `passed`/`issue_count`/`details` payload. All five checks are **SELECT-only**, the function is `SECURITY INVOKER`, so RLS governs visibility.

| Check | Detects |
|---|---|
| `duplicate_cattle_tags` | Same `tag_id` on multiple live cattle in one tenant |
| `orphaned_weight_logs` | Weight logs whose `cattle_id` is not in the tenant's cattle set |
| `negative_stock_items` | Items whose purchase−consumption sum < 0 (should be blocked by the trigger) |
| `cross_tenant_anomalies` | Any visible row whose tenant scoping disagrees (should be impossible under RLS) |
| `cattle_missing_required_fields` | Active cattle lacking `tag_id`, `purchase_date`, or positive `purchase_price` |

### 4.2 App-level auditor (`src/lib/governance/data-quality-auditor.ts`)

- `computeDataQualityReport(businessId, data)` — pure function, unit-tested, no DB.
- `runSupabaseDataQualityAudit(client, businessId)` — read-only adapter that fetches the same five checks through the Supabase JS client.
- `createSupabaseQualityFetchers(client, businessId)` — plugs into any Supabase-like client; safe to mock in tests.

### 4.3 Endpoint

`GET /api/operations/data-quality` — owner/admin (requires `settings:view`), rate-limited 30/min, `force-dynamic`. Returns `{ ok: true, report }`.
---

## 5. Backup, Recovery & Restore Verification

### 5.1 Existing backup baseline (verified in code review)

- **Path**: Netlify scheduled function → `GET /api/backup` → CSV per table → Supabase Storage bucket `backups/weekly/<date>/`.
- **Retention**: folders older than **84 days** are removed automatically.
- **Delivery**: optional Resend email with CSV attachments.
- **Tables backed up**: `cattle`, `sales`, `cost_entries`, `weight_logs`, `inventory_items`, `inventory_transactions`.

### 5.2 Gap closed: manifest & restore dry-run

`src/lib/governance/backup-verifier.ts` adds:

- `generateBackupManifest(businessId, tables)` — per-table `rowCount` + **SHA-256 checksum**, plus an overall manifest checksum.
- `verifyBackup(manifest, candidate)` — compares a restore candidate against the manifest and reports per-table `row_count`/`checksum` mismatches.

**Procedure for a restore drill (never run against production without an authorized change ticket):**
1. Export the backup folder from Storage (CSVs) into an isolated staging instance or local Postgres.
2. Recompute checksums `generateBackupManifest(bizId, parsedTables)` and compare to the stored manifest.
3. Call `verifyBackup(manifest, stagedData)` — all `allPassed === true` required before go/no-go.

### 5.3 RPO / RTO targets

| Metric | Target | Current posture |
|---|---|---|
| RPO (Recovery Point Objective) | ≤ 7 days | Weekly full CSV snapshot |
| RTO (Recovery Time Objective) | ≤ 24 h | CSV re-import + restore drill time |
| Integrity verification cycle | Weekly | Manifest checksums upon generation (apply after deployment) |

---

## 6. Retention, Archival & Data Lifecycle
---

## 7. Business Continuity & Disaster Recovery

1. **Detection**: hourly `/api/operations/health` probes + telemetry (existing).
2. **Restore**: weekly CSV snapshot in Storage; manifest check must pass.
3. **Playbook**:
   - Data corruption? → Restore last good weekly manifest; re-run `get_data_quality_report` on staging.
   - Tenant leakage? → Verify all RLS policies; re-run `cross_tenant_anomalies` check.
   - Storage outage? → Email copy in inbox is the fallback source.
4. **No single point of failure for writes**: Postgres remains source-of-truth; CSV backups are a secondary export.

---

## 8. Migration Safety Checklist (gate before any future deployment)

- [ ] Migration is **additive** (`CREATE OR REPLACE`, `IF NOT EXISTS`) — reject anything destructive without an owner sign-off.
- [ ] RLS enabled on every new tenant table & policy tested with **both** an authenticated and unauthenticated role.
- [ ] No `SECURITY DEFINER` unless the function can't avoid it — prefer `SECURITY INVOKER`.
- [ ] Rollback SQL is included in the migration file.
- [ ] `supabase db push` performed against a zero-data or staging project **first**.
- [ ] Data quality report (`get_data_quality_report`) run against staging **after** the push.
- [ ] Backup manifest regenerated and `verifyBackup` all-green before and after the migration.

---

## 9. Test Coverage

| Suite | What it verifies |
|---|---|
| `src/__tests__/data-quality-backup-verifier.test.ts` | Healthy report, duplicate tags, soft-deletion exclusion, orphaned logs, negative stock, manifest determinism, checksum drift, row-count mismatch. |

Run: `npm test -- data-quality-backup-verifier`

## 10. Next Steps (Phase 3.2/3.3 handoff)

- Apply `20260912_data_quality_governance.sql` via the DBA pipeline; do **not** run it manually against production.
- Wire `verifyBackup` into `runCronBackup` so every weekly backup emits a manifest alongside the CSVs.
- Add a guarded admin UI (settings → data) calling `GET /api/operations/data-quality` for a live tenant report.

| Data class | Retention rule | Action |
|---|---|---|
| Audit logs | 12+ months | Keep `audit_logs` (append-only); archive via CSV snapshot |
| Financial records | Statutory (per fiscal law) | Financial lock `financial_locks` + frozen snapshots |
| Soft-deleted records | 84 days (matches backup window) | Purge only in a documented archival run |
| Backups | 84 days | Auto-expiry already implemented |
| Health/breeding history | Keep while animal record lives | Cascaded by `cattle.deleted_at` |

> **Rule:** any deletion action requires a backup manifest verification **before** the destructive operation, taken from the previous weekly snapshot.
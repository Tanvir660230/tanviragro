/**
 * Tanvir Agro ERP — Phase 3.3: App-level Data Quality Auditor
 *
 * Read-only audit of tenant data for common integrity issues:
 *   • duplicate cattle ear tags
 *   • orphaned weight logs (referencing missing cattle)
 *   • negative computed stock
 *   • cross-tenant business_id mismatches
 *   • active cattle missing required fields
 *
 * DESIGN: the auditor is split into a pure, DB-agnostic report builder
 * (`computeDataQualityReport`) and a Supabase adapter (`runSupabaseDataQualityAudit`).
 * This keeps the logic unit-testable without a live database and keeps the
 * database path strictly read-only (SELECT only).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ── Types ──────────────────────────────────────────────────────────

export interface DataQualityCheckResult {
  check: string;
  description: string;
  passed: boolean;
  issueCount: number;
  details: unknown[];
}

export interface DataQualityReport {
  businessId: string;
  generatedAt: string;
  overallHealthy: boolean;
  totalIssueCount: number;
  checks: DataQualityCheckResult[];
}

export interface CattleQualityRow {
  id: string;
  tag_id: string | null;
  business_id: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  deleted_at: string | null;
}

export interface WeightLogQualityRow {
  id: string;
  cattle_id: string | null;
}

export interface InventoryItemQualityRow {
  id: string;
  name: string | null;
  business_id: string | null;
}

export interface InventoryTxnQualityRow {
  item_id: string | null;
  type: string | null;
  qty: number | null;
}

export interface CostEntryQualityRow {
  id: string;
  business_id: string | null;
}

export interface RawQualityData {
  cattle: CattleQualityRow[];
  weightLogs: WeightLogQualityRow[];
  inventoryItems: InventoryItemQualityRow[];
  inventoryTransactions: InventoryTxnQualityRow[];
  costEntries: CostEntryQualityRow[];
}

/**
 * Fetcher contract — kept minimal so any Supabase-like client or a test
 * double can supply the raw tenant rows.
 */
export interface DataQualityFetchers {
  getCattle(): Promise<CattleQualityRow[]>;
  getWeightLogs(cattleIds: string[]): Promise<WeightLogQualityRow[]>;
  getInventoryItems(): Promise<InventoryItemQualityRow[]>;
  getInventoryTransactions(itemIds: string[]): Promise<InventoryTxnQualityRow[]>;
  getCostEntries(): Promise<CostEntryQualityRow[]>;
}

// ── Pure report builder ────────────────────────────────────────────

const NET_STOCK_EPSILON = 0.0001;
export function computeDataQualityReport(
  businessId: string,
  data: RawQualityData
): DataQualityReport {
  const checks: DataQualityCheckResult[] = [];

  // Check 1: Duplicate cattle tags ------------------------------
  const activeCattle = data.cattle.filter((c) => !c.deleted_at);
  const tagCounts = new Map<string, CattleQualityRow[]>();
  for (const c of activeCattle) {
    if (!c.tag_id || !c.tag_id.trim()) continue;
    const list = tagCounts.get(c.tag_id) ?? [];
    list.push(c);
    tagCounts.set(c.tag_id, list);
  }
  const duplicateGroups = Array.from(tagCounts.entries()).filter(([, list]) => list.length > 1);
  checks.push({
    check: "duplicate_cattle_tags",
    description: "Cattle records sharing the same ear tag within one business",
    passed: duplicateGroups.length === 0,
    issueCount: duplicateGroups.length,
    details: duplicateGroups.map(([tagId, list]) => ({
      tag_id: tagId,
      count: list.length,
      cattle_ids: list.map((c) => c.id),
    })),
  });

  // Check 2: Orphaned weight logs --------------------------------
  const cattleIds = new Set(data.cattle.map((c) => c.id));
  const orphanedWeightLogs = data.weightLogs.filter(
    (w) => !w.cattle_id || !cattleIds.has(w.cattle_id)
  );
  checks.push({
    check: "orphaned_weight_logs",
    description: "Weight logs referencing cattle outside the tenant or missing cattle",
    passed: orphanedWeightLogs.length === 0,
    issueCount: orphanedWeightLogs.length,
    details: orphanedWeightLogs.map((w) => ({ weight_log_id: w.id, cattle_id: w.cattle_id })),
  });

  // Check 3: Negative stock computed from transactions -----------
  const itemById = new Map(data.inventoryItems.map((i) => [i.id, i]));
  const netByItem = new Map<string, number>();
  for (const t of data.inventoryTransactions) {
    if (!t.item_id) continue;
    const qty = t.qty ?? 0;
    const delta = t.type === "purchase" ? qty : t.type === "consumption" ? -qty : 0;
    netByItem.set(t.item_id, (netByItem.get(t.item_id) ?? 0) + delta);
  }
  const negativeStock = Array.from(netByItem.entries())
    .filter(([, net]) => net < -NET_STOCK_EPSILON)
    .map(([itemId, net]) => ({
      item_id: itemId,
      item_name: itemById.get(itemId)?.name ?? null,
      net_stock: Math.round(net * 10000) / 10000,
    }));
  checks.push({
    check: "negative_stock_items",
    description: "Inbound/outbound transaction sums below zero (guard trigger should prevent new ones)",
    passed: negativeStock.length === 0,
    issueCount: negativeStock.length,
    details: negativeStock,
  });
// Check 4: Cross-tenant anomalies ------------------------------
  const crossTenant: { table: string; record_id: string }[] = [];
  for (const c of data.cattle) {
    if (c.business_id && c.business_id !== businessId) {
      crossTenant.push({ table: "cattle", record_id: c.id });
    }
  }
  for (const i of data.inventoryItems) {
    if (i.business_id && i.business_id !== businessId) {
      crossTenant.push({ table: "inventory_items", record_id: i.id });
    }
  }
  for (const e of data.costEntries) {
    if (e.business_id && e.business_id !== businessId) {
      crossTenant.push({ table: "cost_entries", record_id: e.id });
    }
  }
  checks.push({
    check: "cross_tenant_anomalies",
    description: "Records visible to this caller whose tenant scoping disagrees",
    passed: crossTenant.length === 0,
    issueCount: crossTenant.length,
    details: crossTenant,
  });

  // Check 5: Cattle missing required fields ---------------------
  const missingFields: { cattle_id: string; missing_fields: string[] }[] = [];
  for (const c of activeCattle) {
    const missing: string[] = [];
    if (!c.tag_id || !c.tag_id.trim()) missing.push("tag_id");
    if (!c.purchase_date) missing.push("purchase_date");
    if (typeof c.purchase_price !== "number" || c.purchase_price <= 0) missing.push("purchase_price");
    if (missing.length > 0) missingFields.push({ cattle_id: c.id, missing_fields: missing });
  }
  checks.push({
    check: "cattle_missing_required_fields",
    description: "Active cattle missing tag_id, purchase_date, or a positive purchase_price",
    passed: missingFields.length === 0,
    issueCount: missingFields.length,
    details: missingFields,
  });

  const totalIssueCount = checks.reduce((sum, c) => sum + c.issueCount, 0);
  return {
    businessId,
    generatedAt: new Date().toISOString(),
    overallHealthy: totalIssueCount === 0,
    totalIssueCount,
    checks,
  };
}
// ── Supabase adapter ───────────────────────────────────────────────

/**
 * Builds read-only fetchers from a Supabase client for a tenant scope.
 * Note: RLS is the final authority — this adapter only queries rows the
 * caller is already allowed to see.
 */
export function createSupabaseQualityFetchers(
  client: Pick<SupabaseClient, "from">,
  businessId: string
): DataQualityFetchers {
  return {
    async getCattle() {
      const { data } = await client
        .from("cattle")
        .select("id, tag_id, business_id, purchase_date, purchase_price, deleted_at")
        .eq("business_id", businessId);
      return (data ?? []) as unknown as CattleQualityRow[];
    },
    async getWeightLogs(cattleIds) {
      if (cattleIds.length === 0) return [];
      const chunks = chunkArray(cattleIds, 50);
      const rows: WeightLogQualityRow[] = [];
      for (const chunk of chunks) {
        const { data } = await client
          .from("weight_logs")
          .select("id, cattle_id")
          .in("cattle_id", chunk);
        rows.push(...((data ?? []) as unknown as WeightLogQualityRow[]));
      }
      return rows;
    },
    async getInventoryItems() {
      const { data } = await client
        .from("inventory_items")
        .select("id, name, business_id")
        .eq("business_id", businessId);
      return (data ?? []) as unknown as InventoryItemQualityRow[];
    },
    async getInventoryTransactions(itemIds) {
      if (itemIds.length === 0) return [];
      const chunks = chunkArray(itemIds, 50);
      const rows: InventoryTxnQualityRow[] = [];
      for (const chunk of chunks) {
        const { data } = await client
          .from("inventory_transactions")
          .select("item_id, type, qty")
          .in("item_id", chunk);
        rows.push(...((data ?? []) as unknown as InventoryTxnQualityRow[]));
      }
      return rows;
    },
    async getCostEntries() {
      const { data } = await client
        .from("cost_entries")
        .select("id, business_id")
        .eq("business_id", businessId);
      return (data ?? []) as unknown as CostEntryQualityRow[];
    },
  };
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Runs the data quality audit against a live Supabase client (read-only).
 */
export async function runSupabaseDataQualityAudit(
  client: Pick<SupabaseClient, "from">,
  businessId: string
): Promise<DataQualityReport> {
  const fetchers = createSupabaseQualityFetchers(client, businessId);
  const cattle = await fetchers.getCattle();
  const [weightLogs, inventoryItems, costEntries] = await Promise.all([
    fetchers.getWeightLogs(cattle.map((c) => c.id)),
    fetchers.getInventoryItems(),
    fetchers.getCostEntries(),
  ]);
  const inventoryTransactions = await fetchers.getInventoryTransactions(inventoryItems.map((i) => i.id));

  return computeDataQualityReport(businessId, {
    cattle,
    weightLogs,
    inventoryItems,
    inventoryTransactions,
    costEntries,
  });
}
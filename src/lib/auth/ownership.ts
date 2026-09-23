import type { SupabaseClient } from "@supabase/supabase-js";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

/**
 * Validates that a database entity exists and strictly belongs to the given tenant (businessId).
 * Prevents horizontal privilege escalation (IDOR / BOLA) attacks across all modules.
 *
 * @param supabase Authenticated Supabase client
 * @param table Target database table name
 * @param resourceId Primary key ID of the entity
 * @param businessId Authoritative business ID from BusinessContext
 * @param idColumn Primary key column name (defaults to 'id')
 */
export async function assertResourceOwnership<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  resourceId: string,
  businessId: string,
  idColumn = "id"
): Promise<T> {
  if (!resourceId) {
    throw new NotFoundError(`Invalid ${table} resource ID`);
  }

  // If table is businesses itself
  if (table === "businesses") {
    const { data: biz, error } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", resourceId)
      .maybeSingle();

    if (error || !biz) {
      throw new NotFoundError(`Business record not found`, resourceId);
    }
    if (biz.id !== businessId) {
      throw new ForbiddenError(`Access denied: Business mismatch`);
    }
    return biz as T;
  }

  // Standard entity with business_id column
  const { data: record, error } = await supabase
    .from(table)
    .select("*")
    .eq(idColumn, resourceId)
    .maybeSingle();

  if (error || !record) {
    throw new NotFoundError(`${table} record not found`, resourceId);
  }

  const recordBizId = (record as Record<string, unknown>).business_id;
  if (recordBizId && recordBizId !== businessId) {
    throw new ForbiddenError(
      `Access denied: Resource [${table}:${resourceId}] does not belong to your business`
    );
  }

  return record as T;
}

/**
 * Validates multiple entities belong to the business in batch.
 */
export async function assertBatchResourceOwnership(
  supabase: SupabaseClient,
  table: string,
  resourceIds: string[],
  businessId: string,
  idColumn = "id"
): Promise<void> {
  if (!resourceIds.length) return;

  const { data: records, error } = await supabase
    .from(table)
    .select("*")
    .in(idColumn, resourceIds);

  if (error || !records || records.length !== resourceIds.length) {
    throw new NotFoundError(`One or more ${table} records were not found`);
  }

  const typedRecords = records as Array<{ business_id?: string }>;
  const mismatched = typedRecords.some((r) => r.business_id && r.business_id !== businessId);
  if (mismatched) {
    throw new ForbiddenError(
      `Access denied: One or more ${table} records belong to another tenant`
    );
  }
}
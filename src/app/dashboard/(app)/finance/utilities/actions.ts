"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/context/business-context";
import { requirePermission } from "@/lib/auth/permissions";
import { assertResourceOwnership } from "@/lib/auth/ownership";
import { PERMISSIONS } from "@/constants/roles";
import { validateDate, validatePositiveNumber } from "@/lib/validate";
import { verifyFinancialLock } from "@/lib/financial/financial-lock";
import { BILL_MAX_BYTES, BILL_TYPES, categoryNameError } from "@/lib/expenses/categories";
import type { ExpenseKind } from "@/types/database";

export type UtilityFormState = { error?: string; success?: boolean } | undefined;

const BUCKET = "expense-bills";
const PAGE = "/dashboard/finance/utilities";

function done() {
  revalidatePath(PAGE);
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard");
  revalidateTag("accounting", { expire: 0 });
}

function message(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

// ── Categories (admin) ─────────────────────────────────────────────────────

export async function createExpenseCategory(
  _prev: UtilityFormState,
  formData: FormData
): Promise<UtilityFormState> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.SETTINGS_EDIT);

    const kind = ((formData.get("kind") as string) || "utility") as ExpenseKind;
    const name = ((formData.get("name") as string) ?? "").trim();
    const { data: existing } = await supabase
      .from("expense_categories")
      .select("id, name")
      .eq("business_id", ctx.businessId)
      .eq("kind", kind);
    const invalid = categoryNameError(name, existing ?? []);
    if (invalid) return { error: invalid };

    const { error } = await supabase.from("expense_categories").insert({
      business_id: ctx.businessId,
      kind,
      name,
      sort_order: (existing?.length ?? 0) + 1,
    });
    if (error) return { error: error.code === "23505" ? `"${name}" already exists` : "Could not add the category" };
    done();
    return { success: true };
  } catch (err) {
    return { error: message(err, "Could not add the category") };
  }
}

export async function renameExpenseCategory(id: string, name: string): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.SETTINGS_EDIT);
    const cat = await assertResourceOwnership<{ business_id: string; kind: ExpenseKind }>(
      supabase, "expense_categories", id, ctx.businessId
    );
    const { data: existing } = await supabase
      .from("expense_categories")
      .select("id, name")
      .eq("business_id", ctx.businessId)
      .eq("kind", cat.kind);
    const invalid = categoryNameError(name, existing ?? [], id);
    if (invalid) return { error: invalid };
    // Renaming keeps the account (kind) and every expense linked to it.
    const { error } = await supabase.from("expense_categories").update({ name: name.trim() }).eq("id", id);
    if (error) return { error: error.code === "23505" ? `"${name.trim()}" already exists` : "Could not rename" };
    done();
    return {};
  } catch (err) {
    return { error: message(err, "Could not rename") };
  }
}

/** Categories are disabled, never deleted: past expenses keep pointing at them. */
export async function setExpenseCategoryActive(id: string, active: boolean): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.SETTINGS_EDIT);
    await assertResourceOwnership(supabase, "expense_categories", id, ctx.businessId);
    const { error } = await supabase.from("expense_categories").update({ is_active: active }).eq("id", id);
    if (error) return { error: "Could not update the category" };
    done();
    return {};
  } catch (err) {
    return { error: message(err, "Could not update the category") };
  }
}

// ── Utility expenses ───────────────────────────────────────────────────────

/**
 * Creates or corrects a utility expense. A correction updates the row; the database
 * trigger writes the old and new values to cost_entry_audit, so history is never lost.
 */
export async function saveUtilityExpense(
  _prev: UtilityFormState,
  formData: FormData
): Promise<UtilityFormState> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    const id = ((formData.get("id") as string) || "").trim() || null;
    requirePermission(ctx, id ? PERMISSIONS.COST_ENTRY_EDIT : PERMISSIONS.COST_ENTRY_CREATE);

    const categoryId = ((formData.get("category_id") as string) || "").trim();
    const amount = parseFloat(formData.get("amount") as string);
    const recordedAt = ((formData.get("recorded_at") as string) || "").trim();
    const description = ((formData.get("description") as string) || "").trim() || null;
    const file = formData.get("bill");

    if (!categoryId) return { error: "Choose a utility" };
    const amountErr = validatePositiveNumber(amount, "Amount");
    if (amountErr) return { error: amountErr };
    const dateErr = validateDate(recordedAt, "Date");
    if (dateErr) return { error: dateErr };

    const cat = await assertResourceOwnership<{ business_id: string; kind: ExpenseKind; is_active: boolean }>(
      supabase, "expense_categories", categoryId, ctx.businessId
    );
    if (cat.kind !== "utility") return { error: "That category is not a utility" };

    let previous: { recorded_at: string; category_id: string | null } | null = null;
    if (id) {
      previous = await assertResourceOwnership<{ business_id: string; recorded_at: string; category_id: string | null }>(
        supabase, "cost_entries", id, ctx.businessId
      );
      const oldLock = await verifyFinancialLock(supabase, ctx.businessId, previous.recorded_at);
      if (oldLock) return { error: oldLock };
    }
    // a disabled utility can still be kept on an existing expense, but not chosen for a new one
    if (!cat.is_active && previous?.category_id !== categoryId) return { error: "That utility is disabled" };
    const lock = await verifyFinancialLock(supabase, ctx.businessId, recordedAt);
    if (lock) return { error: lock };

    let attachmentPath: string | undefined;
    if (file instanceof File && file.size > 0) {
      const ext = BILL_TYPES[file.type];
      if (!ext) return { error: "Bill must be a PDF, JPG, PNG or WebP file" };
      if (file.size > BILL_MAX_BYTES) return { error: "Bill must be 5 MB or smaller" };
      attachmentPath = `${ctx.businessId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(attachmentPath, file, { contentType: file.type });
      if (upErr) return { error: "The bill could not be uploaded. The expense was not saved." };
    }

    const values = {
      category: "utilities",
      category_id: categoryId,
      amount,
      recorded_at: recordedAt,
      description,
      ...(attachmentPath ? { attachment_path: attachmentPath } : {}),
    };
    const { error } = id
      ? await supabase.from("cost_entries").update(values).eq("id", id)
      : await supabase.from("cost_entries").insert({
          business_id: ctx.businessId,
          type: "fixed",
          entry_class: "expense",
          ...values,
        });
    if (error) return { error: "Could not save the expense" };
    done();
    return { success: true };
  } catch (err) {
    return { error: message(err, "Could not save the expense") };
  }
}

/** Soft delete (the row and its audit history stay; it can be restored from Trash). */
export async function deleteUtilityExpense(id: string): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.COST_ENTRY_DELETE);
    const entry = await assertResourceOwnership<{ business_id: string; recorded_at: string }>(
      supabase, "cost_entries", id, ctx.businessId
    );
    const lock = await verifyFinancialLock(supabase, ctx.businessId, entry.recorded_at);
    if (lock) return { error: lock };
    const { error } = await supabase.from("cost_entries").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return { error: "Could not delete the expense" };
    done();
    return {};
  } catch (err) {
    return { error: message(err, "Could not delete the expense") };
  }
}

/** Short-lived link to view an attached bill (the bucket is private). */
export async function getBillUrl(id: string): Promise<{ url?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.FINANCE_VIEW);
    const entry = await assertResourceOwnership<{ business_id: string; attachment_path: string | null }>(
      supabase, "cost_entries", id, ctx.businessId
    );
    if (!entry.attachment_path) return { error: "No bill attached" };
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(entry.attachment_path, 300);
    if (error || !data) return { error: "Could not open the bill" };
    return { url: data.signedUrl };
  } catch (err) {
    return { error: message(err, "Could not open the bill") };
  }
}

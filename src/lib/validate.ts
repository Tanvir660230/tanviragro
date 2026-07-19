import { z } from "zod";

// ── Shared field schemas ──────────────────────────────────────────────────────

const today = () => new Date().toISOString().slice(0, 10);

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format")
  .refine((d) => d <= today(), "Date cannot be in the future");

export const positiveNumberSchema = z.coerce
  .number()
  .positive("Must be greater than zero");

export const nonNegativeNumberSchema = z.coerce
  .number()
  .min(0, "Must be zero or greater");

export const shortTextSchema = (max = 500) =>
  z.string().max(max, `Must be ${max} characters or less`).nullable().optional();

// ── Action schemas ────────────────────────────────────────────────────────────

export const weightLogSchema = z.object({
  cattle_id:   z.string().uuid("Invalid cattle ID"),
  weight_kg:   positiveNumberSchema.max(3000, "Weight seems too high"),
  recorded_at: dateSchema,
  notes:       shortTextSchema(500),
  girth_cm:    z.coerce.number().positive().max(500).nullable().optional(),
  length_cm:   z.coerce.number().positive().max(500).nullable().optional(),
});

export const createCattleSchema = z.object({
  tag_id:            z.string().min(1, "Tag ID is required").max(30, "Tag ID must be 30 characters or less"),
  gender:            z.enum(["male", "female"] as const),
  breed:             z.string().max(100).nullable().optional(),
  dob:               dateSchema.nullable().optional(),
  purchase_date:     dateSchema,
  purchase_price:    positiveNumberSchema,
  initial_weight_kg: positiveNumberSchema,
  transport_cost:    nonNegativeNumberSchema.default(0),
  haat_hasil:        nonNegativeNumberSchema.default(0),
  notes:             shortTextSchema(1000),
});

export const logConsumptionSchema = z.object({
  item_id:     z.string().uuid("Invalid item ID"),
  qty:         positiveNumberSchema,
  recorded_at: dateSchema,
  cattle_id:   z.string().uuid().nullable().optional(),
  notes:       shortTextSchema(500),
});

// ── Legacy helpers (kept for files not yet migrated to Zod) ──────────────────

function firstIssue(err: z.ZodError): string {
  // Zod v4 uses .issues; fall back to .errors for compatibility
  const issues = (err as unknown as { issues?: { message: string }[]; errors?: { message: string }[] }).issues
    ?? (err as unknown as { errors?: { message: string }[] }).errors;
  return issues?.[0]?.message ?? "Invalid input";
}

export function validateDate(date: string | null | undefined, label = "Date"): string | null {
  const result = dateSchema.safeParse(date);
  if (!result.success) return `${label}: ${firstIssue(result.error)}`;
  return null;
}

export function validatePositiveNumber(value: number, label = "Value"): string | null {
  const result = positiveNumberSchema.safeParse(value);
  if (!result.success) return `${label} ${firstIssue(result.error)}`;
  return null;
}

export function validateText(value: string | null | undefined, label: string, maxLength: number): string | null {
  const result = shortTextSchema(maxLength).safeParse(value);
  if (!result.success) return `${label} ${firstIssue(result.error)}`;
  return null;
}

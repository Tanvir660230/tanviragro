import { dateSchema, positiveNumberSchema, shortTextSchema, getZodErrorMessage } from "./validation/common";

export * from "./validation";

// ── Legacy validation helpers (retained for backward compatibility) ──────────

export function validateDate(date: string | null | undefined, label = "Date"): string | null {
  const result = dateSchema.safeParse(date);
  if (!result.success) return `${label}: ${getZodErrorMessage(result.error)}`;
  return null;
}

export function validatePositiveNumber(value: number, label = "Value"): string | null {
  const result = positiveNumberSchema.safeParse(value);
  if (!result.success) return `${label} ${getZodErrorMessage(result.error)}`;
  return null;
}

export function validateText(value: string | null | undefined, label: string, maxLength: number): string | null {
  const result = shortTextSchema(maxLength).safeParse(value);
  if (!result.success) return `${label} ${getZodErrorMessage(result.error)}`;
  return null;
}


import { z } from "zod";
import { todayDhaka } from "@/lib/dates";

export const todayIso = () => todayDhaka();

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)")
  .refine((d) => d <= todayIso(), "Date cannot be in the future");

export const futureAllowedDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)");

export const positiveNumberSchema = z.coerce
  .number()
  .positive("Must be greater than zero");

export const nonNegativeNumberSchema = z.coerce
  .number()
  .min(0, "Must be zero or greater");

export const percentageSchema = z.coerce
  .number()
  .min(0, "Must be at least 0%")
  .max(100, "Cannot exceed 100%");

export const uuidSchema = z
  .string()
  .uuid("Invalid UUID identifier");

export const shortTextSchema = (max = 500) =>
  z.string().max(max, `Must be ${max} characters or less`).nullable().optional();

export const requiredTextSchema = (min = 1, max = 255, label = "This field") =>
  z.string().trim().min(min, `${label} is required`).max(max, `${label} cannot exceed ${max} characters`);

export function getZodErrorMessage(err: z.ZodError): string {
  const issues = (err as unknown as { issues?: { message: string }[]; errors?: { message: string }[] }).issues
    ?? (err as unknown as { errors?: { message: string }[] }).errors;
  return issues?.[0]?.message ?? "Invalid input";
}

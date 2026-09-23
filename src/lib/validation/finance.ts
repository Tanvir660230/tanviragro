import { z } from "zod";
import { dateSchema, positiveNumberSchema, nonNegativeNumberSchema, shortTextSchema, uuidSchema, requiredTextSchema, percentageSchema } from "./common";
import { COST_TYPES, COST_ENTRY_CLASSES, DEPRECIATION_METHODS } from "@/constants/financial";

export const costEntrySchema = z.object({
  type:        z.enum(COST_TYPES),
  entry_class: z.enum(COST_ENTRY_CLASSES).default("expense"),
  category:    requiredTextSchema(1, 100, "Category"),
  amount:      positiveNumberSchema,
  recorded_at: dateSchema,
  description: shortTextSchema(500),
  cattle_id:   uuidSchema.nullable().optional(),
});

export const loanSchema = z.object({
  lender_name:       requiredTextSchema(1, 200, "Lender name"),
  principal_amount:  positiveNumberSchema,
  interest_rate_pct: z.coerce.number().min(0, "Interest rate cannot be negative").max(200, "Rate cannot exceed 200%").default(0),
  loan_date:         dateSchema,
  due_date:          dateSchema.nullable().optional(),
  purpose:           shortTextSchema(300),
  notes:             shortTextSchema(500),
});

export const loanPaymentSchema = z.object({
  loan_id: uuidSchema,
  amount:  positiveNumberSchema,
  paid_at: dateSchema,
  notes:   shortTextSchema(500),
});

export const fixedAssetSchema = z.object({
  name:                requiredTextSchema(1, 150, "Asset name"),
  category:            z.enum(["infrastructure", "equipment", "vehicle", "other"] as const).default("infrastructure"),
  description:         shortTextSchema(500),
  purchase_date:       dateSchema,
  purchase_cost:       positiveNumberSchema,
  salvage_value:       nonNegativeNumberSchema.default(0),
  useful_life_years:   positiveNumberSchema.max(100),
  depreciation_method: z.enum(DEPRECIATION_METHODS).default("straight_line"),
  declining_rate:      percentageSchema.nullable().optional(),
  notes:               shortTextSchema(500),
});

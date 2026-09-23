import { z } from "zod";
import { dateSchema, positiveNumberSchema, nonNegativeNumberSchema, shortTextSchema, uuidSchema, requiredTextSchema, percentageSchema } from "./common";
import { PARTNER_TYPES, PARTNER_TXN_TYPES } from "@/constants/financial";

export const partnerSchema = z.object({
  name:                requiredTextSchema(1, 200, "Partner name"),
  partner_type:        z.enum(PARTNER_TYPES).default("capital"),
  share_mode:          z.enum(["auto", "manual"] as const).default("auto"),
  investment_amount:   nonNegativeNumberSchema.default(0),
  profit_share_pct:    percentageSchema.default(0),
  labor_value_monthly: nonNegativeNumberSchema.nullable().optional(),
  cliff_months:        z.coerce.number().int().min(0).max(120).default(0),
  bears_loss:          z.coerce.boolean().default(true),
  joined_at:           dateSchema,
  notes:               shortTextSchema(500),
  entry_netpl:         z.coerce.number().nullable().optional(),
  entry_valuation:     z.coerce.number().nullable().optional(),
});

export const partnerTransactionSchema = z.object({
  partner_id:  uuidSchema,
  amount:      positiveNumberSchema,
  type:        z.enum(PARTNER_TXN_TYPES),
  recorded_at: dateSchema,
  notes:       shortTextSchema(500),
});

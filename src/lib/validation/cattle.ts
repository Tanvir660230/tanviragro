import { z } from "zod";
import { dateSchema, positiveNumberSchema, nonNegativeNumberSchema, shortTextSchema, uuidSchema } from "./common";

export const createCattleSchema = z.object({
  tag_id:            z.string().trim().min(1, "Tag ID is required").max(30, "Tag ID must be 30 characters or less"),
  gender:            z.enum(["male", "female"] as const),
  breed:             z.string().trim().max(100).nullable().optional(),
  dob:               dateSchema.nullable().optional(),
  purchase_date:     dateSchema,
  purchase_price:    positiveNumberSchema,
  initial_weight_kg: positiveNumberSchema.max(3000, "Weight exceeds biological limit"),
  target_weight_kg:  positiveNumberSchema.nullable().optional(),
  expected_daily_gain_kg: z.coerce.number().min(0.01).max(5.0).nullable().optional(),
  transport_cost:    nonNegativeNumberSchema.default(0),
  haat_hasil:        nonNegativeNumberSchema.default(0),
  vendor_id:         uuidSchema.nullable().optional(),
  notes:             shortTextSchema(1000),
});

export const updateCattleSchema = createCattleSchema.partial().extend({
  id: uuidSchema,
});

export const weightLogSchema = z.object({
  cattle_id:   uuidSchema,
  weight_kg:   positiveNumberSchema.max(3000, "Weight seems too high"),
  recorded_at: dateSchema,
  notes:       shortTextSchema(500),
  girth_cm:    z.coerce.number().positive().max(500).nullable().optional(),
  length_cm:   z.coerce.number().positive().max(500).nullable().optional(),
});

export const saleRecordSchema = z.object({
  cattle_id:          uuidSchema,
  sale_price_total:   positiveNumberSchema,
  weight_at_sale_kg:  positiveNumberSchema.max(3000),
  sold_at:            dateSchema,
  buyer_name:         z.string().trim().max(255).nullable().optional(),
});

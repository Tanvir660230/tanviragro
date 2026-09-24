import { z } from "zod";
import { dateSchema, positiveNumberSchema, nonNegativeNumberSchema, shortTextSchema, uuidSchema, requiredTextSchema } from "./common";
import { INVENTORY_CATEGORIES } from "@/constants/financial";

export const createInventoryItemSchema = z.object({
  name:                requiredTextSchema(1, 150, "Item name"),
  category:            z.enum(INVENTORY_CATEGORIES),
  unit:                requiredTextSchema(1, 30, "Unit"),
  low_stock_threshold: nonNegativeNumberSchema.nullable().optional(),
  initial_qty:         nonNegativeNumberSchema.default(0),
  unit_cost:           nonNegativeNumberSchema.nullable().optional(),
  purchase_date:       dateSchema.optional(),
  notes:               shortTextSchema(500),
});

export const addStockSchema = z.object({
  item_id:     uuidSchema,
  qty:         positiveNumberSchema,
  unit_cost:   nonNegativeNumberSchema.nullable().optional(),
  recorded_at: dateSchema,
  notes:       shortTextSchema(500),
});

export const logConsumptionSchema = z.object({
  item_id:     uuidSchema,
  qty:         positiveNumberSchema,
  recorded_at: dateSchema,
  cattle_id:   uuidSchema.nullable().optional(),
  notes:       shortTextSchema(500),
});

export const mixBatchSchema = z.object({
  recipe_id:      uuidSchema,
  target_amount:  positiveNumberSchema,
  recorded_at:    dateSchema,
  output_item_id: uuidSchema.nullable().optional(),
  batch_id:       uuidSchema,
});

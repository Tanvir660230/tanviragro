import { z } from "zod";
import { dateSchema, futureAllowedDateSchema, shortTextSchema, uuidSchema, requiredTextSchema } from "./common";
import { HEALTH_EVENT_TYPES } from "@/constants/health";

export const healthEventSchema = z.object({
  cattle_id:    uuidSchema,
  title:        requiredTextSchema(1, 150, "Event title"),
  event_type:   z.enum(HEALTH_EVENT_TYPES),
  scheduled_at: futureAllowedDateSchema,
  completed_at: dateSchema.nullable().optional(),
  notes:        shortTextSchema(500),
});

export const treatmentRecordSchema = z.object({
  cattle_id:          uuidSchema,
  diagnosis:          requiredTextSchema(1, 200, "Diagnosis"),
  medicine_name:      requiredTextSchema(1, 150, "Medicine name"),
  dosage:             requiredTextSchema(1, 100, "Dosage"),
  administered_at:    dateSchema,
  vet_name:           shortTextSchema(150),
  cost:               z.coerce.number().min(0).default(0),
  notes:              shortTextSchema(500),
});

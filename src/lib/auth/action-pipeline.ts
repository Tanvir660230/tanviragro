import { revalidatePath, revalidateTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/context/business-context";
import { requirePermission, requireRole } from "@/lib/auth/permissions";
import { Permission, ExtendedUserRole } from "@/constants/roles";
import { BusinessContext } from "@/types/context";
import { ActionResult } from "@/types/actions";
import { successResult, errorResult, ValidationError } from "@/lib/errors";
import { AuditService } from "@/lib/logging/audit";
import { logger } from "@/lib/logging/logger";

export interface ActionPipelineOptions<TInput> {
  permission?: Permission | Permission[];
  roles?: ExtendedUserRole[];
  schema?: z.ZodType<TInput>;
  verifyOwnership?: (
    input: TInput,
    ctx: BusinessContext,
    supabase: SupabaseClient
  ) => Promise<void>;
  revalidatePaths?: string[];
  revalidateTags?: string[];
  audit?: {
    action: string;
    module: string;
    getEntityId?: (input: TInput) => string | undefined;
  };
}

/**
 * Creates an enterprise-grade Server Action wrapped with the full security pipeline:
 * Authentication -> Business Context -> Permission Check -> Ownership -> Validation -> Execution -> Revalidation -> Audit -> Result
 */
export function createProtectedAction<TInput, TOutput>(
  options: ActionPipelineOptions<TInput>,
  handler: (
    input: TInput,
    ctx: BusinessContext,
    supabase: SupabaseClient
  ) => Promise<TOutput>
): (rawInput: TInput) => Promise<ActionResult<TOutput>> {
  return async (rawInput: TInput): Promise<ActionResult<TOutput>> => {
    const startTime = Date.now();
    let context: BusinessContext | null = null;
    let validatedInput: TInput = rawInput;

    try {
      const supabase = await createClient();

      // 1. Authentication & Authoritative Business Context
      context = await getBusinessContext(supabase);

      // 2. Permission Verification
      if (options.permission) {
        const perms = Array.isArray(options.permission)
          ? options.permission
          : [options.permission];
        for (const p of perms) {
          requirePermission(context, p);
        }
      }

      // 3. Role Verification (if restricted to specific roles)
      if (options.roles && options.roles.length > 0) {
        requireRole(context, options.roles);
      }

      // 4. Input Validation via Zod Schema
      if (options.schema) {
        const parseRes = options.schema.safeParse(rawInput);
        if (!parseRes.success) {
          throw new ValidationError(
            "Input validation failed",
            parseRes.error.flatten().fieldErrors
          );
        }
        validatedInput = parseRes.data;
      }

      // 5. Ownership & Tenancy Verification
      if (options.verifyOwnership) {
        await options.verifyOwnership(validatedInput, context, supabase);
      }

      // 6. Business Logic Execution
      const result = await handler(validatedInput, context, supabase);

      // 7. Cache Revalidation
      if (options.revalidatePaths) {
        for (const path of options.revalidatePaths) {
          revalidatePath(path);
        }
      }
      if (options.revalidateTags) {
        for (const tag of options.revalidateTags) {
          revalidateTag(tag, { expire: 0 });
        }
      }

      // 8. Audit Logging (Async, non-blocking)
      if (options.audit) {
        const entityId = options.audit.getEntityId
          ? options.audit.getEntityId(validatedInput)
          : undefined;

        AuditService.record({
          businessId: context.businessId,
          userId: context.user.id,
          action: options.audit.action,
          entityType: options.audit.module,
          entityId: entityId ?? "unknown",
          metadata: typeof validatedInput === "object" ? (validatedInput as Record<string, unknown>) : undefined,
        }).catch((err: unknown) => {
          logger.warn("Failed to write audit log in protected action", { err: String(err) });
        });
      }

      const durationMs = Date.now() - startTime;
      logger.debug("Protected action succeeded", {
        action: options.audit?.action ?? "action",
        module: options.audit?.module ?? "core",
        durationMs,
        businessId: context.businessId,
      });

      return successResult(result);
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);

      logger.error("Protected action failed", {
        action: options.audit?.action ?? "action",
        error: errorMsg,
        durationMs,
        businessId: context?.businessId,
      });

      return errorResult(errorMsg);
    }
  };
}
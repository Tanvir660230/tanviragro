import { NextRequest, NextResponse } from "next/server";
import { timingSafeMatch, getClientIp } from "@/lib/security";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/context/business-context";
import { requirePermission } from "@/lib/auth/permissions";
import { Permission, ExtendedUserRole } from "@/constants/roles";
import { BusinessContext } from "@/types/context";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";

export interface ApiGuardOptions {
  allowCron?: boolean;
  requiredPermission?: Permission;
  requiredRole?: ExtendedUserRole;
  rateLimitConfig?: {
    maxRequests: number;
    windowMs: number;
  };
}

export type ApiAuthSession =
  | { type: "cron"; businessId: string | null }
  | { type: "user"; context: BusinessContext };

/**
 * Standardized API Route Guard enforcing timing-safe Bearer authentication for Crons,
 * or Session-based Tenant Context + RBAC for authenticated routes.
 */
export async function authenticateApiRoute(
  req: NextRequest,
  options: ApiGuardOptions = {}
): Promise<{ auth: ApiAuthSession } | { response: NextResponse }> {
  const ip = getClientIp(req.headers);

  // Rate Limiting
  if (options.rateLimitConfig) {
    const isAllowed = rateLimit(
      `api:${ip}`,
      options.rateLimitConfig.maxRequests,
      options.rateLimitConfig.windowMs
    );
    if (!isAllowed) {
      return {
        response: NextResponse.json(
          { ok: false, error: "Too many requests. Please try again later." },
          { status: 429 }
        ),
      };
    }
  }

  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // 1. Check Cron / Bearer token if permitted
  if (options.allowCron && cronSecret && authHeader) {
    const expectedAuth = `Bearer ${cronSecret}`;
    if (timingSafeMatch(authHeader, expectedAuth)) {
      const cronBusinessId = process.env.CRON_BUSINESS_ID ?? null;
      return { auth: { type: "cron", businessId: cronBusinessId } };
    }
  }

  // 2. User Session Authentication & Tenant Scope
  try {
    const supabase = await createClient();
    const context = await getBusinessContext(supabase);

    if (options.requiredPermission) {
      requirePermission(context, options.requiredPermission);
    }

    if (options.requiredRole && context.role !== options.requiredRole && !context.isOwner) {
      return {
        response: NextResponse.json(
          { ok: false, error: `Forbidden: Requires ${options.requiredRole} role` },
          { status: 403 }
        ),
      };
    }

    return { auth: { type: "user", context } };
  } catch (err: unknown) {
    const status = err instanceof AppError ? err.statusCode : 401;
    const message = err instanceof Error ? err.message : "Unauthorized";

    logger.warn("API route authentication failed", {
      path: req.nextUrl.pathname,
      ip,
      error: message,
    });

    return {
      response: NextResponse.json(
        { ok: false, error: message },
        { status }
      ),
    };
  }
}
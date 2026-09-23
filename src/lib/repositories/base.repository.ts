import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";

export abstract class BaseRepository {
  protected constructor(
    protected readonly supabase: SupabaseClient,
    protected readonly businessId: string
  ) {}

  /**
   * Helper to ensure database queries return safe data or throw typed errors
   */
  protected handleDbError(error: unknown, operation = "Database operation"): never {
    if (error && typeof error === "object" && "message" in error) {
      const dbErr = error as { message: string; code?: string; details?: string };
      throw new AppError(
        `${operation} failed: ${dbErr.message}`,
        "INTERNAL_ERROR",
        500,
        { code: dbErr.code, details: dbErr.details }
      );
    }
    throw new AppError(`${operation} failed with an unknown error`, "INTERNAL_ERROR", 500);
  }
}

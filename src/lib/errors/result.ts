import { AppError } from "./app-error";
import type { ActionResult } from "@/types/actions";

export function successResult<T>(data?: T, warning?: string): ActionResult<T> {
  return {
    success: true,
    data,
    warning,
  };
}

export function errorResult<T = unknown>(message: string, errors?: { field?: string; message: string }[]): ActionResult<T> {
  return {
    success: false,
    error: message,
    errors: errors?.map((e) => ({ field: e.field, message: e.message })),
  };
}

/**
 * Standard Server Action error boundary wrapper.
 * Catches typed AppErrors and unforeseen exceptions, logging them and returning a clean ActionResult.
 */
export function handleActionError<T = unknown>(err: unknown, fallbackMessage = "Operation failed"): ActionResult<T> {
  if (err instanceof AppError) {
    return errorResult<T>(err.message);
  }
  if (err instanceof Error) {
    console.error("[ActionError]", err.message, err.stack);
    return errorResult<T>(err.message || fallbackMessage);
  }
  console.error("[ActionUnknownError]", err);
  return errorResult<T>(fallbackMessage);
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  businessId?: string | null;
  userId?: string | null;
  module?: string;
  action?: string;
  [key: string]: unknown;
}

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "secret",
  "auth",
  "authorization",
  "cookie",
  "apikey",
]);

function sanitizeData(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map(sanitizeData);

  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      sanitized[k] = "[REDACTED]";
    } else if (typeof v === "object") {
      sanitized[k] = sanitizeData(v);
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

class Logger {
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const payload = {
      timestamp,
      level: level.toUpperCase(),
      message,
      context: sanitizeData(context),
    };
    return JSON.stringify(payload);
  }

  public debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV !== "production") {
      console.debug(this.formatMessage("debug", message, context));
    }
  }

  public info(message: string, context?: LogContext): void {
    console.info(this.formatMessage("info", message, context));
  }

  public warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage("warn", message, context));
  }

  public error(message: string, error?: unknown, context?: LogContext): void {
    const errPayload = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : error;

    console.error(this.formatMessage("error", message, { ...context, error: errPayload }));
  }
}

export const logger = new Logger();

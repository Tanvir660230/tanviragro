import * as Sentry from "@sentry/nextjs";

if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_SENTRY_DSN) {
  console.warn("[Sentry] NEXT_PUBLIC_SENTRY_DSN is not set — errors will not be captured in production");
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.2,
  enabled: process.env.NODE_ENV === "production",
});

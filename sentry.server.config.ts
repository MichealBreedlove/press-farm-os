/**
 * Sentry server-side init (Node runtime). Loaded via src/instrumentation.ts.
 *
 * Inert until NEXT_PUBLIC_SENTRY_DSN is set in Vercel — without it nothing
 * initializes and nothing is sent. The DSN is safe to expose (it's a
 * write-only ingest address), hence the NEXT_PUBLIC_ prefix so the same var
 * also covers the browser init.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  // Errors are the point here; keep perf tracing cheap on a single-farm app.
  tracesSampleRate: 0.1,
});

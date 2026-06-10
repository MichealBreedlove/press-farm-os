/**
 * Sentry browser init. Bundled by withSentryConfig (next.config.js).
 * Inert until NEXT_PUBLIC_SENTRY_DSN is set — see sentry.server.config.ts.
 *
 * No session replay on purpose: it's the heaviest part of the SDK and this
 * is a mobile-first app on farm Wi-Fi.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 0.1,
});

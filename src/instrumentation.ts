/**
 * Next.js instrumentation hook — loads the per-runtime Sentry init.
 * Inert until NEXT_PUBLIC_SENTRY_DSN is set (see sentry.server.config.ts).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

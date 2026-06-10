/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Type and lint errors fail the build. The codebase passes `tsc --noEmit`
  // and `next lint` cleanly, and `main` auto-deploys to Vercel, so a broken
  // build must stop here rather than ship to prod.
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

// Sentry error monitoring. Runtime capture only needs the SDK init files
// (sentry.*.config.ts) plus this wrapper; it stays inert until
// NEXT_PUBLIC_SENTRY_DSN is set in Vercel. Source-map upload additionally
// needs SENTRY_AUTH_TOKEN/ORG/PROJECT and is skipped when they're absent,
// so local + CI builds keep working with zero Sentry env.
const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  // Don't fail the build over Sentry CLI hiccups — main auto-deploys.
  errorHandler: (err) => {
    console.warn("[sentry] build-time warning:", err?.message ?? err);
  },
});

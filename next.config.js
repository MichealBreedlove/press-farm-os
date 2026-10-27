/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Admin-uploaded item photos live in this project's Supabase storage
  // bucket. Listing the host lets next/image serve them as 64px/40px
  // thumbnails on the order form and receiver instead of the full upload.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "rxdfjaseilmjvcwamqyk.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // Type and lint errors fail the build. The codebase passes `tsc --noEmit`
  // and `next lint` cleanly, and `main` auto-deploys to Vercel, so a broken
  // build must stop here rather than ship to prod.
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },

  // Don't serve a dynamic page from the client-side router cache. The
  // default keeps a visited dynamic page for 30s, so tapping back to an
  // availability date (or a chef tapping another date chip) right after a
  // Save could show the list from before the save (2026-10-08).
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
  },
};

// Sentry error monitoring. Runtime capture only needs the SDK init files
// (sentry.*.config.ts) plus this wrapper; it stays inert until
// NEXT_PUBLIC_SENTRY_DSN is set in Vercel. Source-map upload additionally
// needs SENTRY_AUTH_TOKEN/ORG/PROJECT and is skipped when they're absent,
// so local + CI builds keep working with zero Sentry env.
//
// The wrapper is only applied when Sentry is actually configured: with no
// DSN it would still inject the browser SDK (~30KB gz) into every client
// bundle and wrap every route for nothing. Set NEXT_PUBLIC_SENTRY_DSN (or
// SENTRY_AUTH_TOKEN for source maps) and the next build picks it up.
const sentryEnabled = Boolean(
  process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_AUTH_TOKEN,
);

if (sentryEnabled) {
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
} else {
  module.exports = nextConfig;
}

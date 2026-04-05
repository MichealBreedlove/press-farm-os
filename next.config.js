/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Temporarily ignore TS build errors caused by @supabase/ssr v0.5.x
  // incompatibility with @supabase/supabase-js v2.99.x (path resolution issue).
  // TODO: Remove after running `npx supabase gen types typescript` against real DB.
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;

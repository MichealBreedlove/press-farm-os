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

module.exports = nextConfig;

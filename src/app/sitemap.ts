import type { MetadataRoute } from "next";

/**
 * sitemap.xml — only the public, indexable pages. The app itself lives behind
 * auth and is excluded in robots.ts.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://pressfarm.io";
  return [
    {
      url: `${base}/about`,
      // Fixed date: `new Date()` told crawlers the page changed on every
      // request. Bump when /about actually changes.
      lastModified: new Date("2026-10-27"),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}

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
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}

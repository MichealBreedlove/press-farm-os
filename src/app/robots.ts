import type { MetadataRoute } from "next";

/**
 * robots.txt — Press Farm OS is mostly an authenticated app. Only the public
 * marketing surface (/about) should be crawlable; everything behind sign-in
 * (admin, order portal, receiver, chef history, APIs, auth callbacks) is
 * disallowed so it stays out of search results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/order",
        "/receiver",
        "/history",
        "/events",
        "/calendar",
        "/api",
        "/auth",
      ],
    },
    sitemap: "https://pressfarm.io/sitemap.xml",
  };
}

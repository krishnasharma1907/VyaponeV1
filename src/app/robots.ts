import type { MetadataRoute } from "next";

/**
 * Next.js Dynamic Root robots.txt (/robots.txt) [VO-043]
 *
 * Directs search engine crawlers to public storefronts and marketing pages while
 * disallowing private back-office dashboards and internal authentication endpoints.
 *
 * Note: In accordance with PRD FINAL v2 §16 & §17, robots.txt is NOT an authorization
 * control; unpublished and tenant-isolated business data is enforced at the server
 * and database layer via Row-Level Security.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy", "/s/"],
      disallow: [
        "/dashboard/",
        "/workspace/",
        "/platform-admin/",
        "/counter/",
        "/api/",
        "/auth/",
        "/accept-invitation",
        "/update-password",
        "/verify-email",
      ],
    },
    sitemap: "https://vyapone.in/sitemap.xml",
  };
}

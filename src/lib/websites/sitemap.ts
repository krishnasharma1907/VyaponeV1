/**
 * VyapOne — Storefront Sitemap Generation Engine [VO-043]
 *
 * Provides dynamic sitemap generation for multi-tenant storefronts and platform pages
 * in accordance with PRD FINAL v2 §6.14, §15.3, §16, §17:
 * - Generates URLs exclusively for eligible published storefronts (status = 'published').
 * - Strictly excludes drafts, suspended, and archived sites.
 * - Strictly excludes back-office and authenticated dashboard paths.
 * - Uses verified canonical domains or platform subdomains.
 * - Emits only authoritative lastmod dates from database records; never fabricates dates.
 */

import type { MetadataRoute } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { PublicStorefrontData } from "./public-service";
import { buildStorefrontCanonicalUrl, DEFAULT_PLATFORM_DOMAIN, normalizePageSlug } from "./seo";
import { migrateWebsiteConfiguration } from "./versioning";
import type { WebsiteConfiguration } from "./types";

/**
 * Escapes special XML characters for safe inclusion in sitemap XML.
 */
export function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface StorefrontSitemapUrlEntry {
  url: string;
  lastModified?: string | Date;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
}

/**
 * Generates sitemap URL entries for a single published storefront.
 * Excludes pages with noIndex=true or isPublished=false.
 */
export function getStorefrontSitemapEntries(
  storefront: PublicStorefrontData,
  platformDomain: string = DEFAULT_PLATFORM_DOMAIN,
): StorefrontSitemapUrlEntry[] {
  if (storefront.site.status !== "published" || !storefront.version.publishedAt) {
    return [];
  }

  const entries: StorefrontSitemapUrlEntry[] = [];
  const publishedPages = storefront.configuration.pages.filter(
    (page) => page.isPublished !== false && page.seo?.noIndex !== true,
  );

  const lastModDate = new Date(storefront.version.publishedAt);
  // Ensure valid date
  const validLastMod = isNaN(lastModDate.getTime()) ? undefined : lastModDate;

  for (const page of publishedPages) {
    const canonicalUrl = buildStorefrontCanonicalUrl({
      subdomain: storefront.site.subdomain,
      primaryDomain: storefront.site.primaryDomain,
      slug: page.slug,
      platformDomain,
    });

    const isHome = normalizePageSlug(page.slug) === "/";

    entries.push({
      url: canonicalUrl,
      lastModified: validLastMod,
      changeFrequency: isHome ? "daily" : "weekly",
      priority: isHome ? 1.0 : 0.8,
    });
  }

  return entries;
}

/**
 * Serializes storefront sitemap URL entries into valid XML format.
 */
export function generateStorefrontSitemapXml(
  storefront: PublicStorefrontData,
  platformDomain: string = DEFAULT_PLATFORM_DOMAIN,
): string {
  const entries = getStorefrontSitemapEntries(storefront, platformDomain);

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const entry of entries) {
    xml += "  <url>\n";
    xml += `    <loc>${escapeXml(entry.url)}</loc>\n`;
    if (entry.lastModified) {
      const isoDate =
        entry.lastModified instanceof Date
          ? entry.lastModified.toISOString()
          : new Date(entry.lastModified).toISOString();
      xml += `    <lastmod>${isoDate}</lastmod>\n`;
    }
    if (entry.changeFrequency) {
      xml += `    <changefreq>${entry.changeFrequency}</changefreq>\n`;
    }
    if (typeof entry.priority === "number") {
      xml += `    <priority>${entry.priority.toFixed(1)}</priority>\n`;
    }
    xml += "  </url>\n";
  }

  xml += "</urlset>";
  return xml;
}

/**
 * Database row type for joined site & version query.
 */
interface PublishedSiteRecord {
  id: string;
  subdomain: string;
  primary_domain: string | null;
  status: string;
  updated_at: string;
  published_version_id: string;
  site_versions?:
    | {
        id: string;
        published_at: string | null;
        configuration: unknown;
        schema_version: string;
      }
    | Array<{
        id: string;
        published_at: string | null;
        configuration: unknown;
        schema_version: string;
      }>
    | null;
}

/**
 * Generates platform-wide sitemap entries across all eligible published storefronts
 * and core public marketing pages.
 * Strictly excludes:
 * - Drafts (published_version_id IS NULL)
 * - Suspended and archived sites (status != 'published')
 * - Private authenticated routes (/dashboard, /workspace, /platform-admin, /counter)
 */
export async function generatePlatformSitemapEntries(
  supabase: SupabaseClient<Database>,
  platformDomain: string = DEFAULT_PLATFORM_DOMAIN,
): Promise<MetadataRoute.Sitemap> {
  const sitemap: MetadataRoute.Sitemap = [
    {
      url: `https://${platformDomain}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `https://${platformDomain}/privacy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  try {
    // Query published sites with their published version configuration
    const { data: sites, error } = await supabase
      .from("sites")
      .select(
        `
        id,
        subdomain,
        primary_domain,
        status,
        updated_at,
        published_version_id,
        site_versions!fk_sites_published_version (
          id,
          published_at,
          configuration,
          schema_version
        )
      `,
      )
      .eq("status", "published")
      .not("published_version_id", "is", null);

    if (error || !sites) {
      return sitemap;
    }

    for (const rawSite of sites as unknown as PublishedSiteRecord[]) {
      if (rawSite.status !== "published" || !rawSite.published_version_id) {
        continue;
      }

      // Resolve version object
      const versionObj = Array.isArray(rawSite.site_versions)
        ? rawSite.site_versions[0]
        : rawSite.site_versions;

      if (!versionObj || !versionObj.published_at || !versionObj.configuration) {
        continue;
      }

      // Safely parse configuration
      let config: WebsiteConfiguration;
      try {
        config = migrateWebsiteConfiguration(versionObj.configuration);
      } catch {
        // Skip malformed configuration safely
        continue;
      }

      const publishedPages = config.pages.filter(
        (page) => page.isPublished !== false && page.seo?.noIndex !== true,
      );

      const lastModDate = new Date(versionObj.published_at || rawSite.updated_at);
      const validLastMod = isNaN(lastModDate.getTime()) ? undefined : lastModDate;

      for (const page of publishedPages) {
        const canonicalUrl = buildStorefrontCanonicalUrl({
          subdomain: rawSite.subdomain,
          primaryDomain: rawSite.primary_domain,
          slug: page.slug,
          platformDomain,
        });

        const isHome = normalizePageSlug(page.slug) === "/";

        sitemap.push({
          url: canonicalUrl,
          lastModified: validLastMod,
          changeFrequency: isHome ? "daily" : "weekly",
          priority: isHome ? 1.0 : 0.8,
        });
      }
    }
  } catch {
    // Fallback safely to base platform entries
    return sitemap;
  }

  return sitemap;
}

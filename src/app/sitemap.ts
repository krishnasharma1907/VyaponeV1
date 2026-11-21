import type { MetadataRoute } from "next";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generatePlatformSitemapEntries } from "@/lib/websites/sitemap";

/**
 * Next.js Dynamic Root Sitemap (/sitemap.xml) [VO-043]
 *
 * Generates an indexable sitemap of published public storefront pages and core marketing pages.
 * Strictly excludes:
 * - Draft, suspended, or archived storefronts.
 * - Authenticated back-office routes (/dashboard, /workspace, /platform-admin, /counter).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const supabase = createAdminSupabaseClient();
    return await generatePlatformSitemapEntries(supabase);
  } catch {
    try {
      const supabase = await createServerSupabaseClient();
      return await generatePlatformSitemapEntries(supabase);
    } catch {
      // Safe fallback if database client initialization fails
      return [
        {
          url: "https://vyapone.in",
          lastModified: new Date(),
          changeFrequency: "daily",
          priority: 1.0,
        },
        {
          url: "https://vyapone.in/privacy",
          lastModified: new Date(),
          changeFrequency: "monthly",
          priority: 0.5,
        },
      ];
    }
  }
}

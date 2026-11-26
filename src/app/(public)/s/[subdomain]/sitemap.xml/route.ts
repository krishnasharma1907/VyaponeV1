import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolvePublishedStorefrontBySubdomain } from "@/lib/websites/public-service";
import { generateStorefrontSitemapXml } from "@/lib/websites/sitemap";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ subdomain: string }> },
): Promise<Response> {
  const { subdomain } = await params;

  let storefront = null;
  try {
    const supabase = createAdminSupabaseClient();
    storefront = await resolvePublishedStorefrontBySubdomain(supabase, subdomain);
  } catch {
    try {
      const supabase = await createServerSupabaseClient();
      storefront = await resolvePublishedStorefrontBySubdomain(supabase, subdomain);
    } catch {
      storefront = null;
    }
  }

  // Fail closed if storefront does not exist, is draft-only, or is unpublished
  if (!storefront || storefront.site.status !== "published") {
    return new Response("Not Found", { status: 404 });
  }

  const sitemapXml = generateStorefrontSitemapXml(storefront);

  return new Response(sitemapXml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

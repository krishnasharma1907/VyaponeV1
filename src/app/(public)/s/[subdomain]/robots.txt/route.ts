import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolvePublishedStorefrontBySubdomain } from "@/lib/websites/public-service";
import { buildStorefrontCanonicalUrl } from "@/lib/websites/seo";

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

  // If unpublished, draft, suspended, or not found: disallow all crawlers
  if (!storefront || storefront.site.status !== "published") {
    const disallowText = "User-agent: *\nDisallow: /\n";
    return new Response(disallowText, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  const canonicalRoot = buildStorefrontCanonicalUrl({
    subdomain: storefront.site.subdomain,
    primaryDomain: storefront.site.primaryDomain,
    slug: "/",
  });

  const robotsText = [
    "User-agent: *",
    "Allow: /",
    `Sitemap: ${canonicalRoot}/sitemap.xml`,
    "",
  ].join("\n");

  return new Response(robotsText, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

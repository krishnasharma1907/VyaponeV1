/**
 * VyapOne — Dynamic QR Redirect Route Handler [VO-049]
 *
 * Handles public scans of permanent dynamic QR codes:
 * - Permanent QR URLs follow the pattern /qr/[slug]
 * - Destination resolves dynamically without requiring standee reprints
 * - Open-redirect protected: strictly targets published business storefront or internal pages
 * - Returns HTTP 307 Temporary Redirect with Cache-Control: no-store to prevent permanent client caching
 */

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveQrDestination } from "@/lib/websites/qr/service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;

  if (!slug) {
    return new Response("QR Code slug is required", { status: 400 });
  }

  let supabase;
  try {
    supabase = createAdminSupabaseClient();
  } catch {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      return new Response("Database connection unavailable", { status: 503 });
    }
  }

  const hostHeader = request.headers.get("host") || undefined;
  const resolved = await resolveQrDestination(supabase, slug, { hostHeader });

  if (!resolved) {
    return new Response("QR destination not found or website is not currently published", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }

  return new Response(null, {
    status: 307,
    headers: {
      Location: resolved.redirectUrl,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}

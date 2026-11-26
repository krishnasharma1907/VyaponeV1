/**
 * VyapOne — Dynamic QR Code Engine [VO-049]
 *
 * Provides stable QR code management with dynamic destination configuration:
 * - Provision stable public slugs (e.g. /qr/qr_abcd1234)
 * - Dynamic resolution without reprinting physical standees
 * - Open-redirect protection (strict internal path / published storefront destinations)
 * - HTTP 307 temporary redirects with Cache-Control: no-store
 * - Scan-safe SVG generation with 4-module quiet zone and high-contrast styling
 */

import QRCode from "qrcode";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { assertBusinessAccess } from "@/lib/auth/tenant-access";
import { recordAuditEvent } from "@/lib/audit/service";
import { updateQrDestinationInputSchema, type UpdateQrDestinationInput } from "../schemas";
import type { QrCodeRow, QrDestinationConfig } from "../types";
import { WebsiteError } from "../service";

export interface ResolvedQrDestination {
  redirectUrl: string;
  qrCode: QrCodeRow;
}

/**
 * Validates and sanitizes a destination path to prevent open redirects.
 */
function sanitizeDestinationPath(rawPath?: string): string {
  if (!rawPath) return "/";

  // Prevent protocol-relative URLs (//evil.com), javascript:, data:, or absolute URLs
  if (
    rawPath.startsWith("//") ||
    rawPath.includes("://") ||
    rawPath.toLowerCase().startsWith("javascript:") ||
    rawPath.toLowerCase().startsWith("data:")
  ) {
    return "/";
  }

  // Ensure path starts with single /
  return rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
}

/**
 * Retrieves or lazily provisions the stable main storefront QR code for a website.
 */
export async function getOrCreateMainStorefrontQr(
  supabase: SupabaseClient<Database>,
  siteId: string,
): Promise<QrCodeRow> {
  // 1. Check if already exists
  const { data: existingQr } = await supabase
    .from("qr_codes")
    .select("*")
    .eq("site_id", siteId)
    .eq("type", "main_storefront")
    .maybeSingle();

  if (existingQr) {
    return existingQr;
  }

  // 2. Fetch site to assert access and get business_id
  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("id, business_id")
    .eq("id", siteId)
    .maybeSingle();

  if (siteError || !site) {
    throw new WebsiteError("Site not found", "SITE_NOT_FOUND", 404);
  }

  await assertBusinessAccess(supabase, site.business_id);

  // 3. Generate stable unique slug
  const publicSlug = `qr_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

  // 4. Provision QR row
  const { data: newQr, error: insertError } = await supabase
    .from("qr_codes")
    .insert({
      site_id: site.id,
      business_id: site.business_id,
      type: "main_storefront",
      public_slug: publicSlug,
      destination_configuration: { type: "storefront" },
      scan_count: 0,
      status: "active",
    })
    .select("*")
    .single();

  if (insertError || !newQr) {
    // If concurrent insert occurred, attempt fetch again
    const { data: concurrentQr } = await supabase
      .from("qr_codes")
      .select("*")
      .eq("site_id", siteId)
      .eq("type", "main_storefront")
      .maybeSingle();

    if (concurrentQr) return concurrentQr;

    throw new WebsiteError(
      `Failed to provision QR code: ${insertError?.message || "Unknown error"}`,
      "QR_PROVISION_FAILED",
      500,
    );
  }

  return newQr;
}

/**
 * Updates dynamic destination configuration for a QR code.
 * Enforces open-redirect protection.
 */
export async function updateQrDestination(
  supabase: SupabaseClient<Database>,
  input: UpdateQrDestinationInput,
): Promise<QrCodeRow> {
  const parsed = updateQrDestinationInputSchema.parse(input);

  // 1. Fetch QR record
  const { data: qr, error: qrError } = await supabase
    .from("qr_codes")
    .select("*")
    .eq("id", parsed.qrCodeId)
    .eq("site_id", parsed.siteId)
    .maybeSingle();

  if (qrError || !qr) {
    throw new WebsiteError("QR code not found", "QR_NOT_FOUND", 404);
  }

  // 2. Assert tenant access & management permission
  const { business } = await assertBusinessAccess(supabase, qr.business_id, {
    requiredPermission: "business:update_profile",
  });

  // 3. Sanitize destination config
  const sanitizedConfig: QrDestinationConfig = {
    type: parsed.destinationConfiguration.type,
    path: parsed.destinationConfiguration.path
      ? sanitizeDestinationPath(parsed.destinationConfiguration.path)
      : undefined,
    pageSlug: parsed.destinationConfiguration.pageSlug
      ? sanitizeDestinationPath(parsed.destinationConfiguration.pageSlug)
      : undefined,
    utmParams: parsed.destinationConfiguration.utmParams,
  };

  // 4. Update database row
  const { data: updatedQr, error: updateError } = await supabase
    .from("qr_codes")
    .update({
      destination_configuration: sanitizedConfig as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", qr.id)
    .select("*")
    .single();

  if (updateError || !updatedQr) {
    throw new WebsiteError(
      `Failed to update QR destination: ${updateError?.message || "Unknown error"}`,
      "QR_UPDATE_FAILED",
      500,
    );
  }

  // 5. Emit audit event
  try {
    if (business.workspace_id) {
      await recordAuditEvent(supabase, {
        workspaceId: business.workspace_id,
        action: "site.qr_updated",
        resource: "qr_codes",
        metadata: {
          site_id: parsed.siteId,
          business_id: qr.business_id,
          qr_code_id: qr.id,
          public_slug: qr.public_slug,
          new_destination: sanitizedConfig,
        },
      });
    }
  } catch {
    // Non-blocking audit recording
  }

  return updatedQr;
}

/**
 * Resolves a dynamic QR code slug to its destination URL.
 * Strictly enforces open-redirect protection and tracks scan count.
 */
export async function resolveQrDestination(
  supabase: SupabaseClient<Database>,
  slug: string,
  options?: { hostHeader?: string; defaultDomain?: string },
): Promise<ResolvedQrDestination | null> {
  const cleanSlug = slug.trim();

  // 1. Fetch QR record
  const { data: qr, error: qrError } = await supabase
    .from("qr_codes")
    .select("*")
    .eq("public_slug", cleanSlug)
    .eq("status", "active")
    .maybeSingle();

  if (qrError || !qr) {
    return null;
  }

  // 2. Fetch associated site
  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("id, subdomain, primary_domain, status")
    .eq("id", qr.site_id)
    .maybeSingle();

  if (siteError || !site || site.status !== "published") {
    // Non-published sites cannot be visited via public QR
    return null;
  }

  // 3. Resolve base origin (Verified custom domain -> Subdomain platform domain -> host fallback)
  let baseOrigin: string;
  if (site.primary_domain) {
    baseOrigin = `https://${site.primary_domain}`;
  } else if (site.subdomain) {
    baseOrigin = `https://${site.subdomain}.vyapone.in`;
  } else if (options?.hostHeader) {
    baseOrigin = `https://${options.hostHeader}`;
  } else {
    baseOrigin = options?.defaultDomain || "https://vyapone.in";
  }

  // 4. Resolve relative path from destination configuration
  const dest = (qr.destination_configuration as unknown as QrDestinationConfig) || {
    type: "storefront",
  };
  let path = "/";

  if (dest.type === "page" && dest.pageSlug) {
    path = sanitizeDestinationPath(dest.pageSlug);
  } else if (dest.type === "internal_path" && dest.path) {
    path = sanitizeDestinationPath(dest.path);
  }

  // 5. Append UTM parameters if configured
  const urlObj = new URL(path, baseOrigin);
  if (dest.utmParams) {
    if (dest.utmParams.source) urlObj.searchParams.set("utm_source", dest.utmParams.source);
    if (dest.utmParams.medium) urlObj.searchParams.set("utm_medium", dest.utmParams.medium);
    if (dest.utmParams.campaign) urlObj.searchParams.set("utm_campaign", dest.utmParams.campaign);
  }

  // Always tag qr scan as source if no source provided
  if (!urlObj.searchParams.has("utm_source")) {
    urlObj.searchParams.set("utm_source", "vyapone_qr");
  }

  const finalRedirectUrl = urlObj.toString();

  // 6. Track scan count asynchronously
  try {
    await supabase
      .from("qr_codes")
      .update({
        scan_count: (qr.scan_count || 0) + 1,
        last_scanned_at: new Date().toISOString(),
      })
      .eq("id", qr.id);
  } catch {
    // Non-blocking scan counting
  }

  return {
    redirectUrl: finalRedirectUrl,
    qrCode: qr,
  };
}

/**
 * Generates a scan-safe QR code SVG string with high contrast and minimum 4-module quiet zone.
 */
export async function generateScanSafeQrSvg(
  targetUrl: string,
  options?: { margin?: number; width?: number },
): Promise<string> {
  const margin = options?.margin && options.margin >= 4 ? options.margin : 4;
  const width = options?.width && options.width >= 120 ? options.width : 256;

  return QRCode.toString(targetUrl, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin,
    width,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
}

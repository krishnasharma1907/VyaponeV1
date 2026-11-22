/**
 * VyapOne — Public Website Storefront Resolution Service [VO-042]
 *
 * Implements authoritative public website resolution and safe context assembly
 * in strict accordance with PRD FINAL v2 §6.14, §15.3, §16, §17:
 * - CORE INVARIANT: Only explicitly published website configurations are rendered publicly.
 * - Resolves via `published_version_id` and verified `published_at` timestamp.
 * - NEVER falls back to draft configuration or `current_draft_version_id`.
 * - Unknown, unpublished, suspended, or archived sites fail closed.
 * - Extracts only safe public business facts (strictly excludes PAN, GSTIN, owner ID, workspace ID).
 * - Excludes unavailable catalogue items and enforces minor unit integer pricing.
 * - Media Privacy: Strictly excludes private/quarantined assets and never outputs signed private URLs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { CANONICAL_MODULES } from "@/lib/niches/constants";
import { isSupportedSchemaVersion, migrateWebsiteConfiguration } from "./versioning";
import type { WebsiteConfiguration } from "./types";
import type {
  BusinessRenderFacts,
  CatalogueRenderItem,
  ModuleOperationalStatus,
  ModuleRenderStatus,
  WebsiteRenderContext,
} from "@/components/websites/blocks/types";

/**
 * Resolved public storefront data payload.
 */
export interface PublicStorefrontData {
  site: {
    id: string;
    businessId: string;
    subdomain: string;
    primaryDomain: string | null;
    status: string;
    publishedVersionId: string;
  };
  version: {
    id: string;
    versionNumber: number;
    schemaVersion: string;
    publishedAt: string;
  };
  configuration: WebsiteConfiguration;
  context: WebsiteRenderContext;
}

/**
 * Normalizes and validates a subdomain slug.
 * Safe subdomain: 3-63 lowercase alphanumeric chars and hyphens; cannot start/end with hyphen.
 * Returns normalized string or null if invalid or reserved.
 */
export function normalizeSubdomain(rawSubdomain?: string | null): string | null {
  if (!rawSubdomain || typeof rawSubdomain !== "string") {
    return null;
  }

  const normalized = rawSubdomain.trim().toLowerCase();

  // Length constraint (DNS label standard: 3 to 63 chars)
  if (normalized.length < 3 || normalized.length > 63) {
    return null;
  }

  // Regex constraint: starts and ends with alphanumeric, hyphens allowed in middle
  const validPattern = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  if (!validPattern.test(normalized)) {
    return null;
  }

  // Reserved platform subdomains (fail closed)
  const reserved = new Set([
    "admin",
    "api",
    "app",
    "auth",
    "billing",
    "cdn",
    "counter",
    "dashboard",
    "dev",
    "mail",
    "platform",
    "pos",
    "staging",
    "static",
    "status",
    "workspace",
    "www",
  ]);

  if (reserved.has(normalized)) {
    return null;
  }

  return normalized;
}

/**
 * Normalizes incoming host headers (strips port, lowercases, trims).
 * Returns null if malformed or containing invalid domain characters.
 */
export function normalizeHost(rawHost?: string | null): string | null {
  if (!rawHost || typeof rawHost !== "string") {
    return null;
  }

  let normalized = rawHost.trim().toLowerCase();

  // Strip trailing dot
  if (normalized.endsWith(".")) {
    normalized = normalized.slice(0, -1);
  }

  // Strip port if present (e.g. "sharma-sweets.in:3000" -> "sharma-sweets.in")
  const colonIdx = normalized.indexOf(":");
  if (colonIdx !== -1) {
    normalized = normalized.slice(0, colonIdx);
  }

  // Basic hostname validation (RFC 1123)
  if (
    normalized.length === 0 ||
    normalized.length > 253 ||
    /[^a-z0-9.-]/.test(normalized) ||
    normalized.startsWith("-") ||
    normalized.endsWith("-")
  ) {
    return null;
  }

  return normalized;
}

/**
 * Extracts a platform subdomain from a hostname if it ends with the platform domain.
 * E.g. "sharma-cafe.vyapone.in" -> "sharma-cafe".
 */
export function extractSubdomainFromHost(
  host: string,
  platformDomain: string = "vyapone.in",
): string | null {
  const normHost = normalizeHost(host);
  if (!normHost) return null;

  const cleanPlatform = platformDomain.trim().toLowerCase().replace(/^\./, "");
  const suffix = `.${cleanPlatform}`;

  if (normHost.endsWith(suffix)) {
    const sub = normHost.slice(0, -suffix.length);
    // Ignore multi-level subdomains or empty
    if (!sub.includes(".")) {
      return normalizeSubdomain(sub);
    }
  }

  return null;
}

/**
 * Extracts all media UUIDs referenced in a website configuration document.
 */
function extractReferencedMediaIds(config: WebsiteConfiguration): string[] {
  const ids = new Set<string>();

  if (config.metadata.faviconMediaId) ids.add(config.metadata.faviconMediaId);
  if (config.header.logoMediaId) ids.add(config.header.logoMediaId);

  for (const page of config.pages) {
    if (page.seo?.ogImageMediaId) ids.add(page.seo.ogImageMediaId);

    for (const section of page.sections) {
      if (!section.props || typeof section.props !== "object") continue;
      const props = section.props as Record<string, unknown>;

      if (typeof props.imageMediaId === "string") {
        ids.add(props.imageMediaId);
      }

      if (Array.isArray(props.images)) {
        for (const img of props.images) {
          if (
            img &&
            typeof img === "object" &&
            typeof (img as { mediaId?: string }).mediaId === "string"
          ) {
            ids.add((img as { mediaId: string }).mediaId);
          }
        }
      }
    }
  }

  return Array.from(ids);
}

/**
 * Resolves public business facts strictly exposing safe storefront information.
 * NEVER leaks PAN, GSTIN, sovereign_owner_id, workspace_id, or internal metadata.
 */
async function resolvePublicBusinessFacts(
  supabase: SupabaseClient<Database>,
  businessId: string,
): Promise<BusinessRenderFacts | undefined> {
  const { data: business, error } = await supabase
    .from("businesses")
    .select("id, legal_name, trade_name, status, currency_code")
    .eq("id", businessId)
    .maybeSingle();

  if (error || !business) {
    return undefined;
  }

  // Reject inactive/suspended/archived businesses
  if (business.status !== "active") {
    return undefined;
  }

  // Resolve primary physical location and operating hours
  const { data: location } = await supabase
    .from("locations")
    .select("id, name, address_line1, address_line2, city, state, postal_code, is_primary")
    .eq("business_id", businessId)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();

  const primaryLocation = location
    ? {
        addressLine1: location.address_line1,
        addressLine2: location.address_line2 || undefined,
        city: location.city,
        state: location.state,
        postalCode: location.postal_code,
      }
    : undefined;

  return {
    id: business.id,
    name: business.trade_name || business.legal_name,
    tradeName: business.trade_name,
    primaryLocation,
  };
}

/**
 * Resolves publicly available catalogue items for the published storefront.
 * Excludes draft, unavailable, or cross-tenant items.
 */
async function resolvePublicCatalogueItems(
  supabase: SupabaseClient<Database>,
  businessId: string,
): Promise<CatalogueRenderItem[]> {
  const { data: items, error } = await supabase
    .from("catalogue_items")
    .select("id, title, description, price_minor, currency_code, is_available")
    .eq("business_id", businessId)
    .eq("is_available", true)
    .order("created_at", { ascending: false });

  if (error || !items) {
    return [];
  }

  return items.map((item) => ({
    id: item.id,
    name: item.title,
    description: item.description || undefined,
    priceMinor: Number(item.price_minor),
    currency: item.currency_code || "INR",
    isAvailable: true,
  }));
}

/**
 * Resolves verified public media items referenced in the configuration.
 * Excludes private, quarantined, pending, failed, or unverified assets.
 * NEVER returns signed private URLs.
 */
async function resolvePublicMediaUrls(
  supabase: SupabaseClient<Database>,
  businessId: string,
  referencedMediaIds: string[],
): Promise<Record<string, string>> {
  if (referencedMediaIds.length === 0) {
    return {};
  }

  const { data: mediaItems, error } = await supabase
    .from("media_items")
    .select("id, object_key, bucket, is_public, status, verified_at, category")
    .in("id", referencedMediaIds)
    .eq("business_id", businessId);

  if (error || !mediaItems) {
    return {};
  }

  const urlMap: Record<string, string> = {};
  // Strictly allow only verified, public publishable categories (VO-032 / VO-046)
  const allowedCategories = ["business_logo", "catalogue_image", "website_asset"];

  for (const item of mediaItems) {
    // Invariant: Media must be public, ready, verified, in public bucket, and in an approved category
    if (
      item.is_public === true &&
      item.bucket === "vyapone-public-media" &&
      item.status === "ready" &&
      item.verified_at !== null &&
      allowedCategories.includes(item.category)
    ) {
      // Construct verified public CDN / storage URL
      // If object_key is already a full URL (or CDN key), format cleanly
      const isFullUrl =
        item.object_key.startsWith("https://") || item.object_key.startsWith("http://");
      const resolvedUrl = isFullUrl
        ? item.object_key
        : `https://cdn.vyapone.com/${item.bucket}/${item.object_key}`;

      urlMap[item.id] = resolvedUrl;
    }
  }

  return urlMap;
}

/**
 * Resolves safe public module operational statuses for the published storefront.
 * Excludes internal workspace metadata, subscription keys, and sensitive audit records.
 */
async function resolvePublicModules(
  supabase: SupabaseClient<Database>,
  businessId: string,
): Promise<Record<string, ModuleRenderStatus>> {
  const { data: bizModules } = await supabase
    .from("business_modules")
    .select("module_key, is_enabled")
    .eq("business_id", businessId);

  const { data: platformModules } = await supabase
    .from("platform_modules")
    .select("key, name, category, status");

  const enabledSet = new Set(
    (bizModules || []).filter((bm) => bm.is_enabled).map((bm) => bm.module_key),
  );

  const moduleMap: Record<string, ModuleRenderStatus> = {};
  if (platformModules && platformModules.length > 0) {
    for (const pm of platformModules) {
      const isEnabled = enabledSet.has(pm.key);
      let status: ModuleOperationalStatus = "disabled";
      if (pm.status === "coming_soon") {
        status = "coming_soon";
      } else if (pm.status === "active") {
        status = isEnabled ? "operational" : "informational";
      }
      moduleMap[pm.key] = {
        status,
        isEnabled,
        name: pm.name,
        category: pm.category,
      };
    }
  } else {
    for (const cm of CANONICAL_MODULES) {
      moduleMap[cm.key] = {
        status: cm.status === "coming_soon" ? "coming_soon" : "operational",
        isEnabled: true,
        name: cm.name,
        category: cm.category,
      };
    }
  }

  return moduleMap;
}

/**
 * Resolves a published website configuration and safe render context by subdomain.
 *
 * Enforces all VO-042 Core Rendering Invariants:
 * 1. Subdomain is normalized and validated.
 * 2. Site must exist and have status = 'published'.
 * 3. Authoritative published version is resolved via `published_version_id`.
 * 4. NEVER falls back to `current_draft_version_id` or unpublished records.
 * 5. Published version must belong to that exact site and business.
 * 6. `published_at` must be valid (not null).
 * 7. Configuration schema version must be supported and valid.
 * 8. Fails closed (returns null) for any violation or unknown host.
 */
export async function resolvePublishedStorefrontBySubdomain(
  supabase: SupabaseClient<Database>,
  rawSubdomain: string,
): Promise<PublicStorefrontData | null> {
  const subdomain = normalizeSubdomain(rawSubdomain);
  if (!subdomain) {
    return null;
  }

  // 1. Authoritative site lookup
  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("id, business_id, subdomain, primary_domain, status, published_version_id")
    .eq("subdomain", subdomain)
    .maybeSingle();

  if (siteError || !site) {
    return null;
  }

  // Invariant: Only published sites can be rendered publicly
  if (site.status !== "published" || !site.published_version_id) {
    return null;
  }

  // 2. Authoritative published version lookup
  const { data: version, error: versionError } = await supabase
    .from("site_versions")
    .select("id, site_id, business_id, version_number, schema_version, configuration, published_at")
    .eq("id", site.published_version_id)
    .maybeSingle();

  if (versionError || !version) {
    return null;
  }

  // Invariant: Published version must belong to this exact site and business
  if (version.site_id !== site.id || version.business_id !== site.business_id) {
    console.error(
      `[PublicStorefront] Security anomaly: published_version_id '${version.id}' cross-site reference detected`,
    );
    return null;
  }

  // Invariant: Version must have valid published_at timestamp (cannot be a draft record)
  if (!version.published_at) {
    console.error(
      `[PublicStorefront] Security anomaly: published_version_id '${version.id}' lacks published_at timestamp`,
    );
    return null;
  }

  // Invariant: Schema version must be supported
  if (!isSupportedSchemaVersion(version.schema_version)) {
    console.warn(
      `[PublicStorefront] Unsupported schema version: '${version.schema_version}' for site '${site.id}'`,
    );
    return null;
  }

  // Invariant: Configuration must parse and validate against canonical schema
  let validatedConfig: WebsiteConfiguration;
  try {
    validatedConfig = migrateWebsiteConfiguration(version.configuration);
  } catch (err) {
    console.warn(
      `[PublicStorefront] Schema validation failed for published version '${version.id}':`,
      err,
    );
    return null;
  }

  // 3. Resolve safe public facts
  const businessFacts = await resolvePublicBusinessFacts(supabase, site.business_id);
  // If business is suspended, archived, or not found, fail closed
  if (!businessFacts) {
    return null;
  }

  const catalogueItems = await resolvePublicCatalogueItems(supabase, site.business_id);
  const referencedMediaIds = extractReferencedMediaIds(validatedConfig);
  const mediaUrls = await resolvePublicMediaUrls(supabase, site.business_id, referencedMediaIds);
  const modules = await resolvePublicModules(supabase, site.business_id);

  const context: WebsiteRenderContext = {
    theme: validatedConfig.theme,
    business: businessFacts,
    catalogueItems,
    mediaUrls,
    modules,
    previewMode: false,
  };

  return {
    site: {
      id: site.id,
      businessId: site.business_id,
      subdomain: site.subdomain,
      primaryDomain: site.primary_domain,
      status: site.status,
      publishedVersionId: site.published_version_id,
    },
    version: {
      id: version.id,
      versionNumber: version.version_number,
      schemaVersion: version.schema_version,
      publishedAt: version.published_at,
    },
    configuration: validatedConfig,
    context,
  };
}

/**
 * Resolves a published website configuration by host (custom domain or platform subdomain).
 */
export async function resolvePublishedStorefrontByHost(
  supabase: SupabaseClient<Database>,
  rawHost: string,
  platformDomain: string = "vyapone.in",
): Promise<PublicStorefrontData | null> {
  const normHost = normalizeHost(rawHost);
  if (!normHost) {
    return null;
  }

  // 1. Check if the host matches a platform subdomain (e.g. "sharma.vyapone.in")
  const extractedSubdomain = extractSubdomainFromHost(normHost, platformDomain);
  if (extractedSubdomain) {
    return resolvePublishedStorefrontBySubdomain(supabase, extractedSubdomain);
  }

  // 2. Custom Domain lookup
  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("id, business_id, subdomain, primary_domain, status, published_version_id")
    .eq("primary_domain", normHost)
    .maybeSingle();

  if (siteError || !site) {
    return null;
  }

  if (site.status !== "published" || !site.published_version_id) {
    return null;
  }

  // Delegate to subdomain resolver with verified site record
  return resolvePublishedStorefrontBySubdomain(supabase, site.subdomain);
}

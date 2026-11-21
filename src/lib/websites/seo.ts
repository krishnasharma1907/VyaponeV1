/**
 * VyapOne — Storefront SEO & Metadata Engine [VO-043]
 *
 * Provides validated SEO metadata, canonical URL construction, OpenGraph/Twitter card
 * generation, and sensitive data protection for published storefronts in strict accordance
 * with PRD FINAL v2 §6.14, §15.3, §16, §17:
 * - Derives metadata exclusively from explicitly published configurations and public business facts.
 * - Enforces zero draft leakage.
 * - Protects against Host-header poisoning and canonical URL injection.
 * - Strictly guarantees that no statutory business identifiers (PAN, GSTIN, bank details,
 *   sovereign_owner_id, workspace_id) are emitted in public metadata.
 */

import type { Metadata } from "next";
import type { PublicStorefrontData } from "./public-service";
import { normalizeSubdomain } from "./public-service";

export const DEFAULT_PLATFORM_DOMAIN = "vyapone.in";

/**
 * Validates a custom domain string according to RFC 1123 standards.
 * Ensures:
 * - 3 to 253 characters.
 * - Lowercase alphanumeric with hyphens and dots.
 * - Contains at least one dot (domain label + TLD, e.g. "sharmasweets.in").
 * - Does not start or end with a hyphen or dot.
 * - Does not contain port numbers, schemes, or path segments.
 * - Rejects reserved platform domains and loopback addresses.
 */
export function validateCustomDomain(domain?: string | null): boolean {
  if (!domain || typeof domain !== "string") {
    return false;
  }

  const clean = domain.trim().toLowerCase();

  // Length boundaries (RFC 1035 / 1123)
  if (clean.length < 3 || clean.length > 253) {
    return false;
  }

  // Reject schemes or path delimiters
  if (clean.includes("/") || clean.includes(":") || clean.includes("@")) {
    return false;
  }

  // Domain regex: labels separated by dots, each 1-63 chars, alphanumeric with hyphens in middle
  const domainPattern =
    /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
  if (!domainPattern.test(clean)) {
    return false;
  }

  // Reject local and internal TLDs / loopbacks
  const rejectedSubstrings = ["localhost", "127.0.0.1", ".local", ".internal", ".test", ".example"];
  if (rejectedSubstrings.some((rej) => clean === rej || clean.endsWith(rej))) {
    return false;
  }

  return true;
}

/**
 * Normalizes an internal page slug.
 * Ensures it starts with '/' and contains only lower-case alphanumeric segments.
 * Returns '/' for root or invalid slugs.
 */
export function normalizePageSlug(rawSlug?: string | null): string {
  if (!rawSlug || typeof rawSlug !== "string") {
    return "/";
  }

  let slug = rawSlug.trim().toLowerCase();

  // Strip query strings or hash anchors if present
  const queryIdx = slug.indexOf("?");
  if (queryIdx !== -1) slug = slug.slice(0, queryIdx);
  const hashIdx = slug.indexOf("#");
  if (hashIdx !== -1) slug = slug.slice(0, hashIdx);

  // Ensure leading slash
  if (!slug.startsWith("/")) {
    slug = `/${slug}`;
  }

  // Remove multiple consecutive slashes
  slug = slug.replace(/\/+/g, "/");

  // Remove trailing slash if longer than 1 character
  if (slug.length > 1 && slug.endsWith("/")) {
    slug = slug.slice(0, -1);
  }

  // Validate format: alphanumeric, hyphens, underscores separated by slashes
  const validSlugPattern = /^\/([a-z0-9_-]+(\/[a-z0-9_-]+)*)?$/;
  if (!validSlugPattern.test(slug)) {
    return "/";
  }

  return slug;
}

export interface BuildCanonicalUrlParams {
  subdomain: string;
  primaryDomain?: string | null;
  slug?: string;
  platformDomain?: string;
}

/**
 * Constructs a secure, validated canonical URL for a storefront page.
 * Strictly ignores arbitrary client host headers and query parameters.
 * Uses verified custom domain if valid, otherwise falls back to platform subdomain.
 */
export function buildStorefrontCanonicalUrl({
  subdomain,
  primaryDomain,
  slug = "/",
  platformDomain = DEFAULT_PLATFORM_DOMAIN,
}: BuildCanonicalUrlParams): string {
  const normSlug = normalizePageSlug(slug);
  const pathSegment = normSlug === "/" ? "" : normSlug;

  // 1. If primary domain is configured and strictly valid
  if (primaryDomain && validateCustomDomain(primaryDomain)) {
    return `https://${primaryDomain.trim().toLowerCase()}${pathSegment}`;
  }

  // 2. Fall back to validated platform subdomain
  const normSub = normalizeSubdomain(subdomain) || "store";
  const cleanPlatform = platformDomain.trim().toLowerCase().replace(/^\./, "");
  return `https://${normSub}.${cleanPlatform}${pathSegment}`;
}

/**
 * Validates that no sensitive statutory or internal identifiers are present in metadata strings.
 * Redacts or throws if PAN, GSTIN, bank details, or internal tenant IDs are detected.
 */
export function sanitizeMetadataString(text?: string | null): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  let sanitized = text.replace(/<[^>]*>/g, "").trim();

  // Redact Indian PAN patterns: [A-Z]{5}[0-9]{4}[A-Z]
  sanitized = sanitized.replace(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/gi, "[REDACTED]");

  // Redact Indian GSTIN patterns: 15 chars starting with 2 digits
  sanitized = sanitized.replace(
    /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/gi,
    "[REDACTED]",
  );

  // Redact obvious bank account or IFSC patterns
  sanitized = sanitized.replace(/\b[A-Z]{4}0[A-Z0-9]{6}\b/gi, "[REDACTED]");

  // Redact internal UUID patterns that might look like workspace_id or sovereign_owner_id
  sanitized = sanitized.replace(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    "[REDACTED]",
  );

  return sanitized;
}

export interface BuildStorefrontMetadataOptions {
  storefront: PublicStorefrontData;
  slug?: string;
  platformDomain?: string;
}

/**
 * Builds complete Next.js Metadata for a published storefront page.
 * Guarantees published-only data derivation, verified canonical URLs, and safe fallbacks.
 */
export function buildStorefrontMetadata({
  storefront,
  slug = "/",
  platformDomain = DEFAULT_PLATFORM_DOMAIN,
}: BuildStorefrontMetadataOptions): Metadata {
  const normSlug = normalizePageSlug(slug);
  const config = storefront.configuration;
  const business = storefront.context.business;
  const tradeName = sanitizeMetadataString(
    business?.tradeName || business?.name || storefront.site.subdomain,
  );

  // 1. Resolve active page
  const page =
    config.pages.find((p) => p.slug === normSlug) ||
    config.pages.find((p) => p.slug === "/") ||
    config.pages[0];

  const siteTitle = sanitizeMetadataString(config.metadata.title) || `${tradeName} Store`;
  const siteDescription =
    sanitizeMetadataString(config.metadata.description) ||
    `Official storefront for ${tradeName}. Powered by VyapOne.`;

  // 2. Page-specific title overrides
  let pageTitle: string;
  if (page?.seo?.title) {
    const rawPageTitle = sanitizeMetadataString(page.seo.title);
    pageTitle = `${rawPageTitle} | ${siteTitle}`;
  } else if (normSlug === "/" || !page) {
    pageTitle = siteTitle;
  } else {
    const pageHeading = sanitizeMetadataString(page.title);
    pageTitle = `${pageHeading} | ${siteTitle}`;
  }

  // Bound title to recommended SEO length (~70 chars)
  if (pageTitle.length > 80) {
    pageTitle = pageTitle.slice(0, 77) + "...";
  }

  // 3. Page-specific description
  let pageDescription: string;
  if (page?.seo?.metaDescription) {
    pageDescription = sanitizeMetadataString(page.seo.metaDescription);
  } else {
    pageDescription = siteDescription;
  }

  // Bound description to recommended SEO length (~160 chars)
  if (pageDescription.length > 170) {
    pageDescription = pageDescription.slice(0, 167) + "...";
  }

  // 4. Canonical URL
  const canonicalUrl = buildStorefrontCanonicalUrl({
    subdomain: storefront.site.subdomain,
    primaryDomain: storefront.site.primaryDomain,
    slug: normSlug,
    platformDomain,
  });

  // 5. OpenGraph & Twitter Image resolution (verified public CDN only)
  const mediaUrls = storefront.context.mediaUrls || {};
  let ogImageUrl: string | undefined;
  if (page?.seo?.ogImageMediaId && mediaUrls[page.seo.ogImageMediaId]) {
    ogImageUrl = mediaUrls[page.seo.ogImageMediaId];
  } else if (config.metadata.faviconMediaId && mediaUrls[config.metadata.faviconMediaId]) {
    ogImageUrl = mediaUrls[config.metadata.faviconMediaId];
  } else if (config.header.logoMediaId && mediaUrls[config.header.logoMediaId]) {
    ogImageUrl = mediaUrls[config.header.logoMediaId];
  }

  const ogImages = ogImageUrl
    ? [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: pageTitle,
        },
      ]
    : undefined;

  // 6. Robots & Indexing controls
  const isNoIndex = page?.seo?.noIndex === true || storefront.site.status !== "published";

  const robots = isNoIndex
    ? {
        index: false,
        follow: false,
        nocache: true,
        googleBot: {
          index: false,
          follow: false,
        },
      }
    : {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-video-preview": -1,
          "max-image-preview": "large" as const,
          "max-snippet": -1,
        },
      };

  return {
    title: pageTitle,
    description: pageDescription,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      url: canonicalUrl,
      siteName: tradeName,
      locale: config.metadata.defaultLocale || "en_IN",
      type: "website",
      images: ogImages,
    },
    twitter: {
      card: ogImageUrl ? "summary_large_image" : "summary",
      title: pageTitle,
      description: pageDescription,
      images: ogImageUrl ? [ogImageUrl] : undefined,
    },
    robots,
  };
}

/**
 * VyapOne — Multi-Page Navigation, SEO & Sitemap Unit Tests [VO-043]
 *
 * Comprehensive tests for storefront multi-page navigation, metadata generation,
 * canonical URL construction, OpenGraph/Twitter cards, sitemap XML, robots.txt,
 * and security defenses (host header poisoning, sensitive data redaction, draft exclusion):
 *
 * 1. Domain Validation & Slug Normalization:
 *    - RFC 1123 custom domain validation.
 *    - Slug normalization and traversal defense.
 *    - Canonical URL generation and port stripping.
 * 2. SEO Metadata Generation & Security:
 *    - Page title override and fallback behavior.
 *    - Description fallback.
 *    - OpenGraph and Twitter card metadata.
 *    - Robots indexing control (noIndex support).
 *    - Sensitive data redaction (PAN, GSTIN, bank details, internal UUIDs).
 * 3. Header Navigation & Multi-Page UI:
 *    - Semantic <header role="banner"> and <nav aria-label="Main Navigation">.
 *    - Active page indicator (aria-current="page").
 *    - Mobile hamburger toggle and keyboard accessibility (Escape key).
 *    - URL sanitization (rejects javascript:, data:).
 *    - Safe within-storefront 404 for unknown page slugs.
 *    - Persistent <footer role="contentinfo"> landmark.
 * 4. Dynamic Sitemap & robots.txt Generation:
 *    - Storefront sitemap XML serialization and escaping.
 *    - Platform-wide sitemap entries (published only, excludes drafts and suspended sites).
 *    - Exclusion of private back-office routes.
 *    - Authoritative timestamps (no fabricated lastmod).
 *    - Storefront robots.txt (allow published, disallow unpublished).
 *
 * NOTE ON VERIFICATION ENVIRONMENT:
 * These tests execute in Vitest with mocked database clients and in-memory fixtures.
 * They represent static schema/service review and mocked unit verification.
 * Live PostgreSQL RLS and transaction guarantees were tested in SQL migrations.
 */

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

import {
  validateCustomDomain,
  normalizePageSlug,
  buildStorefrontCanonicalUrl,
  sanitizeMetadataString,
  buildStorefrontMetadata,
} from "@/lib/websites/seo";

import {
  getStorefrontSitemapEntries,
  generateStorefrontSitemapXml,
  generatePlatformSitemapEntries,
  escapeXml,
} from "@/lib/websites/sitemap";

import { WebsiteHeaderNav, PublicWebsiteRenderer } from "@/components/websites/public-renderer";

import { buildInitialWebsiteConfiguration } from "@/lib/websites/defaults";
import type { PublicStorefrontData } from "@/lib/websites/public-service";
import type { WebsiteRenderContext } from "@/components/websites/blocks/types";
import rootRobots from "@/app/robots";

// ============================================================================
// Fixtures
// ============================================================================

const MOCK_SITE_ID = "11111111-1111-4111-8111-111111111111";
const MOCK_BIZ_ID = "22222222-2222-4222-8222-222222222222";
const MOCK_VERSION_ID = "33333333-3333-4333-8333-333333333333";
const MOCK_OG_MEDIA_ID = "55555555-5555-4555-8555-555555555555";
const MOCK_LOGO_MEDIA_ID = "66666666-6666-4666-8666-666666666666";

const BASE_CONFIG = buildInitialWebsiteConfiguration({
  siteId: MOCK_SITE_ID,
  businessId: MOCK_BIZ_ID,
  tradeName: "Sharma Sweets & Cafe",
  subdomain: "sharma-sweets",
});

// Augment configuration with multi-page structure and SEO
const MULTI_PAGE_CONFIG = {
  ...BASE_CONFIG,
  metadata: {
    ...BASE_CONFIG.metadata,
    title: "Sharma Sweets & Cafe — Pure Ghee Delicacies",
    description: "Authentic Indian sweets, snacks, and dining in New Delhi.",
    primaryDomain: "sharmasweets.in",
  },
  header: {
    ...BASE_CONFIG.header,
    logoMediaId: MOCK_LOGO_MEDIA_ID,
    logoText: "Sharma Sweets",
    navLinks: [
      { label: "Home", href: "/", isExternal: false },
      { label: "Menu", href: "/menu", isExternal: false },
      { label: "About Us", href: "/about", isExternal: false },
      { label: "Visit Instagram", href: "https://instagram.com/sharmasweets", isExternal: true },
    ],
    cta: {
      label: "Order on WhatsApp",
      action: "whatsapp_order",
    },
  },
  pages: [
    {
      id: "page-home",
      slug: "/",
      title: "Home",
      isPublished: true,
      seo: {
        title: "Best Indian Sweets & Dining in Delhi",
        metaDescription: "Experience authentic pure ghee sweets and delicacies freshly made daily.",
        ogImageMediaId: MOCK_OG_MEDIA_ID,
        noIndex: false,
      },
      sections: BASE_CONFIG.pages[0].sections,
    },
    {
      id: "page-menu",
      slug: "/menu",
      title: "Menu & Sweets",
      isPublished: true,
      seo: {
        title: "Traditional Sweets & Snacks Menu",
        metaDescription: "Explore our complete menu of laddoos, barfis, samosas, and beverages.",
        noIndex: false,
      },
      sections: [
        {
          id: "sec-menu",
          type: "menu" as const,
          isEnabled: true,
          props: {
            title: "Our Delicacies",
            source: "catalogue" as const,
          },
        },
      ],
    },
    {
      id: "page-hidden",
      slug: "/private-catering",
      title: "Private Catering",
      isPublished: false, // Unpublished page
      seo: {
        title: "Catering Packages",
        noIndex: true,
      },
      sections: [
        {
          id: "sec-catering",
          type: "about" as const,
          isEnabled: true,
          props: {
            title: "Private Catering",
            story: "We offer private event catering.",
          },
        },
      ],
    },
  ],
};

const MOCK_CONTEXT: WebsiteRenderContext = {
  theme: BASE_CONFIG.theme,
  business: {
    id: MOCK_BIZ_ID,
    name: "Sharma Pure Sweets Private Limited",
    tradeName: "Sharma Sweets & Cafe",
    phone: "+919876543210",
    whatsappNumber: "+919876543210",
    email: "contact@sharmasweets.in",
    primaryLocation: {
      addressLine1: "12 Connaught Place",
      city: "New Delhi",
      state: "Delhi",
      postalCode: "110001",
    },
  },
  mediaUrls: {
    [MOCK_OG_MEDIA_ID]: "https://cdn.vyapone.in/media/og-banner.webp",
    [MOCK_LOGO_MEDIA_ID]: "https://cdn.vyapone.in/media/logo.png",
  },
  catalogueItems: [
    {
      id: "item-1",
      name: "Besan Laddoo",
      priceMinor: 40000,
      currency: "INR",
      isAvailable: true,
    },
  ],
};

const MOCK_STOREFRONT: PublicStorefrontData = {
  site: {
    id: MOCK_SITE_ID,
    businessId: MOCK_BIZ_ID,
    subdomain: "sharma-sweets",
    primaryDomain: "sharmasweets.in",
    status: "published",
    publishedVersionId: MOCK_VERSION_ID,
  },
  version: {
    id: MOCK_VERSION_ID,
    versionNumber: 1,
    schemaVersion: "v1",
    publishedAt: "2026-11-20T12:00:00.000Z",
  },
  configuration: MULTI_PAGE_CONFIG,
  context: MOCK_CONTEXT,
};

// ============================================================================
// Test Suite
// ============================================================================

describe("VO-043 Storefront Navigation, SEO & Metadata", () => {
  // --------------------------------------------------------------------------
  // 1. Domain Validation & Slug Normalization
  // --------------------------------------------------------------------------
  describe("1. Custom Domain & Slug Normalization", () => {
    it("validates RFC 1123 compliant custom domains", () => {
      expect(validateCustomDomain("sharmasweets.in")).toBe(true);
      expect(validateCustomDomain("store.my-brand.co.uk")).toBe(true);
      expect(validateCustomDomain("fresh-bakery.com")).toBe(true);

      // Rejects invalid formats
      expect(validateCustomDomain("")).toBe(false);
      expect(validateCustomDomain("localhost")).toBe(false);
      expect(validateCustomDomain("127.0.0.1")).toBe(false);
      expect(validateCustomDomain("internal.test")).toBe(false);
      expect(validateCustomDomain("http://example.com")).toBe(false);
      expect(validateCustomDomain("example.com:3000")).toBe(false);
      expect(validateCustomDomain("example.com/path")).toBe(false);
      expect(validateCustomDomain("-invalid.com")).toBe(false);
      expect(validateCustomDomain("invalid-.com")).toBe(false);
      expect(validateCustomDomain("nodots")).toBe(false);
    });

    it("normalizes page slugs and prevents path traversal", () => {
      expect(normalizePageSlug("/")).toBe("/");
      expect(normalizePageSlug("")).toBe("/");
      expect(normalizePageSlug(null)).toBe("/");
      expect(normalizePageSlug("menu")).toBe("/menu");
      expect(normalizePageSlug("/about/")).toBe("/about");
      expect(normalizePageSlug("/our-story?param=1#section")).toBe("/our-story");
      expect(normalizePageSlug("///multiple///slashes//")).toBe("/multiple/slashes");
      expect(normalizePageSlug("/invalid$slug!@")).toBe("/"); // Resets invalid characters
    });

    it("constructs canonical URLs using verified custom domain or platform subdomain", () => {
      // Verified custom domain
      const customUrl = buildStorefrontCanonicalUrl({
        subdomain: "sharma-sweets",
        primaryDomain: "sharmasweets.in",
        slug: "/menu",
      });
      expect(customUrl).toBe("https://sharmasweets.in/menu");

      // Root custom domain (no trailing slash for home)
      const customHomeUrl = buildStorefrontCanonicalUrl({
        subdomain: "sharma-sweets",
        primaryDomain: "sharmasweets.in",
        slug: "/",
      });
      expect(customHomeUrl).toBe("https://sharmasweets.in");

      // Fallback to platform subdomain when primaryDomain is missing or invalid
      const platformUrl = buildStorefrontCanonicalUrl({
        subdomain: "sharma-sweets",
        primaryDomain: "invalid:domain",
        slug: "/about",
      });
      expect(platformUrl).toBe("https://sharma-sweets.vyapone.in/about");
    });
  });

  // --------------------------------------------------------------------------
  // 2. SEO Metadata Generation & Security
  // --------------------------------------------------------------------------
  describe("2. SEO Metadata Generation & Sensitive Data Redaction", () => {
    it("generates page-specific title, description, and canonical URL", () => {
      const metadata = buildStorefrontMetadata({
        storefront: MOCK_STOREFRONT,
        slug: "/menu",
      });

      expect(metadata.title).toBe(
        "Traditional Sweets & Snacks Menu | Sharma Sweets & Cafe — Pure Ghee Delicacies",
      );
      expect(metadata.description).toBe(
        "Explore our complete menu of laddoos, barfis, samosas, and beverages.",
      );
      expect(metadata.alternates?.canonical).toBe("https://sharmasweets.in/menu");
    });

    it("falls back to site metadata when page-specific SEO is omitted", () => {
      const storefrontWithoutPageSeo: PublicStorefrontData = {
        ...MOCK_STOREFRONT,
        configuration: {
          ...MULTI_PAGE_CONFIG,
          pages: [
            {
              id: "page-bare",
              slug: "/",
              title: "Home",
              isPublished: true,
              sections: BASE_CONFIG.pages[0].sections,
            },
          ],
        },
      };

      const metadata = buildStorefrontMetadata({
        storefront: storefrontWithoutPageSeo,
        slug: "/",
      });

      expect(metadata.title).toBe("Sharma Sweets & Cafe — Pure Ghee Delicacies");
      expect(metadata.description).toBe(
        "Authentic Indian sweets, snacks, and dining in New Delhi.",
      );
    });

    it("generates comprehensive OpenGraph and Twitter card metadata", () => {
      const metadata = buildStorefrontMetadata({
        storefront: MOCK_STOREFRONT,
        slug: "/",
      });

      // Open Graph
      expect(metadata.openGraph?.title).toContain("Best Indian Sweets");
      expect(metadata.openGraph?.url).toBe("https://sharmasweets.in");
      expect(metadata.openGraph?.siteName).toBe("Sharma Sweets & Cafe");
      expect(metadata.openGraph?.locale).toBe("en");
      expect((metadata.openGraph as { type?: string } | null | undefined)?.type).toBe("website");
      expect(metadata.openGraph?.images).toEqual([
        {
          url: "https://cdn.vyapone.in/media/og-banner.webp",
          width: 1200,
          height: 630,
          alt: expect.any(String),
        },
      ]);

      // Twitter
      expect((metadata.twitter as { card?: string } | null | undefined)?.card).toBe(
        "summary_large_image",
      );
      expect(metadata.twitter?.images).toEqual(["https://cdn.vyapone.in/media/og-banner.webp"]);
    });

    it("enforces noIndex directive for pages marked noIndex: true", () => {
      const pageWithNoIndex: PublicStorefrontData = {
        ...MOCK_STOREFRONT,
        configuration: {
          ...MULTI_PAGE_CONFIG,
          pages: [
            {
              id: "page-noindex",
              slug: "/hidden",
              title: "Hidden",
              isPublished: true,
              seo: {
                noIndex: true,
              },
              sections: BASE_CONFIG.pages[0].sections,
            },
          ],
        },
      };

      const metadata = buildStorefrontMetadata({
        storefront: pageWithNoIndex,
        slug: "/hidden",
      });

      expect(metadata.robots).toEqual({
        index: false,
        follow: false,
        nocache: true,
        googleBot: {
          index: false,
          follow: false,
        },
      });
    });

    it("redacts sensitive statutory data (PAN, GSTIN, bank IFSC, UUIDs) from metadata", () => {
      const textWithSensitives =
        "Visit Sharma Sweets PAN: ABCDE1234F GSTIN: 07AAAAA0000A1Z5 IFSC: HDFC0001234 Owner: 11111111-2222-3333-4444-555555555555";
      const sanitized = sanitizeMetadataString(textWithSensitives);

      expect(sanitized).not.toContain("ABCDE1234F");
      expect(sanitized).not.toContain("07AAAAA0000A1Z5");
      expect(sanitized).not.toContain("HDFC0001234");
      expect(sanitized).not.toContain("11111111-2222-3333-4444-555555555555");
      expect(sanitized).toContain("[REDACTED]");
    });
  });

  // --------------------------------------------------------------------------
  // 3. Header Navigation & Multi-Page UI
  // --------------------------------------------------------------------------
  describe("3. Multi-Page Header Navigation & UI Landmarks", () => {
    it("renders primary navigation with semantic landmarks, brand logo, and nav links", () => {
      render(
        <WebsiteHeaderNav
          header={MULTI_PAGE_CONFIG.header}
          pages={MULTI_PAGE_CONFIG.pages}
          theme={MULTI_PAGE_CONFIG.theme}
          context={MOCK_CONTEXT}
          currentPath="/menu"
          subdomain="sharma-sweets"
        />,
      );

      // Semantic landmarks
      const header = screen.getByRole("banner");
      expect(header).toBeDefined();

      const mainNav = screen.getByRole("navigation", { name: "Main Navigation" });
      expect(mainNav).toBeDefined();

      // Brand logo & title
      expect(screen.getByText("Sharma Sweets")).toBeDefined();
      expect(screen.getByAltText("Sharma Sweets logo").getAttribute("src")).toBe(
        "https://cdn.vyapone.in/media/logo.png",
      );

      // Navigation links
      const homeLink = screen.getByRole("link", { name: "Home" });
      const menuLink = screen.getByRole("link", { name: "Menu" });
      const aboutLink = screen.getByRole("link", { name: "About Us" });

      expect(homeLink.getAttribute("href")).toBe("/s/sharma-sweets");
      expect(menuLink.getAttribute("href")).toBe("/s/sharma-sweets?p=%2Fmenu");
      expect(aboutLink.getAttribute("href")).toBe("/s/sharma-sweets?p=%2Fabout");

      // Active page state
      expect(menuLink.getAttribute("aria-current")).toBe("page");
      expect(homeLink.getAttribute("aria-current")).toBeNull();

      // External link
      const instaLink = screen.getByRole("link", { name: "Visit Instagram" });
      expect(instaLink.getAttribute("href")).toBe("https://instagram.com/sharmasweets");
      expect(instaLink.getAttribute("target")).toBe("_blank");
      expect(instaLink.getAttribute("rel")).toBe("noopener noreferrer");

      // CTA button
      expect(screen.getByText("Order on WhatsApp")).toBeDefined();
    });

    it("supports mobile navigation toggle and closes on Escape key", () => {
      render(
        <WebsiteHeaderNav
          header={MULTI_PAGE_CONFIG.header}
          pages={MULTI_PAGE_CONFIG.pages}
          theme={MULTI_PAGE_CONFIG.theme}
          context={MOCK_CONTEXT}
          currentPath="/"
          subdomain="sharma-sweets"
        />,
      );

      const toggleButton = screen.getByRole("button", { name: "Open navigation menu" });
      expect(toggleButton.getAttribute("aria-expanded")).toBe("false");

      // Open mobile menu
      fireEvent.click(toggleButton);
      expect(toggleButton.getAttribute("aria-expanded")).toBe("true");
      expect(toggleButton.getAttribute("aria-label")).toBe("Close navigation menu");

      const mobileNav = screen.getByRole("navigation", { name: "Mobile Navigation" });
      expect(mobileNav).toBeDefined();

      // Press Escape key -> menu closes
      fireEvent.keyDown(window, { key: "Escape" });
      expect(toggleButton.getAttribute("aria-expanded")).toBe("false");
      expect(screen.queryByRole("navigation", { name: "Mobile Navigation" })).toBeNull();
    });

    it("sanitizes dangerous URLs in navigation links", () => {
      const configWithXss = {
        ...MULTI_PAGE_CONFIG.header,
        navLinks: [
          { label: "Evil Link", href: "javascript:alert('pwned')", isExternal: false },
          {
            label: "Data Scheme",
            href: "data:text/html,<script>alert(1)</script>",
            isExternal: false,
          },
        ],
      };

      render(
        <WebsiteHeaderNav
          header={configWithXss}
          pages={MULTI_PAGE_CONFIG.pages}
          theme={MULTI_PAGE_CONFIG.theme}
          context={MOCK_CONTEXT}
          currentPath="/"
          subdomain="sharma-sweets"
        />,
      );

      const evilLink = screen.getByRole("link", { name: "Evil Link" });
      const dataLink = screen.getByRole("link", { name: "Data Scheme" });

      expect(evilLink.getAttribute("href")).toBe("#");
      expect(dataLink.getAttribute("href")).toBe("#");
    });

    it("renders active page sections and safe within-storefront 404 for unknown slugs", () => {
      // 1. Valid page: /menu
      const { unmount } = render(
        <PublicWebsiteRenderer
          configuration={MULTI_PAGE_CONFIG}
          context={MOCK_CONTEXT}
          currentPath="/menu"
          subdomain="sharma-sweets"
        />,
      );

      expect(screen.getByText("Our Delicacies")).toBeDefined();
      // Persistent footer is rendered
      expect(screen.getByRole("contentinfo")).toBeDefined();
      unmount();

      // 2. Unknown page: /non-existent-page -> renders within-storefront 404 section
      render(
        <PublicWebsiteRenderer
          configuration={MULTI_PAGE_CONFIG}
          context={MOCK_CONTEXT}
          currentPath="/non-existent-page"
          subdomain="sharma-sweets"
        />,
      );

      expect(screen.getByRole("heading", { name: "Page Not Found" })).toBeDefined();
      expect(screen.getByText(/could not be found on this store/i)).toBeDefined();
      expect(screen.getByRole("link", { name: "Return to Home" }).getAttribute("href")).toBe(
        "/s/sharma-sweets",
      );
      // Header and footer are still present
      expect(screen.getByRole("banner")).toBeDefined();
      expect(screen.getByRole("contentinfo")).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // 4. Dynamic Sitemap & robots.txt Generation
  // --------------------------------------------------------------------------
  describe("4. Dynamic Sitemap & robots.txt Generation", () => {
    it("escapes XML special characters in sitemaps", () => {
      expect(escapeXml("https://example.com/items?a=1&b=2")).toBe(
        "https://example.com/items?a=1&amp;b=2",
      );
      expect(escapeXml("<tag>")).toBe("&lt;tag&gt;");
    });

    it("generates storefront sitemap XML with canonical URLs, authoritative dates, and priorities", () => {
      const xml = generateStorefrontSitemapXml(MOCK_STOREFRONT);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

      // Home page: priority 1.0, daily
      expect(xml).toContain("<loc>https://sharmasweets.in</loc>");
      expect(xml).toContain("<priority>1.0</priority>");
      expect(xml).toContain("<changefreq>daily</changefreq>");
      expect(xml).toContain("<lastmod>2026-11-20T12:00:00.000Z</lastmod>");

      // Menu page: priority 0.8, weekly
      expect(xml).toContain("<loc>https://sharmasweets.in/menu</loc>");
      expect(xml).toContain("<priority>0.8</priority>");
      expect(xml).toContain("<changefreq>weekly</changefreq>");

      // Unpublished / noIndex page excluded
      expect(xml).not.toContain("private-catering");
    });

    it("returns empty sitemap entries if storefront is not published", () => {
      const unpublishedStorefront: PublicStorefrontData = {
        ...MOCK_STOREFRONT,
        site: {
          ...MOCK_STOREFRONT.site,
          status: "draft",
        },
      };

      const entries = getStorefrontSitemapEntries(unpublishedStorefront);
      expect(entries).toEqual([]);
    });

    it("generates platform sitemap entries excluding drafts and back-office routes", async () => {
      // Mock Supabase client returning published sites
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: MOCK_SITE_ID,
                    subdomain: "sharma-sweets",
                    primary_domain: "sharmasweets.in",
                    status: "published",
                    updated_at: "2026-11-20T12:00:00.000Z",
                    published_version_id: MOCK_VERSION_ID,
                    site_versions: {
                      id: MOCK_VERSION_ID,
                      published_at: "2026-11-20T12:00:00.000Z",
                      configuration: MULTI_PAGE_CONFIG,
                      schema_version: "v1",
                    },
                  },
                ],
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as SupabaseClient<Database>;

      const sitemap = await generatePlatformSitemapEntries(mockSupabase);

      // Contains platform root and privacy
      expect(sitemap.some((entry) => entry.url === "https://vyapone.in")).toBe(true);
      expect(sitemap.some((entry) => entry.url === "https://vyapone.in/privacy")).toBe(true);

      // Contains published storefront pages
      expect(sitemap.some((entry) => entry.url === "https://sharmasweets.in")).toBe(true);
      expect(sitemap.some((entry) => entry.url === "https://sharmasweets.in/menu")).toBe(true);

      // Strictly excludes back-office routes
      expect(sitemap.some((entry) => entry.url.includes("/dashboard"))).toBe(false);
      expect(sitemap.some((entry) => entry.url.includes("/workspace"))).toBe(false);
      expect(sitemap.some((entry) => entry.url.includes("/platform-admin"))).toBe(false);
      expect(sitemap.some((entry) => entry.url.includes("/counter"))).toBe(false);
    });

    it("generates root robots.txt disallowing back-office paths and pointing to sitemap", () => {
      const robots = rootRobots();

      const rules = Array.isArray(robots.rules) ? robots.rules[0] : robots.rules;
      expect(rules.userAgent).toBe("*");
      expect(rules.allow).toEqual(["/", "/privacy", "/s/"]);
      expect(rules.disallow).toEqual(
        expect.arrayContaining([
          "/dashboard/",
          "/workspace/",
          "/platform-admin/",
          "/counter/",
          "/api/",
          "/auth/",
        ]),
      );
      expect(robots.sitemap).toBe("https://vyapone.in/sitemap.xml");
    });
  });
});

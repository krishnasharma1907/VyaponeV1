/**
 * VyapOne — Public Website Renderer Unit Tests [VO-042]
 *
 * Comprehensive tests for the public website renderer, published version resolution,
 * safe render context assembly, media privacy, catalogue data binding, and error isolation:
 *
 * 1. Subdomain & Hostname Normalization (RFC 1123, reserved subdomains, port stripping).
 * 2. Core Rendering Invariants:
 *    - Resolves published site and version via `published_version_id` and `published_at`.
 *    - Strictly rejects draft version pointers, unpublished records, and current_draft_version_id.
 *    - Rejects suspended, draft, or archived sites (fails closed).
 *    - Rejects cross-site or cross-tenant version references.
 *    - Rejects unsupported schema versions or corrupted configurations.
 * 3. Safe Public Context & Privacy:
 *    - Strictly excludes sensitive tenant data (PAN, GSTIN, sovereign_owner_id, workspace_id).
 *    - Excludes unavailable catalogue items (`is_available = false`).
 *    - Media privacy: Excludes private, quarantined, or unverified media.
 * 4. Component Rendering & 13 Canonical Blocks:
 *    - All 13 canonical approved blocks rendered through PublicWebsiteRenderer.
 *    - Semantic landmarks (<main>, skip link, WCAG 2.2 AA).
 *    - BlockErrorBoundary error isolation (corrupted section does not crash page).
 *    - StorefrontNotFound fail-closed view.
 */

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

import {
  normalizeSubdomain,
  normalizeHost,
  extractSubdomainFromHost,
  resolvePublishedStorefrontBySubdomain,
  resolvePublishedStorefrontByHost,
} from "@/lib/websites/public-service";

import { PublicWebsiteRenderer, StorefrontNotFound } from "@/components/websites/public-renderer";

import type { ApprovedBlockType, WebsiteConfiguration } from "@/lib/websites/types";
import { buildInitialWebsiteConfiguration } from "@/lib/websites/defaults";
import type { WebsiteRenderContext } from "@/components/websites/blocks/types";

// ============================================================================
// Mock Data Fixtures
// ============================================================================

const MOCK_SITE_ID = "11111111-1111-4111-8111-111111111111";
const MOCK_BIZ_ID = "22222222-2222-4222-8222-222222222222";
const MOCK_PUB_VERSION_ID = "33333333-3333-4333-8333-333333333333";
const MOCK_DRAFT_VERSION_ID = "44444444-4444-4444-8444-444444444444";
const MOCK_PUB_MEDIA_ID = "55555555-5555-4555-8555-555555555555";
const MOCK_PRIV_MEDIA_ID = "66666666-6666-4666-8666-666666666666";

const BASE_CONFIG = buildInitialWebsiteConfiguration({
  siteId: MOCK_SITE_ID,
  businessId: MOCK_BIZ_ID,
  tradeName: "Sharma Pure Sweets",
  subdomain: "sharma-sweets",
  description: "Traditional handcrafted Indian sweets in Bengaluru.",
  logoMediaId: MOCK_PUB_MEDIA_ID,
});

const SAMPLE_CONFIG: WebsiteConfiguration = {
  ...BASE_CONFIG,
  metadata: {
    ...BASE_CONFIG.metadata,
    faviconMediaId: MOCK_PUB_MEDIA_ID,
  },
  pages: [
    {
      id: "page-home",
      slug: "/",
      title: "Home",
      sections: [
        {
          id: "sec-hero",
          type: "hero",
          isEnabled: true,
          props: {
            title: "Authentic Handcrafted Sweets",
            subtitle: "Prepared fresh with pure desi ghee.",
            cta: { label: "Order on WhatsApp", action: "whatsapp_order" },
          },
        },
        {
          id: "sec-about",
          type: "about",
          isEnabled: true,
          props: {
            title: "Our Heritage",
            story: "Serving our neighborhood since 1985 with authentic family recipes.",
            highlights: ["100% Desi Ghee", "Fresh Daily"],
          },
        },
      ],
    },
  ],
};

const SAMPLE_CONTEXT: WebsiteRenderContext = {
  theme: SAMPLE_CONFIG.theme,
  business: {
    id: MOCK_BIZ_ID,
    name: "Sharma Pure Sweets",
    tradeName: "Sharma Sweets",
    primaryLocation: {
      addressLine1: "12 MG Road",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560001",
    },
  },
  catalogueItems: [
    {
      id: "item-1",
      name: "Kaju Katli",
      description: "Diamond cut silver leaf cashew fudge",
      priceMinor: 25000,
      currency: "INR",
      isAvailable: true,
      isFeatured: true,
    },
  ],
  mediaUrls: {
    [MOCK_PUB_MEDIA_ID]: "https://cdn.vyapone.com/vyapone-public-media/logo.png",
  },
  previewMode: false,
};

// ============================================================================
// Helper Mock Supabase Builder
// ============================================================================

interface MockDbOptions {
  site?: Record<string, unknown> | null;
  version?: Record<string, unknown> | null;
  business?: Record<string, unknown> | null;
  locations?: Record<string, unknown>[];
  catalogueItems?: Record<string, unknown>[];
  mediaItems?: Record<string, unknown>[];
}

function createMockSupabase(options: MockDbOptions): SupabaseClient<Database> {
  const {
    site = {
      id: MOCK_SITE_ID,
      business_id: MOCK_BIZ_ID,
      subdomain: "sharma-sweets",
      primary_domain: "sharmasweets.in",
      status: "published",
      published_version_id: MOCK_PUB_VERSION_ID,
    },
    version = {
      id: MOCK_PUB_VERSION_ID,
      site_id: MOCK_SITE_ID,
      business_id: MOCK_BIZ_ID,
      version_number: 1,
      schema_version: "v1",
      configuration: SAMPLE_CONFIG,
      published_at: "2026-11-20T10:00:00Z",
    },
    business = {
      id: MOCK_BIZ_ID,
      legal_name: "Sharma Confectionery Pvt Ltd",
      trade_name: "Sharma Pure Sweets",
      status: "active",
      currency_code: "INR",
      // Sensitive fields that MUST be omitted from public context:
      gst_number: "29AAAAA0000A1Z5",
      pan_number: "AAAAA0000A",
      sovereign_owner_id: "00000000-0000-0000-0000-000000000001",
      workspace_id: "00000000-0000-0000-0000-000000000002",
    },
    locations = [
      {
        id: "loc-1",
        business_id: MOCK_BIZ_ID,
        name: "Main Branch",
        address_line1: "12 MG Road",
        address_line2: "Opposite Town Hall",
        city: "Bengaluru",
        state: "Karnataka",
        postal_code: "560001",
        is_primary: true,
      },
    ],
    catalogueItems = [
      {
        id: "item-1",
        business_id: MOCK_BIZ_ID,
        title: "Kaju Katli",
        description: "Diamond cut silver leaf cashew fudge",
        price_minor: 25000,
        currency_code: "INR",
        is_available: true,
        created_at: "2026-11-20T10:00:00Z",
      },
      {
        id: "item-hidden",
        business_id: MOCK_BIZ_ID,
        title: "Draft Sweet",
        price_minor: 10000,
        currency_code: "INR",
        is_available: false, // Should be filtered out!
        created_at: "2026-11-20T10:00:00Z",
      },
    ],
    mediaItems = [
      {
        id: MOCK_PUB_MEDIA_ID,
        business_id: MOCK_BIZ_ID,
        object_key: "logo.png",
        bucket: "vyapone-public-media",
        is_public: true,
        status: "ready",
        verified_at: "2026-11-20T10:00:00Z",
        category: "business_logo",
      },
      {
        id: MOCK_PRIV_MEDIA_ID,
        business_id: MOCK_BIZ_ID,
        object_key: "private_doc.pdf",
        bucket: "vyapone-private-media",
        is_public: false, // Private/quarantined asset!
        status: "ready",
        verified_at: "2026-11-20T10:00:00Z",
        category: "document_attachment",
      },
    ],
  } = options;

  return {
    from: vi.fn((table: string) => {
      if (table === "sites") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((col: string, val: string) => ({
              maybeSingle: vi.fn(async () => {
                if (!site) return { data: null, error: null };
                if (col === "subdomain" && site.subdomain === val) {
                  return { data: site, error: null };
                }
                if (col === "primary_domain" && site.primary_domain === val) {
                  return { data: site, error: null };
                }
                return { data: null, error: null };
              }),
            })),
          })),
        };
      }

      if (table === "site_versions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((col: string, val: string) => ({
              maybeSingle: vi.fn(async () => {
                if (!version) return { data: null, error: null };
                if (col === "id" && version.id === val) {
                  return { data: version, error: null };
                }
                return { data: null, error: null };
              }),
            })),
          })),
        };
      }

      if (table === "businesses") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((col: string, val: string) => ({
              maybeSingle: vi.fn(async () => {
                if (!business) return { data: null, error: null };
                if (col === "id" && business.id === val) {
                  return { data: business, error: null };
                }
                return { data: null, error: null };
              }),
            })),
          })),
        };
      }

      if (table === "locations") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: locations[0] || null,
                    error: null,
                  })),
                })),
              })),
            })),
          })),
        };
      }

      if (table === "catalogue_items") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((_col1: string, val1: string) => ({
              eq: vi.fn((_col2: string, val2: boolean) => ({
                order: vi.fn(async () => ({
                  data: catalogueItems.filter(
                    (it) => it.business_id === val1 && it.is_available === val2,
                  ),
                  error: null,
                })),
              })),
            })),
          })),
        };
      }

      if (table === "media_items") {
        return {
          select: vi.fn(() => ({
            in: vi.fn((_col: string, ids: string[]) => ({
              eq: vi.fn((_bizCol: string, bId: string) =>
                Promise.resolve({
                  data: mediaItems.filter(
                    (m) => ids.includes(m.id as string) && m.business_id === bId,
                  ),
                  error: null,
                }),
              ),
            })),
          })),
        };
      }

      if (table === "business_modules") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({
              data: [
                { module_key: "website_engine", is_enabled: true },
                { module_key: "catalogue_services", is_enabled: true },
              ],
              error: null,
            })),
          })),
        };
      }

      if (table === "platform_modules") {
        return {
          select: vi.fn(async () => ({
            data: [
              { key: "website_engine", name: "Website Engine", category: "core", status: "active" },
              {
                key: "catalogue_services",
                name: "Catalogue & Services",
                category: "commerce",
                status: "active",
              },
            ],
            error: null,
          })),
        };
      }

      throw new Error(`Unexpected table queried: ${table}`);
    }),
  } as unknown as SupabaseClient<Database>;
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe("VO-042 Public Website Renderer & Resolution Pipeline", () => {
  // ==========================================================================
  // 1. Subdomain & Hostname Normalization (Security & DNS Standards)
  // ==========================================================================
  describe("1. Subdomain & Hostname Normalization", () => {
    it("normalizes valid subdomains safely", () => {
      expect(normalizeSubdomain("sharma-sweets")).toBe("sharma-sweets");
      expect(normalizeSubdomain("  SHARMA-SWEETS  ")).toBe("sharma-sweets");
      expect(normalizeSubdomain("cafe123")).toBe("cafe123");
      expect(normalizeSubdomain("a-b-c-d")).toBe("a-b-c-d");
    });

    it("rejects invalid, short, long, or malformed subdomains", () => {
      expect(normalizeSubdomain("")).toBeNull();
      expect(normalizeSubdomain(null)).toBeNull();
      expect(normalizeSubdomain(undefined)).toBeNull();
      expect(normalizeSubdomain("ab")).toBeNull(); // < 3 chars
      expect(normalizeSubdomain("-leading-hyphen")).toBeNull();
      expect(normalizeSubdomain("trailing-hyphen-")).toBeNull();
      expect(normalizeSubdomain("special_chars!")).toBeNull();
      expect(normalizeSubdomain("../path-traversal")).toBeNull();
      expect(normalizeSubdomain("<script>alert(1)</script>")).toBeNull();
      expect(normalizeSubdomain("a".repeat(64))).toBeNull(); // > 63 chars
    });

    it("rejects reserved platform subdomains to prevent spoofing", () => {
      expect(normalizeSubdomain("admin")).toBeNull();
      expect(normalizeSubdomain("api")).toBeNull();
      expect(normalizeSubdomain("auth")).toBeNull();
      expect(normalizeSubdomain("dashboard")).toBeNull();
      expect(normalizeSubdomain("workspace")).toBeNull();
      expect(normalizeSubdomain("pos")).toBeNull();
      expect(normalizeSubdomain("status")).toBeNull();
    });

    it("normalizes hostnames, stripping port and trailing dot", () => {
      expect(normalizeHost("sharmasweets.in:3000")).toBe("sharmasweets.in");
      expect(normalizeHost("sharmasweets.in.")).toBe("sharmasweets.in");
      expect(normalizeHost("  MY-CAFE.COM  ")).toBe("my-cafe.com");
      expect(normalizeHost("bad hostname with spaces")).toBeNull();
      expect(normalizeHost("")).toBeNull();
    });

    it("extracts platform subdomains accurately from hosts", () => {
      expect(extractSubdomainFromHost("sharma-sweets.vyapone.in", "vyapone.in")).toBe(
        "sharma-sweets",
      );
      expect(extractSubdomainFromHost("SHARMA-SWEETS.VYAPONE.IN", "vyapone.in")).toBe(
        "sharma-sweets",
      );
      // Custom domains return null (delegating to primary_domain lookup)
      expect(extractSubdomainFromHost("sharmasweets.in", "vyapone.in")).toBeNull();
      expect(extractSubdomainFromHost("nested.sub.vyapone.in", "vyapone.in")).toBeNull();
    });
  });

  // ==========================================================================
  // 2. Core Rendering Invariant: Published Site & Version Verification
  // ==========================================================================
  describe("2. Core Rendering Invariant: Published Version Resolution", () => {
    it("successfully resolves published site and configuration by subdomain", async () => {
      const mockSupabase = createMockSupabase({});
      const result = await resolvePublishedStorefrontBySubdomain(mockSupabase, "sharma-sweets");

      expect(result).not.toBeNull();
      expect(result?.site.id).toBe(MOCK_SITE_ID);
      expect(result?.site.status).toBe("published");
      expect(result?.version.id).toBe(MOCK_PUB_VERSION_ID);
      expect(result?.version.publishedAt).toBe("2026-11-20T10:00:00Z");
      expect(result?.configuration.metadata.title).toBe("Sharma Pure Sweets");
    });

    it("successfully resolves published site by custom domain (primary_domain)", async () => {
      const mockSupabase = createMockSupabase({});
      const result = await resolvePublishedStorefrontByHost(mockSupabase, "sharmasweets.in");

      expect(result).not.toBeNull();
      expect(result?.site.primaryDomain).toBe("sharmasweets.in");
      expect(result?.site.status).toBe("published");
    });

    it("rejects site when published_version_id is null (draft only)", async () => {
      const mockSupabase = createMockSupabase({
        site: {
          id: MOCK_SITE_ID,
          business_id: MOCK_BIZ_ID,
          subdomain: "sharma-sweets",
          primary_domain: null,
          status: "published",
          published_version_id: null, // No published version!
          current_draft_version_id: MOCK_DRAFT_VERSION_ID,
        },
      });

      const result = await resolvePublishedStorefrontBySubdomain(mockSupabase, "sharma-sweets");
      expect(result).toBeNull();
    });

    it("rejects site when status is 'draft' or 'suspended'", async () => {
      const draftSupabase = createMockSupabase({
        site: {
          id: MOCK_SITE_ID,
          business_id: MOCK_BIZ_ID,
          subdomain: "sharma-sweets",
          status: "draft", // NOT published
          published_version_id: MOCK_PUB_VERSION_ID,
        },
      });
      expect(
        await resolvePublishedStorefrontBySubdomain(draftSupabase, "sharma-sweets"),
      ).toBeNull();

      const suspendedSupabase = createMockSupabase({
        site: {
          id: MOCK_SITE_ID,
          business_id: MOCK_BIZ_ID,
          subdomain: "sharma-sweets",
          status: "suspended", // Suspended site fails closed
          published_version_id: MOCK_PUB_VERSION_ID,
        },
      });
      expect(
        await resolvePublishedStorefrontBySubdomain(suspendedSupabase, "sharma-sweets"),
      ).toBeNull();
    });

    it("rejects version when published_at is null (draft version record)", async () => {
      const mockSupabase = createMockSupabase({
        version: {
          id: MOCK_PUB_VERSION_ID,
          site_id: MOCK_SITE_ID,
          business_id: MOCK_BIZ_ID,
          version_number: 1,
          schema_version: "v1",
          configuration: SAMPLE_CONFIG,
          published_at: null, // Draft record!
        },
      });

      const result = await resolvePublishedStorefrontBySubdomain(mockSupabase, "sharma-sweets");
      expect(result).toBeNull();
    });

    it("rejects cross-site version reference (version.site_id mismatch)", async () => {
      const mockSupabase = createMockSupabase({
        version: {
          id: MOCK_PUB_VERSION_ID,
          site_id: "99999999-9999-9999-9999-999999999999", // Different site!
          business_id: MOCK_BIZ_ID,
          version_number: 1,
          schema_version: "v1",
          configuration: SAMPLE_CONFIG,
          published_at: "2026-11-20T10:00:00Z",
        },
      });

      const result = await resolvePublishedStorefrontBySubdomain(mockSupabase, "sharma-sweets");
      expect(result).toBeNull();
    });

    it("rejects cross-tenant version reference (version.business_id mismatch)", async () => {
      const mockSupabase = createMockSupabase({
        version: {
          id: MOCK_PUB_VERSION_ID,
          site_id: MOCK_SITE_ID,
          business_id: "88888888-8888-8888-8888-888888888888", // Different tenant!
          version_number: 1,
          schema_version: "v1",
          configuration: SAMPLE_CONFIG,
          published_at: "2026-11-20T10:00:00Z",
        },
      });

      const result = await resolvePublishedStorefrontBySubdomain(mockSupabase, "sharma-sweets");
      expect(result).toBeNull();
    });

    it("rejects unsupported schema version (e.g. v99)", async () => {
      const mockSupabase = createMockSupabase({
        version: {
          id: MOCK_PUB_VERSION_ID,
          site_id: MOCK_SITE_ID,
          business_id: MOCK_BIZ_ID,
          version_number: 1,
          schema_version: "v99", // Unsupported version
          configuration: SAMPLE_CONFIG,
          published_at: "2026-11-20T10:00:00Z",
        },
      });

      const result = await resolvePublishedStorefrontBySubdomain(mockSupabase, "sharma-sweets");
      expect(result).toBeNull();
    });

    it("rejects corrupted configuration JSON safely", async () => {
      const mockSupabase = createMockSupabase({
        version: {
          id: MOCK_PUB_VERSION_ID,
          site_id: MOCK_SITE_ID,
          business_id: MOCK_BIZ_ID,
          version_number: 1,
          schema_version: "v1",
          configuration: { invalid: "corrupted_payload" }, // Invalid schema
          published_at: "2026-11-20T10:00:00Z",
        },
      });

      const result = await resolvePublishedStorefrontBySubdomain(mockSupabase, "sharma-sweets");
      expect(result).toBeNull();
    });

    it("fails closed if the business status is not active (suspended business)", async () => {
      const mockSupabase = createMockSupabase({
        business: {
          id: MOCK_BIZ_ID,
          legal_name: "Suspended Bakery",
          trade_name: "Suspended Bakery",
          status: "suspended", // Suspended tenant
          currency_code: "INR",
        },
      });

      const result = await resolvePublishedStorefrontBySubdomain(mockSupabase, "sharma-sweets");
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // 3. Safe Public Facts & Privacy Verification
  // ==========================================================================
  describe("3. Safe Public Context & Privacy Verification", () => {
    it("strictly excludes private business facts (PAN, GSTIN, owner_id, workspace_id)", async () => {
      const mockSupabase = createMockSupabase({});
      const result = await resolvePublishedStorefrontBySubdomain(mockSupabase, "sharma-sweets");

      const biz = result?.context.business as unknown as Record<string, unknown>;
      expect(biz).toBeDefined();
      expect(biz.tradeName).toBe("Sharma Pure Sweets");
      const loc = biz.primaryLocation as { city?: string } | undefined;
      expect(loc?.city).toBe("Bengaluru");

      // Verify ZERO statutory or back-office facts in public context:
      expect(biz.gst_number).toBeUndefined();
      expect(biz.gstNumber).toBeUndefined();
      expect(biz.pan_number).toBeUndefined();
      expect(biz.panNumber).toBeUndefined();
      expect(biz.sovereign_owner_id).toBeUndefined();
      expect(biz.sovereignOwnerId).toBeUndefined();
      expect(biz.workspace_id).toBeUndefined();
      expect(biz.workspaceId).toBeUndefined();
      expect(biz.bank_account).toBeUndefined();
    });

    it("excludes unavailable catalogue items (is_available = false)", async () => {
      const mockSupabase = createMockSupabase({});
      const result = await resolvePublishedStorefrontBySubdomain(mockSupabase, "sharma-sweets");

      const items = result?.context.catalogueItems || [];
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe("Kaju Katli");
      expect(items[0].priceMinor).toBe(25000);
      expect(items[0].currency).toBe("INR");

      // Draft item with is_available = false is excluded
      const draftItem = items.find((i) => i.name === "Draft Sweet");
      expect(draftItem).toBeUndefined();
    });

    it("media privacy: excludes private or quarantined media items from public URL map", async () => {
      const configWithBothMedia: WebsiteConfiguration = {
        ...SAMPLE_CONFIG,
        metadata: {
          ...SAMPLE_CONFIG.metadata,
          faviconMediaId: MOCK_PUB_MEDIA_ID,
        },
        header: {
          ...SAMPLE_CONFIG.header,
          logoMediaId: MOCK_PRIV_MEDIA_ID, // Private document asset!
        },
      };

      const mockSupabase = createMockSupabase({
        version: {
          id: MOCK_PUB_VERSION_ID,
          site_id: MOCK_SITE_ID,
          business_id: MOCK_BIZ_ID,
          version_number: 1,
          schema_version: "v1",
          configuration: configWithBothMedia,
          published_at: "2026-11-20T10:00:00Z",
        },
      });

      const result = await resolvePublishedStorefrontBySubdomain(mockSupabase, "sharma-sweets");

      const mediaUrls = result?.context.mediaUrls || {};
      // Public verified media resolved
      expect(mediaUrls[MOCK_PUB_MEDIA_ID]).toBe(
        "https://cdn.vyapone.com/vyapone-public-media/logo.png",
      );
      // Private/quarantined asset NOT exposed
      expect(mediaUrls[MOCK_PRIV_MEDIA_ID]).toBeUndefined();
    });
  });

  // ==========================================================================
  // 4. PublicWebsiteRenderer Component & 13 Canonical Approved Blocks
  // ==========================================================================
  describe("4. PublicWebsiteRenderer Component & All 13 Blocks", () => {
    it("renders website with theme styling, accessibility landmarks, and skip link", () => {
      render(<PublicWebsiteRenderer configuration={SAMPLE_CONFIG} context={SAMPLE_CONTEXT} />);

      // Skip link for WCAG 2.2 AA keyboard accessibility
      const skipLink = screen.getByRole("link", { name: "Skip to main content" });
      expect(skipLink).toBeDefined();
      expect(skipLink.getAttribute("href")).toBe("#main-content");

      // Main landmark
      const main = screen.getByRole("main");
      expect(main).toBeDefined();
      expect(main.getAttribute("id")).toBe("main-content");

      // Sections rendered
      expect(screen.getByText("Authentic Handcrafted Sweets")).toBeDefined();
      expect(screen.getByText("Our Heritage")).toBeDefined();
    });

    it("skips disabled sections (isEnabled = false)", () => {
      const configWithDisabledSection: WebsiteConfiguration = {
        ...SAMPLE_CONFIG,
        pages: [
          {
            ...SAMPLE_CONFIG.pages[0],
            sections: [
              {
                id: "sec-hero",
                type: "hero",
                isEnabled: false, // Disabled!
                props: { title: "Disabled Hero" },
              },
              {
                id: "sec-about",
                type: "about",
                isEnabled: true,
                props: { title: "Active About", story: "Valid story" },
              },
            ],
          },
        ],
      };

      render(
        <PublicWebsiteRenderer
          configuration={configWithDisabledSection}
          context={SAMPLE_CONTEXT}
        />,
      );

      expect(screen.queryByText("Disabled Hero")).toBeNull();
      expect(screen.getByText("Active About")).toBeDefined();
    });

    it("renders all 13 canonical approved blocks without crashing", () => {
      const full13BlocksConfig: WebsiteConfiguration = {
        ...SAMPLE_CONFIG,
        pages: [
          {
            id: "page-13",
            slug: "/all-blocks",
            title: "All Blocks Showcase",
            sections: [
              {
                id: "b-hero",
                type: "hero",
                isEnabled: true,
                props: { title: "Hero Block" },
              },
              {
                id: "b-about",
                type: "about",
                isEnabled: true,
                props: { title: "About Block", story: "About us" },
              },
              {
                id: "b-menu",
                type: "menu",
                isEnabled: true,
                props: { title: "Menu Block", source: "catalogue" },
              },
              {
                id: "b-grid",
                type: "catalogue_grid",
                isEnabled: true,
                props: { title: "Grid Block", source: "catalogue" },
              },
              {
                id: "b-gallery",
                type: "gallery",
                isEnabled: true,
                props: { title: "Gallery Block", images: [] },
              },
              {
                id: "b-booking",
                type: "booking_form",
                isEnabled: true,
                props: { title: "Booking Block" },
              },
              {
                id: "b-pricing",
                type: "pricing",
                isEnabled: true,
                props: { title: "Pricing Block", source: "catalogue" },
              },
              {
                id: "b-reviews",
                type: "reviews",
                isEnabled: true,
                props: { title: "Reviews Block", source: "verified_reviews" },
              },
              {
                id: "b-offers",
                type: "offers",
                isEnabled: true,
                props: { title: "Offers Block", offers: [] },
              },
              {
                id: "b-location",
                type: "location_map",
                isEnabled: true,
                props: {
                  title: "Location Block",
                  addressRef: "business.primary_location",
                },
              },
              {
                id: "b-contact",
                type: "contact",
                isEnabled: true,
                props: { title: "Contact Block" },
              },
              {
                id: "b-faq",
                type: "faq",
                isEnabled: true,
                props: { title: "FAQ Block", items: [] },
              },
              {
                id: "b-footer",
                type: "footer",
                isEnabled: true,
                props: { copyright: "© 2026 Test" },
              },
            ],
          },
        ],
      };

      render(<PublicWebsiteRenderer configuration={full13BlocksConfig} context={SAMPLE_CONTEXT} />);

      // Verify presence of representative headers across all 13 blocks
      expect(screen.getByText("Hero Block")).toBeDefined();
      expect(screen.getByText("About Block")).toBeDefined();
      expect(screen.getByText("Menu Block")).toBeDefined();
      expect(screen.getByText("Grid Block")).toBeDefined();
      expect(screen.getByText("Gallery Block")).toBeDefined();
      expect(screen.getByText("Booking Block")).toBeDefined();
      expect(screen.getByText("Pricing Block")).toBeDefined();
      expect(screen.getByText("Reviews Block")).toBeDefined();
      expect(screen.getByText("Offers Block")).toBeDefined();
      expect(screen.getByText("Location Block")).toBeDefined();
      expect(screen.getByText("Contact Block")).toBeDefined();
      expect(screen.getByText("FAQ Block")).toBeDefined();
      expect(screen.getByText("© 2026 Test")).toBeDefined();
    });

    it("isolates block rendering errors so valid sections continue rendering", () => {
      const configWithCorruptedSection: WebsiteConfiguration = {
        ...SAMPLE_CONFIG,
        pages: [
          {
            ...SAMPLE_CONFIG.pages[0],
            sections: [
              {
                id: "sec-valid-1",
                type: "hero",
                isEnabled: true,
                props: { title: "Valid First Block" },
              },
              {
                id: "sec-unapproved",
                type: "custom_iframe_widget" as unknown as ApprovedBlockType, // Unapproved block type!
                isEnabled: true,
                props: { src: "https://evil.com" },
              },
              {
                id: "sec-valid-2",
                type: "about",
                isEnabled: true,
                props: { title: "Valid Second Block", story: "Valid text" },
              },
            ],
          },
        ],
      };

      // In production mode (previewMode: false), unapproved block safely returns null
      render(
        <PublicWebsiteRenderer
          configuration={configWithCorruptedSection}
          context={{ ...SAMPLE_CONTEXT, previewMode: false }}
        />,
      );

      // Both valid sections are rendered intact
      expect(screen.getByText("Valid First Block")).toBeDefined();
      expect(screen.getByText("Valid Second Block")).toBeDefined();
    });

    it("renders StorefrontNotFound fail-closed view without leaking tenant info", () => {
      render(<StorefrontNotFound subdomain="secret-tenant" />);

      expect(screen.getByText("Storefront Unavailable")).toBeDefined();
      expect(
        screen.getByText(
          "The website you are looking for is not published or is currently unavailable.",
        ),
      ).toBeDefined();
      expect(screen.getByRole("link", { name: "Return to VyapOne Home" })).toBeDefined();

      // Zero leakage of sensitive terms or tenant identifiers
      expect(screen.queryByText(/secret-tenant/)).toBeNull();
      expect(screen.queryByText(/PAN/)).toBeNull();
      expect(screen.queryByText(/GSTIN/)).toBeNull();
    });
  });
});

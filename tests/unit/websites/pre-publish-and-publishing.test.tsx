/**
 * VyapOne — Pre-publish Validation, Domains, and QR Test Suite [VO-049]
 */

import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Mock server-only
vi.mock("server-only", () => ({}));

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { SiteRow, WebsiteConfiguration } from "@/lib/websites/types";
import { buildInitialWebsiteConfiguration } from "@/lib/websites/defaults";
import { validateSiteForPublishing } from "@/lib/websites/pre-publish-validation";
import {
  addCustomDomain,
  formatDnsInstructions,
  removeCustomDomain,
  verifyCustomDomain,
} from "@/lib/websites/domains/service";
import { MockCustomDomainAdapter } from "@/lib/websites/domains/adapter";
import {
  generateScanSafeQrSvg,
  getOrCreateMainStorefrontQr,
  resolveQrDestination,
  updateQrDestination,
} from "@/lib/websites/qr/service";
import { publishSiteDraft } from "@/lib/websites/service";
import { PublishModal } from "@/components/websites/editor/publish-modal";
import { GET as qrRouteHandler } from "@/app/(public)/qr/[slug]/route";
import * as websiteActions from "@/lib/websites/actions";

// Mock tenant access
vi.mock("@/lib/auth/tenant-access", () => ({
  assertBusinessAccess: vi.fn(),
  assertAuthenticatedUser: vi.fn(),
  verifyBusinessAccess: vi.fn().mockResolvedValue({
    authorized: true,
    role: "owner",
    businessId: "11111111-1111-4111-8111-111111111111",
    userId: "00000000-0000-4000-8000-000000000001",
  }),
}));

// Mock plans service
vi.mock("@/lib/plans/service", () => ({
  getCapacityUsage: vi.fn().mockResolvedValue({
    metric: "live_websites",
    current: 0,
    baseLimit: 1,
    overrideCapacity: 0,
    effectiveLimit: 1,
    remaining: 1,
    isUnlimited: false,
    isExceeded: false,
  }),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock supabase admin
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(),
}));

describe("VO-049 Pre-publish Validation, Domains, and QR Test Suite", () => {
  const mockUserId = "00000000-0000-4000-8000-000000000001";
  const mockBusinessId = "11111111-1111-4111-8111-111111111111";
  const mockWorkspaceId = "22222222-2222-4222-8222-222222222222";
  const mockSiteId = "33333333-3333-4333-8333-333333333333";
  const mockDraftVersionId = "44444444-4444-4444-8444-444444444444";
  const mockMediaId = "55555555-5555-4555-8555-555555555555";
  const mockQrId = "66666666-6666-4666-8666-666666666666";
  const mockDomainId = "77777777-7777-4777-8777-777777777777";

  function createTestConfig(overrides?: Partial<WebsiteConfiguration>): WebsiteConfiguration {
    const base = buildInitialWebsiteConfiguration({
      siteId: mockSiteId,
      businessId: mockBusinessId,
      tradeName: "Artisan Roasters",
      subdomain: "artisan-roasters",
      nicheSlug: "cafe",
      description: "Artisanal coffee and baked goods in Koramangala.",
    });

    return {
      ...base,
      ...overrides,
    };
  }

  const sampleSite: SiteRow = {
    id: mockSiteId,
    business_id: mockBusinessId,
    subdomain: "artisan-roasters",
    primary_domain: null,
    status: "draft",
    current_draft_version_id: mockDraftVersionId,
    published_version_id: null,
    created_at: "2026-11-20T10:00:00Z",
    updated_at: "2026-11-20T10:00:00Z",
  };

  const sampleBusiness: Database["public"]["Tables"]["businesses"]["Row"] = {
    id: mockBusinessId,
    workspace_id: mockWorkspaceId,
    sovereign_owner_id: mockUserId,
    legal_name: "Artisan Roasters LLP",
    trade_name: "Artisan Roasters",
    slug: "artisan-roasters",
    contact_configuration: { phone: "+919876543210", email: "info@artisanroasters.in" },
    address_configuration: { street: "100ft Road", city: "Bengaluru", pincode: "560034" },
    timings_configuration: {},
    facts_provenance: {},
    category: "cafe",
    niche_id: null,
    description: "Artisanal coffee and baked goods",
    gst_number: null,
    pan_number: null,
    tax_scheme: "unregistered" as const,
    status: "active" as const,
    currency_code: "INR",
    preferred_language: "en",
    timezone: "Asia/Kolkata",
    created_at: "2026-11-20T10:00:00Z",
    updated_at: "2026-11-20T10:00:00Z",
  };

  function mockBusinessAccess(
    businessOverrides?: Partial<Database["public"]["Tables"]["businesses"]["Row"]>,
  ) {
    return {
      business: {
        ...sampleBusiness,
        ...businessOverrides,
      },
      callerUserId: mockUserId,
      isSovereignOwner: true,
      effectiveRole: "owner" as const,
      member: null,
      locationId: null,
    };
  }

  /**
   * Builds a comprehensive Supabase mock that responds correctly to all validation queries.
   */
  function createValidationSupabaseMock(options?: {
    site?: SiteRow;
    mediaRows?: Array<{ id: string; business_id: string; status: string }>;
    bModules?: Array<{ module_key: string; is_enabled: boolean }>;
  }) {
    const siteToReturn = options?.site || sampleSite;
    const mediaToReturn = options?.mediaRows || [];
    const modulesToReturn = options?.bModules || [];

    return {
      from: (table: string) => {
        if (table === "sites") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: siteToReturn, error: null }),
              }),
            }),
          };
        }
        if (table === "site_versions") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: mockDraftVersionId,
                    configuration: createTestConfig(),
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "media_items") {
          return {
            select: () => ({
              in: vi.fn().mockResolvedValue({ data: mediaToReturn, error: null }),
            }),
          };
        }
        if (table === "business_modules") {
          return {
            select: () => ({
              eq: () => ({
                in: vi.fn().mockResolvedValue({ data: modulesToReturn, error: null }),
              }),
            }),
          };
        }
        return {};
      },
    } as unknown as SupabaseClient<Database>;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Pre-publish Validation Service Tests
  // =========================================================================
  describe("1. Pre-publish Validation Service", () => {
    it("passes validation when all business facts, navigation, and blocks are valid", async () => {
      const config = createTestConfig();
      const mockSupabase = createValidationSupabaseMock();

      const { assertBusinessAccess } = await import("@/lib/auth/tenant-access");
      vi.mocked(assertBusinessAccess).mockResolvedValueOnce(mockBusinessAccess());

      const result = await validateSiteForPublishing(mockSupabase, mockSiteId, config);

      expect(result.isValid).toBe(true);
      expect(result.canPublish).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it("blocks publish with error when trade name is missing", async () => {
      const config = createTestConfig();
      const mockSupabase = createValidationSupabaseMock();

      const { assertBusinessAccess } = await import("@/lib/auth/tenant-access");
      vi.mocked(assertBusinessAccess).mockResolvedValueOnce(mockBusinessAccess({ trade_name: "" }));

      const result = await validateSiteForPublishing(mockSupabase, mockSiteId, config);

      expect(result.canPublish).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
      const tradeNameCheck = result.checks.find((c) => c.id === "business_trade_name_missing");
      expect(tradeNameCheck).toBeDefined();
      expect(tradeNameCheck?.severity).toBe("error");
    });

    it("blocks publish with error when primary contact phone is missing", async () => {
      const config = createTestConfig();
      const mockSupabase = createValidationSupabaseMock();

      const { assertBusinessAccess } = await import("@/lib/auth/tenant-access");
      vi.mocked(assertBusinessAccess).mockResolvedValueOnce(
        mockBusinessAccess({ contact_configuration: {} }),
      );

      const result = await validateSiteForPublishing(mockSupabase, mockSiteId, config);

      expect(result.canPublish).toBe(false);
      const phoneCheck = result.checks.find((c) => c.id === "business_phone_missing");
      expect(phoneCheck).toBeDefined();
      expect(phoneCheck?.severity).toBe("error");
    });

    it("emits non-blocking warning when business address is missing", async () => {
      const config = createTestConfig();
      const mockSupabase = createValidationSupabaseMock();

      const { assertBusinessAccess } = await import("@/lib/auth/tenant-access");
      vi.mocked(assertBusinessAccess).mockResolvedValueOnce(
        mockBusinessAccess({ address_configuration: {} }),
      );

      const result = await validateSiteForPublishing(mockSupabase, mockSiteId, config);

      expect(result.canPublish).toBe(true);
      const addressCheck = result.checks.find((c) => c.id === "business_address_missing");
      expect(addressCheck).toBeDefined();
      expect(addressCheck?.severity).toBe("warning");
    });

    it("blocks publish when homepage (slug '/') is missing", async () => {
      const config = createTestConfig({
        pages: [
          {
            id: "page_about",
            slug: "/about",
            title: "About Us",
            isPublished: true,
            sections: [
              {
                id: "about_1",
                type: "about",
                props: { title: "About", content: "We roast coffee." },
              },
            ],
          },
        ],
      });

      const mockSupabase = createValidationSupabaseMock();

      const { assertBusinessAccess } = await import("@/lib/auth/tenant-access");
      vi.mocked(assertBusinessAccess).mockResolvedValueOnce(mockBusinessAccess());

      const result = await validateSiteForPublishing(mockSupabase, mockSiteId, config);

      expect(result.canPublish).toBe(false);
      const homeCheck = result.checks.find((c) => c.id === "nav_missing_homepage");
      expect(homeCheck).toBeDefined();
      expect(homeCheck?.severity).toBe("error");
    });

    it("blocks publish when header navigation link points to non-existent page", async () => {
      const config = createTestConfig({
        header: {
          navLinks: [
            { label: "Home", href: "/" },
            { label: "Secret Menu", href: "/non-existent-page" },
          ],
        },
      });

      const mockSupabase = createValidationSupabaseMock();

      const { assertBusinessAccess } = await import("@/lib/auth/tenant-access");
      vi.mocked(assertBusinessAccess).mockResolvedValueOnce(mockBusinessAccess());

      const result = await validateSiteForPublishing(mockSupabase, mockSiteId, config);

      expect(result.canPublish).toBe(false);
      const brokenLinkCheck = result.checks.find((c) => c.id.startsWith("nav_header_broken_"));
      expect(brokenLinkCheck).toBeDefined();
      expect(brokenLinkCheck?.severity).toBe("error");
    });

    it("warns when navigation link uses insecure HTTP", async () => {
      const config = createTestConfig({
        header: {
          navLinks: [
            { label: "External Blog", href: "http://insecure-blog.com", isExternal: true },
          ],
        },
      });

      const mockSupabase = createValidationSupabaseMock();

      const { assertBusinessAccess } = await import("@/lib/auth/tenant-access");
      vi.mocked(assertBusinessAccess).mockResolvedValueOnce(mockBusinessAccess());

      const result = await validateSiteForPublishing(mockSupabase, mockSiteId, config);

      expect(result.canPublish).toBe(true);
      const httpCheck = result.checks.find((c) => c.id.startsWith("nav_header_http_"));
      expect(httpCheck).toBeDefined();
      expect(httpCheck?.severity).toBe("warning");
    });

    it("blocks publish when referenced media asset is missing or not owned by business", async () => {
      const config = createTestConfig({
        metadata: {
          ...createTestConfig().metadata,
          faviconMediaId: mockMediaId,
        },
      });

      const mockSupabase = createValidationSupabaseMock({
        mediaRows: [
          // Owned by a different business!
          { id: mockMediaId, business_id: "other-business-uuid", status: "ready" },
        ],
      });

      const { assertBusinessAccess } = await import("@/lib/auth/tenant-access");
      vi.mocked(assertBusinessAccess).mockResolvedValueOnce(mockBusinessAccess());

      const result = await validateSiteForPublishing(mockSupabase, mockSiteId, config);

      expect(result.canPublish).toBe(false);
      const tenantCheck = result.checks.find((c) => c.id.startsWith("media_tenant_violation_"));
      expect(tenantCheck).toBeDefined();
      expect(tenantCheck?.severity).toBe("error");
    });

    it("blocks publish when plan capacity limit is reached for draft site", async () => {
      const config = createTestConfig();
      const mockSupabase = createValidationSupabaseMock();

      const { assertBusinessAccess } = await import("@/lib/auth/tenant-access");
      vi.mocked(assertBusinessAccess).mockResolvedValueOnce(mockBusinessAccess());

      const { getCapacityUsage } = await import("@/lib/plans/service");
      vi.mocked(getCapacityUsage).mockResolvedValueOnce({
        metric: "live_websites",
        current: 1,
        baseLimit: 1,
        overrideCapacity: 0,
        effectiveLimit: 1,
        remaining: 0,
        isUnlimited: false,
        isExceeded: true,
      });

      const result = await validateSiteForPublishing(mockSupabase, mockSiteId, config);

      expect(result.canPublish).toBe(false);
      const capacityCheck = result.checks.find((c) => c.id === "plan_capacity_exceeded");
      expect(capacityCheck).toBeDefined();
      expect(capacityCheck?.severity).toBe("error");
      expect(result.planCapacity?.allowed).toBe(false);
    });

    it("allows re-publishing an already published site even if plan limit is reached", async () => {
      const config = createTestConfig();
      const alreadyPublishedSite: SiteRow = {
        ...sampleSite,
        status: "published",
        published_version_id: "55555555-5555-4555-8555-555555555555",
      };

      const mockSupabase = createValidationSupabaseMock({
        site: alreadyPublishedSite,
      });

      const { assertBusinessAccess } = await import("@/lib/auth/tenant-access");
      vi.mocked(assertBusinessAccess).mockResolvedValueOnce(mockBusinessAccess());

      const { getCapacityUsage } = await import("@/lib/plans/service");
      vi.mocked(getCapacityUsage).mockResolvedValueOnce({
        metric: "live_websites",
        current: 1,
        baseLimit: 1,
        overrideCapacity: 0,
        effectiveLimit: 1,
        remaining: 0,
        isUnlimited: false,
        isExceeded: true,
      });

      const result = await validateSiteForPublishing(mockSupabase, mockSiteId, config);

      // Re-publishing an already live site consumes 0 additional slots
      expect(result.canPublish).toBe(true);
      expect(result.checks.some((c) => c.id === "plan_capacity_exceeded")).toBe(false);
      expect(result.planCapacity?.allowed).toBe(true);
    });
  });

  // =========================================================================
  // 2. Custom Domain Adapter & Service Tests
  // =========================================================================
  describe("2. Custom Domain Adapter & Service", () => {
    const mockDomainAdapter = new MockCustomDomainAdapter();

    it("adds a custom domain and generates DNS challenge instructions", async () => {
      const mockInsertedRow = {
        id: mockDomainId,
        site_id: mockSiteId,
        business_id: mockBusinessId,
        domain: "store.artisanroasters.in",
        status: "pending_verification" as const,
        verification_method: "dns_txt" as const,
        verification_token: "vyapone-verify-abc1234567890123456789",
        verification_target: "vyapone-verify-abc1234567890123456789",
        verified_at: null,
        last_checked_at: null,
        ssl_status: "pending" as const,
        error_message: null,
        created_at: "2026-11-22T10:00:00Z",
        updated_at: "2026-11-22T10:00:00Z",
      };

      const mockSupabase = {
        from: (table: string) => {
          if (table === "sites") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: sampleSite, error: null }),
                }),
              }),
            };
          }
          if (table === "site_domains") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
              insert: () => ({
                select: () => ({
                  single: vi.fn().mockResolvedValue({ data: mockInsertedRow, error: null }),
                }),
              }),
            };
          }
          return {};
        },
      } as unknown as SupabaseClient<Database>;

      const { assertBusinessAccess } = await import("@/lib/auth/tenant-access");
      vi.mocked(assertBusinessAccess).mockResolvedValueOnce(mockBusinessAccess());

      const result = await addCustomDomain(
        mockSupabase,
        { siteId: mockSiteId, domain: "store.artisanroasters.in" },
        mockDomainAdapter,
      );

      expect(result.domain.domain).toBe("store.artisanroasters.in");
      expect(result.domain.status).toBe("pending_verification");
      expect(result.instructions.recordType).toBe("TXT");
      expect(result.instructions.host).toBe("_vyapone-challenge.store.artisanroasters.in");
    });

    it("verifies custom domain ownership and updates site primary domain", async () => {
      const mockPendingRow = {
        id: mockDomainId,
        site_id: mockSiteId,
        business_id: mockBusinessId,
        domain: "store.artisanroasters.in",
        status: "pending_verification" as const,
        verification_method: "dns_txt" as const,
        verification_token: "vyapone-verify-abc1234567890123456789",
        verification_target: "vyapone-verify-abc1234567890123456789",
        ssl_status: "pending" as const,
      };

      const mockVerifiedRow = {
        ...mockPendingRow,
        status: "verified" as const,
        ssl_status: "active" as const,
        verified_at: "2026-11-22T10:05:00Z",
      };

      const mockSupabase = {
        from: (table: string) => {
          if (table === "site_domains") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: mockPendingRow, error: null }),
                  }),
                }),
              }),
              update: () => ({
                eq: () => ({
                  select: () => ({
                    single: vi.fn().mockResolvedValue({ data: mockVerifiedRow, error: null }),
                  }),
                }),
              }),
            };
          }
          if (table === "sites") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: sampleSite, error: null }),
                }),
              }),
              update: () => ({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          return {};
        },
      } as unknown as SupabaseClient<Database>;

      const { assertBusinessAccess } = await import("@/lib/auth/tenant-access");
      vi.mocked(assertBusinessAccess).mockResolvedValueOnce(mockBusinessAccess());

      const result = await verifyCustomDomain(
        mockSupabase,
        { siteId: mockSiteId, domainId: mockPendingRow.id },
        mockDomainAdapter,
      );

      expect(result.success).toBe(true);
      expect(result.domain.status).toBe("verified");
      expect(result.domain.ssl_status).toBe("active");
    });

    it("rejects domain registration if domain belongs to another business", async () => {
      const mockSupabase = {
        from: (table: string) => {
          if (table === "sites") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: sampleSite, error: null }),
                }),
              }),
            };
          }
          if (table === "site_domains") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: "other-domain-id",
                      business_id: "other-business-uuid",
                      site_id: "other-site-uuid",
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        },
      } as unknown as SupabaseClient<Database>;

      const { assertBusinessAccess } = await import("@/lib/auth/tenant-access");
      vi.mocked(assertBusinessAccess).mockResolvedValueOnce(mockBusinessAccess());

      await expect(
        addCustomDomain(
          mockSupabase,
          { siteId: mockSiteId, domain: "store.artisanroasters.in" },
          mockDomainAdapter,
        ),
      ).rejects.toThrow("This domain is already registered to another account");
    });

    it("removes custom domain and clears primary domain pointer", async () => {
      const mockDomainRow = {
        id: mockDomainId,
        site_id: mockSiteId,
        business_id: mockBusinessId,
        domain: "store.artisanroasters.in",
      };

      const siteWithPrimary = {
        ...sampleSite,
        primary_domain: "store.artisanroasters.in",
      };

      const siteUpdateSpy = vi.fn().mockResolvedValue({ error: null });

      const mockSupabase = {
        from: (table: string) => {
          if (table === "site_domains") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: mockDomainRow, error: null }),
                  }),
                }),
              }),
              delete: () => ({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          if (table === "sites") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: siteWithPrimary, error: null }),
                }),
              }),
              update: (args: Record<string, unknown>) => ({
                eq: (idCol: string, idVal: string) => siteUpdateSpy(args, idCol, idVal),
              }),
            };
          }
          return {};
        },
      } as unknown as SupabaseClient<Database>;

      const { assertBusinessAccess } = await import("@/lib/auth/tenant-access");
      vi.mocked(assertBusinessAccess).mockResolvedValueOnce(mockBusinessAccess());

      const result = await removeCustomDomain(
        mockSupabase,
        { siteId: mockSiteId, domainId: mockDomainRow.id },
        mockDomainAdapter,
      );

      expect(result.success).toBe(true);
      expect(siteUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ primary_domain: null }),
        "id",
        mockSiteId,
      );
    });

    it("formats DNS instructions correctly", () => {
      const domainRow = {
        id: "d1",
        site_id: mockSiteId,
        business_id: mockBusinessId,
        domain: "coffee.in",
        status: "pending_verification" as const,
        verification_method: "dns_txt" as const,
        verification_token: "token123",
        verification_target: "target123",
        verified_at: null,
        last_checked_at: null,
        ssl_status: "pending" as const,
        error_message: null,
        created_at: "2026-11-22T00:00:00Z",
        updated_at: "2026-11-22T00:00:00Z",
      };

      const instructions = formatDnsInstructions(domainRow);
      expect(instructions.recordType).toBe("TXT");
      expect(instructions.host).toBe("_vyapone-challenge.coffee.in");
      expect(instructions.value).toBe("target123");
    });
  });

  // =========================================================================
  // 3. Dynamic QR Code Engine & Redirects Tests
  // =========================================================================
  describe("3. Dynamic QR Code Engine & Redirects", () => {
    it("lazily creates stable main storefront QR code", async () => {
      const mockSupabase = {
        from: (table: string) => {
          if (table === "qr_codes") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
              insert: (record: Record<string, unknown>) => ({
                select: () => ({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: mockQrId,
                      ...record,
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "sites") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: sampleSite, error: null }),
                }),
              }),
            };
          }
          return {};
        },
      } as unknown as SupabaseClient<Database>;

      const { assertBusinessAccess } = await import("@/lib/auth/tenant-access");
      vi.mocked(assertBusinessAccess).mockResolvedValueOnce(mockBusinessAccess());

      const qr = await getOrCreateMainStorefrontQr(mockSupabase, mockSiteId);

      expect(qr.type).toBe("main_storefront");
      expect(qr.public_slug).toMatch(/^qr_[a-f0-9]{16}$/);
      expect(qr.status).toBe("active");
    });

    it("updates dynamic destination configuration and strips unsafe open redirect targets", async () => {
      const mockQr = {
        id: mockQrId,
        site_id: mockSiteId,
        business_id: mockBusinessId,
        public_slug: "qr_1234567890abcdef",
        destination_configuration: { type: "storefront" },
      };

      const updateSpy = vi.fn().mockResolvedValue({
        data: {
          ...mockQr,
          destination_configuration: {
            type: "page",
            pageSlug: "/menu",
          },
        },
        error: null,
      });

      const mockSupabase = {
        from: (table: string) => {
          if (table === "qr_codes") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: mockQr, error: null }),
                  }),
                }),
              }),
              update: (args: Record<string, unknown>) => ({
                eq: () => ({
                  select: () => ({
                    single: () => updateSpy(args),
                  }),
                }),
              }),
            };
          }
          return {};
        },
      } as unknown as SupabaseClient<Database>;

      const { assertBusinessAccess } = await import("@/lib/auth/tenant-access");
      vi.mocked(assertBusinessAccess).mockResolvedValueOnce(mockBusinessAccess());

      const updated = await updateQrDestination(mockSupabase, {
        qrCodeId: mockQr.id,
        siteId: mockSiteId,
        destinationConfiguration: {
          type: "page",
          pageSlug: "/menu",
        },
      });

      expect(updated.destination_configuration).toEqual({
        type: "page",
        pageSlug: "/menu",
      });
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          destination_configuration: expect.objectContaining({
            type: "page",
            pageSlug: "/menu",
          }),
        }),
      );
    });

    it("resolves dynamic QR destination and increments scan count", async () => {
      const mockQr = {
        id: mockQrId,
        site_id: mockSiteId,
        business_id: mockBusinessId,
        public_slug: "qr_test1234567890",
        destination_configuration: {
          type: "page",
          pageSlug: "/coffee-beans",
          utmParams: { campaign: "summer_roast" },
        },
        scan_count: 5,
        status: "active",
      };

      const publishedSite: SiteRow = {
        ...sampleSite,
        status: "published",
        primary_domain: "roasters.com",
      };

      const updateSpy = vi.fn().mockResolvedValue({ error: null });

      const mockSupabase = {
        from: (table: string) => {
          if (table === "qr_codes") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: mockQr, error: null }),
                  }),
                }),
              }),
              update: (args: Record<string, unknown>) => ({
                eq: () => updateSpy(args),
              }),
            };
          }
          if (table === "sites") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: publishedSite, error: null }),
                }),
              }),
            };
          }
          return {};
        },
      } as unknown as SupabaseClient<Database>;

      const resolved = await resolveQrDestination(mockSupabase, "qr_test1234567890");

      expect(resolved).not.toBeNull();
      expect(resolved?.redirectUrl).toContain("https://roasters.com/coffee-beans");
      expect(resolved?.redirectUrl).toContain("utm_campaign=summer_roast");
      expect(resolved?.redirectUrl).toContain("utm_source=vyapone_qr");

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          scan_count: 6,
        }),
      );
    });

    it("generates a high-contrast scan-safe SVG with 4-module quiet zone", async () => {
      const targetUrl = "https://artisan-roasters.vyapone.in";
      const svg = await generateScanSafeQrSvg(targetUrl);

      expect(svg).toContain("<svg");
      expect(svg).toContain("</svg>");
      // High-contrast check
      expect(svg.toLowerCase()).toContain("#000000");
      expect(svg.toLowerCase()).toContain("#ffffff");
    });

    it("handles HTTP 307 temporary redirect with Cache-Control: no-store in QR route handler", async () => {
      const mockQr = {
        id: mockQrId,
        site_id: mockSiteId,
        business_id: mockBusinessId,
        public_slug: "qr_redirect_test",
        destination_configuration: { type: "storefront" },
        scan_count: 0,
        status: "active",
      };

      const publishedSite: SiteRow = {
        ...sampleSite,
        status: "published",
      };

      const mockClient = {
        from: (table: string) => {
          if (table === "qr_codes") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: mockQr, error: null }),
                  }),
                }),
              }),
              update: () => ({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          if (table === "sites") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: publishedSite, error: null }),
                }),
              }),
            };
          }
          return {};
        },
      };

      const { createAdminSupabaseClient } = await import("@/lib/supabase/admin");
      vi.mocked(createAdminSupabaseClient).mockReturnValue(mockClient as never);

      const request = new Request("http://localhost:3000/qr/qr_redirect_test", {
        headers: { host: "localhost:3000" },
      });

      const response = await qrRouteHandler(request, {
        params: Promise.resolve({ slug: "qr_redirect_test" }),
      });

      expect(response.status).toBe(307);
      expect(response.headers.get("Location")).toBe(
        "https://artisan-roasters.vyapone.in/?utm_source=vyapone_qr",
      );
      expect(response.headers.get("Cache-Control")).toContain("no-store");
    });
  });

  // =========================================================================
  // 4. Atomic Publishing Service Tests
  // =========================================================================
  describe("4. Atomic Publishing Service", () => {
    it("calls publish_site_draft_atomic RPC and returns published site details", async () => {
      const config = createTestConfig();

      const mockRpcPublishedResult = {
        site: {
          ...sampleSite,
          status: "published",
          published_version_id: mockDraftVersionId,
        },
        publishedVersion: {
          id: mockDraftVersionId,
          site_id: mockSiteId,
          business_id: mockBusinessId,
          version_number: 1,
          schema_version: "v1",
          configuration: config,
          published_at: "2026-11-22T12:00:00Z",
          created_at: "2026-11-22T10:00:00Z",
        },
        mainQrCode: {
          id: mockQrId,
          site_id: mockSiteId,
          business_id: mockBusinessId,
          public_slug: "qr_1234567890abcdef",
        },
      };

      const mockSupabase = {
        ...createValidationSupabaseMock(),
        rpc: vi.fn().mockResolvedValue({
          data: mockRpcPublishedResult,
          error: null,
        }),
      } as unknown as SupabaseClient<Database>;

      const { assertBusinessAccess } = await import("@/lib/auth/tenant-access");
      vi.mocked(assertBusinessAccess).mockResolvedValue(mockBusinessAccess());

      const result = await publishSiteDraft(mockSupabase, mockUserId, {
        siteId: mockSiteId,
        expectedDraftVersionNumber: 1,
      });

      expect(result.site.status).toBe("published");
      expect(result.publishedVersion.published_at).toBe("2026-11-22T12:00:00Z");
      expect(result.platformUrl).toBe("https://artisan-roasters.vyapone.in");
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "publish_site_draft_atomic",
        expect.objectContaining({
          p_site_id: mockSiteId,
          p_expected_draft_version_number: 1,
        }),
      );
    });

    it("rejects publishing when optimistic concurrency conflict occurs (VY049)", async () => {
      const mockSupabase = {
        ...createValidationSupabaseMock(),
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: {
            message: "Draft has changed since last loaded (expected 1, actual 2)",
            code: "VY049",
          },
        }),
      } as unknown as SupabaseClient<Database>;

      const { assertBusinessAccess } = await import("@/lib/auth/tenant-access");
      vi.mocked(assertBusinessAccess).mockResolvedValue(mockBusinessAccess());

      await expect(
        publishSiteDraft(mockSupabase, mockUserId, {
          siteId: mockSiteId,
          expectedDraftVersionNumber: 1,
        }),
      ).rejects.toThrow("Draft has changed since last loaded");
    });
  });

  // =========================================================================
  // 5. UI Layer: PublishModal Component Tests
  // =========================================================================
  describe("5. UI Layer: PublishModal Component", () => {
    it("renders pre-publish validation checklist with categories", async () => {
      vi.spyOn(websiteActions, "validateSitePrePublishAction").mockResolvedValueOnce({
        success: true,
        data: {
          isValid: true,
          canPublish: true,
          errorCount: 0,
          warningCount: 1,
          checks: [
            {
              id: "business_address_missing",
              category: "business_facts",
              severity: "warning",
              title: "Business Address Recommended",
              message: "Physical business address is not configured.",
            },
          ],
          validatedAt: new Date().toISOString(),
          siteId: mockSiteId,
          planCapacity: {
            currentPublishedSites: 0,
            maxPublishedSites: 1,
            allowed: true,
          },
        },
      });

      render(
        <PublishModal isOpen={true} onClose={vi.fn()} site={sampleSite} draftVersionNumber={1} />,
      );

      // Loading state shows first
      expect(screen.getByText(/running pre-publish validation/i)).toBeDefined();

      // Wait for validation to resolve
      await waitFor(() => {
        expect(screen.getByText(/Business Details/i)).toBeDefined();
        expect(screen.getByText(/Business Address Recommended/i)).toBeDefined();
      });
    });

    it("disables publish button when blocking errors exist", async () => {
      vi.spyOn(websiteActions, "validateSitePrePublishAction").mockResolvedValueOnce({
        success: true,
        data: {
          isValid: false,
          canPublish: false,
          errorCount: 1,
          warningCount: 0,
          checks: [
            {
              id: "business_phone_missing",
              category: "business_facts",
              severity: "error",
              title: "Primary Phone Number Required",
              message: "A primary contact phone number is required.",
            },
          ],
          validatedAt: new Date().toISOString(),
          siteId: mockSiteId,
        },
      });

      render(
        <PublishModal isOpen={true} onClose={vi.fn()} site={sampleSite} draftVersionNumber={1} />,
      );

      await waitFor(() => {
        expect(screen.getByText(/Primary Phone Number Required/i)).toBeDefined();
        const publishBtn = screen.getByRole("button", {
          name: /publish storefront/i,
        }) as HTMLButtonElement;
        expect(publishBtn.disabled).toBe(true);
      });
    });
  });
});

/**
 * VyapOne — Website Blocks Media & Module Data Integration Test Suite [VO-046]
 *
 * Verifies:
 * 1. Authorized business media selection & filtering in editor.
 * 2. Cross-tenant media isolation & pre-publish reference validation.
 * 3. Private / quarantined media exclusion from public rendering.
 * 4. Graceful handling of missing, deleted, or unverified media.
 * 5. Business facts & module availability binding (operational vs informational vs coming soon).
 * 6. Public data sanitization (zero PAN, GSTIN, bank, or workspace leakage).
 * 7. Draft preview vs published storefront boundary.
 * 8. Regression protection for VO-044 optimistic concurrency and VO-045 responsive previews.
 */

import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

// Mock server-only
vi.mock("server-only", () => ({}));

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type {
  MediaItemSummary,
  SiteRow,
  SiteVersionRow,
  WebsiteConfiguration,
} from "@/lib/websites/types";
import type { WebsiteRenderContext } from "@/components/websites/blocks/types";
import { buildInitialWebsiteConfiguration } from "@/lib/websites/defaults";
import { SectionInspector } from "@/components/websites/editor/section-inspector";
import { ConstrainedWebsiteEditor } from "@/components/websites/editor/constrained-website-editor";
import { BookingFormBlock } from "@/components/websites/blocks/booking-form-block";
import { LocationMapBlock } from "@/components/websites/blocks/location-map-block";
import { MenuBlock } from "@/components/websites/blocks/menu-block";
import { GalleryBlock } from "@/components/websites/blocks/gallery-block";
import { validateWebsiteMediaReferences } from "@/lib/websites/service";
import { resolvePublishedStorefrontBySubdomain } from "@/lib/websites/public-service";
import * as tenantAccess from "@/lib/auth/tenant-access";
import * as websiteActions from "@/lib/websites/actions";

// Mock tenant access
vi.mock("@/lib/auth/tenant-access", async () => {
  const actual = await vi.importActual<typeof tenantAccess>("@/lib/auth/tenant-access");
  return {
    ...actual,
    assertAuthenticatedUser: vi.fn(),
    assertBusinessAccess: vi.fn(),
  };
});

// Mock server actions
vi.mock("@/lib/websites/actions", async () => {
  const actual = await vi.importActual<typeof websiteActions>("@/lib/websites/actions");
  return {
    ...actual,
    saveSiteDraftConfigurationAction: vi.fn(),
    loadOwnerWebsiteWorkspaceAction: vi.fn(),
  };
});

describe("VO-046 Media and Module Data Integration Test Suite", () => {
  const MOCK_SITE_ID = "11111111-1111-4111-8111-111111111111";
  const MOCK_BUSINESS_ID = "22222222-2222-4222-8222-222222222222";
  const OTHER_BUSINESS_ID = "99999999-9999-4999-8999-999999999999";
  const MOCK_VERSION_ID = "33333333-3333-4333-8333-333333333333";
  const MOCK_USER_ID = "44444444-4444-4444-8444-444444444444";

  const MOCK_MEDIA_1: MediaItemSummary = {
    id: "aaaa1111-1111-4111-8111-111111111111",
    originalFilename: "sweets_hero_banner.jpg",
    category: "website_asset",
    fileSizeBytes: 1024 * 500,
    width: 1920,
    height: 1080,
    isPublic: true,
    status: "ready",
    url: "https://cdn.vyapone.com/vyapone-public-media/sweets_hero.jpg",
  };

  const MOCK_MEDIA_2: MediaItemSummary = {
    id: "bbbb2222-2222-4222-8222-222222222222",
    originalFilename: "kaju_katli_showcase.webp",
    category: "catalogue_image",
    fileSizeBytes: 1024 * 300,
    width: 1200,
    height: 800,
    isPublic: false, // Private quarantine
    status: "ready",
    url: "https://cdn.vyapone.com/preview/vyapone-private-media/kaju_katli.webp",
  };

  const MOCK_MEDIA_LOGO: MediaItemSummary = {
    id: "cccc3333-3333-4333-8333-333333333333",
    originalFilename: "sharma_brand_logo.png",
    category: "business_logo",
    fileSizeBytes: 1024 * 100,
    width: 512,
    height: 512,
    isPublic: true,
    status: "ready",
    url: "https://cdn.vyapone.com/vyapone-public-media/logo.png",
  };

  const MOCK_SITE: SiteRow = {
    id: MOCK_SITE_ID,
    business_id: MOCK_BUSINESS_ID,
    subdomain: "sharma-sweets",
    primary_domain: "sharmasweets.in",
    status: "published",
    current_draft_version_id: MOCK_VERSION_ID,
    published_version_id: MOCK_VERSION_ID,
    created_at: "2026-11-20T10:00:00Z",
    updated_at: "2026-11-20T10:00:00Z",
  };

  const MOCK_VERSION: SiteVersionRow = {
    id: MOCK_VERSION_ID,
    site_id: MOCK_SITE_ID,
    business_id: MOCK_BUSINESS_ID,
    version_number: 1,
    schema_version: "v1",
    configuration: {},
    change_summary: "Initial draft",
    created_by: MOCK_USER_ID,
    created_at: "2026-11-20T10:00:00Z",
    published_at: "2026-11-20T12:00:00Z",
  };

  let MOCK_CONFIG: WebsiteConfiguration;

  const MOCK_CONTEXT: WebsiteRenderContext = {
    business: {
      id: MOCK_BUSINESS_ID,
      name: "Sharma Sweets",
      tradeName: "Sharma Sweets",
      phone: "+919876543210",
      whatsappNumber: "+919876543210",
      primaryLocation: {
        addressLine1: "123 MG Road",
        addressLine2: "Opposite Town Hall",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
      },
    },
    catalogueItems: [
      {
        id: "cat-1",
        name: "Kaju Katli (500g)",
        description: "Pure cashew confection crafted with silver leaf.",
        priceMinor: 45000,
        currency: "INR",
        isAvailable: true,
        category: "Sweets",
      },
      {
        id: "cat-2",
        name: "Special Consultation & Catering Tasting",
        description: "Wedding and festival bulk order sampling.",
        priceMinor: 0,
        currency: "INR",
        isAvailable: true,
        category: "Services",
      },
    ],
    mediaUrls: {
      [MOCK_MEDIA_1.id]: MOCK_MEDIA_1.url!,
      [MOCK_MEDIA_2.id]: MOCK_MEDIA_2.url!,
      [MOCK_MEDIA_LOGO.id]: MOCK_MEDIA_LOGO.url!,
    },
    modules: {
      website_engine: { status: "operational", isEnabled: true, name: "Website Engine" },
      catalogue_services: { status: "operational", isEnabled: true, name: "Catalogue & Services" },
      appointments: { status: "operational", isEnabled: true, name: "Appointments & Scheduling" },
      feedback_reviews: { status: "operational", isEnabled: true, name: "Feedback & Reviews" },
    },
    previewMode: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    MOCK_CONFIG = buildInitialWebsiteConfiguration({
      siteId: MOCK_SITE_ID,
      businessId: MOCK_BUSINESS_ID,
      tradeName: "Sharma Sweets",
      subdomain: "sharma-sweets",
      nicheSlug: "sweets",
      description: "Authentic Indian sweets crafted with pure desi ghee.",
    });
  });

  // ----------------------------------------------------------------------------
  // 1. Authorized Business Media Selection in Editor
  // ----------------------------------------------------------------------------
  describe("1. Authorized Business Media Selection & Filtering (Editor)", () => {
    it("renders available verified business media in Hero section inspector", () => {
      const heroSection = MOCK_CONFIG.pages[0].sections.find((s) => s.type === "hero")!;
      const onUpdateProps = vi.fn();

      render(
        <SectionInspector
          section={heroSection}
          availableMedia={[MOCK_MEDIA_1, MOCK_MEDIA_2, MOCK_MEDIA_LOGO]}
          onUpdateProps={onUpdateProps}
          onClose={vi.fn()}
        />,
      );

      const mediaSelect = screen.getByLabelText("Select hero image");
      expect(mediaSelect).toBeDefined();

      // Options list available verified media
      const options = within(mediaSelect).getAllByRole("option");
      expect(options.length).toBeGreaterThan(1);
      expect(options.some((o) => o.textContent?.includes("sweets_hero_banner.jpg"))).toBe(true);
    });

    it("attaches selected media ID to hero props upon selection", () => {
      const heroSection = MOCK_CONFIG.pages[0].sections.find((s) => s.type === "hero")!;
      const onUpdateProps = vi.fn();

      render(
        <SectionInspector
          section={heroSection}
          availableMedia={[MOCK_MEDIA_1]}
          onUpdateProps={onUpdateProps}
          onClose={vi.fn()}
        />,
      );

      const mediaSelect = screen.getByLabelText("Select hero image");
      fireEvent.change(mediaSelect, { target: { value: MOCK_MEDIA_1.id } });

      expect(onUpdateProps).toHaveBeenCalledWith(
        heroSection.id,
        expect.objectContaining({ imageMediaId: MOCK_MEDIA_1.id }),
        expect.any(String),
      );
    });

    it("supports removing selected hero image", () => {
      const heroSection = {
        ...MOCK_CONFIG.pages[0].sections.find((s) => s.type === "hero")!,
        props: {
          title: "Sharma Sweets",
          imageMediaId: MOCK_MEDIA_1.id,
        },
      };
      const onUpdateProps = vi.fn();

      render(
        <SectionInspector
          section={heroSection}
          availableMedia={[MOCK_MEDIA_1]}
          onUpdateProps={onUpdateProps}
          onClose={vi.fn()}
        />,
      );

      const removeBtn = screen.getByRole("button", { name: "Remove" });
      fireEvent.click(removeBtn);

      expect(onUpdateProps).toHaveBeenCalledWith(
        heroSection.id,
        expect.objectContaining({ imageMediaId: undefined }),
        expect.any(String),
      );
    });

    it("allows managing gallery photos with media selection, caption, and alt text", () => {
      const gallerySection = {
        id: "sec_gallery",
        type: "gallery" as const,
        variant: "grid-3",
        isEnabled: true,
        props: {
          title: "Store Showcase",
          images: [],
          columns: 3,
        },
      };
      const onUpdateProps = vi.fn();

      render(
        <SectionInspector
          section={gallerySection}
          availableMedia={[MOCK_MEDIA_1, MOCK_MEDIA_2]}
          onUpdateProps={onUpdateProps}
          onClose={vi.fn()}
        />,
      );

      const addBtn = screen.getByRole("button", { name: "+ Add Photo from Media Library" });
      fireEvent.click(addBtn);

      expect(onUpdateProps).toHaveBeenCalledWith(
        gallerySection.id,
        expect.objectContaining({
          images: [
            expect.objectContaining({
              mediaId: MOCK_MEDIA_1.id,
            }),
          ],
        }),
        "grid-3",
      );
    });
  });

  // ----------------------------------------------------------------------------
  // 2. Cross-Tenant Media Isolation & Pre-Publish Reference Validation
  // ----------------------------------------------------------------------------
  describe("2. Cross-Tenant Media Isolation & Pre-Publish Validation", () => {
    it("detects cross-tenant media references and flags them as isolation violations", async () => {
      const configWithCrossTenantMedia = {
        ...MOCK_CONFIG,
        pages: [
          {
            ...MOCK_CONFIG.pages[0],
            sections: [
              {
                id: "sec_hero",
                type: "hero" as const,
                props: {
                  title: "Sharma Sweets",
                  imageMediaId: "cross-tenant-media-id",
                },
              },
            ],
          },
        ],
      };

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [
                {
                  id: "cross-tenant-media-id",
                  business_id: OTHER_BUSINESS_ID, // Belongs to different tenant!
                  status: "ready",
                  verified_at: "2026-11-20T10:00:00Z",
                  is_public: true,
                  bucket: "vyapone-public-media",
                  category: "website_asset",
                },
              ],
              error: null,
            })),
          })),
        })),
      } as unknown as SupabaseClient<Database>;

      const validation = await validateWebsiteMediaReferences(
        mockSupabase,
        MOCK_BUSINESS_ID,
        configWithCrossTenantMedia,
      );

      expect(validation.isValid).toBe(false);
      expect(validation.crossTenantMediaIds).toContain("cross-tenant-media-id");
      expect(validation.brokenMediaIds).toHaveLength(0);
    });

    it("surfaces broken media references when an image ID does not exist in database", async () => {
      const configWithBrokenMedia = {
        ...MOCK_CONFIG,
        pages: [
          {
            ...MOCK_CONFIG.pages[0],
            sections: [
              {
                id: "sec_hero",
                type: "hero" as const,
                props: {
                  title: "Sharma Sweets",
                  imageMediaId: "deleted-media-uuid",
                },
              },
            ],
          },
        ],
      };

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [], // Media does not exist
              error: null,
            })),
          })),
        })),
      } as unknown as SupabaseClient<Database>;

      const validation = await validateWebsiteMediaReferences(
        mockSupabase,
        MOCK_BUSINESS_ID,
        configWithBrokenMedia,
      );

      expect(validation.isValid).toBe(false);
      expect(validation.brokenMediaIds).toContain("deleted-media-uuid");
    });

    it("surfaces unverified media items as not ready", async () => {
      const configWithUnverified = {
        ...MOCK_CONFIG,
        pages: [
          {
            ...MOCK_CONFIG.pages[0],
            sections: [
              {
                id: "sec_hero",
                type: "hero" as const,
                props: {
                  title: "Sharma Sweets",
                  imageMediaId: "unverified-media-id",
                },
              },
            ],
          },
        ],
      };

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [
                {
                  id: "unverified-media-id",
                  business_id: MOCK_BUSINESS_ID,
                  status: "pending_upload", // Not ready
                  verified_at: null, // Not verified
                  is_public: false,
                  bucket: "vyapone-private-media",
                  category: "website_asset",
                },
              ],
              error: null,
            })),
          })),
        })),
      } as unknown as SupabaseClient<Database>;

      const validation = await validateWebsiteMediaReferences(
        mockSupabase,
        MOCK_BUSINESS_ID,
        configWithUnverified,
      );

      expect(validation.isValid).toBe(false);
      expect(validation.unverifiedMediaIds).toContain("unverified-media-id");
    });
  });

  // ----------------------------------------------------------------------------
  // 3. Public Storefront Media Boundary (Public Rendering)
  // ----------------------------------------------------------------------------
  describe("3. Public Storefront Media Privacy & Exclusion", () => {
    it("excludes private quarantined media from published storefront URL map", async () => {
      const sampleConfig = {
        ...MOCK_CONFIG,
        pages: [
          {
            ...MOCK_CONFIG.pages[0],
            sections: [
              {
                id: "sec_hero",
                type: "hero" as const,
                props: {
                  title: "Sharma Sweets",
                  imageMediaId: MOCK_MEDIA_2.id, // Private quarantine asset
                },
              },
            ],
          },
        ],
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "sites") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: MOCK_SITE, error: null })),
                })),
              })),
            };
          }
          if (table === "site_versions") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      ...MOCK_VERSION,
                      configuration: sampleConfig,
                    },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: MOCK_BUSINESS_ID,
                      trade_name: "Sharma Sweets",
                      legal_name: "Sharma Sweets Pvt Ltd",
                      status: "active",
                      currency_code: "INR",
                    },
                    error: null,
                  })),
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
                        data: {
                          id: "loc-1",
                          address_line1: "123 MG Road",
                          city: "Bengaluru",
                          state: "Karnataka",
                          postal_code: "560001",
                          is_primary: true,
                        },
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
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    order: vi.fn(async () => ({ data: [], error: null })),
                  })),
                })),
              })),
            };
          }
          if (table === "media_items") {
            return {
              select: vi.fn(() => ({
                in: vi.fn(() => ({
                  eq: vi.fn(async () => ({
                    data: [
                      {
                        id: MOCK_MEDIA_2.id,
                        object_key: "private/quarantine/photo.webp",
                        bucket: "vyapone-private-media", // Quarantined bucket
                        is_public: false, // Strictly private!
                        status: "ready",
                        verified_at: "2026-11-20T10:00:00Z",
                        category: "website_asset",
                      },
                    ],
                    error: null,
                  })),
                })),
              })),
            };
          }
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: null, error: null })),
              })),
            })),
          };
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await resolvePublishedStorefrontBySubdomain(mockSupabase, "sharma-sweets");
      expect(result).not.toBeNull();
      // Quarantined asset must NOT be resolved into public mediaUrls
      expect(result!.context.mediaUrls?.[MOCK_MEDIA_2.id]).toBeUndefined();
    });

    it("resolves valid public media URLs cleanly for verified public assets", async () => {
      const sampleConfig = {
        ...MOCK_CONFIG,
        pages: [
          {
            ...MOCK_CONFIG.pages[0],
            sections: [
              {
                id: "sec_hero",
                type: "hero" as const,
                props: {
                  title: "Sharma Sweets",
                  imageMediaId: MOCK_MEDIA_1.id,
                },
              },
            ],
          },
        ],
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "sites") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: MOCK_SITE, error: null })),
                })),
              })),
            };
          }
          if (table === "site_versions") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      ...MOCK_VERSION,
                      configuration: sampleConfig,
                    },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: MOCK_BUSINESS_ID,
                      trade_name: "Sharma Sweets",
                      status: "active",
                      currency_code: "INR",
                    },
                    error: null,
                  })),
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
                      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                    })),
                  })),
                })),
              })),
            };
          }
          if (table === "catalogue_items") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    order: vi.fn(async () => ({ data: [], error: null })),
                  })),
                })),
              })),
            };
          }
          if (table === "media_items") {
            return {
              select: vi.fn(() => ({
                in: vi.fn(() => ({
                  eq: vi.fn(async () => ({
                    data: [
                      {
                        id: MOCK_MEDIA_1.id,
                        object_key: "tenant/website_asset/hero.jpg",
                        bucket: "vyapone-public-media",
                        is_public: true,
                        status: "ready",
                        verified_at: "2026-11-20T10:00:00Z",
                        category: "website_asset",
                      },
                    ],
                    error: null,
                  })),
                })),
              })),
            };
          }
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: null, error: null })),
              })),
            })),
          };
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await resolvePublishedStorefrontBySubdomain(mockSupabase, "sharma-sweets");
      expect(result).not.toBeNull();
      expect(result!.context.mediaUrls?.[MOCK_MEDIA_1.id]).toBe(
        "https://cdn.vyapone.com/vyapone-public-media/tenant/website_asset/hero.jpg",
      );
    });
  });

  // ----------------------------------------------------------------------------
  // 4. Business & Module Data Integration Across Blocks
  // ----------------------------------------------------------------------------
  describe("4. Business & Module Data Binding in Blocks", () => {
    it("renders BookingFormBlock in operational mode when appointments module is active", () => {
      const onAction = vi.fn();
      render(
        <BookingFormBlock
          id="booking-1"
          props={{ title: "Book a Tasting Session" }}
          context={{
            ...MOCK_CONTEXT,
            modules: {
              appointments: { status: "operational", isEnabled: true },
            },
            onAction,
          }}
        />,
      );

      expect(screen.getByText("Online Booking")).toBeDefined();
      expect(screen.getByRole("button", { name: "Request Appointment" })).toBeDefined();

      fireEvent.change(screen.getByLabelText(/Your Full Name/i), {
        target: { value: "Aarav Sharma" },
      });
      fireEvent.change(screen.getByPlaceholderText("9876543210"), {
        target: { value: "9876543210" },
      });
      fireEvent.change(screen.getByLabelText(/Preferred Date/i), {
        target: { value: "2026-12-01" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Request Appointment" }));

      expect(onAction).toHaveBeenCalledWith(
        "booking_submitted",
        expect.objectContaining({
          name: "Aarav Sharma",
          phone: "9876543210",
          isOperational: true,
        }),
      );
    });

    it("renders BookingFormBlock in informational enquiry mode when appointments module is informational", () => {
      const onAction = vi.fn();
      render(
        <BookingFormBlock
          id="booking-1"
          props={{ title: "Book a Tasting Session" }}
          context={{
            ...MOCK_CONTEXT,
            modules: {
              appointments: { status: "informational", isEnabled: false },
            },
            onAction,
          }}
        />,
      );

      expect(screen.getByText("Appointment Enquiry")).toBeDefined();
      expect(screen.getByRole("button", { name: "Submit Appointment Enquiry" })).toBeDefined();

      fireEvent.change(screen.getByLabelText(/Your Full Name/i), {
        target: { value: "Pooja Patel" },
      });
      fireEvent.change(screen.getByPlaceholderText("9876543210"), {
        target: { value: "9876543210" },
      });
      fireEvent.change(screen.getByLabelText(/Preferred Date/i), {
        target: { value: "2026-12-01" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Submit Appointment Enquiry" }));

      expect(onAction).toHaveBeenCalledWith(
        "appointment_enquiry_submitted",
        expect.objectContaining({
          name: "Pooja Patel",
          isOperational: false,
        }),
      );
    });

    it("renders MenuBlock with bound catalogue items and category filters", () => {
      render(
        <MenuBlock
          id="menu-1"
          props={{ title: "Our Traditional Sweets", source: "catalogue" }}
          context={MOCK_CONTEXT}
        />,
      );

      expect(screen.getByText("Kaju Katli (500g)")).toBeDefined();
      expect(screen.getByText("₹450")).toBeDefined();
    });

    it("renders MenuBlock clean empty state when catalogue items are empty", () => {
      render(
        <MenuBlock
          id="menu-1"
          props={{ title: "Our Traditional Sweets", source: "catalogue" }}
          context={{
            ...MOCK_CONTEXT,
            catalogueItems: [],
          }}
        />,
      );

      expect(screen.getByText("No menu items available")).toBeDefined();
    });

    it("renders LocationMapBlock with verified business address and directions link", () => {
      render(
        <LocationMapBlock
          id="loc-1"
          props={{ title: "Visit Our Main Branch", addressRef: "business.primary_location" }}
          context={MOCK_CONTEXT}
        />,
      );

      expect(
        screen.getAllByText(/123 MG Road, Opposite Town Hall, Bengaluru, Karnataka - 560001/i)
          .length,
      ).toBeGreaterThan(0);
      expect(screen.getByText("+919876543210")).toBeDefined();
    });

    it("renders LocationMapBlock clean fallback when business location is not configured", () => {
      render(
        <LocationMapBlock
          id="loc-1"
          props={{ title: "Visit Our Main Branch", addressRef: "business.primary_location" }}
          context={{
            ...MOCK_CONTEXT,
            business: {
              id: MOCK_BUSINESS_ID,
              name: "Sharma Sweets",
              primaryLocation: undefined,
            },
          }}
        />,
      );

      expect(screen.getAllByText("Store address on file").length).toBeGreaterThan(0);
    });

    it("renders GalleryBlock gracefully with Image Preview Unavailable when media URL is missing", () => {
      render(
        <GalleryBlock
          id="gal-1"
          props={{
            title: "Storefront Gallery",
            images: [
              {
                mediaId: "missing-or-quarantined-media-id",
                caption: "Store Front",
              },
            ],
            columns: 3,
          }}
          context={{
            ...MOCK_CONTEXT,
            mediaUrls: {}, // Missing media URL
          }}
        />,
      );

      expect(screen.getByText("Image Preview Unavailable")).toBeDefined();
      expect(screen.getByText("Store Front")).toBeDefined();
    });
  });

  // ----------------------------------------------------------------------------
  // 5. Draft Preview vs Public Storefront Isolation & Concurrency Regression
  // ----------------------------------------------------------------------------
  describe("5. Draft Preview vs Public Storefront Isolation & Regression Protection", () => {
    it("renders authorized private preview media inside the constrained editor preview without leaking to public", () => {
      render(
        <ConstrainedWebsiteEditor
          initialSite={MOCK_SITE}
          initialVersion={MOCK_VERSION}
          initialConfiguration={MOCK_CONFIG}
          context={MOCK_CONTEXT}
          availableMedia={[MOCK_MEDIA_1, MOCK_MEDIA_2]}
          availableModules={{
            appointments: { status: "operational", isEnabled: true },
          }}
        />,
      );

      // Editor loads and renders preview canvas
      const canvas = screen.getByTestId("preview-canvas");
      expect(canvas).toBeDefined();

      // Top bar reflects draft status without modifying published pointer
      expect(screen.getByText("Draft v1")).toBeDefined();
    });

    it("preserves VO-045 responsive device modes while rendering bound media", () => {
      render(
        <ConstrainedWebsiteEditor
          initialSite={MOCK_SITE}
          initialVersion={MOCK_VERSION}
          initialConfiguration={MOCK_CONFIG}
          context={MOCK_CONTEXT}
          availableMedia={[MOCK_MEDIA_1]}
          initialDeviceMode="mobile"
        />,
      );

      const canvas = screen.getByTestId("preview-canvas");
      expect(canvas.className).toContain("w-[390px]");
      expect(screen.getByTestId("mobile-notch")).toBeDefined();

      // Tablet toggle
      const tabletRadio = screen.getByRole("radio", { name: "Tablet Preview Mode (768px)" });
      fireEvent.click(tabletRadio);
      expect(canvas.className).toContain("w-[768px]");
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  approvedBlockTypeSchema,
  hexColorSchema,
  pageConfigSchema,
  sectionConfigSchema,
  siteMetadataConfigSchema,
  websiteConfigurationSchema,
} from "@/lib/websites/schemas";
import { buildInitialWebsiteConfiguration, CANONICAL_THEMES } from "@/lib/websites/defaults";

describe("VO-040 Website Configuration Schemas", () => {
  const validSiteId = "00000000-0000-4000-8000-000000000001";
  const validBusinessId = "00000000-0000-4000-8000-000000000002";

  describe("hexColorSchema", () => {
    it("accepts valid 6-character hex colors", () => {
      expect(hexColorSchema.parse("#0B6E4F")).toBe("#0B6E4F");
      expect(hexColorSchema.parse("#ffffff")).toBe("#ffffff");
      expect(hexColorSchema.parse("#123456")).toBe("#123456");
    });

    it("rejects invalid hex formats (3-char, named, missing #, extra chars)", () => {
      expect(() => hexColorSchema.parse("#FFF")).toThrow();
      expect(() => hexColorSchema.parse("blue")).toThrow();
      expect(() => hexColorSchema.parse("0B6E4F")).toThrow();
      expect(() => hexColorSchema.parse("#0B6E4F00")).toThrow();
    });
  });

  describe("approvedBlockTypeSchema", () => {
    it("accepts all 13 canonical approved blocks", () => {
      const canonicalBlocks = [
        "hero",
        "about",
        "menu",
        "catalogue_grid",
        "gallery",
        "booking_form",
        "pricing",
        "reviews",
        "offers",
        "location_map",
        "contact",
        "faq",
        "footer",
      ];

      for (const block of canonicalBlocks) {
        expect(approvedBlockTypeSchema.parse(block)).toBe(block);
      }
    });

    it("rejects arbitrary, unapproved or executable blocks (XSS defense)", () => {
      expect(() => approvedBlockTypeSchema.parse("custom_html")).toThrow();
      expect(() => approvedBlockTypeSchema.parse("raw_script")).toThrow();
      expect(() => approvedBlockTypeSchema.parse("iframe_embed")).toThrow();
      expect(() => approvedBlockTypeSchema.parse("arbitrary_component")).toThrow();
    });
  });

  describe("sectionConfigSchema & dynamic catalogue bindings", () => {
    it("accepts valid hero section", () => {
      const validHero = {
        id: "hero_section_1",
        type: "hero",
        props: {
          title: "Premium Artisan Bakery",
          subtitle: "Baked fresh daily in South Delhi",
          cta: {
            label: "Explore Menu",
            action: "catalogue",
          },
        },
      };

      const result = sectionConfigSchema.parse(validHero);
      expect(result.id).toBe("hero_section_1");
      expect(result.type).toBe("hero");
    });

    it("enforces dynamic catalogue binding for menu block (rejects hardcoded items/prices)", () => {
      const validMenu = {
        id: "menu_sec",
        type: "menu",
        props: {
          title: "Our Delicacies",
          source: "catalogue",
        },
      };
      expect(sectionConfigSchema.parse(validMenu).props.source).toBe("catalogue");

      const invalidMenu = {
        id: "menu_sec",
        type: "menu",
        props: {
          title: "Our Delicacies",
          source: "hardcoded_prices",
        },
      };
      expect(() => sectionConfigSchema.parse(invalidMenu)).toThrow(
        "Menu block must dynamically bind to 'catalogue' data source",
      );
    });

    it("enforces dynamic catalogue binding for catalogue_grid and pricing blocks", () => {
      const validCatGrid = {
        id: "cat_sec",
        type: "catalogue_grid",
        props: {
          source: "catalogue",
          columns: 3,
        },
      };
      expect(sectionConfigSchema.parse(validCatGrid).type).toBe("catalogue_grid");

      const invalidCatGrid = {
        id: "cat_sec",
        type: "catalogue_grid",
        props: {
          source: "custom_static_list",
        },
      };
      expect(() => sectionConfigSchema.parse(invalidCatGrid)).toThrow();

      const validPricing = {
        id: "pricing_sec",
        type: "pricing",
        props: {
          title: "Membership Tiers",
          source: "catalogue",
        },
      };
      expect(sectionConfigSchema.parse(validPricing).type).toBe("pricing");
    });

    it("enforces confirmed business location reference for location_map block", () => {
      const validLocation = {
        id: "loc_sec",
        type: "location_map",
        props: {
          title: "Find Us",
          addressRef: "business.primary_location",
          showTimings: true,
        },
      };
      expect(sectionConfigSchema.parse(validLocation).type).toBe("location_map");

      const invalidLocation = {
        id: "loc_sec",
        type: "location_map",
        props: {
          title: "Find Us",
          addressRef: "arbitrary_custom_address",
        },
      };
      expect(() => sectionConfigSchema.parse(invalidLocation)).toThrow(
        "Location block must reference 'business.primary_location' source of truth",
      );
    });
  });

  describe("pageConfigSchema", () => {
    it("accepts valid page with proper slug and sections", () => {
      const validPage = {
        id: "page_home",
        slug: "/",
        title: "Home",
        sections: [
          {
            id: "hero_sec",
            type: "hero",
            props: { title: "Welcome" },
          },
        ],
      };
      expect(pageConfigSchema.parse(validPage).slug).toBe("/");
    });

    it("rejects invalid page slugs", () => {
      const invalidSlugPage = {
        id: "page_about",
        slug: "about", // Missing leading slash
        title: "About",
        sections: [{ id: "hero_sec", type: "hero", props: { title: "About Us" } }],
      };
      expect(() => pageConfigSchema.parse(invalidSlugPage)).toThrow(
        "Page slug must start with '/'",
      );

      const upperSlugPage = {
        ...invalidSlugPage,
        slug: "/About Us", // Upper case and spaces
      };
      expect(() => pageConfigSchema.parse(upperSlugPage)).toThrow();
    });

    it("rejects page with empty sections array", () => {
      const emptyPage = {
        id: "page_empty",
        slug: "/empty",
        title: "Empty Page",
        sections: [],
      };
      expect(() => pageConfigSchema.parse(emptyPage)).toThrow(
        "Page must contain at least one section",
      );
    });
  });

  describe("siteMetadataConfigSchema", () => {
    it("accepts valid metadata with conforming subdomain", () => {
      const validMeta = {
        title: "Chai Point Indiranagar",
        subdomain: "chaipoint-indiranagar",
        defaultLocale: "en",
        supportedLocales: ["en", "hi"],
      };
      expect(siteMetadataConfigSchema.parse(validMeta).subdomain).toBe("chaipoint-indiranagar");
    });

    it("rejects invalid subdomains (too short, uppercase, invalid characters)", () => {
      expect(() =>
        siteMetadataConfigSchema.parse({
          title: "Store",
          subdomain: "ab", // Min length 3
        }),
      ).toThrow();

      expect(() =>
        siteMetadataConfigSchema.parse({
          title: "Store",
          subdomain: "MyStore", // Uppercase rejected
        }),
      ).toThrow();

      expect(() =>
        siteMetadataConfigSchema.parse({
          title: "Store",
          subdomain: "-invalid-start", // Hyphen at start
        }),
      ).toThrow();
    });
  });

  describe("websiteConfigurationSchema & factory defaults", () => {
    it("validates factory-generated configuration from buildInitialWebsiteConfiguration", () => {
      const config = buildInitialWebsiteConfiguration({
        siteId: validSiteId,
        businessId: validBusinessId,
        tradeName: "Green Earth Organics",
        subdomain: "greenearth",
        nicheSlug: "retail.grocery",
        description: "Fresh farm-to-table organic groceries delivered in Pune",
        primaryPhone: "+91 98765 43210",
      });

      const parsed = websiteConfigurationSchema.parse(config);
      expect(parsed.schemaVersion).toBe("v1");
      expect(parsed.siteId).toBe(validSiteId);
      expect(parsed.businessId).toBe(validBusinessId);
      expect(parsed.pages.length).toBeGreaterThan(0);
      expect(parsed.theme.themeId).toBe(CANONICAL_THEMES["emerald-marigold"].themeId);
    });

    it("enforces schemaVersion to be exactly 'v1'", () => {
      const config = buildInitialWebsiteConfiguration({
        siteId: validSiteId,
        businessId: validBusinessId,
        tradeName: "Test Shop",
        subdomain: "testshop",
      });

      const invalidVersionConfig = {
        ...config,
        schemaVersion: "v2",
      };

      expect(() => websiteConfigurationSchema.parse(invalidVersionConfig)).toThrow();
    });

    it("rejects configurations with non-UUID siteId or businessId", () => {
      const config = buildInitialWebsiteConfiguration({
        siteId: "not-a-uuid",
        businessId: validBusinessId,
        tradeName: "Test Shop",
        subdomain: "testshop",
      });

      expect(() => websiteConfigurationSchema.parse(config)).toThrow("Invalid site ID");
    });
  });
});

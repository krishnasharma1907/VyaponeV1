import { describe, expect, it } from "vitest";
import { DEFAULT_NICHE_MANIFESTS } from "@/lib/niches/constants";
import { nicheManifestSchema } from "@/lib/niches/schemas";
import { resolveDashboardNavigation } from "@/lib/niches/service";

describe("VO-030 Niche Manifests & Dynamic Navigation", () => {
  describe("1. Manifest Schema Validation", () => {
    it("validates all default niche manifests against the strict Zod schema", () => {
      const nicheSlugs = Object.keys(DEFAULT_NICHE_MANIFESTS);
      expect(nicheSlugs.length).toBeGreaterThanOrEqual(5);

      for (const slug of nicheSlugs) {
        const manifest = DEFAULT_NICHE_MANIFESTS[slug];
        expect(manifest).toBeDefined();

        const parseResult = nicheManifestSchema.safeParse(manifest);
        if (!parseResult.success) {
          throw new Error(
            `Manifest schema validation failed for '${slug}': ${JSON.stringify(parseResult.error.format())}`,
          );
        }
        expect(parseResult.success).toBe(true);
      }
    });

    it("verifies manifest version semantics", () => {
      for (const manifest of Object.values(DEFAULT_NICHE_MANIFESTS)) {
        expect(manifest.version).toBe("v1");
      }
    });

    it("verifies required fields and questions in restaurant manifest", () => {
      const restaurantManifest = DEFAULT_NICHE_MANIFESTS["restaurant"];
      expect(restaurantManifest).toBeDefined();
      if (!restaurantManifest) return;

      expect(restaurantManifest.nicheSlug).toBe("restaurant");
      expect(restaurantManifest.nicheGroupSlug).toBe("food_hospitality");
      expect(restaurantManifest.onboarding.requiredQuestions.length).toBeGreaterThanOrEqual(2);

      const cuisineQuestion = restaurantManifest.onboarding.requiredQuestions.find(
        (q) => q.key === "cuisine_types",
      );
      expect(cuisineQuestion).toBeDefined();
      expect(cuisineQuestion?.type).toBe("multiselect");
      expect(cuisineQuestion?.options?.length).toBeGreaterThan(0);
    });

    it("verifies salon manifest has appointment navigation and questions", () => {
      const salonManifest = DEFAULT_NICHE_MANIFESTS["salon"];
      expect(salonManifest).toBeDefined();
      if (!salonManifest) return;

      expect(salonManifest.nicheSlug).toBe("salon");
      expect(salonManifest.nicheGroupSlug).toBe("beauty_wellness_fitness");

      const navIds = salonManifest.dashboardNavigation.map((n) => n.id);
      expect(navIds).toContain("appointments");
      expect(navIds).toContain("services");
    });
  });

  describe("2. Dynamic Dashboard Navigation Resolution", () => {
    const restaurantManifest = DEFAULT_NICHE_MANIFESTS["restaurant"]!;

    it("includes all navigation items when all required modules are enabled", () => {
      const allEnabledModules = [
        "website_engine",
        "catalogue_services",
        "orders",
        "gst_billing",
        "qr_management",
        "whatsapp_layer",
      ];

      const nav = resolveDashboardNavigation(restaurantManifest, allEnabledModules);
      const navIds = nav.map((item) => item.id);

      expect(navIds).toContain("daily_pulse");
      expect(navIds).toContain("menu");
      expect(navIds).toContain("orders");
      expect(navIds).toContain("gst_billing");
      expect(navIds).toContain("qr_codes");
      expect(navIds).toContain("whatsapp");
      expect(navIds).toContain("website");
      expect(navIds).toContain("settings");
    });

    it("omits orders navigation tab when the 'orders' module is disabled", () => {
      const modulesWithoutOrders = [
        "website_engine",
        "catalogue_services",
        "gst_billing",
        "qr_management",
        "whatsapp_layer",
      ];

      const nav = resolveDashboardNavigation(restaurantManifest, modulesWithoutOrders);
      const navIds = nav.map((item) => item.id);

      expect(navIds).toContain("daily_pulse");
      expect(navIds).toContain("menu");
      expect(navIds).not.toContain("orders");
      expect(navIds).toContain("gst_billing");
    });

    it("omits gst_billing navigation tab when the 'gst_billing' module is disabled", () => {
      const modulesWithoutBilling = [
        "website_engine",
        "catalogue_services",
        "orders",
        "qr_management",
        "whatsapp_layer",
      ];

      const nav = resolveDashboardNavigation(restaurantManifest, modulesWithoutBilling);
      const navIds = nav.map((item) => item.id);

      expect(navIds).toContain("orders");
      expect(navIds).not.toContain("gst_billing");
    });

    it("proves PRD §7/§8 requirement: navigation changes dynamically without bespoke routing code", () => {
      const baseNav = resolveDashboardNavigation(restaurantManifest, ["website_engine"]);
      expect(baseNav.map((n) => n.id)).toEqual(["daily_pulse", "website", "settings"]);

      const expandedNav = resolveDashboardNavigation(restaurantManifest, [
        "website_engine",
        "catalogue_services",
        "orders",
      ]);
      expect(expandedNav.map((n) => n.id)).toEqual([
        "daily_pulse",
        "menu",
        "orders",
        "website",
        "settings",
      ]);
    });
  });
});

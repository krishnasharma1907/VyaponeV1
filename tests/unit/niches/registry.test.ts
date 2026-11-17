import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  listNicheGroups,
  getNicheGroup,
  listNiches,
  getNiche,
  getNicheManifest,
} from "@/lib/niches/service";
import { CANONICAL_NICHE_GROUPS } from "@/lib/niches/constants";

describe("VO-030 Niche Registry Service", () => {
  describe("1. Canonical Niche Groups", () => {
    it("defines all 9 canonical PRD §7 niche groups in priority display order", () => {
      expect(CANONICAL_NICHE_GROUPS).toHaveLength(9);
      const slugs = CANONICAL_NICHE_GROUPS.map((g) => g.slug);
      expect(slugs).toEqual([
        "food_hospitality",
        "beauty_wellness_fitness",
        "retail_commerce",
        "professional_home_services",
        "automotive_repair",
        "education",
        "real_estate",
        "operational_rentals",
        "other_business",
      ]);
    });

    it("falls back to canonical niche groups if the database table is empty or offline", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({
                data: [],
                error: null,
              })),
            })),
          })),
        })),
      } as unknown as SupabaseClient<Database>;

      const groups = await listNicheGroups(mockSupabase);
      expect(groups).toHaveLength(9);
      expect(groups[0]?.slug).toBe("food_hospitality");
      expect(groups[1]?.slug).toBe("beauty_wellness_fitness");
    });

    it("queries database when populated and returns ordered groups", async () => {
      const mockDbGroups = [
        {
          id: "11111111-1111-1111-1111-111111111111",
          slug: "food_hospitality",
          name: "Food & Hospitality",
          description: "Cafés, restaurants, bakeries, cloud kitchens, and catering",
          display_order: 10,
          status: "active",
        },
        {
          id: "22222222-2222-2222-2222-222222222222",
          slug: "retail_commerce",
          name: "Retail & Local Commerce",
          description: "Kirana, boutiques, electronics, supermarkets, and local shops",
          display_order: 30,
          status: "active",
        },
      ];

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({
                data: mockDbGroups,
                error: null,
              })),
            })),
          })),
        })),
      } as unknown as SupabaseClient<Database>;

      const groups = await listNicheGroups(mockSupabase);
      expect(groups).toHaveLength(2);
      expect(groups[0]?.slug).toBe("food_hospitality");
      expect(groups[1]?.slug).toBe("retail_commerce");
    });

    it("retrieves a single niche group by slug", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: "11111111-1111-1111-1111-111111111111",
                  slug: "food_hospitality",
                  name: "Food & Hospitality",
                  description: "Cafés, restaurants, bakeries, cloud kitchens, and catering",
                  display_order: 10,
                  status: "active",
                },
                error: null,
              })),
            })),
          })),
        })),
      } as unknown as SupabaseClient<Database>;

      const group = await getNicheGroup(mockSupabase, "food_hospitality");
      expect(group).not.toBeNull();
      expect(group?.slug).toBe("food_hospitality");
      expect(group?.name).toBe("Food & Hospitality");
    });

    it("returns null for non-existent niche group", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: null,
                error: null,
              })),
            })),
          })),
        })),
      } as unknown as SupabaseClient<Database>;

      const group = await getNicheGroup(mockSupabase, "unknown_group");
      expect(group).toBeNull();
    });
  });

  describe("2. Niches & Manifests Discovery", () => {
    it("retrieves niches with fallback when database returns empty", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({
                data: [],
                error: null,
              })),
            })),
          })),
        })),
      } as unknown as SupabaseClient<Database>;

      const niches = await listNiches(mockSupabase);
      expect(niches.length).toBeGreaterThanOrEqual(5);
      const slugs = niches.map((n) => n.slug);
      expect(slugs).toContain("restaurant");
      expect(slugs).toContain("salon");
      expect(slugs).toContain("kirana");
    });

    it("resolves specific niche details by slug with manifest", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: null, // Triggers fallback
                error: null,
              })),
            })),
          })),
        })),
      } as unknown as SupabaseClient<Database>;

      const niche = await getNiche(mockSupabase, "restaurant");
      expect(niche).not.toBeNull();
      expect(niche?.slug).toBe("restaurant");
      expect(niche?.availabilityLabel).toBe("live_operational");
      expect(niche?.manifest.version).toBe("v1");
      expect(niche?.manifest.dashboardNavigation.length).toBeGreaterThan(0);
    });

    it("fetches raw versioned manifest directly", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: null,
                error: null,
              })),
            })),
          })),
        })),
      } as unknown as SupabaseClient<Database>;

      const manifest = await getNicheManifest(mockSupabase, "salon");
      expect(manifest).not.toBeNull();
      expect(manifest?.name).toBe("Salon & Hair Studio");
      expect(manifest?.availabilityLabel).toBe("live_operational");
    });
  });
});

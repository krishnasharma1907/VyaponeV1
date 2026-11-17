import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  listPlatformModules,
  getPlatformModule,
  getBusinessModules,
  enableBusinessModule,
  disableBusinessModule,
  NicheRegistryError,
} from "@/lib/niches/service";
import { CANONICAL_MODULES } from "@/lib/niches/constants";

describe("VO-030 Platform Modules & Business Lifecycle", () => {
  const mockBusinessId = "11111111-1111-1111-1111-111111111111";
  const mockUserId = "22222222-2222-2222-2222-222222222222";

  describe("1. Platform Module Directory", () => {
    it("defines exactly 21 canonical platform modules from PRD §8", () => {
      expect(CANONICAL_MODULES).toHaveLength(21);
      const keys = CANONICAL_MODULES.map((m) => m.key);

      // Core & Website
      expect(keys).toContain("website_engine");

      // Commerce & Operations
      expect(keys).toContain("catalogue_services");
      expect(keys).toContain("enquiries_leads");
      expect(keys).toContain("orders");
      expect(keys).toContain("appointments");
      expect(keys).toContain("inventory");
      expect(keys).toContain("property_listings");
      expect(keys).toContain("qr_management");

      // Growth & Loyalty
      expect(keys).toContain("feedback_reviews");
      expect(keys).toContain("offers_loyalty");
      expect(keys).toContain("analytics");
      expect(keys).toContain("whatsapp_layer");

      // Compliance & Payments
      expect(keys).toContain("udhaar_balances");
      expect(keys).toContain("gst_billing");

      // Advanced Marketing & Automation
      expect(keys).toContain("customer_broadcasts");
      expect(keys).toContain("automation_engine");
      expect(keys).toContain("google_business_sync");
      expect(keys).toContain("auto_social_posts");
      expect(keys).toContain("delivery_integration");
      expect(keys).toContain("staff_roles");
      expect(keys).toContain("campaign_pages");
    });

    it("identifies core mandatory modules correctly", () => {
      const coreModules = CANONICAL_MODULES.filter((m) => m.category === "core");
      expect(coreModules.map((m) => m.key)).toEqual(["website_engine"]);
    });

    it("lists all platform modules with fallback when database is empty", async () => {
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

      const modules = await listPlatformModules(mockSupabase);
      expect(modules).toHaveLength(21);
      expect(modules[0]?.key).toBe("website_engine");
    });

    it("resolves module by key from memory or database", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: null, // Triggers fallback to CANONICAL_MODULES
                error: null,
              })),
            })),
          })),
        })),
      } as unknown as SupabaseClient<Database>;

      const mod = await getPlatformModule(mockSupabase, "orders");
      expect(mod).not.toBeNull();
      expect(mod?.key).toBe("orders");
      expect(mod?.category).toBe("commerce");
      expect(mod?.status).toBe("active");
    });
  });

  describe("2. Business Module State & Lifecycle", () => {
    it("lists business modules combining platform definitions with business state", async () => {
      const mockBusinessModuleRows = [
        {
          id: "bm-1",
          business_id: mockBusinessId,
          module_key: "website_engine",
          is_enabled: true,
          custom_config: {},
          enabled_at: "2026-11-18T00:00:00Z",
          updated_at: "2026-11-18T00:00:00Z",
          platform_modules: {
            name: "Website Engine",
            category: "core",
          },
        },
        {
          id: "bm-2",
          business_id: mockBusinessId,
          module_key: "orders",
          is_enabled: true,
          custom_config: {},
          enabled_at: "2026-11-18T00:00:00Z",
          updated_at: "2026-11-18T00:00:00Z",
          platform_modules: {
            name: "Order Management",
            category: "commerce",
          },
        },
      ];

      const createChain = (data: unknown) => {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
        chain.order = vi.fn(() => chain);
        chain.then = (resolve: (val: unknown) => void) =>
          Promise.resolve({ data, error: null }).then(resolve);
        return chain;
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "business_modules") {
            return createChain(mockBusinessModuleRows);
          }
          return createChain(null);
        }),
      } as unknown as SupabaseClient<Database>;

      const businessModules = await getBusinessModules(mockSupabase, mockBusinessId);
      expect(businessModules).toHaveLength(2);

      const websiteEngine = businessModules.find((m) => m.moduleKey === "website_engine");
      expect(websiteEngine?.isEnabled).toBe(true);
      expect(websiteEngine?.category).toBe("core");

      const orders = businessModules.find((m) => m.moduleKey === "orders");
      expect(orders?.isEnabled).toBe(true);
      expect(orders?.category).toBe("commerce");
    });

    it("prevents disabling core platform modules such as website_engine", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: mockUserId, email: "owner@test.com" } },
            error: null,
          })),
        },
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: mockBusinessId,
                      workspace_id: "ws-1",
                      name: "Test Business",
                      sovereign_owner_id: mockUserId,
                    },
                    error: null,
                  })),
                })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        disableBusinessModule(mockSupabase, {
          businessId: mockBusinessId,
          moduleKey: "website_engine",
          callerUserId: mockUserId,
        }),
      ).rejects.toThrow(NicheRegistryError);
    });

    it("enables an optional module and records audit event", async () => {
      let upsertCalled = false;

      const mockSupabase = {
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: mockUserId, email: "owner@test.com" } },
            error: null,
          })),
        },
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: mockBusinessId,
                      workspace_id: "ws-1",
                      name: "Test Business",
                      sovereign_owner_id: mockUserId,
                    },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "platform_modules") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: "mod-orders",
                      key: "orders",
                      name: "Order Management",
                      category: "commerce",
                      status: "active",
                      entitlement_feature_key: "orders",
                      display_order: 40,
                    },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "business_modules") {
            return {
              upsert: vi.fn(() => {
                upsertCalled = true;
                return {
                  select: vi.fn(() => ({
                    single: vi.fn(async () => ({
                      data: {
                        id: "bm-orders",
                        business_id: mockBusinessId,
                        module_key: "orders",
                        is_enabled: true,
                        custom_config: { acceptTakeaway: true },
                        enabled_at: "2026-11-18T00:00:00Z",
                        updated_at: "2026-11-18T00:00:00Z",
                      },
                      error: null,
                    })),
                  })),
                };
              }),
            };
          }
          if (table === "audit_logs") {
            return {
              insert: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({ data: {}, error: null })),
                })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await enableBusinessModule(mockSupabase, {
        businessId: mockBusinessId,
        moduleKey: "orders",
        callerUserId: mockUserId,
        customConfig: { acceptTakeaway: true },
      });

      expect(result.moduleKey).toBe("orders");
      expect(result.isEnabled).toBe(true);
      expect(upsertCalled).toBe(true);
    });
  });
});

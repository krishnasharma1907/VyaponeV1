import { describe, expect, it, vi } from "vitest";
import {
  BusinessError,
  createBusinessWithSetup,
  getBusinessSetupDraft,
} from "@/lib/businesses/service";
import {
  createBusinessWithSetupAction,
  getBusinessSetupDraftAction,
} from "@/lib/businesses/actions";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Mock server supabase and revalidatePath for action tests
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("VO-033 — Mobile-First Create Business Flow Service & Actions", () => {
  const mockCallerId = "11111111-1111-4111-8111-111111111111";
  const mockWorkspaceId = "22222222-2222-4222-8222-222222222222";
  const mockBusinessId = "33333333-3333-4333-8333-333333333333";
  const mockLocationId = "44444444-4444-4444-8444-444444444444";
  const mockLogoMediaId = "55555555-5555-4555-8555-555555555555";

  const validSetupInput = {
    workspace_id: mockWorkspaceId,
    niche_slug: "cafe",
    trade_name: "Chai & Conversations Café",
    legal_name: "Chai & Conversations Hospitality LLP",
    primary_location: {
      name: "Main Store",
      address_line1: "123 Indiranagar 100ft Road",
      address_line2: "Opposite Metro Pillar 150",
      city: "Bengaluru",
      state: "Karnataka",
      postal_code: "560038",
    },
    contact: {
      primary_phone: "+919876543210",
      whatsapp_number: "+919876543210",
      email: "hello@chaiconvo.in",
    },
    gst_number: "29ABCDE1234F1Z5",
    pan_number: "ABCDE1234F",
    tax_scheme: "registered" as const,
    logo_media_id: mockLogoMediaId,
    showcase_media_ids: [],
    onboarding_answers: {
      has_outdoor_seating: true,
      serves_alcohol: false,
    },
    proposal_confirmed: true,
  };

  function createMockSupabase(overrides?: {
    workspaceRole?: string;
    existingSlug?: boolean;
    capacityExceeded?: boolean;
  }) {
    const insertedBusinesses: Record<string, unknown>[] = [];
    const insertedLocations: Record<string, unknown>[] = [];
    const insertedMembers: Record<string, unknown>[] = [];
    const upsertedOnboarding: Record<string, unknown>[] = [];
    const upsertedModules: Record<string, unknown>[] = [];
    const updatedMedia: Record<string, unknown>[] = [];
    const insertedAuditLogs: Record<string, unknown>[] = [];

    function createChain(data: unknown, count?: number) {
      const chain: Record<string, unknown> = {
        eq: vi.fn(() => chain),
        neq: vi.fn(() => chain),
        in: vi.fn(() => chain),
        order: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        select: vi.fn(() => chain),
        maybeSingle: vi.fn(async () => ({ data, error: null })),
        single: vi.fn(async () => ({ data, error: null })),
        then: (resolve: (val: unknown) => unknown) =>
          resolve({ data, count: count ?? 0, error: null }),
      };
      return chain;
    }

    const mockClient = {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: mockCallerId, email: "reseller@vyapone.in" } },
          error: null,
        })),
      },
      rpc: vi.fn(async (fnName: string) => {
        if (fnName === "assert_and_lock_workspace_capacity") {
          if (overrides?.capacityExceeded) {
            return {
              data: [
                {
                  allowed: false,
                  current_count: 5,
                  effective_limit: 5,
                  remaining: 0,
                  reason: "Workspace draft website limit reached (5/5)",
                },
              ],
              error: null,
            };
          }
          return {
            data: [
              {
                allowed: true,
                current_count: 1,
                effective_limit: 5,
                remaining: 4,
                reason: null,
              },
            ],
            error: null,
          };
        }
        return { data: null, error: null };
      }),
      from: vi.fn((table: string) => {
        if (table === "workspaces") {
          return createChain({
            id: mockWorkspaceId,
            name: "Agency Workspace",
            status: "active",
            plan: "starter",
          });
        }

        if (table === "workspace_members") {
          return createChain({
            id: "wsm-1",
            workspace_id: mockWorkspaceId,
            user_id: mockCallerId,
            role: overrides?.workspaceRole ?? "workspace_admin",
            status: "active",
          });
        }

        if (table === "businesses") {
          return {
            select: vi.fn(() =>
              createChain(overrides?.existingSlug ? { id: "existing-biz-id" } : null),
            ),
            insert: vi.fn((data: Record<string, unknown>) => {
              insertedBusinesses.push(data);
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: { id: mockBusinessId, ...data },
                    error: null,
                  })),
                })),
              };
            }),
          };
        }

        if (table === "locations") {
          return {
            insert: vi.fn((data: Record<string, unknown>) => {
              insertedLocations.push(data);
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: { id: mockLocationId, ...data },
                    error: null,
                  })),
                })),
              };
            }),
          };
        }

        if (table === "business_members") {
          return {
            insert: vi.fn(async (data: Record<string, unknown>) => {
              insertedMembers.push(data);
              return { error: null };
            }),
          };
        }

        if (table === "media_items") {
          return {
            update: vi.fn((data: Record<string, unknown>) => {
              updatedMedia.push(data);
              return {
                eq: vi.fn(async () => ({ error: null })),
                in: vi.fn(async () => ({ error: null })),
              };
            }),
          };
        }

        if (table === "business_onboarding_answers") {
          return {
            upsert: vi.fn(async (data: Record<string, unknown>) => {
              upsertedOnboarding.push(data);
              return { error: null };
            }),
          };
        }

        if (table === "business_modules") {
          return {
            upsert: vi.fn(async (data: Record<string, unknown>[]) => {
              if (Array.isArray(data)) {
                upsertedModules.push(...data);
              } else {
                upsertedModules.push(data);
              }
              return { error: null };
            }),
          };
        }

        if (table === "audit_logs") {
          return {
            insert: vi.fn(async (data: Record<string, unknown>) => {
              insertedAuditLogs.push(data);
              return { error: null };
            }),
          };
        }

        if (table === "niches") {
          return createChain(null);
        }

        return createChain(null);
      }),
    };

    return {
      client: mockClient as unknown as SupabaseClient<Database>,
      insertedBusinesses,
      insertedLocations,
      insertedMembers,
      upsertedOnboarding,
      upsertedModules,
      updatedMedia,
      insertedAuditLogs,
    };
  }

  describe("1. createBusinessWithSetup() Service Layer", () => {
    it("successfully creates a business, primary location, owner membership, onboarding answers, modules and audit log", async () => {
      const mock = createMockSupabase();

      const result = await createBusinessWithSetup(mock.client, mockCallerId, validSetupInput);

      // 1. Result contract
      expect(result.business.id).toBe(mockBusinessId);
      expect(result.business.trade_name).toBe("Chai & Conversations Café");
      expect(result.primaryLocation.id).toBe(mockLocationId);
      expect(result.primaryLocation.is_primary).toBe(true);
      expect(result.nicheSlug).toBe("cafe");

      // 2. Business insertion integrity
      expect(mock.insertedBusinesses.length).toBe(1);
      const biz = mock.insertedBusinesses[0];
      expect(biz.workspace_id).toBe(mockWorkspaceId);
      expect(biz.sovereign_owner_id).toBe(mockCallerId);
      expect(biz.status).toBe("onboarding");
      expect(biz.currency_code).toBe("INR");

      // 3. Primary location insertion
      expect(mock.insertedLocations.length).toBe(1);
      const loc = mock.insertedLocations[0];
      expect(loc.business_id).toBe(mockBusinessId);
      expect(loc.address_line1).toBe("123 Indiranagar 100ft Road");
      expect(loc.postal_code).toBe("560038");
      expect(loc.is_primary).toBe(true);

      // 4. Initial owner membership
      expect(mock.insertedMembers.length).toBe(1);
      expect(mock.insertedMembers[0].role).toBe("owner");
      expect(mock.insertedMembers[0].user_id).toBe(mockCallerId);

      // 5. Media quarantine linkage
      expect(mock.updatedMedia.length).toBeGreaterThan(0);
      expect(mock.updatedMedia[0].business_id).toBe(mockBusinessId);

      // 6. Onboarding answers persistence
      expect(mock.upsertedOnboarding.length).toBe(1);
      expect(mock.upsertedOnboarding[0].niche_slug).toBe("cafe");
      expect(mock.upsertedOnboarding[0].business_id).toBe(mockBusinessId);

      // 7. Module initialization
      expect(mock.upsertedModules.length).toBeGreaterThan(0);
      const moduleKeys = mock.upsertedModules.map((m) => m.module_key);
      expect(moduleKeys).toContain("website_engine");

      // 8. Audit log recording
      expect(mock.insertedAuditLogs.length).toBe(1);
      expect(mock.insertedAuditLogs[0].action).toBe("business.created_with_setup");
      expect(mock.insertedAuditLogs[0].business_id).toBe(mockBusinessId);
      expect(mock.insertedAuditLogs[0].workspace_id).toBe(mockWorkspaceId);
    });

    it("enforces plan capacity limits and rejects when draft website allowance is exceeded", async () => {
      const mock = createMockSupabase({ capacityExceeded: true });

      await expect(
        createBusinessWithSetup(mock.client, mockCallerId, validSetupInput),
      ).rejects.toThrow(BusinessError);
    });

    it("rejects unauthorized caller who does not have manage_businesses permission in workspace", async () => {
      const mock = createMockSupabase({ workspaceRole: "workspace_member" });

      await expect(
        createBusinessWithSetup(mock.client, mockCallerId, validSetupInput),
      ).rejects.toThrow(/management permissions/i);
    });

    it("handles slug collisions by appending a unique random suffix", async () => {
      const mock = createMockSupabase({ existingSlug: true });

      const result = await createBusinessWithSetup(mock.client, mockCallerId, validSetupInput);

      expect(result.business.slug).toMatch(/^chai-conversations-caf-[a-z0-9]{4}$/);
    });
  });

  describe("2. createBusinessWithSetupAction() Server Action", () => {
    it("returns UNAUTHENTICATED error when caller is not signed in", async () => {
      const { createServerSupabaseClient } = await import("@/lib/supabase/server");
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn(async () => ({ data: { user: null }, error: new Error("No session") })),
        },
      } as unknown as SupabaseClient<Database>);

      const result = await createBusinessWithSetupAction(validSetupInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("UNAUTHENTICATED");
      }
    });

    it("returns VALIDATION_FAILED when PIN code or trade name is invalid", async () => {
      const { createServerSupabaseClient } = await import("@/lib/supabase/server");
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: mockCallerId } },
            error: null,
          })),
        },
      } as unknown as SupabaseClient<Database>);

      const invalidInput = {
        ...validSetupInput,
        trade_name: "X", // too short (min 2)
        primary_location: {
          ...validSetupInput.primary_location,
          postal_code: "123", // invalid 3-digit PIN code
        },
      };

      const result = await createBusinessWithSetupAction(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("VALIDATION_FAILED");
        expect(result.validationErrors?.trade_name).toBeDefined();
        expect(result.validationErrors?.["primary_location.postal_code"]).toBeDefined();
      }
    });

    it("executes successfully and revalidates workspace paths", async () => {
      const { createServerSupabaseClient } = await import("@/lib/supabase/server");
      const { revalidatePath } = await import("next/cache");

      const mock = createMockSupabase();
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce(mock.client);

      const result = await createBusinessWithSetupAction(validSetupInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.business.id).toBe(mockBusinessId);
      }
      expect(revalidatePath).toHaveBeenCalledWith("/workspace");
      expect(revalidatePath).toHaveBeenCalledWith("/workspace/clients");
    });
  });

  describe("3. getBusinessSetupDraft() & getBusinessSetupDraftAction()", () => {
    it("returns draft details for an authorized workspace manager", async () => {
      function createChain(data: unknown) {
        const chain: Record<string, unknown> = {
          eq: vi.fn(() => chain),
          neq: vi.fn(() => chain),
          in: vi.fn(() => chain),
          order: vi.fn(() => chain),
          limit: vi.fn(() => chain),
          select: vi.fn(() => chain),
          maybeSingle: vi.fn(async () => ({ data, error: null })),
          single: vi.fn(async () => ({ data, error: null })),
          then: (resolve: (val: unknown) => unknown) => resolve({ data, error: null }),
        };
        return chain;
      }

      const mockClient = {
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: mockCallerId } },
            error: null,
          })),
        },
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return createChain({
              id: mockBusinessId,
              trade_name: "Chai & Conversations Café",
              slug: "chai-conversations",
              workspace_id: mockWorkspaceId,
              sovereign_owner_id: mockCallerId,
            });
          }
          if (table === "business_members") {
            return createChain({ role: "owner", status: "active" });
          }
          if (table === "workspace_members") {
            return createChain({ role: "workspace_admin", status: "active" });
          }
          if (table === "locations") {
            return createChain({
              id: mockLocationId,
              name: "Main Store",
              address_line1: "123 Indiranagar",
              city: "Bengaluru",
              state: "Karnataka",
              postal_code: "560038",
              is_primary: true,
            });
          }
          if (table === "business_onboarding_answers") {
            return createChain({
              business_id: mockBusinessId,
              niche_slug: "cafe",
              answers: { has_outdoor_seating: true },
              is_complete: true,
              missing_fields: [],
            });
          }
          if (table === "media_items") {
            return createChain([
              { id: mockLogoMediaId, category: "business_logo", original_filename: "logo.png" },
            ]);
          }
          return createChain(null);
        }),
      } as unknown as SupabaseClient<Database>;

      const draft = await getBusinessSetupDraft(mockClient, mockBusinessId, mockCallerId);
      expect(draft).not.toBeNull();
      expect(draft?.business.trade_name).toBe("Chai & Conversations Café");
      expect(draft?.primaryLocation?.city).toBe("Bengaluru");
      expect(draft?.onboardingAnswers).toEqual({ has_outdoor_seating: true });
      expect(draft?.mediaItems.length).toBe(1);
    });

    it("rejects unauthorized users from retrieving draft data", async () => {
      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: mockBusinessId,
                      sovereign_owner_id: "other-user-uuid",
                      workspace_id: null,
                    },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "business_members") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                    })),
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

      await expect(
        getBusinessSetupDraft(mockClient, mockBusinessId, "unauthorized-user-uuid"),
      ).rejects.toThrow(/access denied/i);
    });

    it("retrieves draft via getBusinessSetupDraftAction", async () => {
      const { createServerSupabaseClient } = await import("@/lib/supabase/server");

      function createChain(data: unknown) {
        const chain: Record<string, unknown> = {
          eq: vi.fn(() => chain),
          neq: vi.fn(() => chain),
          in: vi.fn(() => chain),
          order: vi.fn(() => chain),
          limit: vi.fn(() => chain),
          select: vi.fn(() => chain),
          maybeSingle: vi.fn(async () => ({ data, error: null })),
          single: vi.fn(async () => ({ data, error: null })),
          then: (resolve: (val: unknown) => unknown) => resolve({ data, error: null }),
        };
        return chain;
      }

      const mockClient = {
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: mockCallerId } },
            error: null,
          })),
        },
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return createChain({
              id: mockBusinessId,
              trade_name: "Chai & Conversations Café",
              slug: "chai-conversations",
              workspace_id: mockWorkspaceId,
              sovereign_owner_id: mockCallerId,
            });
          }
          if (table === "business_members") {
            return createChain({ role: "owner", status: "active" });
          }
          if (table === "workspace_members") {
            return createChain({ role: "workspace_admin", status: "active" });
          }
          if (table === "locations") {
            return createChain({
              id: mockLocationId,
              name: "Main Store",
              is_primary: true,
            });
          }
          if (table === "business_onboarding_answers") {
            return createChain(null);
          }
          if (table === "media_items") {
            return createChain([]);
          }
          return createChain(null);
        }),
      } as unknown as SupabaseClient<Database>;

      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce(mockClient);

      const result = await getBusinessSetupDraftAction(mockBusinessId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.business.trade_name).toBe("Chai & Conversations Café");
      }
    });
  });
});

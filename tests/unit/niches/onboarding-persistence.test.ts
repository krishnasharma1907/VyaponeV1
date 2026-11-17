import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  saveBusinessOnboardingAnswers,
  getBusinessOnboardingAnswers,
  NicheRegistryError,
} from "@/lib/niches/service";
import * as tenantAccess from "@/lib/auth/tenant-access";
import * as auditService from "@/lib/audit/service";

vi.mock("@/lib/auth/tenant-access", async () => {
  const actual = await vi.importActual<typeof tenantAccess>("@/lib/auth/tenant-access");
  return {
    ...actual,
    assertBusinessAccess: vi.fn(async () => ({
      business: { id: "mock-biz-id", sovereign_owner_id: "user-123", plan_id: "starter" },
      membership: { role: "owner" },
      isSovereignOwner: true,
      isWorkspaceAdmin: false,
    })),
  };
});

vi.mock("@/lib/audit/service", () => ({
  recordAuditEvent: vi.fn(async () => ({ id: "audit-123" })),
}));

describe("VO-031 Business Onboarding Persistence & Sovereign Isolation", () => {
  const mockBusinessId = "11111111-1111-1111-1111-111111111111";
  const mockUserId = "22222222-2222-2222-2222-222222222222";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists valid onboarding answers and triggers audit log", async () => {
    const mockRecord = {
      id: "ans-1",
      business_id: mockBusinessId,
      niche_slug: "restaurant",
      manifest_version: "v1",
      answers: {
        cuisine_types: ["North Indian", "Chinese"],
        offers_dine_in: true,
        dine_in_tables: 20,
        offers_takeaway: true,
        delivery_radius_km: 10,
      },
      is_complete: true,
      missing_fields: [],
      created_at: "2026-11-18T00:00:00Z",
      updated_at: "2026-11-18T00:00:00Z",
    };

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "business_onboarding_answers") {
          return {
            upsert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: mockRecord,
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === "niches") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: null, // triggers fallback to DEFAULT_NICHE_MANIFESTS
                  error: null,
                })),
              })),
            })),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient<Database>;

    const result = await saveBusinessOnboardingAnswers(mockSupabase, {
      businessId: mockBusinessId,
      nicheSlug: "restaurant",
      answers: {
        cuisine_types: ["North Indian", "Chinese"],
        offers_dine_in: true,
        dine_in_tables: 20,
        offers_takeaway: true,
        delivery_radius_km: 10,
      },
      callerUserId: mockUserId,
    });

    expect(result.id).toBe("ans-1");
    expect(result.isComplete).toBe(true);
    expect(result.missingFields).toHaveLength(0);
    expect(tenantAccess.assertBusinessAccess).toHaveBeenCalledWith(mockSupabase, mockBusinessId, {
      requiredRole: "manager",
    });
    expect(auditService.recordAuditEvent).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({
        businessId: mockBusinessId,
        actorUserId: mockUserId,
        action: "business.onboarding_answers_saved",
      }),
    );
  });

  it("throws validation error and refuses persistence when answers are invalid", async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      })),
    } as unknown as SupabaseClient<Database>;

    // dine_in_tables is out of range (> 500)
    await expect(
      saveBusinessOnboardingAnswers(mockSupabase, {
        businessId: mockBusinessId,
        nicheSlug: "restaurant",
        answers: {
          cuisine_types: ["North Indian"],
          offers_dine_in: true,
          dine_in_tables: 9999, // Max is 500!
          offers_takeaway: false,
        },
        callerUserId: mockUserId,
      }),
    ).rejects.toThrow(NicheRegistryError);

    expect(auditService.recordAuditEvent).not.toHaveBeenCalled();
  });

  it("retrieves saved onboarding answers for a business", async () => {
    const mockRecord = {
      id: "ans-1",
      business_id: mockBusinessId,
      niche_slug: "salon",
      manifest_version: "v1",
      answers: {
        client_gender: "Unisex",
        staff_count: 5,
        offers_home_service: false,
      },
      is_complete: true,
      missing_fields: [],
      created_at: "2026-11-18T00:00:00Z",
      updated_at: "2026-11-18T00:00:00Z",
    };

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: mockRecord,
              error: null,
            })),
          })),
        })),
      })),
    } as unknown as SupabaseClient<Database>;

    const res = await getBusinessOnboardingAnswers(mockSupabase, mockBusinessId, mockUserId);
    expect(res).not.toBeNull();
    expect(res?.nicheSlug).toBe("salon");
    expect(res?.answers["client_gender"]).toBe("Unisex");
  });

  it("returns null when no answers have been persisted yet", async () => {
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

    const res = await getBusinessOnboardingAnswers(mockSupabase, mockBusinessId, mockUserId);
    expect(res).toBeNull();
  });

  it("preserves plan entitlement separation: never mutates plan or module tables", async () => {
    const fromSpy = vi.fn((table: string) => {
      if (table === "business_onboarding_answers") {
        return {
          upsert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: "ans-1",
                  business_id: mockBusinessId,
                  niche_slug: "other_business",
                  manifest_version: "v1",
                  answers: {
                    business_summary: "Consulting",
                    target_customer_action: "Send an Enquiry",
                  },
                  is_complete: true,
                  missing_fields: [],
                  created_at: "2026-11-18T00:00:00Z",
                  updated_at: "2026-11-18T00:00:00Z",
                },
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
    });

    const mockSupabase = { from: fromSpy } as unknown as SupabaseClient<Database>;

    await saveBusinessOnboardingAnswers(mockSupabase, {
      businessId: mockBusinessId,
      nicheSlug: "other_business",
      answers: {
        business_summary: "Software Consulting Services",
        target_customer_action: "Send an Enquiry",
      },
      callerUserId: mockUserId,
    });

    const tablesAccessed = fromSpy.mock.calls.map((call) => call[0]);
    expect(tablesAccessed).not.toContain("subscriptions");
    expect(tablesAccessed).not.toContain("entitlement_overrides");
    expect(tablesAccessed).not.toContain("business_modules");
  });
});

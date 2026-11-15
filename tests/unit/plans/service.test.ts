import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  resolveWorkspacePlan,
  checkFeatureEntitlement,
  assertFeatureEntitled,
  getWorkspaceSubscriptionDetails,
} from "@/lib/plans/service";
import { normalizePlanId } from "@/lib/plans/constants";

describe("VO-026 Plans & Entitlement Service", () => {
  const mockWorkspaceId = "11111111-1111-1111-1111-111111111111";
  const mockBusinessId = "22222222-2222-2222-2222-222222222222";

  describe("1. Plan Resolution", () => {
    it("resolves default starter plan from workspace row when no subscription exists", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: mockWorkspaceId,
                      plan: "starter",
                      status: "active",
                    },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "subscriptions") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: null,
                    error: null,
                  })),
                })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await resolveWorkspacePlan(mockSupabase, mockWorkspaceId);
      expect(result.plan.id).toBe("starter");
      expect(result.plan.capacities.live_websites).toBe(3);
      expect(result.subscription).toBeNull();
      expect(result.isGracePeriod).toBe(false);
    });

    it("resolves active subscription plan overriding workspace row", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: mockWorkspaceId,
                      plan: "starter",
                      status: "active",
                    },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "subscriptions") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: "sub-001",
                      workspace_id: mockWorkspaceId,
                      plan_id: "agency",
                      status: "active",
                      current_period_start: "2026-11-01T00:00:00Z",
                      current_period_end: "2026-12-01T00:00:00Z",
                      grace_period_end: null,
                      provider_reference: "sub_razorpay_123",
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

      const result = await resolveWorkspacePlan(mockSupabase, mockWorkspaceId);
      expect(result.plan.id).toBe("agency");
      expect(result.plan.capacities.live_websites).toBe(20);
      expect(result.subscription?.id).toBe("sub-001");
    });

    it("detects active grace period when subscription is in grace period", async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { id: mockWorkspaceId, plan: "growth", status: "active" },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "subscriptions") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: "sub-002",
                      workspace_id: mockWorkspaceId,
                      plan_id: "growth",
                      status: "past_due",
                      current_period_start: "2026-10-01T00:00:00Z",
                      current_period_end: "2026-11-01T00:00:00Z",
                      grace_period_end: futureDate,
                      provider_reference: null,
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

      const result = await resolveWorkspacePlan(mockSupabase, mockWorkspaceId);
      expect(result.isGracePeriod).toBe(true);
      expect(result.plan.id).toBe("growth");
    });

    it("falls back to starter plan when subscription is canceled", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { id: mockWorkspaceId, plan: "agency", status: "active" },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "subscriptions") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: "sub-003",
                      workspace_id: mockWorkspaceId,
                      plan_id: "agency",
                      status: "canceled",
                      current_period_start: "2026-10-01T00:00:00Z",
                      current_period_end: "2026-11-01T00:00:00Z",
                      grace_period_end: null,
                      provider_reference: null,
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

      const result = await resolveWorkspacePlan(mockSupabase, mockWorkspaceId);
      expect(result.plan.id).toBe("starter");
    });

    it("fails closed when workspace does not exist", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
        })),
      } as unknown as SupabaseClient<Database>;

      await expect(resolveWorkspacePlan(mockSupabase, "non-existent-workspace")).rejects.toThrow(
        "Workspace not found",
      );
    });
  });

  describe("2. Feature Entitlement Evaluation", () => {
    it("confirms feature included in base plan without overrides", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "entitlement_overrides") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                  })),
                })),
              })),
            };
          }
          if (table === "workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { id: mockWorkspaceId, plan: "growth", status: "active" },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "subscriptions") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const evalCustomDomain = await checkFeatureEntitlement(mockSupabase, {
        workspaceId: mockWorkspaceId,
        feature: "custom_domain",
      });
      expect(evalCustomDomain.enabled).toBe(true);
      expect(evalCustomDomain.source).toBe("plan");

      const evalWhiteLabel = await checkFeatureEntitlement(mockSupabase, {
        workspaceId: mockWorkspaceId,
        feature: "white_label",
      });
      expect(evalWhiteLabel.enabled).toBe(false);
      expect(evalWhiteLabel.source).toBe("plan");
    });

    it("respects explicit business entitlement override over base plan", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "entitlement_overrides") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn((col: string, val: string) => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => {
                      if (col === "business_id" && val === mockBusinessId) {
                        return {
                          data: {
                            id: "eno-001",
                            workspace_id: null,
                            business_id: mockBusinessId,
                            feature_key: "white_label",
                            is_enabled: true,
                            expires_at: null,
                            reason: "Pilot VIP partner grant",
                          },
                          error: null,
                        };
                      }
                      return { data: null, error: null };
                    }),
                  })),
                })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await checkFeatureEntitlement(mockSupabase, {
        workspaceId: mockWorkspaceId,
        businessId: mockBusinessId,
        feature: "white_label",
      });

      expect(result.enabled).toBe(true);
      expect(result.source).toBe("override");
      expect(result.reason).toBe("Pilot VIP partner grant");
    });

    it("ignores expired entitlement overrides and falls back to plan", async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "entitlement_overrides") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({
                      data: {
                        id: "eno-002",
                        workspace_id: mockWorkspaceId,
                        business_id: null,
                        feature_key: "custom_domain",
                        is_enabled: true,
                        expires_at: pastDate,
                        reason: "Trial promo expired",
                      },
                      error: null,
                    })),
                  })),
                })),
              })),
            };
          }
          if (table === "workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { id: mockWorkspaceId, plan: "starter", status: "active" },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "subscriptions") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await checkFeatureEntitlement(mockSupabase, {
        workspaceId: mockWorkspaceId,
        feature: "custom_domain",
      });

      // Expired override is skipped -> evaluates base starter plan (custom_domain is false)
      expect(result.enabled).toBe(false);
      expect(result.source).toBe("plan");
    });

    it("throws PlanEntitlementError when asserting unentitled feature", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "entitlement_overrides") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                  })),
                })),
              })),
            };
          }
          if (table === "workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { id: mockWorkspaceId, plan: "starter", status: "active" },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "subscriptions") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        assertFeatureEntitled(mockSupabase, {
          workspaceId: mockWorkspaceId,
          feature: "custom_domain",
        }),
      ).rejects.toThrow("Feature 'custom_domain' requires a plan upgrade");
    });
  });

  describe("3. Subscription Details & Aggregation", () => {
    it("aggregates complete subscription, capacities and features", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { id: mockWorkspaceId, plan: "growth", status: "active" },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "subscriptions" || table === "capacity_overrides") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                  })),
                })),
              })),
            };
          }
          if (table === "entitlement_overrides") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                  })),
                })),
              })),
            };
          }
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  neq: vi.fn(async () => ({ data: [], error: null })),
                })),
              })),
            };
          }
          if (table === "workspace_members") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(async () => ({ count: 1, error: null })),
                })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const details = await getWorkspaceSubscriptionDetails(mockSupabase, mockWorkspaceId);
      expect(details.planId).toBe("growth");
      expect(details.planName).toBe("Growth");
      expect(details.status).toBe("active");
      expect(details.capacities.live_websites.baseLimit).toBe(8);
      expect(details.features.custom_domain.enabled).toBe(true);
    });

    it("normalizes unknown plan IDs to starter plan", () => {
      expect(normalizePlanId(null)).toBe("starter");
      expect(normalizePlanId("unknown_tier")).toBe("starter");
      expect(normalizePlanId("agency")).toBe("agency");
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  getCapacityUsage,
  assertCapacityAvailable,
  checkSiteTransitionCapacity,
} from "@/lib/plans/service";
import { CapacityExceededError, PlanEntitlementError } from "@/lib/plans/types";

describe("VO-026 Capacity Service & Counting Rules (§9.2)", () => {
  const mockWorkspaceId = "11111111-1111-1111-1111-111111111111";
  const mockSiteId = "33333333-3333-3333-3333-333333333333";

  describe("1. Live Website Slots (PRD §9.2)", () => {
    it("counts only published sites belonging to active businesses", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
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
          if (table === "capacity_overrides") {
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
                  neq: vi.fn(async () => ({
                    data: [{ id: "biz-1" }, { id: "biz-2" }],
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "sites") {
            return {
              select: vi.fn(() => ({
                in: vi.fn(() => ({
                  eq: vi.fn(async () => ({
                    count: 2,
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

      const usage = await getCapacityUsage(mockSupabase, mockWorkspaceId, "live_websites");

      // Starter plan limit: 3 live websites
      expect(usage.current).toBe(2);
      expect(usage.baseLimit).toBe(3);
      expect(usage.remaining).toBe(1);
      expect(usage.isExceeded).toBe(false);
    });

    it("rejects operation when live website capacity is exhausted", async () => {
      const mockSupabase = {
        rpc: vi.fn(async (proc: string) => {
          if (proc === "assert_and_lock_workspace_capacity") {
            return {
              data: [
                {
                  allowed: false,
                  current_count: 3,
                  effective_limit: 3,
                },
              ],
              error: null,
            };
          }
          return { data: null, error: null };
        }),
        from: vi.fn((table: string) => {
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
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  neq: vi.fn(async () => ({
                    data: [{ id: "biz-1" }, { id: "biz-2" }, { id: "biz-3" }],
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "sites") {
            return {
              select: vi.fn(() => ({
                in: vi.fn(() => ({
                  eq: vi.fn(async () => ({
                    count: 3,
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

      await expect(
        assertCapacityAvailable(mockSupabase, mockWorkspaceId, "live_websites", 1),
      ).rejects.toThrow(CapacityExceededError);
    });

    it("expands capacity when active capacity override is present", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
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
          if (table === "capacity_overrides") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({
                      data: {
                        additional_capacity: 5,
                        expires_at: null,
                      },
                      error: null,
                    })),
                  })),
                })),
              })),
            };
          }
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  neq: vi.fn(async () => ({
                    data: [{ id: "biz-1" }, { id: "biz-2" }, { id: "biz-3" }],
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "sites") {
            return {
              select: vi.fn(() => ({
                in: vi.fn(() => ({
                  eq: vi.fn(async () => ({
                    count: 3,
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

      const usage = await getCapacityUsage(mockSupabase, mockWorkspaceId, "live_websites");

      // Starter 3 + override 5 = 8 effective limit
      expect(usage.baseLimit).toBe(3);
      expect(usage.overrideCapacity).toBe(5);
      expect(usage.effectiveLimit).toBe(8);
      expect(usage.remaining).toBe(5);
      expect(usage.isExceeded).toBe(false);
    });
  });

  describe("2. Site Transition Rules (§9.2)", () => {
    it("always permits archiving or suspending a site to free capacity", async () => {
      const mockSupabase = {} as unknown as SupabaseClient<Database>;

      const archiveResult = await checkSiteTransitionCapacity(
        mockSupabase,
        mockWorkspaceId,
        mockSiteId,
        "archived",
      );
      expect(archiveResult.allowed).toBe(true);

      const suspendResult = await checkSiteTransitionCapacity(
        mockSupabase,
        mockWorkspaceId,
        mockSiteId,
        "suspended",
      );
      expect(suspendResult.allowed).toBe(true);
    });

    it("does not consume extra capacity when updating an already published site", async () => {
      const mockSupabase = {
        rpc: vi.fn(async (proc: string) => {
          if (proc === "transition_site_status_atomic") {
            return {
              data: [
                {
                  success: true,
                  site_id: mockSiteId,
                  status: "published",
                },
              ],
              error: null,
            };
          }
          return { data: null, error: null };
        }),
        from: vi.fn((table: string) => {
          if (table === "sites") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { id: mockSiteId, status: "published" },
                    error: null,
                  })),
                })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      // Target status is already published
      const result = await checkSiteTransitionCapacity(
        mockSupabase,
        mockWorkspaceId,
        mockSiteId,
        "published",
      );
      expect(result.allowed).toBe(true);
    });

    it("blocks transition from draft to published when live limit is reached", async () => {
      const mockSupabase = {
        rpc: vi.fn(async (proc: string) => {
          if (proc === "transition_site_status_atomic") {
            return {
              data: [
                {
                  success: false,
                  site_id: mockSiteId,
                  status: "draft",
                  reason: "Capacity limit reached for live_websites",
                },
              ],
              error: null,
            };
          }
          return { data: null, error: null };
        }),
        from: vi.fn((table: string) => {
          if (table === "sites") {
            return {
              select: vi.fn((cols: string) => {
                if (cols === "id, status") {
                  return {
                    eq: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({
                        data: { id: mockSiteId, status: "draft" },
                        error: null,
                      })),
                    })),
                  };
                }
                return {
                  in: vi.fn(() => ({
                    eq: vi.fn(async () => ({ count: 3, error: null })),
                  })),
                };
              }),
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
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  neq: vi.fn(async () => ({
                    data: [{ id: "biz-1" }, { id: "biz-2" }, { id: "biz-3" }],
                    error: null,
                  })),
                })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await checkSiteTransitionCapacity(
        mockSupabase,
        mockWorkspaceId,
        mockSiteId,
        "published",
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Capacity limit reached for live_websites");
    });

    it("blocks transition from archived to draft when draft allowance is reached", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "sites") {
            return {
              select: vi.fn((cols: string) => {
                if (cols === "id, status") {
                  return {
                    eq: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({
                        data: { id: mockSiteId, status: "archived" },
                        error: null,
                      })),
                    })),
                  };
                }
                return {
                  in: vi.fn(() => ({
                    eq: vi.fn(async () => ({ count: 10, error: null })),
                  })),
                };
              }),
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
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  neq: vi.fn(async () => ({
                    data: [{ id: "biz-1" }],
                    error: null,
                  })),
                })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await checkSiteTransitionCapacity(
        mockSupabase,
        mockWorkspaceId,
        mockSiteId,
        "draft",
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Draft website allowance reached");
    });
  });

  describe("3. Team Seats & Resource Capacities", () => {
    it("measures team seats and locations correctly", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
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
          if (table === "workspace_members") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(async () => ({ count: 2, error: null })),
                })),
              })),
            };
          }
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  neq: vi.fn(async () => ({
                    data: [{ id: "biz-1" }],
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "locations") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(async () => ({ count: 1, error: null })),
              })),
            };
          }
          if (table === "catalogue_items") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(async () => ({ count: 25, error: null })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const seatsUsage = await getCapacityUsage(mockSupabase, mockWorkspaceId, "team_seats");
      expect(seatsUsage.current).toBe(2);
      expect(seatsUsage.baseLimit).toBe(2);
      expect(seatsUsage.isExceeded).toBe(true);

      const locUsage = await getCapacityUsage(
        mockSupabase,
        mockWorkspaceId,
        "locations_per_business",
      );
      expect(locUsage.current).toBe(1);

      const catUsage = await getCapacityUsage(
        mockSupabase,
        mockWorkspaceId,
        "catalogue_items_per_business",
      );
      expect(catUsage.current).toBe(25);
    });
  });

  describe("4. Concurrency Safety & Simultaneous Operations", () => {
    it("strictly isolates and counts unique businesses even if multiple published sites exist (PRD §9.2 rule 1)", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
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
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  neq: vi.fn(async () => ({
                    data: [{ id: "biz-1" }],
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "sites") {
            return {
              select: vi.fn(() => ({
                in: vi.fn(() => ({
                  eq: vi.fn(async () => ({
                    // Simulate 2 published site rows for the same business (biz-1)
                    data: [{ business_id: "biz-1" }, { business_id: "biz-1" }],
                    error: null,
                  })),
                })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const usage = await getCapacityUsage(mockSupabase, mockWorkspaceId, "live_websites");

      // PRD §9.2: One live slot per business. Even with 2 published rows, current = 1
      expect(usage.current).toBe(1);
      expect(usage.baseLimit).toBe(3);
      expect(usage.remaining).toBe(2);
    });

    it("enforces atomic serialization when two simultaneous requests race for the last remaining live website slot", async () => {
      let slotTaken = false;

      // Mock client that simulates PostgreSQL row locking & atomic RPC transition_site_status_atomic
      const mockSupabase = {
        rpc: vi.fn(
          async (funcName: string, args: { p_site_id: string; p_target_status: string }) => {
            if (funcName === "transition_site_status_atomic") {
              if (args.p_target_status === "published") {
                if (!slotTaken) {
                  slotTaken = true;
                  return {
                    data: [
                      { success: true, status: "published", reason: "Site published successfully" },
                    ],
                    error: null,
                  };
                } else {
                  return {
                    data: [
                      {
                        success: false,
                        status: "draft",
                        reason: "Capacity limit reached for live_websites",
                      },
                    ],
                    error: null,
                  };
                }
              }
            }
            return { data: null, error: null };
          },
        ),
      } as unknown as SupabaseClient<Database>;

      // Two simultaneous requests race to publish their site when only 1 slot is remaining
      const [req1, req2] = await Promise.all([
        checkSiteTransitionCapacity(mockSupabase, mockWorkspaceId, "site-1", "published"),
        checkSiteTransitionCapacity(mockSupabase, mockWorkspaceId, "site-2", "published"),
      ]);

      // Exactly one request must succeed, and the other must be rejected
      const successes = [req1, req2].filter((r) => r.allowed);
      const rejections = [req1, req2].filter((r) => !r.allowed);

      expect(successes).toHaveLength(1);
      expect(rejections).toHaveLength(1);
      expect(rejections[0].reason).toContain("Capacity limit reached for live_websites");
    });

    it("enforces atomic capacity assertion with row-lock RPC", async () => {
      let remainingSlots = 1;

      const mockSupabase = {
        rpc: vi.fn(
          async (funcName: string, args: { p_metric: string; p_requested_quantity: number }) => {
            if (funcName === "assert_and_lock_workspace_capacity") {
              if (remainingSlots >= args.p_requested_quantity) {
                remainingSlots -= args.p_requested_quantity;
                return {
                  data: [
                    {
                      allowed: true,
                      current_count: 2,
                      effective_limit: 3,
                      remaining: remainingSlots,
                      reason: "Capacity available",
                    },
                  ],
                  error: null,
                };
              } else {
                return {
                  data: [
                    {
                      allowed: false,
                      current_count: 3,
                      effective_limit: 3,
                      remaining: 0,
                      reason: "Capacity limit reached for " + args.p_metric,
                    },
                  ],
                  error: null,
                };
              }
            }
            return { data: null, error: null };
          },
        ),
      } as unknown as SupabaseClient<Database>;

      // Request 1 succeeds
      const result1 = await assertCapacityAvailable(
        mockSupabase,
        mockWorkspaceId,
        "live_websites",
        1,
      );
      expect(result1.current).toBe(2);
      expect(result1.effectiveLimit).toBe(3);

      // Simultaneous Request 2 fails because capacity is now exhausted
      await expect(
        assertCapacityAvailable(mockSupabase, mockWorkspaceId, "live_websites", 1),
      ).rejects.toThrow(CapacityExceededError);
    });

    it("fails closed when atomic RPC is missing or fails during publishing (preventing unsafe read-count-write bypass)", async () => {
      const mockSupabase = {
        rpc: vi.fn(async () => {
          // Simulate missing remote RPC (PGRST202)
          return {
            data: null,
            error: {
              code: "PGRST202",
              message: "Could not find the function public.transition_site_status_atomic",
            },
          };
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        checkSiteTransitionCapacity(mockSupabase, mockWorkspaceId, "site-1", "published"),
      ).rejects.toThrow(PlanEntitlementError);
    });

    it("fails closed when assertCapacityAvailable for live_websites encounters an RPC failure", async () => {
      const mockSupabase = {
        rpc: vi.fn(async () => {
          return {
            data: null,
            error: {
              code: "PGRST202",
              message: "Could not find the function public.assert_and_lock_workspace_capacity",
            },
          };
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        assertCapacityAvailable(mockSupabase, mockWorkspaceId, "live_websites", 1),
      ).rejects.toThrow(PlanEntitlementError);
    });

    it("permits safe non-publishing status changes (archiving, suspending) without requiring RPC", async () => {
      const mockSupabase = {} as unknown as SupabaseClient<Database>;

      const archiveResult = await checkSiteTransitionCapacity(
        mockSupabase,
        mockWorkspaceId,
        "site-1",
        "archived",
      );
      expect(archiveResult.allowed).toBe(true);

      const suspendResult = await checkSiteTransitionCapacity(
        mockSupabase,
        mockWorkspaceId,
        "site-1",
        "suspended",
      );
      expect(suspendResult.allowed).toBe(true);
    });

    it("fails closed when workspace has an invalid or unknown plan ID", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: mockWorkspaceId,
                      plan: "unsupported_enterprise_custom",
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
                  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        getCapacityUsage(mockSupabase, mockWorkspaceId, "live_websites"),
      ).rejects.toThrow("Invalid or unknown workspace plan: unsupported_enterprise_custom");
    });

    it("excludes sites belonging to archived businesses from live website capacity", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
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
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  neq: vi.fn(async () => ({
                    // Only biz-active is returned by .neq("status", "archived")
                    data: [{ id: "biz-active" }],
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "sites") {
            return {
              select: vi.fn(() => ({
                in: vi.fn((_col: string, ids: string[]) => ({
                  eq: vi.fn(async () => ({
                    // Only sites belonging to active businesses are returned
                    data: ids.includes("biz-active") ? [{ business_id: "biz-active" }] : [],
                    error: null,
                  })),
                })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const usage = await getCapacityUsage(mockSupabase, mockWorkspaceId, "live_websites");
      expect(usage.current).toBe(1);
      expect(usage.baseLimit).toBe(3);
      expect(usage.remaining).toBe(2);
      expect(usage.isUnlimited).toBe(false);
    });
  });

  describe("4. Atomic Publishing & Role Authorization Regression Tests", () => {
    it("permits replacement publishing when capacity is available", async () => {
      const mockSupabase = {
        rpc: vi.fn(
          async (funcName: string, args: { p_site_id: string; p_target_status: string }) => {
            if (funcName === "transition_site_status_atomic") {
              expect(args.p_target_status).toBe("published");
              return {
                data: [
                  {
                    success: true,
                    status: "published",
                    reason: "Site published successfully",
                  },
                ],
                error: null,
              };
            }
            return { data: null, error: null };
          },
        ),
      } as unknown as SupabaseClient<Database>;

      const result = await checkSiteTransitionCapacity(
        mockSupabase,
        mockWorkspaceId,
        mockSiteId,
        "published",
      );

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("rejects replacement publishing when plan capacity is already exceeded after downgrade", async () => {
      const mockSupabase = {
        rpc: vi.fn(async () => ({
          data: [
            {
              success: false,
              status: "draft",
              reason: "Capacity limit reached for live_websites: workspace exceeds plan allowance",
            },
          ],
          error: null,
        })),
      } as unknown as SupabaseClient<Database>;

      const result = await checkSiteTransitionCapacity(
        mockSupabase,
        mockWorkspaceId,
        mockSiteId,
        "published",
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("workspace exceeds plan allowance");
    });

    it("preserves the existing published website without demotion when publishing is rejected", async () => {
      // Simulates database state before transition attempt
      const siteRows = [
        { id: "site-old", business_id: "biz-1", status: "published" },
        { id: "site-new", business_id: "biz-1", status: "draft" },
      ];

      // Atomic transition RPC checks capacity FIRST, fails, and leaves siteRows untouched
      const mockSupabase = {
        rpc: vi.fn(async (_func: string, args: { p_site_id: string }) => {
          if (args.p_site_id === "site-new") {
            // Capacity check fails: no UPDATE statements executed
            return {
              data: [
                {
                  success: false,
                  status: "draft",
                  reason:
                    "Capacity limit reached for live_websites: workspace exceeds plan allowance",
                },
              ],
              error: null,
            };
          }
          return { data: null, error: null };
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await checkSiteTransitionCapacity(
        mockSupabase,
        mockWorkspaceId,
        "site-new",
        "published",
      );

      // Verify publishing failed
      expect(result.allowed).toBe(false);

      // Verify existing published site remains published and was NOT demoted
      const oldSite = siteRows.find((s) => s.id === "site-old");
      expect(oldSite?.status).toBe("published");
    });

    it("serializes concurrent replacement requests for the same business", async () => {
      let activePublishedSiteId = "site-initial";

      const mockSupabase = {
        rpc: vi.fn(async (_funcName: string, args: { p_site_id: string }) => {
          // Transaction-scoped lock serializes execution
          activePublishedSiteId = args.p_site_id;
          return {
            data: [
              {
                success: true,
                status: "published",
                reason: "Site published successfully",
              },
            ],
            error: null,
          };
        }),
      } as unknown as SupabaseClient<Database>;

      const [res1, res2] = await Promise.all([
        checkSiteTransitionCapacity(mockSupabase, mockWorkspaceId, "site-update-1", "published"),
        checkSiteTransitionCapacity(mockSupabase, mockWorkspaceId, "site-update-2", "published"),
      ]);

      expect(res1.allowed).toBe(true);
      expect(res2.allowed).toBe(true);
      // Exactly one published site active after serialized transitions
      expect(["site-update-1", "site-update-2"]).toContain(activePublishedSiteId);
    });

    it("correctly rejects second business when two businesses compete for the final slot", async () => {
      let remainingLiveSlots = 1;

      const mockSupabase = {
        rpc: vi.fn(async (_funcName: string, _args: { p_site_id: string }) => {
          if (remainingLiveSlots > 0) {
            remainingLiveSlots -= 1;
            return {
              data: [
                {
                  success: true,
                  status: "published",
                  reason: "Site published successfully",
                },
              ],
              error: null,
            };
          } else {
            return {
              data: [
                {
                  success: false,
                  status: "draft",
                  reason: "Capacity limit reached for live_websites",
                },
              ],
              error: null,
            };
          }
        }),
      } as unknown as SupabaseClient<Database>;

      const [resBizA, resBizB] = await Promise.all([
        checkSiteTransitionCapacity(mockSupabase, mockWorkspaceId, "site-biz-a", "published"),
        checkSiteTransitionCapacity(mockSupabase, mockWorkspaceId, "site-biz-b", "published"),
      ]);

      const successes = [resBizA, resBizB].filter((r) => r.allowed);
      const rejections = [resBizA, resBizB].filter((r) => !r.allowed);

      expect(successes).toHaveLength(1);
      expect(rejections).toHaveLength(1);
      expect(rejections[0].reason).toContain("Capacity limit reached for live_websites");
    });

    it("verifies migration SQL enforces exact role-based authorization for publishing", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const sqlContent = fs.readFileSync(
        path.join(
          process.cwd(),
          "supabase",
          "migrations",
          "20261115000001_plans_entitlements_capacity.sql",
        ),
        "utf-8",
      );

      // Authorized roles present
      expect(sqlContent).toContain("owner_user_id = v_caller_id");
      expect(sqlContent).toContain("role = 'workspace_owner'");
      expect(sqlContent).toContain("role IN ('workspace_admin', 'reseller_admin')");
      expect(sqlContent).toContain("v_sovereign_owner_id = v_caller_id");
      expect(sqlContent).toContain("role IN ('owner', 'manager')");

      // Staff roles prohibited from publishing
      expect(sqlContent).not.toContain("'reseller_staff'");
      expect(sqlContent).not.toContain("'cashier'");
      expect(sqlContent).toContain(
        "Access denied: caller does not possess required publishing permissions",
      );
    });

    it("verifies migration SQL enforces archived business cleanup and prevents publishing", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const sqlContent = fs.readFileSync(
        path.join(
          process.cwd(),
          "supabase",
          "migrations",
          "20261115000001_plans_entitlements_capacity.sql",
        ),
        "utf-8",
      );

      // Reject publishing for archived business
      expect(sqlContent).toContain("Cannot publish site for an archived business");
      // Permit archiving/suspending even if business is archived (cleanup)
      expect(sqlContent).toContain("IF p_target_status IN ('archived', 'suspended') THEN");
      expect(sqlContent).toContain("Cannot modify site for an archived business");
    });

    it("verifies migration SQL enforces immutable business_id on public.sites", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const sqlContent = fs.readFileSync(
        path.join(
          process.cwd(),
          "supabase",
          "migrations",
          "20261115000001_plans_entitlements_capacity.sql",
        ),
        "utf-8",
      );

      // Immutability trigger on business_id
      expect(sqlContent).toContain(
        "CREATE OR REPLACE FUNCTION public.prevent_site_business_id_change()",
      );
      expect(sqlContent).toContain(
        "business_id on public.sites is immutable and cannot be modified",
      );
      expect(sqlContent).toContain("BEFORE UPDATE OF business_id ON public.sites");
    });

    it("verifies migration SQL adheres to SECURITY DEFINER best practices", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const sqlContent = fs.readFileSync(
        path.join(
          process.cwd(),
          "supabase",
          "migrations",
          "20261115000001_plans_entitlements_capacity.sql",
        ),
        "utf-8",
      );

      // Empty search_path
      expect(sqlContent).toContain("SET search_path = ''");
      // Does not use current_user as proof of caller identity
      expect(sqlContent).not.toContain("IF current_user NOT IN ('postgres', 'service_role')");
      expect(sqlContent).toContain("session_user NOT IN ('postgres', 'service_role')");
      // Execution privileges revoked from PUBLIC and anon
      expect(sqlContent).toContain(
        "REVOKE ALL ON FUNCTION public.transition_site_status_atomic(UUID, TEXT) FROM PUBLIC, anon;",
      );
      expect(sqlContent).toContain(
        "GRANT EXECUTE ON FUNCTION public.transition_site_status_atomic(UUID, TEXT) TO authenticated, service_role;",
      );
    });

    it("verifies replacement draft capacity rules (PRD §9.2)", async () => {
      // 1. Replacement when draft capacity is available: allowed
      const mockSupabaseAvailable = {
        rpc: vi.fn(async () => ({
          data: [
            {
              success: true,
              status: "published",
              reason: "Site published successfully",
            },
          ],
          error: null,
        })),
      } as unknown as SupabaseClient<Database>;

      const resAvailable = await checkSiteTransitionCapacity(
        mockSupabaseAvailable,
        mockWorkspaceId,
        "site-draft-1",
        "published",
      );
      expect(resAvailable.allowed).toBe(true);

      // 2. Replacement when draft capacity is exactly full: allowed (net-neutral +1 -1 = 0)
      const mockSupabaseFull = {
        rpc: vi.fn(async () => ({
          data: [
            {
              success: true,
              status: "published",
              reason: "Site published successfully",
            },
          ],
          error: null,
        })),
      } as unknown as SupabaseClient<Database>;

      const resFull = await checkSiteTransitionCapacity(
        mockSupabaseFull,
        mockWorkspaceId,
        "site-draft-2",
        "published",
      );
      expect(resFull.allowed).toBe(true);

      // 3. Replacement when workspace is above draft limit following downgrade: rejected
      const mockSupabaseExceeded = {
        rpc: vi.fn(async () => ({
          data: [
            {
              success: false,
              status: "draft",
              reason:
                "Capacity limit reached for draft_websites: workspace exceeds draft allowance",
            },
          ],
          error: null,
        })),
      } as unknown as SupabaseClient<Database>;

      const resExceeded = await checkSiteTransitionCapacity(
        mockSupabaseExceeded,
        mockWorkspaceId,
        "site-draft-3",
        "published",
      );
      expect(resExceeded.allowed).toBe(false);
      expect(resExceeded.reason).toContain("Capacity limit reached for draft_websites");
    });

    it("verifies migration 20261116000001 enforces dedicated custom SQLSTATE codes and row-lock syntax", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const sqlContent = fs.readFileSync(
        path.join(
          process.cwd(),
          "supabase",
          "migrations",
          "20261116000001_harden_capacity_locking_and_sqlstate.sql",
        ),
        "utf-8",
      );

      // Dedicated SQLSTATE codes (VY001 to VY006)
      expect(sqlContent).toContain("USING ERRCODE = 'VY001'"); // Capacity exceeded
      expect(sqlContent).toContain("USING ERRCODE = 'VY002'"); // Invalid business lifecycle
      expect(sqlContent).toContain("USING ERRCODE = 'VY003'"); // Permission denied
      expect(sqlContent).toContain("USING ERRCODE = 'VY004'"); // Tenant boundary violation
      expect(sqlContent).toContain("USING ERRCODE = 'VY005'"); // Invalid plan identifier
      expect(sqlContent).toContain("USING ERRCODE = 'VY006'"); // Immutable field mutation

      // No collision with predefined PostgreSQL codes P0003 or P0004
      expect(sqlContent).not.toContain("USING ERRCODE = 'P0003'");
      expect(sqlContent).not.toContain("USING ERRCODE = 'P0004'");
      expect(sqlContent).not.toContain("USING ERRCODE = 'P0005'");

      // Valid PostgreSQL row-locking syntax: ORDER BY precedes FOR UPDATE
      expect(sqlContent).toContain("ORDER BY id FOR UPDATE");
      expect(sqlContent).not.toContain("FOR UPDATE ORDER BY id");

      // Lock-order inversion elimination: revoke direct status updates
      expect(sqlContent).toContain(
        "REVOKE UPDATE (status) ON public.sites FROM authenticated, anon, PUBLIC;",
      );

      // Trigger guard checking in_atomic_site_transition
      expect(sqlContent).toContain("vyapone.in_atomic_site_transition");

      // Business archival and restoration trigger
      expect(sqlContent).toContain("trg_handle_business_archive_restore");
      expect(sqlContent).toContain(
        "CREATE OR REPLACE FUNCTION public.handle_business_archive_restore_trigger()",
      );
    });
  });
});
